import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { nicknameToneEnum, positionEnum } from "./enums";
import { seasons } from "./seasons";

export const players = pgTable(
  "players",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shirtNumber: integer("shirt_number").notNull(),
    // Só pré-preenche formulários. A posição que vale é a de cada participação.
    defaultPosition: positionEnum("default_position").notNull(),
    photoUrl: text("photo_url"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("players_shirt_number_range", sql`shirt_number between 1 and 99`),
    uniqueIndex("players_active_shirt_number_idx")
      .on(t.shirtNumber)
      .where(sql`is_active`),
  ],
);

// Totais anteriores ao sistema, por jogador e temporada. Nunca viram partidas
// e não têm Nota VFC (ADR 0003).
export const legacyStats = pgTable(
  "legacy_stats",
  {
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    // Temporada histórica a que os números pertencem.
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    matches: integer("matches").notNull(),
    goals: integer("goals").notNull(),
    assists: integer("assists").notNull(),
    // Nulo significa "não anotado", diferente de zero.
    cleanSheets: integer("clean_sheets"),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.playerId, t.seasonId] }),
    check(
      "legacy_stats_non_negative",
      sql`matches >= 0 and goals >= 0 and assists >= 0`,
    ),
    check(
      "legacy_stats_clean_sheets_range",
      sql`clean_sheets is null or clean_sheets between 0 and matches`,
    ),
  ],
);

export const nicknames = pgTable(
  "nicknames",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    label: text("label").notNull(),
    tone: nicknameToneEnum("tone").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("nicknames_player_label_idx").on(
      t.playerId,
      sql`lower(${t.label})`,
    ),
  ],
);
