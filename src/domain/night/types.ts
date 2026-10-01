import type { MatchResult } from "../match";
import type { Position } from "../positions";

// Fonte única da lista de prêmios. O enum do banco é criado a partir dela.
export const AWARD_TYPES = [
  "top_scorer",
  "top_assists",
  "top_ga",
  "mvp",
  "best_goalkeeper",
] as const;

export type AwardType = (typeof AWARD_TYPES)[number];

// Partida não excluída de uma noite.
export interface NightMatch {
  id: number;
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
  rating: number;
}

// Co-vencedores aparecem como várias entradas do mesmo prêmio.
export interface NightAward {
  award: AwardType;
  playerId: number;
  // Gols, assistências, G/A ou média de nota (duas casas), conforme o prêmio.
  value: number;
}
