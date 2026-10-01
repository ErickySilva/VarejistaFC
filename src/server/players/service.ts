import "server-only";
import { eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { players } from "@/db/schema";
import { recordAudit } from "../audit";
import { assertCan, type RequestContext } from "../auth/session";
import { ServiceError } from "../errors";

// Foto do jogador. Um `player` só altera a do jogador vinculado à própria
// conta; nome, número e posição padrão são exclusivos de admin e não passam
// por esta função.
export async function setPlayerPhoto(
  context: RequestContext,
  input: { playerId: number; photoUrl: string | null },
): Promise<void> {
  assertCan(context.actor, {
    action: "players.edit-photo",
    playerId: input.playerId,
  });

  await withTransaction(async () => {
    const [before] = await getDb()
      .select({ photoUrl: players.photoUrl })
      .from(players)
      .where(eq(players.id, input.playerId));
    if (!before) throw new ServiceError("NOT_FOUND");

    await getDb()
      .update(players)
      .set({ photoUrl: input.photoUrl })
      .where(eq(players.id, input.playerId));

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "players",
      entityId: input.playerId,
      before: { photoUrl: before.photoUrl },
      after: { photoUrl: input.photoUrl },
    });
  });
}
