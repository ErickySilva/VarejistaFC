export type MatchResult = "W" | "D" | "L";

export interface MatchScore {
  goalsFor: number;
  goalsAgainst: number;
  wentToPenalties: boolean;
  penaltyScoreFor: number | null;
  penaltyScoreAgainst: number | null;
}

// Mesma regra da coluna gerada `matches.result`: o placar decide e, em caso de
// empate com disputa, os pênaltis decidem. Os gols da disputa não são gols da
// partida.
export function matchResult(score: MatchScore): MatchResult {
  if (score.goalsFor > score.goalsAgainst) return "W";
  if (score.goalsFor < score.goalsAgainst) return "L";
  if (!score.wentToPenalties) return "D";

  if (score.penaltyScoreFor === null || score.penaltyScoreAgainst === null) {
    throw new RangeError("Disputa de pênaltis sem placar da disputa.");
  }
  return score.penaltyScoreFor > score.penaltyScoreAgainst ? "W" : "L";
}
