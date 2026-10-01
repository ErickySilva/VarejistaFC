import { describe, expect, it } from "vitest";
import { matchResult } from "./match";
import {
  isGoalkeeper,
  POSITION_LABEL,
  positionGroup,
  POSITIONS,
  type Position,
  type PositionGroup,
} from "./positions";

describe("posições", () => {
  it("são as 13 posições aprovadas", () => {
    expect(POSITIONS).toEqual([
      "GOL",
      "ZAG",
      "LD",
      "LE",
      "VOL",
      "MC",
      "MD",
      "ME",
      "MEI",
      "PD",
      "PE",
      "SA",
      "ATA",
    ]);
  });

  it("cada posição pertence ao grupo aprovado", () => {
    const expected: Record<PositionGroup, Position[]> = {
      GOL: ["GOL"],
      DEF: ["ZAG", "LD", "LE"],
      MEI: ["VOL", "MC", "MD", "ME", "MEI"],
      ATA: ["PD", "PE", "SA", "ATA"],
    };

    for (const [group, positions] of Object.entries(expected)) {
      for (const position of positions) {
        expect(positionGroup(position)).toBe(group);
      }
    }
    expect(Object.values(expected).flat()).toHaveLength(POSITIONS.length);
  });

  it("só GOL é goleiro e toda posição tem rótulo", () => {
    expect(POSITIONS.filter(isGoalkeeper)).toEqual(["GOL"]);
    for (const position of POSITIONS) {
      expect(POSITION_LABEL[position]).toBeTruthy();
    }
  });
});

describe("resultado da partida", () => {
  const noPenalties = {
    wentToPenalties: false,
    penaltyScoreFor: null,
    penaltyScoreAgainst: null,
  };

  it("o placar decide quando não há empate", () => {
    expect(matchResult({ goalsFor: 3, goalsAgainst: 1, ...noPenalties })).toBe(
      "W",
    );
    expect(matchResult({ goalsFor: 0, goalsAgainst: 1, ...noPenalties })).toBe(
      "L",
    );
  });

  it("empate sem disputa é D", () => {
    expect(matchResult({ goalsFor: 2, goalsAgainst: 2, ...noPenalties })).toBe(
      "D",
    );
  });

  it("empate com disputa é decidido pelos pênaltis", () => {
    const draw = { goalsFor: 2, goalsAgainst: 2, wentToPenalties: true };
    expect(
      matchResult({ ...draw, penaltyScoreFor: 4, penaltyScoreAgainst: 3 }),
    ).toBe("W");
    expect(
      matchResult({ ...draw, penaltyScoreFor: 3, penaltyScoreAgainst: 4 }),
    ).toBe("L");
  });

  it("rejeita disputa sem placar", () => {
    expect(() =>
      matchResult({
        goalsFor: 1,
        goalsAgainst: 1,
        wentToPenalties: true,
        penaltyScoreFor: null,
        penaltyScoreAgainst: null,
      }),
    ).toThrow(RangeError);
  });
});
