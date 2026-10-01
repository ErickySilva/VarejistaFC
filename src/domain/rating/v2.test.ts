import { describe, expect, it } from "vitest";
import type { MatchResult } from "../match";
import { POSITIONS, type Position } from "../positions";
import { calculateRating, CURRENT_RATING_VERSION } from "./index";
import type { RatingInput } from "./types";
import { calculateRatingV1 } from "./v1";
import { calculateRatingV2 } from "./v2";

function resultFromScore(goalsFor: number, goalsAgainst: number): MatchResult {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

function line(
  position: Position,
  goalsFor: number,
  goalsAgainst: number,
  goals: number,
  assists: number,
): RatingInput {
  return {
    position,
    goals,
    assists,
    saves: null,
    goalsFor,
    goalsAgainst,
    result: resultFromScore(goalsFor, goalsAgainst),
  };
}

function goalkeeper(
  goalsFor: number,
  goalsAgainst: number,
  saves: number,
  penaltiesSaved: number | null = null,
): RatingInput {
  return {
    position: "GOL",
    goals: 0,
    assists: 0,
    saves,
    penaltiesSaved,
    goalsFor,
    goalsAgainst,
    result: resultFromScore(goalsFor, goalsAgainst),
  };
}

// Os 18 exemplos de docs/nota-v1.md, com a nota aprovada na v1.
const V1_EXAMPLES: [string, RatingInput, number][] = [
  ["L1", line("ATA", 4, 1, 2, 1), 9.6],
  ["L2", line("ATA", 0, 2, 0, 0), 5.1],
  ["L3", line("ATA", 3, 0, 0, 0), 6.1],
  ["L4", line("ATA", 2, 3, 2, 0), 8.0],
  ["L5", line("ATA", 6, 0, 4, 1), 10.0],
  ["L6", line("MEI", 3, 1, 1, 0), 7.8],
  ["L7", line("MEI", 2, 2, 0, 2), 8.1],
  ["L8", line("MEI", 5, 2, 3, 2), 10.0],
  ["L9", line("ZAG", 1, 0, 0, 0), 7.3],
  ["L10", line("ZAG", 1, 4, 0, 0), 4.9],
  ["G1", goalkeeper(2, 0, 6), 9.0],
  ["G2", goalkeeper(1, 0, 0), 7.5],
  ["G3", goalkeeper(1, 1, 4), 6.7],
  ["G4", goalkeeper(2, 4, 10), 6.4],
  ["G5", goalkeeper(0, 4, 1), 4.0],
  ["G6", goalkeeper(5, 3, 2), 5.8],
  ["G7", goalkeeper(0, 7, 12), 5.5],
  ["G8", goalkeeper(0, 7, 2), 3.5],
];

describe("nota v2: sem pênalti defendido é idêntica à v1", () => {
  it.each(V1_EXAMPLES)("exemplo %s da v1", (_name, input, expectedRating) => {
    const v1 = calculateRatingV1(input);
    const v2 = calculateRatingV2(input);

    expect(v1.rating).toBe(expectedRating);
    expect(v2.rating).toBe(expectedRating);
    expect(v2.raw).toBe(v1.raw);
    expect(v2.version).toBe("v2");
  });

  it("goleiro com zero pênaltis defendidos informado explicitamente", () => {
    for (const [, input] of V1_EXAMPLES.filter(([name]) => name[0] === "G")) {
      const explicitZero = { ...input, penaltiesSaved: 0 };
      expect(calculateRatingV2(explicitZero).raw).toBe(
        calculateRatingV1(input).raw,
      );
    }
  });

  it("toda combinação sem pênalti defendido dá a mesma nota nas duas versões", () => {
    let compared = 0;
    for (const position of POSITIONS) {
      for (let goalsFor = 0; goalsFor <= 7; goalsFor++) {
        for (let goalsAgainst = 0; goalsAgainst <= 9; goalsAgainst += 3) {
          for (let goals = 0; goals <= goalsFor; goals++) {
            for (let assists = 0; goals + assists <= goalsFor; assists++) {
              for (const saves of [0, 5, 13, 40]) {
                const input: RatingInput = {
                  position,
                  goals,
                  assists,
                  saves: position === "GOL" ? saves : null,
                  goalsFor,
                  goalsAgainst,
                  result: resultFromScore(goalsFor, goalsAgainst),
                };
                const v1 = calculateRatingV1(input);
                const v2 = calculateRatingV2(input);
                expect(v2.rating).toBe(v1.rating);
                expect(v2.raw).toBe(v1.raw);
                compared++;
              }
            }
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(5000);
  });
});

describe("nota v2: pênalti defendido", () => {
  it("cada pênalti defendido soma 0,5 além do que já vale como defesa", () => {
    // G3 da v1: 1x1 com 4 defesas = 6,7. Uma das 4 foi de pênalti.
    const without = calculateRatingV2(goalkeeper(1, 1, 4));
    const withOne = calculateRatingV2(goalkeeper(1, 1, 4, 1));
    const withTwo = calculateRatingV2(goalkeeper(1, 1, 4, 2));

    expect(without.rating).toBe(6.7);
    expect(withOne.raw).toBeCloseTo(without.raw + 0.5, 6);
    expect(withOne.rating).toBe(7.2);
    expect(withTwo.raw).toBeCloseTo(without.raw + 1.0, 6);
    expect(withTwo.rating).toBe(7.7);
  });

  it("o pênalti defendido não é contado de novo como defesa", () => {
    // 4 defesas com 1 de pênalti valem as mesmas 4 defesas, mais o bônus:
    // não viram 5 defesas.
    const fourSavesOnePenalty = calculateRatingV2(goalkeeper(1, 1, 4, 1));
    const fiveSaves = calculateRatingV2(goalkeeper(1, 1, 5));
    const fourSaves = calculateRatingV2(goalkeeper(1, 1, 4));

    expect(fourSavesOnePenalty.raw).toBeCloseTo(fourSaves.raw + 0.5, 6);
    expect(fourSavesOnePenalty.raw).not.toBeCloseTo(fiveSaves.raw + 0.5, 3);
  });

  it("a v1 ignora o pênalti defendido", () => {
    expect(calculateRatingV1(goalkeeper(1, 1, 4, 2)).rating).toBe(6.7);
  });

  it("o limite final continua em 10,0", () => {
    // G1 da v1 (2x0, 6 defesas) vale 9,0; com 3 pênaltis passaria de 10.
    const output = calculateRatingV2(goalkeeper(2, 0, 6, 3));
    expect(output.raw).toBeCloseTo(10.5, 6);
    expect(output.rating).toBe(10.0);
  });

  it("pode tirar o goleiro do piso em uma goleada", () => {
    // 0x10 sem defesas é 3,0; com 2 defesas, as duas de pênalti, sobe.
    expect(calculateRatingV2(goalkeeper(0, 10, 0)).rating).toBe(3.0);
    expect(calculateRatingV2(goalkeeper(0, 10, 2, 2)).rating).toBe(4.5);
  });

  it("é ignorado para jogador de linha", () => {
    const input = { ...line("MC", 2, 1, 1, 0), penaltiesSaved: 3 };
    expect(calculateRatingV2(input).raw).toBe(
      calculateRatingV2(line("MC", 2, 1, 1, 0)).raw,
    );
  });

  it("rejeita valores inválidos", () => {
    expect(() => calculateRatingV2(goalkeeper(1, 1, 2, 3))).toThrow(RangeError);
    expect(() => calculateRatingV2(goalkeeper(1, 1, 2, -1))).toThrow(
      RangeError,
    );
    expect(() => calculateRatingV2(goalkeeper(1, 1, 2, 0.5))).toThrow(
      RangeError,
    );
  });
});

describe("seleção de versão", () => {
  it("a versão vigente é a v2 e é a usada por padrão", () => {
    const input = goalkeeper(1, 1, 4, 1);
    expect(CURRENT_RATING_VERSION).toBe("v2");
    expect(calculateRating(input)).toEqual(calculateRatingV2(input));
  });

  it("a v1 continua disponível para recalcular notas antigas", () => {
    const input = goalkeeper(1, 1, 4, 1);
    expect(calculateRating(input, "v1")).toEqual(calculateRatingV1(input));
    expect(calculateRating(input, "v1").version).toBe("v1");
  });
});
