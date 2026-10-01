import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { players } from "@/db/schema";

// Dados públicos mínimos para ligar um jogador ao seu perfil e à sua foto.

export interface PlayerLink {
  slug: string;
  photoUrl: string | null;
}

export async function getPlayerPhotos(
  playerIds: number[],
): Promise<Map<number, PlayerLink>> {
  if (playerIds.length === 0) return new Map();

  const rows = await getDb()
    .select({ id: players.id, slug: players.slug, photoUrl: players.photoUrl })
    .from(players)
    .where(inArray(players.id, playerIds));
  return new Map(
    rows.map((row) => [row.id, { slug: row.slug, photoUrl: row.photoUrl }]),
  );
}

// Slug do jogador ligado a uma conta, para levar o usuário ao próprio perfil.
export async function getPlayerSlug(playerId: number): Promise<string | null> {
  const [row] = await getDb()
    .select({ slug: players.slug })
    .from(players)
    .where(eq(players.id, playerId));
  return row?.slug ?? null;
}
