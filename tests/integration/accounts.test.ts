import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { signIn } from "@/server/auth/service";
import {
  getActorFromHeaders,
  type RequestContext,
} from "@/server/auth/session";
import { setPlayerPhoto } from "@/server/players/service";
import {
  createAccount,
  deactivateAccount,
  listAccounts,
  reactivateAccount,
  setAccountPassword,
  setAccountPlayer,
  setAccountRole,
} from "@/server/users/service";
import {
  createAccount as seedAccount,
  PASSWORD,
  signIn as signInHeaders,
} from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

// Contexto como o de uma requisição real: faz login e resolve o ator a partir
// do cookie, pelo mesmo caminho usado pelas Server Actions.
async function contextFor(email: string): Promise<RequestContext> {
  const headers = await signInHeaders(email);
  const actor = await getActorFromHeaders(headers);
  if (!actor) throw new Error(`Sem sessão para ${email}`);
  return { actor, headers };
}

async function insertPlayer(slug: string, shirtNumber: number) {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position)
    values (${slug}, ${slug}, ${shirtNumber}, 'MC') returning id`;
  return row.id as number;
}

async function audits() {
  return sql`
    select actor_user_id, action, entity, entity_id, before, after
    from audit_log order by id`;
}

async function userRow(id: string) {
  const [row] = await sql`
    select role, banned, player_id from users where id = ${id}`;
  return row;
}

let admin: RequestContext;
let player: RequestContext;
let erickyId: number;
let lucaoId: number;

beforeEach(async () => {
  await resetDatabase(sql);
  erickyId = await insertPlayer("ericky", 7);
  lucaoId = await insertPlayer("lucao", 10);
  await seedAccount({ email: "admin@test.dev", role: "admin" });
  await seedAccount({ email: "jogador@test.dev", playerId: erickyId });
  admin = await contextFor("admin@test.dev");
  player = await contextFor("jogador@test.dev");
});

afterAll(async () => {
  await sql.end();
});

describe("criar conta", () => {
  const input = {
    email: "lucao@test.dev",
    name: "Lucão",
    password: PASSWORD,
    role: "player" as const,
    playerId: null,
  };

  it("admin cria a conta, que consegue entrar, e a auditoria registra o autor", async () => {
    const created = await createAccount(admin, { ...input, playerId: lucaoId });

    expect(created).toEqual({
      id: expect.any(String),
      name: "Lucão",
      email: "lucao@test.dev",
      role: "player",
      active: true,
      playerId: lucaoId,
    });
    await signIn(new Headers(), { email: input.email, password: PASSWORD });

    expect(await audits()).toEqual([
      {
        actor_user_id: admin.actor.userId,
        action: "create",
        entity: "users",
        entity_id: created.id,
        before: null,
        after: created,
      },
    ]);
  });

  it("a senha não aparece na auditoria", async () => {
    await createAccount(admin, input);
    const [{ dump }] = await sql`
      select string_agg(coalesce(before::text, '') || coalesce(after::text, ''), ' ') as dump
      from audit_log`;
    expect(dump).not.toContain(PASSWORD);
  });

  it("player não cria conta", async () => {
    await expect(createAccount(player, input)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(2);
    expect(await audits()).toEqual([]);
  });

  it("e-mail repetido é recusado", async () => {
    await expect(
      createAccount(admin, { ...input, email: "jogador@test.dev" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(await audits()).toEqual([]);
  });

  it("jogador já vinculado a outra conta: recusa e não deixa conta pela metade", async () => {
    await expect(
      createAccount(admin, { ...input, playerId: erickyId }),
    ).rejects.toMatchObject({ code: "PLAYER_ALREADY_LINKED" });

    const [{ count }] = await sql`
      select count(*)::int as count from users where email = ${input.email}`;
    expect(count).toBe(0);
    expect(await audits()).toEqual([]);
  });
});

describe("vínculo com jogador", () => {
  it("admin vincula e desvincula, com auditoria", async () => {
    const linked = await setAccountPlayer(admin, {
      userId: admin.actor.userId,
      playerId: lucaoId,
    });
    expect(linked.playerId).toBe(lucaoId);

    const unlinked = await setAccountPlayer(admin, {
      userId: admin.actor.userId,
      playerId: null,
    });
    expect(unlinked.playerId).toBeNull();

    expect(await audits()).toMatchObject([
      { before: { playerId: null }, after: { playerId: lucaoId } },
      { before: { playerId: lucaoId }, after: { playerId: null } },
    ]);
  });

  it("um jogador não pode ser vinculado a duas contas", async () => {
    await expect(
      setAccountPlayer(admin, {
        userId: admin.actor.userId,
        playerId: erickyId,
      }),
    ).rejects.toMatchObject({ code: "PLAYER_ALREADY_LINKED" });
    expect((await userRow(admin.actor.userId)).player_id).toBeNull();
    expect(await audits()).toEqual([]);
  });

  it("o banco também impede o vínculo duplicado", async () => {
    await expect(
      sql`update users set player_id = ${erickyId} where id = ${admin.actor.userId}`,
    ).rejects.toMatchObject({ constraint_name: "users_player_id_unique" });
  });

  it("player não altera vínculo, nem o próprio", async () => {
    await expect(
      setAccountPlayer(player, {
        userId: player.actor.userId,
        playerId: lucaoId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await userRow(player.actor.userId)).player_id).toBe(erickyId);
  });
});

describe("papel", () => {
  it("admin promove um player, com auditoria", async () => {
    const updated = await setAccountRole(admin, {
      userId: player.actor.userId,
      role: "admin",
    });

    expect(updated.role).toBe("admin");
    expect(await audits()).toMatchObject([
      {
        actor_user_id: admin.actor.userId,
        entity_id: player.actor.userId,
        before: { role: "player" },
        after: { role: "admin" },
      },
    ]);
  });

  it("player não troca papel, nem o próprio", async () => {
    await expect(
      setAccountRole(player, { userId: player.actor.userId, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await userRow(player.actor.userId)).role).toBe("player");
  });

  it("o último admin não pode ser rebaixado", async () => {
    await expect(
      setAccountRole(admin, { userId: admin.actor.userId, role: "player" }),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
    expect((await userRow(admin.actor.userId)).role).toBe("admin");
    expect(await audits()).toEqual([]);
  });

  it("com dois admins, um pode rebaixar o outro, mas não os dois", async () => {
    await setAccountRole(admin, { userId: player.actor.userId, role: "admin" });
    await setAccountRole(admin, { userId: admin.actor.userId, role: "player" });
    expect((await userRow(admin.actor.userId)).role).toBe("player");

    // O ex-admin perdeu o acesso de gestão na mesma hora.
    const former = await contextFor("admin@test.dev");
    await expect(
      setAccountRole(former, { userId: player.actor.userId, role: "player" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const remaining = await contextFor("jogador@test.dev");
    await expect(
      setAccountRole(remaining, {
        userId: remaining.actor.userId,
        role: "player",
      }),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
  });
});

describe("desativar e reativar", () => {
  it("conta desativada perde as sessões e não consegue entrar", async () => {
    const result = await deactivateAccount(admin, {
      userId: player.actor.userId,
    });

    expect(result.active).toBe(false);
    expect(await getActorFromHeaders(player.headers)).toBeNull();
    const [{ count }] = await sql`
      select count(*)::int as count from sessions
      where user_id = ${player.actor.userId}`;
    expect(count).toBe(0);
    await expect(
      signIn(new Headers(), { email: "jogador@test.dev", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });

    expect(await audits()).toMatchObject([
      { before: { active: true }, after: { active: false } },
    ]);
  });

  it("reativar devolve o acesso", async () => {
    await deactivateAccount(admin, { userId: player.actor.userId });
    const result = await reactivateAccount(admin, {
      userId: player.actor.userId,
    });

    expect(result.active).toBe(true);
    await signIn(new Headers(), {
      email: "jogador@test.dev",
      password: PASSWORD,
    });
  });

  it("admin não desativa a própria conta", async () => {
    await expect(
      deactivateAccount(admin, { userId: admin.actor.userId }),
    ).rejects.toMatchObject({ code: "CANNOT_DEACTIVATE_SELF" });
    expect((await userRow(admin.actor.userId)).banned).toBe(false);
  });

  it("o último admin ativo não pode ser desativado por outro caminho", async () => {
    // Segundo admin desativa o primeiro; depois ninguém pode desativar o que
    // restou, e o banco barra a tentativa direta.
    await setAccountRole(admin, { userId: player.actor.userId, role: "admin" });
    const second = await contextFor("jogador@test.dev");
    await deactivateAccount(second, { userId: admin.actor.userId });

    await expect(
      sql`update users set banned = true where id = ${second.actor.userId}`,
    ).rejects.toMatchObject({ constraint_name: "users_at_least_one_admin" });
    expect((await userRow(second.actor.userId)).banned).toBe(false);
  });

  it("player não desativa contas", async () => {
    await expect(
      deactivateAccount(player, { userId: admin.actor.userId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await userRow(admin.actor.userId)).banned).toBe(false);
  });
});

describe("redefinir senha de outra conta", () => {
  it("a senha nova passa a valer, a antiga deixa de valer e as sessões são encerradas", async () => {
    await setAccountPassword(admin, {
      userId: player.actor.userId,
      newPassword: "senha-redefinida-789",
    });

    expect(await getActorFromHeaders(player.headers)).toBeNull();
    await expect(
      signIn(new Headers(), { email: "jogador@test.dev", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await signIn(new Headers(), {
      email: "jogador@test.dev",
      password: "senha-redefinida-789",
    });

    expect(await audits()).toMatchObject([
      {
        actor_user_id: admin.actor.userId,
        entity_id: player.actor.userId,
        after: { passwordReset: true },
      },
    ]);
  });

  it("player não redefine senha de ninguém", async () => {
    await expect(
      setAccountPassword(player, {
        userId: admin.actor.userId,
        newPassword: "senha-redefinida-789",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await signIn(new Headers(), {
      email: "admin@test.dev",
      password: PASSWORD,
    });
  });
});

describe("listar contas", () => {
  it("admin lista as contas sem dados de credencial", async () => {
    const accounts = await listAccounts(admin);

    expect(accounts.map((account) => account.email)).toEqual([
      "admin@test.dev",
      "jogador@test.dev",
    ]);
    expect(Object.keys(accounts[0]).sort()).toEqual([
      "active",
      "email",
      "id",
      "name",
      "playerId",
      "role",
    ]);
  });

  it("player não lista contas", async () => {
    await expect(listAccounts(player)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("foto do jogador", () => {
  it("player altera a foto do próprio jogador, com auditoria", async () => {
    await setPlayerPhoto(player, {
      playerId: erickyId,
      photoUrl: "/fotos/ericky.png",
    });

    const [row] = await sql`
      select photo_url from players where id = ${erickyId}`;
    expect(row.photo_url).toBe("/fotos/ericky.png");
    expect(await audits()).toEqual([
      {
        actor_user_id: player.actor.userId,
        action: "update",
        entity: "players",
        entity_id: String(erickyId),
        before: { photoUrl: null },
        after: { photoUrl: "/fotos/ericky.png" },
      },
    ]);
  });

  it("player não altera a foto de outro jogador", async () => {
    await expect(
      setPlayerPhoto(player, { playerId: lucaoId, photoUrl: "/fotos/x.png" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const [row] =
      await sql`select photo_url from players where id = ${lucaoId}`;
    expect(row.photo_url).toBeNull();
    expect(await audits()).toEqual([]);
  });

  it("admin altera a foto de qualquer jogador", async () => {
    await setPlayerPhoto(admin, {
      playerId: lucaoId,
      photoUrl: "/fotos/l.png",
    });
    const [row] =
      await sql`select photo_url from players where id = ${lucaoId}`;
    expect(row.photo_url).toBe("/fotos/l.png");
  });

  it("jogador inexistente: NOT_FOUND e nada é auditado", async () => {
    await expect(
      setPlayerPhoto(admin, { playerId: 9999, photoUrl: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await audits()).toEqual([]);
  });
});

describe("integridade da auditoria", () => {
  it("usuário com registro de auditoria não pode ser apagado", async () => {
    await setAccountRole(admin, { userId: player.actor.userId, role: "admin" });

    await expect(
      sql`delete from users where id = ${admin.actor.userId}`,
    ).rejects.toMatchObject({
      constraint_name: "audit_log_actor_user_id_users_id_fk",
    });
  });

  it("autor inexistente é rejeitado pelo banco", async () => {
    await expect(
      sql`insert into audit_log (actor_user_id, action, entity, entity_id)
          values ('nao-existe', 'create', 'users', '1')`,
    ).rejects.toMatchObject({
      constraint_name: "audit_log_actor_user_id_users_id_fk",
    });
  });
});
