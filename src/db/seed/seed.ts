import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { legacyStats, nicknames, players, seasons } from "../schema";
import { LEGACY_SEASON_SLUG, SEED_PLAYERS, SEED_SEASONS } from "./data";

export interface SeedResult {
  seasons: number;
  players: number;
  legacyStats: number;
  nicknames: number;
}

// Insere os dados iniciais que ainda não existem e não altera nada que já
// exista. Pode ser executado quantas vezes for preciso: nunca duplica linhas e
// nunca sobrescreve correções feitas depois (em especial em legacy_stats).
export async function seed(
  db: PostgresJsDatabase<Record<string, unknown>>,
): Promise<SeedResult> {
  return db.transaction(async (tx) => {
    // Uma temporada por vez: se já existir outra temporada ativa, a do seed
    // esbarra no índice de temporada única e é ignorada.
    let insertedSeasons = 0;
    for (const season of SEED_SEASONS) {
      const inserted = await tx
        .insert(seasons)
        .values(season)
        .onConflictDoNothing()
        .returning({ id: seasons.id });
      insertedSeasons += inserted.length;
    }
    const [legacySeason] = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.slug, LEGACY_SEASON_SLUG));

    const insertedPlayers = await tx
      .insert(players)
      .values(
        SEED_PLAYERS.map(
          ({ slug, name, shirtNumber, defaultPosition, photoUrl }) => ({
            slug,
            name,
            shirtNumber,
            defaultPosition,
            photoUrl,
          }),
        ),
      )
      .onConflictDoNothing()
      .returning({ id: players.id });

    const existing = await tx
      .select({ id: players.id, slug: players.slug })
      .from(players)
      .where(
        inArray(
          players.slug,
          SEED_PLAYERS.map((player) => player.slug),
        ),
      );
    const idBySlug = new Map(existing.map((row) => [row.slug, row.id]));
    const seeded = SEED_PLAYERS.flatMap((player) => {
      const playerId = idBySlug.get(player.slug);
      return playerId === undefined ? [] : [{ ...player, playerId }];
    });

    const insertedLegacy = await tx
      .insert(legacyStats)
      .values(
        seeded.map(({ playerId, legacy }) => ({
          playerId,
          seasonId: legacySeason.id,
          ...legacy,
        })),
      )
      .onConflictDoNothing()
      .returning({ playerId: legacyStats.playerId });

    const insertedNicknames = await tx
      .insert(nicknames)
      .values(
        seeded.flatMap(({ playerId, nicknames: lore }) => [
          { playerId, label: lore.good, tone: "good" as const },
          { playerId, label: lore.bad, tone: "bad" as const },
        ]),
      )
      .onConflictDoNothing()
      .returning({ id: nicknames.id });

    return {
      seasons: insertedSeasons,
      players: insertedPlayers.length,
      legacyStats: insertedLegacy.length,
      nicknames: insertedNicknames.length,
    };
  });
}
