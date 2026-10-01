import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  matches,
  matchPlayers,
  nightAwards,
  nights,
  opponents,
  players,
} from "@/db/schema";
import type { MatchResult } from "@/domain/match";
import type { AwardType, NightMatch, NightParticipation } from "@/domain/night";
import type { Position } from "@/domain/positions";

// Leituras da noite. Tudo aqui é estatística pública, então não há checagem de
// permissão; quem decide o que mostrar e para quem é a página ou o serviço.

export interface ParticipationDetail {
  playerId: number;
  playerName: string;
  shirtNumber: number;
  position: Position;
  goals: number;
  assists: number;
  saves: number | null;
  penaltiesSaved: number | null;
  rating: number;
  ratingVersion: string;
}

export interface MatchDetail {
  id: number;
  nightId: number;
  sequence: number;
  opponentName: string;
  matchType: (typeof matches.$inferSelect)["matchType"];
  playedAt: Date;
  goalsFor: number;
  goalsAgainst: number;
  wentToPenalties: boolean;
  penaltyScoreFor: number | null;
  penaltyScoreAgainst: number | null;
  result: MatchResult;
  participations: ParticipationDetail[];
}

export interface NightDetail {
  id: number;
  referenceDate: string;
  status: "open" | "closed";
  startedAt: Date;
  closedAt: Date | null;
  summary: string | null;
  // Partidas não excluídas, na ordem em que foram jogadas.
  matches: MatchDetail[];
}

export interface NightAwardDetail {
  award: AwardType;
  playerId: number;
  playerName: string;
  value: number;
}

const matchColumns = {
  id: matches.id,
  nightId: matches.nightId,
  sequence: matches.sequence,
  opponentName: opponents.name,
  matchType: matches.matchType,
  playedAt: matches.playedAt,
  goalsFor: matches.goalsFor,
  goalsAgainst: matches.goalsAgainst,
  wentToPenalties: matches.wentToPenalties,
  penaltyScoreFor: matches.penaltyScoreFor,
  penaltyScoreAgainst: matches.penaltyScoreAgainst,
  result: matches.result,
};

async function loadParticipations(
  matchIds: number[],
): Promise<Map<number, ParticipationDetail[]>> {
  const byMatch = new Map<number, ParticipationDetail[]>();
  if (matchIds.length === 0) return byMatch;

  const rows = await getDb()
    .select({
      matchId: matchPlayers.matchId,
      playerId: matchPlayers.playerId,
      playerName: players.name,
      shirtNumber: players.shirtNumber,
      position: matchPlayers.position,
      goals: matchPlayers.goals,
      assists: matchPlayers.assists,
      saves: matchPlayers.saves,
      penaltiesSaved: matchPlayers.penaltiesSaved,
      rating: matchPlayers.rating,
      ratingVersion: matchPlayers.ratingVersion,
    })
    .from(matchPlayers)
    .innerJoin(players, eq(players.id, matchPlayers.playerId))
    .where(inArray(matchPlayers.matchId, matchIds))
    .orderBy(asc(players.shirtNumber));

  for (const { matchId, ...participation } of rows) {
    byMatch.set(matchId, [...(byMatch.get(matchId) ?? []), participation]);
  }
  return byMatch;
}

// Partida não excluída, com as participações. Devolve null se não existir.
export async function getMatchDetail(
  matchId: number,
): Promise<MatchDetail | null> {
  const [row] = await getDb()
    .select(matchColumns)
    .from(matches)
    .innerJoin(opponents, eq(opponents.id, matches.opponentId))
    .where(and(eq(matches.id, matchId), isNull(matches.deletedAt)));
  if (!row) return null;

  const participations = await loadParticipations([row.id]);
  return { ...row, participations: participations.get(row.id) ?? [] };
}

export async function getNightDetail(
  nightId: number,
): Promise<NightDetail | null> {
  const [night] = await getDb()
    .select({
      id: nights.id,
      referenceDate: nights.referenceDate,
      status: nights.status,
      startedAt: nights.startedAt,
      closedAt: nights.closedAt,
      summary: nights.summary,
    })
    .from(nights)
    .where(eq(nights.id, nightId));
  if (!night) return null;

  const matchRows = await getDb()
    .select(matchColumns)
    .from(matches)
    .innerJoin(opponents, eq(opponents.id, matches.opponentId))
    .where(and(eq(matches.nightId, nightId), isNull(matches.deletedAt)))
    .orderBy(asc(matches.sequence));
  const participations = await loadParticipations(
    matchRows.map((match) => match.id),
  );

  return {
    ...night,
    matches: matchRows.map((match) => ({
      ...match,
      participations: participations.get(match.id) ?? [],
    })),
  };
}

export async function getOpenNight(): Promise<NightDetail | null> {
  const [open] = await getDb()
    .select({ id: nights.id })
    .from(nights)
    .where(eq(nights.status, "open"));
  return open ? getNightDetail(open.id) : null;
}

export async function getLatestClosedNight(): Promise<NightDetail | null> {
  const [latest] = await getDb()
    .select({ id: nights.id })
    .from(nights)
    .where(eq(nights.status, "closed"))
    .orderBy(desc(nights.referenceDate))
    .limit(1);
  return latest ? getNightDetail(latest.id) : null;
}

export async function getNightAwards(
  nightId: number,
): Promise<NightAwardDetail[]> {
  return getDb()
    .select({
      award: nightAwards.award,
      playerId: nightAwards.playerId,
      playerName: players.name,
      value: nightAwards.value,
    })
    .from(nightAwards)
    .innerJoin(players, eq(players.id, nightAwards.playerId))
    .where(eq(nightAwards.nightId, nightId))
    .orderBy(asc(nightAwards.id));
}

// Converte o detalhe da noite na entrada das funções de domínio (prêmios e
// resumo).
export function toDomainNight(night: NightDetail): {
  matches: NightMatch[];
  participations: NightParticipation[];
} {
  return {
    matches: night.matches.map((match) => ({
      id: match.id,
      goalsFor: match.goalsFor,
      goalsAgainst: match.goalsAgainst,
      result: match.result,
      wentToPenalties: match.wentToPenalties,
    })),
    participations: night.matches.flatMap((match) =>
      match.participations.map((participation) => ({
        playerId: participation.playerId,
        matchId: match.id,
        position: participation.position,
        goals: participation.goals,
        assists: participation.assists,
        rating: participation.rating,
      })),
    ),
  };
}
