import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { players, users } from "@/db/schema";
import { recordAudit } from "../audit";
import { getAuth } from "../auth/auth";
import { ServiceError, toServiceError } from "../errors";

export interface FirstAdminInput {
  email: string;
  name: string;
  password: string;
  // Slug do jogador a vincular à conta, se houver.
  playerSlug?: string | null;
}

export type FirstAdminResult =
  | { created: true; userId: string }
  | { created: false; reason: "admin-exists" };

// Cria o primeiro admin do sistema. Só funciona enquanto não existe nenhum
// admin ativo: depois disso, novas contas são criadas por um admin logado.
// Executar de novo não altera nada, nem a senha de uma conta existente.
//
// Não há sessão aqui; a auditoria registra o autor como nulo (ação do sistema).
export async function createFirstAdmin(
  input: FirstAdminInput,
): Promise<FirstAdminResult> {
  try {
    return await withTransaction(async () => {
      const [existingAdmin] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.banned, false)))
        .limit(1);
      if (existingAdmin) return { created: false, reason: "admin-exists" };

      let playerId: number | null = null;
      if (input.playerSlug) {
        const [player] = await getDb()
          .select({ id: players.id })
          .from(players)
          .where(eq(players.slug, input.playerSlug));
        if (!player) {
          throw new ServiceError(
            "NOT_FOUND",
            `Jogador "${input.playerSlug}" não encontrado.`,
          );
        }
        playerId = player.id;
      }

      const { user } = await getAuth().api.createUser({
        body: {
          email: input.email,
          name: input.name,
          password: input.password,
          role: "admin",
          data: { playerId },
        },
      });

      await recordAudit({
        actorUserId: null,
        action: "create",
        entity: "users",
        entityId: user.id,
        after: {
          email: user.email,
          name: user.name,
          role: "admin",
          playerId,
          source: "create-first-admin",
        },
      });

      return { created: true, userId: user.id };
    });
  } catch (error) {
    throw toServiceError(error);
  }
}
