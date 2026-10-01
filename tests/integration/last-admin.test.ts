import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Testa o gatilho do banco diretamente, com SQL, sem passar pela aplicação:
// ele é a última barreira, qualquer que seja o caminho da escrita.
const sql = postgres(getTestDatabaseUrl(), { max: 4, onnotice: () => {} });

type Db = postgres.Sql | postgres.TransactionSql;

async function insertUser(
  db: Db,
  id: string,
  role: "admin" | "player",
  banned = false,
) {
  await db`
    insert into users (id, name, email, role, banned)
    values (${id}, ${id}, ${`${id}@test.dev`}, ${role}, ${banned})`;
}

const setRole = (db: Db, id: string, role: "admin" | "player") =>
  db`update users set role = ${role} where id = ${id}`;

const setBanned = (db: Db, id: string, banned: boolean) =>
  db`update users set banned = ${banned} where id = ${id}`;

async function activeAdmins(): Promise<string[]> {
  const rows = await sql`
    select id from users where role = 'admin' and not banned order by id`;
  return rows.map((row) => row.id);
}

async function expectLastAdminViolation(operation: () => Promise<unknown>) {
  await expect(operation()).rejects.toMatchObject({
    code: "23514",
    constraint_name: "users_at_least_one_admin",
  });
}

beforeEach(async () => {
  await resetDatabase(sql);
});

afterAll(async () => {
  await sql.end();
});

describe("banco sem nenhum admin", () => {
  it("a primeira conta não pode ser um player", async () => {
    await expectLastAdminViolation(() => insertUser(sql, "a", "player"));
    const [{ count }] = await sql`select count(*)::int as count from users`;
    expect(count).toBe(0);
  });

  it("a primeira conta não pode ser um admin desativado", async () => {
    await expectLastAdminViolation(() => insertUser(sql, "a", "admin", true));
  });

  it("aceita criar o primeiro admin", async () => {
    await insertUser(sql, "a", "admin");
    expect(await activeAdmins()).toEqual(["a"]);
  });

  it("aceita criar player e admin na mesma transação, em qualquer ordem", async () => {
    await sql.begin(async (tx) => {
      await insertUser(tx, "p", "player");
      await insertUser(tx, "a", "admin");
    });
    expect(await activeAdmins()).toEqual(["a"]);
  });
});

describe("com um único admin", () => {
  beforeEach(async () => {
    await insertUser(sql, "a", "admin");
    await insertUser(sql, "p", "player");
  });

  it("não pode ser rebaixado", async () => {
    await expectLastAdminViolation(() => setRole(sql, "a", "player"));
    expect(await activeAdmins()).toEqual(["a"]);
  });

  it("não pode ser desativado", async () => {
    await expectLastAdminViolation(() => setBanned(sql, "a", true));
    expect(await activeAdmins()).toEqual(["a"]);
  });

  it("não pode ser apagado", async () => {
    await expectLastAdminViolation(() => sql`delete from users where id = 'a'`);
    expect(await activeAdmins()).toEqual(["a"]);
  });

  it("alterações que não tocam em papel nem desativação continuam livres", async () => {
    await sql`update users set name = 'Novo nome' where id = 'a'`;
    await setBanned(sql, "p", true);
    await sql`delete from users where id = 'p'`;
    expect(await activeAdmins()).toEqual(["a"]);
  });

  it("uma transação pode promover outro admin e rebaixar o anterior", async () => {
    await sql.begin(async (tx) => {
      await setRole(tx, "p", "admin");
      await setRole(tx, "a", "player");
    });
    expect(await activeAdmins()).toEqual(["p"]);
  });

  it("a ordem dentro da transação não importa: rebaixar antes de promover também vale", async () => {
    await sql.begin(async (tx) => {
      // Por um instante a transação fica sem admin; o que conta é o COMMIT.
      await setRole(tx, "a", "player");
      await setRole(tx, "p", "admin");
    });
    expect(await activeAdmins()).toEqual(["p"]);
  });

  it("uma transação pode criar um novo admin e desativar o anterior", async () => {
    await sql.begin(async (tx) => {
      await insertUser(tx, "b", "admin");
      await setBanned(tx, "a", true);
    });
    expect(await activeAdmins()).toEqual(["b"]);
  });

  it("promover um admin que está desativado não conta", async () => {
    await setBanned(sql, "p", true);
    await expectLastAdminViolation(() =>
      sql.begin(async (tx) => {
        await setRole(tx, "p", "admin");
        await setRole(tx, "a", "player");
      }),
    );
    expect(await activeAdmins()).toEqual(["a"]);
  });

  it("a transação rejeitada é desfeita por inteiro", async () => {
    await expectLastAdminViolation(() =>
      sql.begin(async (tx) => {
        await tx`update users set name = 'alterado' where id = 'p'`;
        await setRole(tx, "a", "player");
      }),
    );
    const [player] = await sql`select name from users where id = 'p'`;
    expect(player.name).toBe("p");
  });
});

describe("com dois admins", () => {
  beforeEach(async () => {
    await sql.begin(async (tx) => {
      await insertUser(tx, "a", "admin");
      await insertUser(tx, "b", "admin");
    });
  });

  it("um deles pode ser rebaixado; o que sobra não pode", async () => {
    await setRole(sql, "a", "player");
    expect(await activeAdmins()).toEqual(["b"]);

    await expectLastAdminViolation(() => setRole(sql, "b", "player"));
    expect(await activeAdmins()).toEqual(["b"]);
  });

  it("rebaixar os dois na mesma transação é rejeitado", async () => {
    await expectLastAdminViolation(() =>
      sql.begin(async (tx) => {
        await setRole(tx, "a", "player");
        await setRole(tx, "b", "player");
      }),
    );
    expect(await activeAdmins()).toEqual(["a", "b"]);
  });

  it("duas transações simultâneas não conseguem rebaixar um admin cada", async () => {
    // Cada transação rebaixa um admin diferente e espera, para que as duas
    // estejam abertas ao mesmo tempo, cada uma enxergando o outro como admin.
    const demote = (id: string) =>
      sql.begin(async (tx) => {
        await setRole(tx, id, "player");
        await tx`select pg_sleep(0.4)`;
      });

    const results = await Promise.allSettled([demote("a"), demote("b")]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: { constraint_name: "users_at_least_one_admin" },
    });
    expect(await activeAdmins()).toHaveLength(1);
  });
});
