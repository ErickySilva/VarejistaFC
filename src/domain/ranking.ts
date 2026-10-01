// Ordenações do Ranking do Varejista. Funções puras: recebem os números já
// calculados de cada jogador e devolvem a ordem.

export const RANKING_TABS = [
  "geral",
  "gols",
  "assistencias",
  "ga",
  "nota",
  "goleiros",
] as const;

export type RankingTab = (typeof RANKING_TABS)[number];

export const RANKING_TAB_LABEL: Record<RankingTab, string> = {
  geral: "Geral",
  gols: "Gols",
  assistencias: "Assistências",
  ga: "G/A",
  nota: "Nota VFC",
  goleiros: "Goleiros",
};

export interface RankablePlayer {
  shirtNumber: number;
  goals: number;
  assists: number;
  goalContributions: number;
  // Partidas com Nota VFC.
  ratedMatches: number;
  averageRating: number | null;
  goalkeeper: {
    matches: number;
    averageRating: number | null;
    savesPerMatch: number | null;
    cleanSheets: number;
  };
}

type Comparator = (a: RankablePlayer, b: RankablePlayer) => number;

// Maior primeiro; quem não tem o valor (null) fica por último.
const desc =
  (value: (player: RankablePlayer) => number | null): Comparator =>
  (a, b) =>
    (value(b) ?? -Infinity) - (value(a) ?? -Infinity);

const goals = desc((player) => player.goals);
const assists = desc((player) => player.assists);
const goalContributions = desc((player) => player.goalContributions);

const COMPARATORS: Record<RankingTab, Comparator[]> = {
  // G/A, depois gols e, em caso de empate, assistências.
  geral: [goalContributions, goals, assists],
  gols: [goals, goalContributions],
  assistencias: [assists, goalContributions],
  ga: [goalContributions, goals, assists],
  // A quantidade de partidas avaliadas vem antes da média.
  nota: [
    desc((player) => player.ratedMatches),
    desc((player) => player.averageRating),
    goalContributions,
    goals,
  ],
  goleiros: [
    desc((player) => player.goalkeeper.matches),
    desc((player) => player.goalkeeper.averageRating),
    desc((player) => player.goalkeeper.savesPerMatch),
    desc((player) => player.goalkeeper.cleanSheets),
  ],
};

export function compareForRanking(
  tab: RankingTab,
  a: RankablePlayer,
  b: RankablePlayer,
): number {
  for (const comparator of COMPARATORS[tab]) {
    const difference = comparator(a, b);
    if (difference !== 0) return difference;
  }
  // Empate em tudo: ordem estável pelo número da camisa.
  return a.shirtNumber - b.shirtNumber;
}

export function rankPlayers<T extends RankablePlayer>(
  players: readonly T[],
  tab: RankingTab,
): T[] {
  return [...players].sort((a, b) => compareForRanking(tab, a, b));
}

// O ranking de goleiros lista só quem já jogou no gol.
export function hasGoalkeeperStats(player: RankablePlayer): boolean {
  return player.goalkeeper.matches > 0;
}
