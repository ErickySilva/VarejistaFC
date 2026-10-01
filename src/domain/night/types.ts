import type { MatchResult } from "../match";
import type { MatchType } from "../match-type";
import type { Position } from "../positions";

// Fonte única da lista de prêmios. O enum do banco é criado a partir dela.
export const AWARD_TYPES = [
  // Artilheiro, Assistente e Craque da Noite: só partidas principais (X1 e
  // Partida).
  "top_scorer",
  "top_assists",
  "mvp",
  // Destaque do Rush: só partidas de Rush
  "rush_mvp",
] as const;

export type AwardType = (typeof AWARD_TYPES)[number];

// Partida não excluída de uma noite.
export interface NightMatch {
  id: number;
  matchType: MatchType;
  goalsFor: number;
  goalsAgainst: number;
  result: MatchResult;
  wentToPenalties: boolean;
}

export interface NightParticipation {
  playerId: number;
  matchId: number;
  position: Position;
  goals: number;
  assists: number;
  // Só para goleiro; null para jogador de linha.
  saves: number | null;
  penaltiesSaved: number | null;
  // Nota VFC. A Nota FIFA é só informativa e não entra em nenhum cálculo.
  rating: number;
}

// Co-vencedores aparecem como várias entradas do mesmo prêmio.
export interface NightAward {
  award: AwardType;
  playerId: number;
  // Gols, assistências ou média de Nota VFC (duas casas), conforme o prêmio.
  value: number;
}
