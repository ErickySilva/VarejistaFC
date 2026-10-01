import { isGoalkeeper } from "../positions";
import type { NightParticipation } from "./types";

// Totais de um jogador em uma noite. As notas são somadas em décimos (inteiros)
// para que médias e comparações sejam exatas.
export interface NightPlayerTotals {
  playerId: number;
  matches: number;
  goals: number;
  assists: number;
  goalContributions: number;
  ratingTenths: number;
  goalkeeperMatches: number;
  goalkeeperRatingTenths: number;
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
        goalkeeperMatches: 0,
        goalkeeperRatingTenths: 0,
      };
      byPlayer.set(participation.playerId, totals);
    }

    const ratingTenths = Math.round(participation.rating * 10);
    totals.matches += 1;
    totals.goals += participation.goals;
    totals.assists += participation.assists;
    totals.goalContributions += participation.goals + participation.assists;
    totals.ratingTenths += ratingTenths;
    if (isGoalkeeper(participation.position)) {
      totals.goalkeeperMatches += 1;
      totals.goalkeeperRatingTenths += ratingTenths;
    }
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
