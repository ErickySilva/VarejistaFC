import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { recordAudit } from "../audit";
import { getAuth } from "../auth/auth";
import { assertCan, type RequestContext } from "../auth/session";
import { ServiceError, toServiceError } from "../errors";

// Gestão de contas. Cada função:
//   - confere a permissão do ator, que veio da sessão lida no servidor;
//   - executa a escrita pelo plugin de administração do Better Auth;
//   - grava a auditoria na mesma transação (ADR 0006 e 0011).

export interface Account {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  playerId: number | null;
}

const accountColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  banned: users.banned,
  playerId: users.playerId,
};

type AccountRow = {
  [Key in keyof typeof accountColumns]: (typeof users.$inferSelect)[Key];
};

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: !row.banned,
    playerId: row.playerId,
  };
}

async function findAccountRow(userId: string): Promise<AccountRow> {
  const [row] = await getDb()
    .select(accountColumns)
    .from(users)
    .where(eq(users.id, userId));
  if (!row) throw new ServiceError("NOT_FOUND");
  return row;
}

// Erro amigável para o caso mais comum. A garantia de verdade é o gatilho
// `users_at_least_one_admin`, que confere no COMMIT qualquer que seja o caminho.
async function assertNotLastActiveAdmin(target: AccountRow) {
  if (target.role !== "admin" || target.banned) return;

  const [{ total }] = await getDb()
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.banned, false)));
  if (total <= 1) throw new ServiceError("LAST_ADMIN");
}

async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withTransaction(fn);
  } catch (error) {
    throw toServiceError(error);
  }
}

export async function listAccounts(
  context: RequestContext,
): Promise<Account[]> {
  assertCan(context.actor, { action: "accounts.manage" });

  const rows = await getDb()
    .select(accountColumns)
    .from(users)
    .orderBy(asc(users.name));
  return rows.map(toAccount);
}

export interface CreateAccountInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  playerId: number | null;
}

export async function createAccount(
  context: RequestContext,
  input: CreateAccountInput,
): Promise<Account> {
  assertCan(context.actor, { action: "accounts.manage" });

  return inTransaction(async () => {
    const { user } = await getAuth().api.createUser({
      body: {
        email: input.email,
        name: input.name,
        password: input.password,
        role: input.role,
        data: { playerId: input.playerId },
      },
      headers: context.headers,
    });

    const created = toAccount(await findAccountRow(user.id));
    // A senha nunca entra na auditoria.
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "create",
      entity: "users",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

export async function setAccountRole(
  context: RequestContext,
  input: { userId: string; role: UserRole },
): Promise<Account> {
  assertCan(context.actor, { action: "accounts.manage" });

  return inTransaction(async () => {
    const before = await findAccountRow(input.userId);
    if (input.role !== "admin") await assertNotLastActiveAdmin(before);

    await getAuth().api.setRole({
      body: { userId: input.userId, role: input.role },
      headers: context.headers,
    });

    const after = toAccount(await findAccountRow(input.userId));
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "users",
      entityId: input.userId,
      before: { role: before.role },
      after: { role: after.role },
    });
    return after;
  });
}

// O vínculo com o jogador só muda por aqui, e só por admin. `null` desvincula.
export async function setAccountPlayer(
  context: RequestContext,
  input: { userId: string; playerId: number | null },
): Promise<Account> {
  assertCan(context.actor, { action: "accounts.manage" });

  return inTransaction(async () => {
    const before = await findAccountRow(input.userId);

    await getAuth().api.adminUpdateUser({
      body: { userId: input.userId, data: { playerId: input.playerId } },
      headers: context.headers,
    });

    const after = toAccount(await findAccountRow(input.userId));
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "users",
      entityId: input.userId,
      before: { playerId: before.playerId },
      after: { playerId: after.playerId },
    });
    return after;
  });
}

// Redefine a senha de outra conta e encerra as sessões dela, para que a senha
// antiga deixe de valer em todos os aparelhos.
export async function setAccountPassword(
  context: RequestContext,
  input: { userId: string; newPassword: string },
): Promise<void> {
  assertCan(context.actor, { action: "accounts.manage" });

  await inTransaction(async () => {
    await findAccountRow(input.userId);

    await getAuth().api.setUserPassword({
      body: { userId: input.userId, newPassword: input.newPassword },
      headers: context.headers,
    });
    if (input.userId !== context.actor.userId) {
      await getAuth().api.revokeUserSessions({
        body: { userId: input.userId },
        headers: context.headers,
      });
    }

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "users",
      entityId: input.userId,
      after: { passwordReset: true },
    });
  });
}

// Desativar: a conta não consegue mais entrar e as sessões são encerradas.
export async function deactivateAccount(
  context: RequestContext,
  input: { userId: string },
): Promise<Account> {
  assertCan(context.actor, { action: "accounts.manage" });
  if (input.userId === context.actor.userId) {
    throw new ServiceError("CANNOT_DEACTIVATE_SELF");
  }

  return inTransaction(async () => {
    const before = await findAccountRow(input.userId);
    await assertNotLastActiveAdmin(before);

    await getAuth().api.banUser({
      body: { userId: input.userId, banReason: "Desativada por um admin" },
      headers: context.headers,
    });

    const after = toAccount(await findAccountRow(input.userId));
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "users",
      entityId: input.userId,
      before: { active: !before.banned },
      after: { active: after.active },
    });
    return after;
  });
}

export async function reactivateAccount(
  context: RequestContext,
  input: { userId: string },
): Promise<Account> {
  assertCan(context.actor, { action: "accounts.manage" });

  return inTransaction(async () => {
    const before = await findAccountRow(input.userId);

    await getAuth().api.unbanUser({
      body: { userId: input.userId },
      headers: context.headers,
    });

    const after = toAccount(await findAccountRow(input.userId));
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "users",
      entityId: input.userId,
      before: { active: !before.banned },
      after: { active: after.active },
    });
    return after;
  });
}
