import { statsScope, type StatsScope } from "../match-type";
import {
  aggregateNightPlayers,
  averageRating,
  compareAverages,
  type NightPlayerTotals,
} from "./player-totals";
import type {
  AwardType,
  NightAward,
  NightMatch,
  NightParticipation,
} from "./types";

// Regras em docs/adr/0008-premios-da-noite.md.

export interface NightAwardsInput {
  // Partidas não excluídas da gameplay, inclusive as que algum jogador não jogou.
  matches: readonly NightMatch[];
  participations: readonly NightParticipation[];
}

// Só concorre a Craque da Noite (ou a Destaque do Rush) quem jogou pelo menos
// metade das partidas daquele recorte, arredondando para cima.
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

// Maior média de Nota VFC; desempate por G/A e depois por gols; empate
// completo gera co-vencedores.
function bestAverageAward(
  award: AwardType,
  players: readonly NightPlayerTotals[],
  matchCount: number,
): NightAward[] {
  if (matchCount === 0) return [];

  const minimum = minimumMatchesForMvp(matchCount);
  const eligible = players.filter((player) => player.matches >= minimum);

  return leaders(
    eligible,
    (a, b) =>
      compareAverages(a.ratingTenths, a.matches, b.ratingTenths, b.matches) ||
      a.goalContributions - b.goalContributions ||
      a.goals - b.goals,
  ).map((player) => ({
    award,
    playerId: player.playerId,
    value: averageRating(player.ratingTenths, player.matches),
  }));
}

export function calculateNightAwards(input: NightAwardsInput): NightAward[] {
  const scopeOfMatch = new Map(
    input.matches.map((match) => [match.id, statsScope(match.matchType)]),
  );
  const inScope = (scope: StatsScope) => ({
    matchCount: input.matches.filter(
      (match) => statsScope(match.matchType) === scope,
    ).length,
    players: aggregateNightPlayers(
      input.participations.filter(
        (participation) => scopeOfMatch.get(participation.matchId) === scope,
      ),
    ),
  });

  // Artilheiro, Assistente e Craque consideram só as partidas principais (X1
  // e Partida). O Rush fica separado e tem só o próprio destaque.
  const main = inScope("main");
  const rush = inScope("rush");

  return [
    ...countAward("top_scorer", main.players, (player) => player.goals),
    ...countAward("top_assists", main.players, (player) => player.assists),
    ...bestAverageAward("mvp", main.players, main.matchCount),
    ...bestAverageAward("rush_mvp", rush.players, rush.matchCount),
  ];
}
