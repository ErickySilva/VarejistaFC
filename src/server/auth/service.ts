import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { players, users } from "@/db/schema";
import { recordAudit } from "../audit";
import { ServiceError, toServiceError } from "../errors";
import {
  attemptKey,
  clearFailures,
  isBlocked,
  recordFailure,
} from "./attempts";
import { getAuth } from "./auth";
import { assertCan, type RequestContext } from "./session";

// Entrar, sair e trocar a própria senha. A sessão fica no banco e o cookie é
// gravado pelo Better Auth (HTTP-only).

// Login com e-mail e senha, com limite de tentativas erradas por origem e
// conta. `target` identifica a conta no contador (e-mail ou slug do jogador).
async function signInWithLimit(
  headers: Headers,
  target: string,
  credentials: { email: string; password: string },
): Promise<void> {
  const key = attemptKey(headers, target);
  if (isBlocked(key)) throw new ServiceError("TOO_MANY_ATTEMPTS");

  try {
    await getAuth().api.signInEmail({ body: credentials, headers });
  } catch (error) {
    const known = toServiceError(error);
    if (known instanceof ServiceError && known.code === "INVALID_CREDENTIALS") {
      recordFailure(key);
    }
    throw known;
  }
  clearFailures(key);
}

export async function signIn(
  headers: Headers,
  input: { email: string; password: string },
): Promise<void> {
  await signInWithLimit(headers, input.email, input);
}

// Entrada pelo tile do jogador: autentica a conta vinculada àquele jogador.
// O e-mail da conta nunca sai do servidor. Depois do login a sessão já sabe
// qual é o jogador, pelo vínculo da conta (users.player_id).
export async function signInAsPlayer(
  headers: Headers,
  input: { playerSlug: string; password: string },
): Promise<void> {
  const [account] = await getDb()
    .select({ email: users.email })
    .from(users)
    .innerJoin(players, eq(players.id, users.playerId))
    .where(and(eq(players.slug, input.playerSlug), eq(players.isActive, true)));
  if (!account) throw new ServiceError("PLAYER_WITHOUT_ACCOUNT");

  await signInWithLimit(headers, input.playerSlug, {
    email: account.email,
    password: input.password,
  });
}

export async function signOut(headers: Headers): Promise<void> {
  try {
    await getAuth().api.signOut({ headers });
  } catch (error) {
    throw toServiceError(error);
  }
}

// Troca a senha de quem está logado, conferindo a senha atual, e encerra as
// outras sessões da conta.
export async function changeOwnPassword(
  context: RequestContext,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  assertCan(context.actor, { action: "account.self" });

  try {
    await withTransaction(async () => {
      await getAuth().api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        headers: context.headers,
      });

      await recordAudit({
        actorUserId: context.actor.userId,
        action: "update",
        entity: "users",
        entityId: context.actor.userId,
        after: { passwordChanged: true },
      });
    });
  } catch (error) {
    throw toServiceError(error);
  }
}
