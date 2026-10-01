import { getAuthTables } from "better-auth/db";
import { getTableColumns } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { getAuth } from "@/server/auth/auth";
import { changeOwnPassword, signIn, signOut } from "@/server/auth/service";
import { getActorFromHeaders } from "@/server/auth/session";
import {
  createAccount,
  PASSWORD,
  signIn as signInHeaders,
} from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

const EMAIL = "admin@test.dev";

// Chamada HTTP de verdade às rotas do Better Auth, como um cliente externo.
function httpPost(path: string, body: unknown, headers?: Headers) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  requestHeaders.set("origin", "http://localhost:3000");
  return getAuth().handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(body),
    }),
  );
}

let adminId: string;

beforeEach(async () => {
  await resetDatabase(sql);
  adminId = (await createAccount({ email: EMAIL, role: "admin" })).id;
});

afterAll(async () => {
  await sql.end();
});

describe("schema", () => {
  it("o schema do Drizzle tem todos os campos que o Better Auth espera", () => {
    const drizzleTables = {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    };
    const expected = getAuthTables(getAuth().options);

    expect(Object.keys(expected).sort()).toEqual(
      Object.keys(drizzleTables).sort(),
    );
    for (const [model, table] of Object.entries(expected)) {
      const columns = Object.keys(
        getTableColumns(drizzleTables[model as keyof typeof drizzleTables]),
      );
      expect(columns, `tabela ${model}`).toEqual(
        expect.arrayContaining(["id", ...Object.keys(table.fields)]),
      );
    }
  });
});

describe("login", () => {
  it("senha certa cria uma sessão no banco, com cookie HTTP-only e validade de 30 dias", async () => {
    const { headers } = await getAuth().api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      returnHeaders: true,
    });

    const sessionCookie = headers
      .getSetCookie()
      .find((cookie) => cookie.includes("session_token"));
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);

    const [session] = await sql`
      select user_id,
        extract(epoch from (expires_at - now())) / 86400 as days_left
      from sessions`;
    expect(session.user_id).toBe(adminId);
    expect(Number(session.days_left)).toBeGreaterThan(29.9);
    expect(Number(session.days_left)).toBeLessThanOrEqual(30);
  });

  it("senha errada é recusada e não cria sessão", async () => {
    await expect(
      signIn(new Headers(), { email: EMAIL, password: "senha-errada" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    const [{ count }] = await sql`select count(*)::int as count from sessions`;
    expect(count).toBe(0);
  });

  it("e-mail desconhecido recebe a mesma resposta de senha errada", async () => {
    await expect(
      signIn(new Headers(), { email: "ninguem@test.dev", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("a sessão identifica o ator com papel e jogador lidos do banco", async () => {
    const [player] = await sql`
      insert into players (slug, name, shirt_number, default_position)
      values ('ericky', 'Ericky', 7, 'MEI') returning id`;
    await createAccount({ email: "ericky@test.dev", playerId: player.id });
    const headers = await signInHeaders("ericky@test.dev");

    expect(await getActorFromHeaders(headers)).toEqual({
      userId: expect.any(String),
      role: "player",
      playerId: player.id,
      name: "ericky@test.dev",
      email: "ericky@test.dev",
    });

    // Mudança de papel feita no banco vale já na requisição seguinte.
    await sql`update users set role = 'admin' where email = 'ericky@test.dev'`;
    expect(await getActorFromHeaders(headers)).toMatchObject({ role: "admin" });
  });

  it("sem cookie ou com cookie inválido não há ator", async () => {
    expect(await getActorFromHeaders(new Headers())).toBeNull();
    expect(
      await getActorFromHeaders(
        new Headers({ cookie: "better-auth.session_token=forjado.assinatura" }),
      ),
    ).toBeNull();
  });

  it("sair encerra a sessão", async () => {
    const headers = await signInHeaders(EMAIL);
    expect(await getActorFromHeaders(headers)).not.toBeNull();

    await signOut(headers);

    expect(await getActorFromHeaders(headers)).toBeNull();
    const [{ count }] = await sql`select count(*)::int as count from sessions`;
    expect(count).toBe(0);
  });
});

describe("cadastro público e rotas HTTP desabilitadas", () => {
  it("cadastro pela API é recusado", async () => {
    await expect(
      getAuth().api.signUpEmail({
        body: { email: "novo@test.dev", password: PASSWORD, name: "Novo" },
      }),
    ).rejects.toThrow();

    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(1);
  });

  it("cadastro por HTTP responde 404", async () => {
    const response = await httpPost("/sign-up/email", {
      email: "novo@test.dev",
      password: PASSWORD,
      name: "Novo",
    });
    expect(response.status).toBe(404);
  });

  it("rotas de administração respondem 404 por HTTP, mesmo para um admin logado", async () => {
    const adminHeaders = await signInHeaders(EMAIL);
    const target = await createAccount({ email: "jogador@test.dev" });

    const attempts: [string, unknown][] = [
      ["/admin/set-role", { userId: target.id, role: "admin" }],
      ["/admin/ban-user", { userId: target.id }],
      [
        "/admin/set-user-password",
        { userId: target.id, newPassword: PASSWORD },
      ],
      ["/admin/update-user", { userId: target.id, data: { name: "x" } }],
      [
        "/admin/create-user",
        { email: "x@test.dev", name: "x", password: PASSWORD },
      ],
      ["/admin/remove-user", { userId: target.id }],
      ["/admin/impersonate-user", { userId: target.id }],
      ["/update-user", { name: "x" }],
    ];
    for (const [path, body] of attempts) {
      const response = await httpPost(path, body, adminHeaders);
      expect(response.status, path).toBe(404);
    }

    const [row] = await sql`
      select role, banned, name from users where id = ${target.id}`;
    expect(row).toEqual({
      role: "player",
      banned: false,
      name: "jogador@test.dev",
    });
  });

  it("login por HTTP continua funcionando", async () => {
    const response = await httpPost("/sign-in/email", {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(response.status).toBe(200);
  });

  it("personificação e remoção são recusadas também em chamadas no servidor", async () => {
    const adminHeaders = await signInHeaders(EMAIL);
    const target = await createAccount({ email: "jogador@test.dev" });

    await expect(
      getAuth().api.impersonateUser({
        body: { userId: target.id },
        headers: adminHeaders,
      }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
    await expect(
      getAuth().api.removeUser({
        body: { userId: target.id },
        headers: adminHeaders,
      }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });

    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(2);
  });

  it("o cliente não consegue definir o próprio papel nem o vínculo com jogador", async () => {
    await createAccount({ email: "jogador@test.dev" });
    const headers = await signInHeaders("jogador@test.dev");

    // Chamada no servidor à rota de atualizar a própria conta, com campos que
    // são exclusivos do servidor.
    await expect(
      getAuth().api.updateUser({
        body: { name: "Novo nome", role: "admin", playerId: 1 } as never,
        headers,
      }),
    ).rejects.toThrow();

    const [row] = await sql`
      select role, player_id from users where email = 'jogador@test.dev'`;
    expect(row).toEqual({ role: "player", player_id: null });
  });
});

describe("troca da própria senha", () => {
  it("troca a senha, audita e encerra as outras sessões", async () => {
    const headers = await signInHeaders(EMAIL);
    const otherDevice = await signInHeaders(EMAIL);
    const actor = await getActorFromHeaders(headers);

    await changeOwnPassword(
      { actor: actor!, headers },
      { currentPassword: PASSWORD, newPassword: "nova-senha-456" },
    );

    await expect(
      signIn(new Headers(), { email: EMAIL, password: PASSWORD }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await signIn(new Headers(), { email: EMAIL, password: "nova-senha-456" });
    expect(await getActorFromHeaders(otherDevice)).toBeNull();

    const [audit] = await sql`
      select actor_user_id, action, entity, entity_id, after from audit_log`;
    expect(audit).toEqual({
      actor_user_id: adminId,
      action: "update",
      entity: "users",
      entity_id: adminId,
      after: { passwordChanged: true },
    });
  });

  it("senha atual errada: nada muda e nada é auditado", async () => {
    const headers = await signInHeaders(EMAIL);
    const actor = await getActorFromHeaders(headers);

    await expect(
      changeOwnPassword(
        { actor: actor!, headers },
        { currentPassword: "errada", newPassword: "nova-senha-456" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    await signIn(new Headers(), { email: EMAIL, password: PASSWORD });
    const [{ count }] = await sql`select count(*)::int as count from audit_log`;
    expect(count).toBe(0);
  });
});
