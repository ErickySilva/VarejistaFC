import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { awardTypeEnum, nightStatusEnum } from "./enums";
import { players } from "./players";

export const seasons = pgTable(
  "seasons",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    // Edição do EA FC, ex.: "FC 26".
    gameEdition: text("game_edition").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }),
    ...timestamps,
  },
  () => [
    check("seasons_date_order", sql`ends_on is null or ends_on >= starts_on`),
  ],
);

export const nights = pgTable(
  "nights",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    // Define o mês e a temporada de todas as partidas da noite (ADR 0007).
    referenceDate: date("reference_date", { mode: "string" })
      .notNull()
      .unique(),
    status: nightStatusEnum("status").notNull().default("open"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    summary: text("summary"),
    ...timestamps,
  },
  (t) => [
    // No máximo uma noite aberta em todo o sistema.
    uniqueIndex("nights_single_open_idx")
      .on(t.status)
      .where(sql`status = 'open'`),
    check(
      "nights_closed_at_matches_status",
      sql`(status = 'closed') = (closed_at is not null)`,
    ),
  ],
);

// Fotografia do fechamento. Co-vencedores são várias linhas do mesmo prêmio.
export const nightAwards = pgTable(
  "night_awards",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nightId: integer("night_id")
      .notNull()
      .references(() => nights.id),
    award: awardTypeEnum("award").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    // Métrica que decidiu o prêmio: gols, assistências, G/A ou média de nota.
    value: numeric("value", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("night_awards_night_award_player_key").on(
      t.nightId,
      t.award,
      t.playerId,
    ),
  ],
);
