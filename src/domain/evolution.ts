import { compareForRanking } from "./ranking";

// Evolução de um jogador ao longo das gameplays de um período, nas partidas
// principais. Função pura: recebe os totais de cada noite e o histórico
// pré-sistema do período, e devolve a série de pontos.

export interface NightPlayerLine {
  playerId: number;
  matches: number;
  goals: number;
  assists: number;
  // Soma das Notas VFC da noite, em décimos.
  ratingTenths: number;
}

export interface NightTotals {
  nightId: number;
  referenceDate: string;
  players: NightPlayerLine[];
}

export interface PlayerBaseline {
  playerId: number;
  shirtNumber: number;
  // Histórico pré-sistema do período: ponto de partida do acumulado.
  legacyGoals: number;
  legacyAssists: number;
}

export interface EvolutionPoint {
  nightId: number;
  referenceDate: string;
  // Se o jogador participou desta gameplay.
  played: boolean;
  // G/A acumulado até esta gameplay, com o histórico do período.
  cumulativeGoalContributions: number;
  // Média de Nota VFC nesta gameplay; null se não jogou.
  nightAverageRating: number | null;
  // Média de Nota VFC de todas as partidas avaliadas até aqui; null se nenhuma.
  cumulativeAverageRating: number | null;
  // Posição no ranking geral (G/A, gols, assistências) depois desta gameplay.
  rank: number;
}

function average(ratingTenths: number, matches: number): number | null {
  return matches === 0 ? null : Math.round((ratingTenths * 10) / matches) / 100;
}

export function buildEvolution(
  playerId: number,
  baselines: readonly PlayerBaseline[],
  nights: readonly NightTotals[],
): EvolutionPoint[] {
  const running = new Map(
    baselines.map((baseline) => [
      baseline.playerId,
      {
        shirtNumber: baseline.shirtNumber,
        goals: baseline.legacyGoals,
        assists: baseline.legacyAssists,
        ratedMatches: 0,
        ratingTenths: 0,
      },
    ]),
  );
  if (!running.has(playerId)) return [];

  return nights.map((night) => {
    for (const line of night.players) {
      const totals = running.get(line.playerId);
      if (!totals) continue;
      totals.goals += line.goals;
      totals.assists += line.assists;
      totals.ratedMatches += line.matches;
      totals.ratingTenths += line.ratingTenths;
    }

    const standings = [...running.entries()]
      .map(([id, totals]) => ({
        id,
        shirtNumber: totals.shirtNumber,
        goals: totals.goals,
        assists: totals.assists,
        goalContributions: totals.goals + totals.assists,
        ratedMatches: totals.ratedMatches,
        averageRating: average(totals.ratingTenths, totals.ratedMatches),
        goalkeeper: {
          matches: 0,
          averageRating: null,
          savesPerMatch: null,
          cleanSheets: 0,
        },
      }))
      .sort((a, b) => compareForRanking("geral", a, b));

    const mine = running.get(playerId)!;
    const tonight = night.players.find((line) => line.playerId === playerId);

    return {
      nightId: night.nightId,
      referenceDate: night.referenceDate,
      played: tonight !== undefined,
      cumulativeGoalContributions: mine.goals + mine.assists,
      nightAverageRating: tonight
        ? average(tonight.ratingTenths, tonight.matches)
        : null,
      cumulativeAverageRating: average(mine.ratingTenths, mine.ratedMatches),
      rank: standings.findIndex((entry) => entry.id === playerId) + 1,
    };
  });
}
