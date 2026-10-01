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
import { seasons } from "./seasons";

export const nights = pgTable(
  "nights",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // A temporada ativa no momento em que a gameplay começou.
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id),
    // Define o mês de todas as partidas da noite (ADR 0007).
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
    // Métrica que decidiu o prêmio: gols, assistências ou média de Nota VFC.
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
