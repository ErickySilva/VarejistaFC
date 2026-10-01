import { statsScope, type StatsScope } from "../match-type";
import { calculateNightAwards } from "./awards";
import {
  aggregateNightGoalkeepers,
  aggregateNightPlayers,
  averageRating,
} from "./player-totals";
import type { NightAward, NightMatch, NightParticipation } from "./types";

export interface NightPlayerSummary {
  playerId: number;
  matches: number;
  goals: number;
  assists: number;
  goalContributions: number;
  // Média da Nota VFC.
  averageRating: number;
}

// Só quem jogou no gol, contando apenas as partidas como goleiro.
export interface NightGoalkeeperSummary {
  playerId: number;
  matches: number;
  saves: number;
  penaltiesSaved: number;
  goalsConceded: number;
  cleanSheets: number;
  averageRating: number;
}

// Números de um recorte da gameplay: partidas principais ou Rush.
export interface NightScopeSummary {
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
  goalkeepers: NightGoalkeeperSummary[];
}

export interface NightSummary {
  // Todas as partidas da gameplay, de qualquer tipo.
  matchCount: number;
  // X1 e Partida: é o que conta nas estatísticas principais.
  main: NightScopeSummary;
  // Torneio de Rush: registrado por inteiro, com estatísticas próprias.
  rush: NightScopeSummary;
  awards: NightAward[];
}

export interface NightSummaryInput {
  matches: readonly NightMatch[];
  participations: readonly NightParticipation[];
}

function summarizeScope(
  matches: readonly NightMatch[],
  participations: readonly NightParticipation[],
): NightScopeSummary {
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

  const goalkeepers = aggregateNightGoalkeepers(matches, participations).map(
    (goalkeeper) => ({
      playerId: goalkeeper.playerId,
      matches: goalkeeper.matches,
      saves: goalkeeper.saves,
      penaltiesSaved: goalkeeper.penaltiesSaved,
      goalsConceded: goalkeeper.goalsConceded,
      cleanSheets: goalkeeper.cleanSheets,
      averageRating: averageRating(goalkeeper.ratingTenths, goalkeeper.matches),
    }),
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
    goalkeepers,
  };
}

export function summarizeNight(input: NightSummaryInput): NightSummary {
  const { matches, participations } = input;
  const scopeOfMatch = new Map(
    matches.map((match) => [match.id, statsScope(match.matchType)]),
  );
  const scoped = (scope: StatsScope) =>
    summarizeScope(
      matches.filter((match) => statsScope(match.matchType) === scope),
      participations.filter(
        (participation) => scopeOfMatch.get(participation.matchId) === scope,
      ),
    );

  return {
    matchCount: matches.length,
    main: scoped("main"),
    rush: scoped("rush"),
    awards: calculateNightAwards({ matches, participations }),
  };
}
