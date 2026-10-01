import type {
  RatingFormula,
  RatingInput,
  RatingOutput,
  RatingVersion,
} from "./types";
import { calculateRatingV1 } from "./v1";
import { calculateRatingV2 } from "./v2";

export { RATING_VERSIONS } from "./types";
export type { RatingInput, RatingOutput, RatingVersion } from "./types";

// Versão usada para notas novas. Notas já gravadas guardam a versão que as
// produziu e não mudam quando este valor mudar (ADR 0010).
export const CURRENT_RATING_VERSION: RatingVersion = "v2";

const FORMULAS: Record<RatingVersion, RatingFormula> = {
  v1: calculateRatingV1,
  v2: calculateRatingV2,
};

export function calculateRating(
  input: RatingInput,
  version: RatingVersion = CURRENT_RATING_VERSION,
): RatingOutput {
  return FORMULAS[version](input);
}
