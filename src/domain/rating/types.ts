import type { MatchResult } from "../match";
import type { Position } from "../positions";

export const RATING_VERSIONS = ["v1", "v2"] as const;

export type RatingVersion = (typeof RATING_VERSIONS)[number];

export interface RatingInput {
  // Posição ocupada naquela partida, não a posição padrão do jogador.
  position: Position;
  goals: number;
  assists: number;
  // Obrigatório para goleiro; ignorado para jogadores de linha.
  saves: number | null;
  // Pênaltis defendidos pelo goleiro durante a partida, já incluídos em
  // `saves`. Usado a partir da v2; a v1 ignora.
  penaltiesSaved?: number | null;
  goalsFor: number;
  goalsAgainst: number;
  // Já considera a disputa de pênaltis, quando houve.
  result: MatchResult;
}

export interface RatingOutput {
  // Nota final, entre 3,0 e 10,0, com uma casa decimal. É o valor gravado.
  rating: number;
  version: RatingVersion;
  // Soma das parcelas antes dos limites e do arredondamento. Só informativo.
  raw: number;
}

export type RatingFormula = (input: RatingInput) => RatingOutput;
