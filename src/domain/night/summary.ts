import { calculateNightAwards } from "./awards";
import { aggregateNightPlayers, averageRating } from "./player-totals";
import type { NightAward, NightMatch, NightParticipation } from "./types";

export interface NightPlayerSummary {
  playerId: number;
  matches: number;
  goals: number;
  assists: number;
  goalContributions: number;
  averageRating: number;
}

export interface NightSummary {
  matchCount: number;
  wins: number;
  draws: number;
  losses: number;
  // Já incluídas em wins e losses.
  penaltyWins: number;
  penaltyLosses: number;
  // Gols das partidas; cobranças da disputa de pênaltis não entram.
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  // Partidas em que o time não sofreu gol.
  cleanSheets: number;
  // Ordenado por G/A, depois gols, depois média de nota.
  players: NightPlayerSummary[];
  awards: NightAward[];
}

export interface NightSummaryInput {
  matches: readonly NightMatch[];
  participations: readonly NightParticipation[];
}

export function summarizeNight(input: NightSummaryInput): NightSummary {
  const { matches, participations } = input;
  const count = (predicate: (match: NightMatch) => boolean) =>
    matches.filter(predicate).length;
  const sum = (value: (match: NightMatch) => number) =>
    matches.reduce((total, match) => total + value(match), 0);

  const goalsFor = sum((match) => match.goalsFor);
  const goalsAgainst = sum((match) => match.goalsAgainst);

  const players = aggregateNightPlayers(participations)
    .map((player) => ({
      playerId: player.playerId,
      matches: player.matches,
      goals: player.goals,
      assists: player.assists,
      goalContributions: player.goalContributions,
      averageRating: averageRating(player.ratingTenths, player.matches),
    }))
    .sort(
      (a, b) =>
        b.goalContributions - a.goalContributions ||
        b.goals - a.goals ||
        b.averageRating - a.averageRating ||
        a.playerId - b.playerId,
    );

  return {
    matchCount: matches.length,
    wins: count((match) => match.result === "W"),
    draws: count((match) => match.result === "D"),
    losses: count((match) => match.result === "L"),
    penaltyWins: count((m) => m.wentToPenalties && m.result === "W"),
    penaltyLosses: count((m) => m.wentToPenalties && m.result === "L"),
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    cleanSheets: count((match) => match.goalsAgainst === 0),
    players,
    awards: calculateNightAwards({
      matchCount: matches.length,
      participations,
    }),
  };
}
