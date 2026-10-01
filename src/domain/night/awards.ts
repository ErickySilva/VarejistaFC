import {
  aggregateNightPlayers,
  averageRating,
  compareAverages,
  type NightPlayerTotals,
} from "./player-totals";
import type { AwardType, NightAward, NightParticipation } from "./types";

// Regras em docs/adr/0008-premios-da-noite.md.

export interface NightAwardsInput {
  // Partidas não excluídas da noite, inclusive as que algum jogador não jogou.
  matchCount: number;
  participations: readonly NightParticipation[];
}

// Só concorre a craque quem jogou pelo menos metade das partidas da noite,
// arredondando para cima.
export function minimumMatchesForMvp(matchCount: number): number {
  return Math.ceil(matchCount / 2);
}

// Todos os candidatos empatados no topo, segundo o comparador.
function leaders<T>(candidates: readonly T[], compare: (a: T, b: T) => number) {
  let best: T[] = [];
  for (const candidate of candidates) {
    const difference = best.length === 0 ? 1 : compare(candidate, best[0]);
    if (difference > 0) best = [candidate];
    else if (difference === 0) best.push(candidate);
  }
  return best;
}

// Prêmios de contagem: quem tem o maior valor vence; sem vencedor se for zero.
function countAward(
  award: AwardType,
  players: readonly NightPlayerTotals[],
  value: (player: NightPlayerTotals) => number,
): NightAward[] {
  return leaders(players, (a, b) => value(a) - value(b))
    .filter((player) => value(player) > 0)
    .map((player) => ({
      award,
      playerId: player.playerId,
      value: value(player),
    }));
}

function mvpAward(
  players: readonly NightPlayerTotals[],
  matchCount: number,
): NightAward[] {
  const minimum = minimumMatchesForMvp(matchCount);
  const eligible = players.filter((player) => player.matches >= minimum);

  return leaders(
    eligible,
    (a, b) =>
      compareAverages(a.ratingTenths, a.matches, b.ratingTenths, b.matches) ||
      a.goalContributions - b.goalContributions ||
      a.goals - b.goals,
  ).map((player) => ({
    award: "mvp",
    playerId: player.playerId,
    value: averageRating(player.ratingTenths, player.matches),
  }));
}

// Considera só as participações como goleiro, sem mínimo de partidas.
function bestGoalkeeperAward(
  players: readonly NightPlayerTotals[],
): NightAward[] {
  const goalkeepers = players.filter((player) => player.goalkeeperMatches > 0);

  return leaders(goalkeepers, (a, b) =>
    compareAverages(
      a.goalkeeperRatingTenths,
      a.goalkeeperMatches,
      b.goalkeeperRatingTenths,
      b.goalkeeperMatches,
    ),
  ).map((player) => ({
    award: "best_goalkeeper",
    playerId: player.playerId,
    value: averageRating(
      player.goalkeeperRatingTenths,
      player.goalkeeperMatches,
    ),
  }));
}

export function calculateNightAwards(input: NightAwardsInput): NightAward[] {
  if (input.matchCount === 0) return [];

  const players = aggregateNightPlayers(input.participations);

  return [
    ...countAward("top_scorer", players, (player) => player.goals),
    ...countAward("top_assists", players, (player) => player.assists),
    ...countAward("top_ga", players, (player) => player.goalContributions),
    ...mvpAward(players, input.matchCount),
    ...bestGoalkeeperAward(players),
  ];
}
