import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { withTransaction } from "@/db";
import { recordAudit } from "@/server/audit";
import { getAuth } from "@/server/auth/auth";
import { createAccount, PASSWORD, signIn } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Conexão independente da aplicação: só enxerga o que foi de fato confirmado
// (commit) no banco.
const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

const FOREIGN_KEY_VIOLATION = "23503";

async function count(table: string, where = sql`true`): Promise<number> {
  const [row] = await sql`
    select count(*)::int as count from ${sql(table)} where ${where}`;
  return row.count;
}

async function userRow(email: string) {
  const [row] = await sql`
    select id, role, banned from users where email = ${email}`;
  return row;
}

// Auditoria que falha de verdade: o autor não existe em `users`, então a
// chave estrangeira de audit_log rejeita a inserção.
function failingAudit(entityId: string) {
  return recordAudit({
    actorUserId: "usuario-inexistente",
    action: "update",
    entity: "users",
    entityId,
  });
}

let adminId: string;
let adminHeaders: Headers;

beforeEach(async () => {
  await resetDatabase(sql);
  adminId = (await createAccount({ email: "admin@test.dev", role: "admin" }))
    .id;
  adminHeaders = await signIn("admin@test.dev");
});

afterAll(async () => {
  await sql.end();
});

describe("operações do Better Auth dentro de withTransaction", () => {
  it("criar usuário: se a auditoria falha, nem o usuário nem a credencial persistem", async () => {
    await expect(
      withTransaction(async () => {
        const { user } = await getAuth().api.createUser({
          body: {
            email: "novo@test.dev",
            name: "Novo",
            password: PASSWORD,
            role: "player",
          },
          headers: adminHeaders,
        });
        await failingAudit(user.id);
      }),
    ).rejects.toMatchObject({ cause: { code: FOREIGN_KEY_VIOLATION } });

    expect(await userRow("novo@test.dev")).toBeUndefined();
    // Só o admin criado no beforeEach existe, com sua única credencial.
    expect(await count("users")).toBe(1);
    expect(await count("accounts")).toBe(1);
    expect(await count("audit_log")).toBe(0);
  });

  it("trocar papel: se a auditoria falha, o papel não muda", async () => {
    const target = await createAccount({ email: "jogador@test.dev" });

    await expect(
      withTransaction(async () => {
        await getAuth().api.setRole({
          body: { userId: target.id, role: "admin" },
          headers: adminHeaders,
        });
        await failingAudit(target.id);
      }),
    ).rejects.toMatchObject({ cause: { code: FOREIGN_KEY_VIOLATION } });

    expect(await userRow("jogador@test.dev")).toMatchObject({ role: "player" });
    expect(await count("audit_log")).toBe(0);
  });

  it("desativar conta: se a transação falha, a conta segue ativa e a sessão permanece", async () => {
    const target = await createAccount({ email: "jogador@test.dev" });
    await signIn("jogador@test.dev");
    const targetSessions = sql`user_id = ${target.id}`;
    expect(await count("sessions", targetSessions)).toBe(1);

    await expect(
      withTransaction(async () => {
        // Duas escritas do plugin: marca a conta e apaga as sessões.
        await getAuth().api.banUser({
          body: { userId: target.id },
          headers: adminHeaders,
        });
        throw new Error("falha proposital depois da operação do plugin");
      }),
    ).rejects.toThrow("falha proposital");

    expect(await userRow("jogador@test.dev")).toMatchObject({ banned: false });
    expect(await count("sessions", targetSessions)).toBe(1);
  });

  it("quando tudo dá certo, a alteração e a auditoria são gravadas juntas", async () => {
    const target = await createAccount({ email: "jogador@test.dev" });

    await withTransaction(async () => {
      await getAuth().api.setRole({
        body: { userId: target.id, role: "admin" },
        headers: adminHeaders,
      });
      await recordAudit({
        actorUserId: adminId,
        action: "update",
        entity: "users",
        entityId: target.id,
        before: { role: "player" },
        after: { role: "admin" },
      });
    });

    expect(await userRow("jogador@test.dev")).toMatchObject({ role: "admin" });
    const [audit] = await sql`
      select actor_user_id, action, entity, entity_id, before, after
      from audit_log`;
    expect(audit).toEqual({
      actor_user_id: adminId,
      action: "update",
      entity: "users",
      entity_id: target.id,
      before: { role: "player" },
      after: { role: "admin" },
    });
  });

  it("controle: fora de withTransaction a mesma falha deixaria a alteração gravada", async () => {
    // Este teste mostra que os anteriores não passam por acaso: sem a
    // transação, a operação do plugin é confirmada antes de a falha acontecer.
    const target = await createAccount({ email: "jogador@test.dev" });

    await getAuth().api.setRole({
      body: { userId: target.id, role: "admin" },
      headers: adminHeaders,
    });

    expect(await userRow("jogador@test.dev")).toMatchObject({ role: "admin" });
  });

  it("transações aninhadas participam da externa", async () => {
    const target = await createAccount({ email: "jogador@test.dev" });

    await expect(
      withTransaction(async () => {
        await withTransaction(async () => {
          await getAuth().api.setRole({
            body: { userId: target.id, role: "admin" },
            headers: adminHeaders,
          });
        });
        throw new Error("falha na transação externa");
      }),
    ).rejects.toThrow("falha na transação externa");

    expect(await userRow("jogador@test.dev")).toMatchObject({ role: "player" });
  });
});

describe("recordAudit", () => {
  it("recusa ser chamado fora de uma transação", async () => {
    await expect(
      recordAudit({
        actorUserId: adminId,
        action: "create",
        entity: "users",
        entityId: adminId,
      }),
    ).rejects.toThrow(/withTransaction/);
    expect(await count("audit_log")).toBe(0);
  });

  it("aceita autor nulo para ações do sistema", async () => {
    await withTransaction(() =>
      recordAudit({
        actorUserId: null,
        action: "create",
        entity: "seasons",
        entityId: 1,
      }),
    );

    const [audit] = await sql`select actor_user_id, entity_id from audit_log`;
    expect(audit).toEqual({ actor_user_id: null, entity_id: "1" });
  });
});
