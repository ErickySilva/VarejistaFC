import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  matches,
  nights,
  opponents,
  playerMatchView,
  seasons,
} from "@/db/schema";
import type { MatchResult } from "@/domain/match";
import type { MatchType } from "@/domain/match-type";
import type { Position } from "@/domain/positions";
import { getMatchDetail, type MatchDetail } from "../nights/queries";

// Histórico de partidas: leitura pública. Não há filtros nem busca nesta
// versão; as consultas já recebem limite e deslocamento para a paginação.

export interface MatchSummary {
  id: number;
  nightId: number;
  // Data da gameplay a que a partida pertence.
  referenceDate: string;
  // Momento real em que a partida foi registrada.
  playedAt: Date;
  opponentName: string;
  matchType: MatchType;
  goalsFor: number;
  goalsAgainst: number;
  wentToPenalties: boolean;
  penaltyScoreFor: number | null;
  penaltyScoreAgainst: number | null;
  result: MatchResult;
}

const summaryColumns = {
  id: matches.id,
  nightId: matches.nightId,
  referenceDate: nights.referenceDate,
  playedAt: matches.playedAt,
  opponentName: opponents.name,
  matchType: matches.matchType,
  goalsFor: matches.goalsFor,
  goalsAgainst: matches.goalsAgainst,
  wentToPenalties: matches.wentToPenalties,
  penaltyScoreFor: matches.penaltyScoreFor,
  penaltyScoreAgainst: matches.penaltyScoreAgainst,
  result: matches.result,
};

// Partidas não excluídas, da mais recente para a mais antiga.
export async function listMatches(options: {
  limit: number;
  offset?: number;
}): Promise<MatchSummary[]> {
  return getDb()
    .select(summaryColumns)
    .from(matches)
    .innerJoin(nights, eq(nights.id, matches.nightId))
    .innerJoin(opponents, eq(opponents.id, matches.opponentId))
    .where(isNull(matches.deletedAt))
    .orderBy(desc(matches.playedAt), desc(matches.id))
    .limit(options.limit)
    .offset(options.offset ?? 0);
}

export async function countMatches(): Promise<number> {
  return getDb().$count(matches, isNull(matches.deletedAt));
}

export interface PlayerMatchLine extends MatchSummary {
  position: Position;
  goals: number;
  assists: number;
  saves: number | null;
  penaltiesSaved: number | null;
  // Nota VFC e Nota FIFA (esta, null quando não informada).
  rating: number;
  fifaRating: number | null;
}

// Partidas recentes de um jogador, com a linha dele em cada uma.
export async function listPlayerMatches(
  playerId: number,
  limit: number,
): Promise<PlayerMatchLine[]> {
  const view = playerMatchView;
  return getDb()
    .select({
      ...summaryColumns,
      position: view.position,
      goals: view.goals,
      assists: view.assists,
      saves: view.saves,
      penaltiesSaved: view.penaltiesSaved,
      rating: view.rating,
      fifaRating: view.fifaRating,
    })
    .from(view)
    .innerJoin(matches, eq(matches.id, view.matchId))
    .innerJoin(nights, eq(nights.id, matches.nightId))
    .innerJoin(opponents, eq(opponents.id, matches.opponentId))
    .where(eq(view.playerId, playerId))
    .orderBy(desc(matches.playedAt), desc(matches.id))
    .limit(limit);
}

export interface MatchPage {
  match: MatchDetail;
  night: {
    id: number;
    referenceDate: string;
    status: "open" | "closed";
    seasonName: string;
  };
}

// Página permanente de uma partida. Partida excluída não tem página.
export async function getMatchPage(matchId: number): Promise<MatchPage | null> {
  const match = await getMatchDetail(matchId);
  if (!match) return null;

  const [night] = await getDb()
    .select({
      id: nights.id,
      referenceDate: nights.referenceDate,
      status: nights.status,
      seasonName: seasons.name,
    })
    .from(nights)
    .innerJoin(seasons, eq(seasons.id, nights.seasonId))
    .where(and(eq(nights.id, match.nightId)));

  return { match, night };
}
