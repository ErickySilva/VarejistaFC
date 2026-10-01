import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signIn } from "@/server/auth/service";
import { createFirstAdmin } from "@/server/users/first-admin";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

const input = {
  email: "ericky@test.dev",
  name: "Ericky",
  password: "senha-do-admin-123",
};

beforeEach(async () => {
  await resetDatabase(sql);
  await sql`
    insert into players (slug, name, shirt_number, default_position)
    values ('ericky', 'Ericky', 7, 'MEI')`;
});

afterAll(async () => {
  await sql.end();
});

describe("primeiro admin", () => {
  it("cria o admin vinculado ao jogador, que consegue entrar", async () => {
    const result = await createFirstAdmin({ ...input, playerSlug: "ericky" });

    expect(result).toEqual({ created: true, userId: expect.any(String) });
    const [user] = await sql`
      select u.email, u.role, u.banned, p.slug
      from users u left join players p on p.id = u.player_id`;
    expect(user).toEqual({
      email: "ericky@test.dev",
      role: "admin",
      banned: false,
      slug: "ericky",
    });
    await signIn(new Headers(), {
      email: input.email,
      password: input.password,
    });
  });

  it("registra a criação na auditoria como ação do sistema, sem a senha", async () => {
    await createFirstAdmin(input);

    const [audit] = await sql`
      select actor_user_id, action, entity, after from audit_log`;
    expect(audit).toMatchObject({
      actor_user_id: null,
      action: "create",
      entity: "users",
      after: { email: "ericky@test.dev", role: "admin" },
    });
    expect(JSON.stringify(audit.after)).not.toContain(input.password);
  });

  it("é idempotente: executar de novo não cria nem altera nada", async () => {
    await createFirstAdmin(input);

    const again = await createFirstAdmin({
      ...input,
      password: "outra-senha-456",
    });

    expect(again).toEqual({ created: false, reason: "admin-exists" });
    const [{ users, audits }] = await sql`
      select (select count(*)::int from users) as users,
             (select count(*)::int from audit_log) as audits`;
    expect({ users, audits }).toEqual({ users: 1, audits: 1 });
    // A senha original continua valendo.
    await signIn(new Headers(), {
      email: input.email,
      password: input.password,
    });
  });

  it("não cria um segundo admin com outro e-mail", async () => {
    await createFirstAdmin(input);

    const other = await createFirstAdmin({ ...input, email: "outro@test.dev" });

    expect(other).toEqual({ created: false, reason: "admin-exists" });
    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(1);
  });

  it("jogador inexistente: falha e não deixa conta criada", async () => {
    await expect(
      createFirstAdmin({ ...input, playerSlug: "ninguem" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(0);
  });
});
