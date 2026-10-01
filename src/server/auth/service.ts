import "server-only";
import { withTransaction } from "@/db";
import { recordAudit } from "../audit";
import { toServiceError } from "../errors";
import { getAuth } from "./auth";
import { assertCan, type RequestContext } from "./session";

// Entrar, sair e trocar a própria senha. A sessão fica no banco e o cookie é
// gravado pelo Better Auth (HTTP-only).

export async function signIn(
  headers: Headers,
  input: { email: string; password: string },
): Promise<void> {
  try {
    await getAuth().api.signInEmail({ body: input, headers });
  } catch (error) {
    throw toServiceError(error);
  }
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
