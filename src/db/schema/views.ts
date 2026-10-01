import {
  boolean,
  date,
  integer,
  numeric,
  pgView,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { matchTypeEnum, positionEnum } from "./enums";

// As views são criadas por SQL (a versão vigente está em
// migrations/0004_types_seasons_fifa.sql).
// `.existing()` só descreve as colunas para consultas tipadas; o drizzle-kit
// não gera nem altera estas views.

export const playerMatchView = pgView("v_player_match", {
  playerId: integer("player_id").notNull(),
  matchId: integer("match_id").notNull(),
  nightId: integer("night_id").notNull(),
  seasonId: integer("season_id").notNull(),
  referenceDate: date("reference_date", { mode: "string" }).notNull(),
  referenceMonth: date("reference_month", { mode: "string" }).notNull(),
  sequence: integer("sequence").notNull(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  opponentId: integer("opponent_id").notNull(),
  matchType: matchTypeEnum("match_type").notNull(),
  goalsFor: integer("goals_for").notNull(),
  goalsAgainst: integer("goals_against").notNull(),
  wentToPenalties: boolean("went_to_penalties").notNull(),
  result: text("result").$type<"W" | "D" | "L">().notNull(),
  position: positionEnum("position").notNull(),
  goals: integer("goals").notNull(),
  assists: integer("assists").notNull(),
  goalContributions: integer("goal_contributions").notNull(),
  rating: numeric("rating", {
    precision: 3,
    scale: 1,
    mode: "number",
  }).notNull(),
  ratingVersion: text("rating_version").notNull(),
  isGoalkeeper: boolean("is_goalkeeper").notNull(),
  saves: integer("saves"),
  penaltiesSaved: integer("penalties_saved"),
  goalsConceded: integer("goals_conceded"),
  cleanSheet: boolean("clean_sheet").notNull(),
  // Recorte de estatísticas: "main" (X1 e Partida) ou "rush".
  statsScope: text("stats_scope").$type<"main" | "rush">().notNull(),
  // Nota FIFA, informada à mão; nula quando não informada.
  fifaRating: numeric("fifa_rating", {
    precision: 3,
    scale: 1,
    mode: "number",
  }),
}).existing();

// Totais do sistema por jogador, temporada e recorte. As somas de nota são
// expostas para que as médias sejam calculadas sobre o período escolhido.
export const playerPeriodTotalsView = pgView("v_player_period_totals", {
  playerId: integer("player_id").notNull(),
  seasonId: integer("season_id").notNull(),
  statsScope: text("stats_scope").$type<"main" | "rush">().notNull(),
  matches: integer("matches").notNull(),
  goals: integer("goals").notNull(),
  assists: integer("assists").notNull(),
  goalContributions: integer("goal_contributions").notNull(),
  wins: integer("wins").notNull(),
  draws: integer("draws").notNull(),
  losses: integer("losses").notNull(),
  ratingSum: numeric("rating_sum", { mode: "number" }).notNull(),
  fifaRatedMatches: integer("fifa_rated_matches").notNull(),
  fifaRatingSum: numeric("fifa_rating_sum", { mode: "number" }).notNull(),
  goalkeeperMatches: integer("goalkeeper_matches").notNull(),
  saves: integer("saves").notNull(),
  penaltiesSaved: integer("penalties_saved").notNull(),
  goalsConceded: integer("goals_conceded").notNull(),
  cleanSheets: integer("clean_sheets").notNull(),
  goalkeeperRatingSum: numeric("goalkeeper_rating_sum", {
    mode: "number",
  }).notNull(),
}).existing();

export const playerTotalsSystemView = pgView("v_player_totals_system", {
  playerId: integer("player_id").notNull(),
  matches: integer("matches").notNull(),
  goals: integer("goals").notNull(),
  assists: integer("assists").notNull(),
  goalContributions: integer("goal_contributions").notNull(),
  wins: integer("wins").notNull(),
  draws: integer("draws").notNull(),
  losses: integer("losses").notNull(),
  // Nulo enquanto o jogador não tiver partidas no sistema.
  averageRating: numeric("average_rating", { mode: "number" }),
  goalkeeperMatches: integer("goalkeeper_matches").notNull(),
  saves: integer("saves").notNull(),
  penaltiesSaved: integer("penalties_saved").notNull(),
  goalsConceded: integer("goals_conceded").notNull(),
  cleanSheets: integer("clean_sheets").notNull(),
}).existing();

export const playerTotalsOverallView = pgView("v_player_totals_overall", {
  playerId: integer("player_id").notNull(),
  systemMatches: integer("system_matches").notNull(),
  legacyMatches: integer("legacy_matches").notNull(),
  totalMatches: integer("total_matches").notNull(),
  systemGoals: integer("system_goals").notNull(),
  legacyGoals: integer("legacy_goals").notNull(),
  totalGoals: integer("total_goals").notNull(),
  systemAssists: integer("system_assists").notNull(),
  legacyAssists: integer("legacy_assists").notNull(),
  totalAssists: integer("total_assists").notNull(),
  systemGoalContributions: integer("system_goal_contributions").notNull(),
  legacyGoalContributions: integer("legacy_goal_contributions").notNull(),
  totalGoalContributions: integer("total_goal_contributions").notNull(),
  systemCleanSheets: integer("system_clean_sheets").notNull(),
  // Nulo significa "não anotado" no histórico.
  legacyCleanSheets: integer("legacy_clean_sheets"),
  totalCleanSheets: integer("total_clean_sheets").notNull(),
}).existing();
