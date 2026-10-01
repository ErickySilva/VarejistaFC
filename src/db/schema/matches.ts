import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns";
import { matchTypeEnum, positionEnum } from "./enums";
import { nights } from "./nights";
import { nicknames, players } from "./players";

export const opponents = pgTable(
  "opponents",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("opponents_name_idx").on(sql`lower(${t.name})`)],
);

export const matches = pgTable(
  "matches",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nightId: integer("night_id")
      .notNull()
      .references(() => nights.id),
    // Ordem da partida dentro da noite.
    sequence: integer("sequence").notNull(),
    opponentId: integer("opponent_id")
      .notNull()
      .references(() => opponents.id),
    matchType: matchTypeEnum("match_type"),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
    // Gols do jogo, sem contar a disputa de pênaltis.
    goalsFor: integer("goals_for").notNull(),
    goalsAgainst: integer("goals_against").notNull(),
    wentToPenalties: boolean("went_to_penalties").notNull().default(false),
    penaltyScoreFor: integer("penalty_score_for"),
    penaltyScoreAgainst: integer("penalty_score_against"),
    // Derivado do placar; a disputa de pênaltis decide quando houve.
    result: text("result")
      .$type<"W" | "D" | "L">()
      .notNull()
      .generatedAlwaysAs(
        sql`case
          when goals_for > goals_against then 'W'
          when goals_for < goals_against then 'L'
          when went_to_penalties and penalty_score_for > penalty_score_against then 'W'
          when went_to_penalties then 'L'
          else 'D'
        end`,
      ),
    // Exclusão lógica: partidas não são removidas fisicamente (ADR 0006).
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("matches_night_sequence_idx")
      .on(t.nightId, t.sequence)
      .where(sql`deleted_at is null`),
    index("matches_night_idx").on(t.nightId),
    check("matches_sequence_positive", sql`sequence >= 1`),
    check(
      "matches_goals_non_negative",
      sql`goals_for >= 0 and goals_against >= 0`,
    ),
    check(
      "matches_penalty_scores_presence",
      sql`went_to_penalties = (penalty_score_for is not null)
        and went_to_penalties = (penalty_score_against is not null)`,
    ),
    check(
      "matches_penalties_only_after_draw",
      sql`not went_to_penalties or goals_for = goals_against`,
    ),
    check(
      "matches_penalty_scores_valid",
      sql`not went_to_penalties or (
        penalty_score_for >= 0
        and penalty_score_against >= 0
        and penalty_score_for <> penalty_score_against
      )`,
    ),
  ],
);

// A participação é o fato central: a quantidade de jogos de um jogador é a
// contagem destas linhas, mesmo com zero gols e zero assistências (ADR 0002).
export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    position: positionEnum("position").notNull(),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    // Estatísticas de goleiro. Gols sofridos e clean sheet são derivados do
    // placar e por isso não existem como coluna.
    saves: integer("saves"),
    penaltiesSaved: integer("penalties_saved"),
    rating: numeric("rating", {
      precision: 3,
      scale: 1,
      mode: "number",
    }).notNull(),
    ratingVersion: text("rating_version").notNull(),
    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.playerId] }),
    index("match_players_player_idx").on(t.playerId),
    // No máximo um goleiro do Varejista por partida.
    uniqueIndex("match_players_single_goalkeeper_idx")
      .on(t.matchId)
      .where(sql`"position" = 'GOL'`),
    check(
      "match_players_goals_assists_non_negative",
      sql`goals >= 0 and assists >= 0`,
    ),
    check(
      "match_players_saves_only_for_goalkeeper",
      sql`("position" = 'GOL') = (saves is not null)`,
    ),
    check("match_players_saves_non_negative", sql`saves is null or saves >= 0`),
    check(
      "match_players_penalties_saved_valid",
      sql`penalties_saved is null or (
        "position" = 'GOL' and penalties_saved between 0 and saves
      )`,
    ),
    check("match_players_rating_range", sql`rating between 3.0 and 10.0`),
  ],
);

// Apelido atribuído manualmente a uma partida ou a uma noite, nunca aos dois.
export const nicknameAssignments = pgTable(
  "nickname_assignments",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    nicknameId: integer("nickname_id")
      .notNull()
      .references(() => nicknames.id),
    nightId: integer("night_id").references(() => nights.id),
    matchId: integer("match_id").references(() => matches.id),
    note: text("note"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    check(
      "nickname_assignments_single_target",
      sql`num_nonnulls(night_id, match_id) = 1`,
    ),
    unique("nickname_assignments_nickname_night_key").on(
      t.nicknameId,
      t.nightId,
    ),
    unique("nickname_assignments_nickname_match_key").on(
      t.nicknameId,
      t.matchId,
    ),
  ],
);
