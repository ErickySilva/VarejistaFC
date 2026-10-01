import { isGoalkeeper } from "../positions";
import type { NightMatch, NightParticipation } from "./types";

// Totais de um jogador em um conjunto de participações. As notas são somadas
// em décimos (inteiros) para que médias e comparações sejam exatas.
export interface NightPlayerTotals {
  playerId: number;
  matches: number;
  goals: number;
  assists: number;
  goalContributions: number;
  ratingTenths: number;
}

export function aggregateNightPlayers(
  participations: readonly NightParticipation[],
): NightPlayerTotals[] {
  const byPlayer = new Map<number, NightPlayerTotals>();

  for (const participation of participations) {
    let totals = byPlayer.get(participation.playerId);
    if (!totals) {
      totals = {
        playerId: participation.playerId,
        matches: 0,
        goals: 0,
        assists: 0,
        goalContributions: 0,
        ratingTenths: 0,
      };
      byPlayer.set(participation.playerId, totals);
    }

    totals.matches += 1;
    totals.goals += participation.goals;
    totals.assists += participation.assists;
    totals.goalContributions += participation.goals + participation.assists;
    totals.ratingTenths += Math.round(participation.rating * 10);
  }

  return [...byPlayer.values()].sort((a, b) => a.playerId - b.playerId);
}

// Totais de quem jogou no gol, contando só as participações como goleiro. A
// posição é a da partida: qualquer jogador pode ter atuado no gol.
export interface NightGoalkeeperTotals {
  playerId: number;
  matches: number;
  saves: number;
  penaltiesSaved: number;
  // Derivado do placar do adversário nas partidas em que jogou no gol.
  goalsConceded: number;
  cleanSheets: number;
  ratingTenths: number;
}

export function aggregateNightGoalkeepers(
  matches: readonly NightMatch[],
  participations: readonly NightParticipation[],
): NightGoalkeeperTotals[] {
  const goalsAgainst = new Map(
    matches.map((match) => [match.id, match.goalsAgainst]),
  );
  const byPlayer = new Map<number, NightGoalkeeperTotals>();

  for (const participation of participations) {
    if (!isGoalkeeper(participation.position)) continue;

    let totals = byPlayer.get(participation.playerId);
    if (!totals) {
      totals = {
        playerId: participation.playerId,
        matches: 0,
        saves: 0,
        penaltiesSaved: 0,
        goalsConceded: 0,
        cleanSheets: 0,
        ratingTenths: 0,
      };
      byPlayer.set(participation.playerId, totals);
    }

    const conceded = goalsAgainst.get(participation.matchId) ?? 0;
    totals.matches += 1;
    totals.saves += participation.saves ?? 0;
    totals.penaltiesSaved += participation.penaltiesSaved ?? 0;
    totals.goalsConceded += conceded;
    if (conceded === 0) totals.cleanSheets += 1;
    totals.ratingTenths += Math.round(participation.rating * 10);
  }

  return [...byPlayer.values()].sort((a, b) => a.playerId - b.playerId);
}

// Média com duas casas decimais, arredondando meio para cima.
export function averageRating(ratingTenths: number, matches: number): number {
  return Math.floor((20 * ratingTenths + matches) / (2 * matches)) / 100;
}

// Compara médias sem dividir: negativo se a primeira é menor.
export function compareAverages(
  aTenths: number,
  aMatches: number,
  bTenths: number,
  bMatches: number,
): number {
  return aTenths * bMatches - bTenths * aMatches;
}
