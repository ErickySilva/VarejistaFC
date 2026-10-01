import { describe, expect, it } from "vitest";
import type { MatchResult } from "../match";
import { POSITIONS, type Position } from "../positions";
import { calculateRating, CURRENT_RATING_VERSION } from "./index";
import type { RatingInput } from "./types";
import { calculateRatingV1 } from "./v1";

function resultFromScore(goalsFor: number, goalsAgainst: number): MatchResult {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

// Placar na ordem Varejista × adversário, como em docs/nota-v1.md.
function line(
  position: Position,
  goalsFor: number,
  goalsAgainst: number,
  goals: number,
  assists: number,
  result = resultFromScore(goalsFor, goalsAgainst),
): RatingInput {
  return {
    position,
    goals,
    assists,
    saves: null,
    goalsFor,
    goalsAgainst,
    result,
  };
}

function goalkeeper(
  goalsFor: number,
  goalsAgainst: number,
  saves: number,
  extra: Partial<RatingInput> = {},
): RatingInput {
  return {
    position: "GOL",
    goals: 0,
    assists: 0,
    saves,
    goalsFor,
    goalsAgainst,
    result: resultFromScore(goalsFor, goalsAgainst),
    ...extra,
  };
}

describe("nota v1: exemplos de docs/nota-v1.md", () => {
  it.each([
    ["L1", line("ATA", 4, 1, 2, 1), 9.575, 9.6],
    ["L2", line("ATA", 0, 2, 0, 0), 5.1, 5.1],
    ["L3", line("ATA", 3, 0, 0, 0), 6.1, 6.1],
    ["L4", line("ATA", 2, 3, 2, 0), 8.0, 8.0],
    ["L5", line("ATA", 6, 0, 4, 1), 10.617, 10.0],
    ["L6", line("MEI", 3, 1, 1, 0), 7.767, 7.8],
    ["L7", line("MEI", 2, 2, 0, 2), 8.1, 8.1],
    ["L8", line("MEI", 5, 2, 3, 2), 11.35, 10.0],
    ["L9", line("ZAG", 1, 0, 0, 0), 7.3, 7.3],
    ["L10", line("ZAG", 1, 4, 0, 0), 4.9, 4.9],
    ["G1", goalkeeper(2, 0, 6), 9.0, 9.0],
    ["G2", goalkeeper(1, 0, 0), 7.5, 7.5],
    ["G3", goalkeeper(1, 1, 4), 6.7, 6.7],
    ["G4", goalkeeper(2, 4, 10), 6.414, 6.4],
    ["G5", goalkeeper(0, 4, 1), 3.95, 4.0],
    ["G6", goalkeeper(5, 3, 2), 5.8, 5.8],
    ["G7", goalkeeper(0, 7, 12), 5.505, 5.5],
    ["G8", goalkeeper(0, 7, 2), 3.5, 3.5],
  ])("%s", (_name, input, expectedRaw, expectedRating) => {
    const output = calculateRatingV1(input);
    expect(output.rating).toBe(expectedRating);
    expect(output.raw).toBeCloseTo(expectedRaw, 3);
    expect(output.version).toBe("v1");
  });
});

describe("nota v1: limites", () => {
  it("o pior caso do goleiro fica exatamente no piso de 3,0", () => {
    const output = calculateRatingV1(goalkeeper(0, 10, 0));
    expect(output.raw).toBe(3);
    expect(output.rating).toBe(3.0);
  });

  it("atuações acima de 10 são limitadas a 10,0", () => {
    const output = calculateRatingV1(line("ZAG", 8, 0, 5, 3));
    expect(output.raw).toBeGreaterThan(10);
    expect(output.rating).toBe(10.0);
  });

  it("toda combinação válida fica entre 3,0 e 10,0 com uma casa decimal", () => {
    for (const position of POSITIONS) {
      for (let goalsFor = 0; goalsFor <= 7; goalsFor++) {
        for (let goalsAgainst = 0; goalsAgainst <= 9; goalsAgainst += 3) {
          for (let goals = 0; goals <= goalsFor; goals++) {
            for (let assists = 0; goals + assists <= goalsFor; assists++) {
              for (const saves of [0, 5, 13, 40]) {
                const { rating } = calculateRatingV1({
                  position,
                  goals,
                  assists,
                  saves: position === "GOL" ? saves : null,
                  goalsFor,
                  goalsAgainst,
                  result: resultFromScore(goalsFor, goalsAgainst),
                });
                expect(rating).toBeGreaterThanOrEqual(3);
                expect(rating).toBeLessThanOrEqual(10);
                expect(Number.isInteger(Math.round(rating * 10))).toBe(true);
                expect(rating).toBe(Math.round(rating * 10) / 10);
              }
            }
          }
        }
      }
    }
  });
});

describe("nota v1: jogadores de linha", () => {
  it("partida 0x0: cada grupo recebe suas parcelas de em branco e clean sheet", () => {
    expect(calculateRatingV1(line("ATA", 0, 0, 0, 0)).rating).toBe(5.6);
    expect(calculateRatingV1(line("MEI", 0, 0, 0, 0)).rating).toBe(6.0);
    expect(calculateRatingV1(line("ZAG", 0, 0, 0, 0)).rating).toBe(6.8);
  });

  it("gols e assistências valem metade a partir do 3º", () => {
    // 6,0 + 1,0 + 1,0 + 0,5 (3º gol) + 0,5 participação + 0,5 vitória
    expect(calculateRatingV1(line("ATA", 3, 0, 3, 0)).rating).toBe(9.5);
    // 6,0 + 0,7 + 0,7 + 0,35 (3ª assistência) + 0,5 participação + 0,5 vitória
    expect(calculateRatingV1(line("ATA", 3, 0, 0, 3)).raw).toBeCloseTo(8.75, 3);
  });

  it("defensor perde 0,2 por gol sofrido a partir do 2º, até 1,0", () => {
    expect(calculateRatingV1(line("ZAG", 0, 1, 0, 0)).rating).toBe(5.5);
    expect(calculateRatingV1(line("ZAG", 0, 2, 0, 0)).rating).toBe(5.3);
    expect(calculateRatingV1(line("ZAG", 0, 6, 0, 0)).rating).toBe(4.5);
    expect(calculateRatingV1(line("ZAG", 0, 9, 0, 0)).rating).toBe(4.5);
  });

  it("posições do mesmo grupo recebem a mesma nota", () => {
    const groups: Position[][] = [
      ["ZAG", "LD", "LE"],
      ["VOL", "MC", "MD", "ME", "MEI"],
      ["PD", "PE", "SA", "ATA"],
    ];
    for (const positions of groups) {
      const ratings = positions.map(
        (position) => calculateRatingV1(line(position, 3, 2, 1, 1)).rating,
      );
      expect(new Set(ratings).size).toBe(1);
    }
  });

  it("saves é ignorado para jogador de linha", () => {
    const withSaves = { ...line("MC", 2, 1, 1, 0), saves: 5 };
    expect(calculateRatingV1(withSaves).rating).toBe(
      calculateRatingV1(line("MC", 2, 1, 1, 0)).rating,
    );
  });
});

describe("nota v1: goleiro", () => {
  it("sem chutes contra: taxa de defesa zero e clean sheet", () => {
    const output = calculateRatingV1(goalkeeper(0, 0, 0));
    expect(output.rating).toBe(7.0);
  });

  it("defesas valem 0,25 até a 8ª, 0,10 depois, com teto de 3,0", () => {
    expect(calculateRatingV1(goalkeeper(0, 0, 8)).raw).toBeCloseTo(9.0, 3);
    expect(calculateRatingV1(goalkeeper(0, 0, 12)).raw).toBeCloseTo(9.4, 3);
    expect(calculateRatingV1(goalkeeper(0, 0, 18)).raw).toBeCloseTo(10.0, 3);
    expect(calculateRatingV1(goalkeeper(0, 0, 40)).raw).toBeCloseTo(10.0, 3);
  });

  it("gol e assistência de goleiro somam 1,0 e 0,7, sem bônus de participação", () => {
    // 6,0 + 0,75 (3 defesas) + 1,0 clean sheet + 1,0 gol + 0,5 vitória = 9,25
    const scorer = calculateRatingV1(goalkeeper(1, 0, 3, { goals: 1 }));
    expect(scorer.raw).toBeCloseTo(9.25, 3);
    expect(scorer.rating).toBe(9.3);

    const assister = calculateRatingV1(goalkeeper(1, 0, 3, { assists: 1 }));
    expect(assister.raw).toBeCloseTo(8.95, 3);
  });

  it("exige o número de defesas", () => {
    expect(() =>
      calculateRatingV1({ ...goalkeeper(1, 0, 0), saves: null }),
    ).toThrow(RangeError);
  });
});

describe("nota v1: disputa de pênaltis", () => {
  it("vitória nos pênaltis recebe o bônus de vitória", () => {
    // 6,0 + 1,0 gol + 0,25 participação + 0,5 vitória = 7,75 → 7,8
    const output = calculateRatingV1(line("ATA", 2, 2, 1, 0, "W"));
    expect(output.raw).toBeCloseTo(7.75, 3);
    expect(output.rating).toBe(7.8);
  });

  it("derrota nos pênaltis recebe a penalidade de derrota", () => {
    // 6,0 + 1,0 gol + 0,25 participação − 0,5 derrota = 6,75 → 6,8
    const output = calculateRatingV1(line("ATA", 2, 2, 1, 0, "L"));
    expect(output.raw).toBeCloseTo(6.75, 3);
    expect(output.rating).toBe(6.8);
  });

  it("empate sem disputa não soma nem tira", () => {
    expect(calculateRatingV1(line("ATA", 2, 2, 1, 0, "D")).raw).toBeCloseTo(
      7.25,
      3,
    );
  });
});

describe("nota v1: entradas inválidas", () => {
  it.each([
    ["gols negativos", { ...line("ATA", 2, 0, 0, 0), goals: -1 }],
    ["assistências fracionadas", { ...line("ATA", 2, 0, 0, 0), assists: 0.5 }],
    ["placar negativo", { ...line("ATA", 2, 0, 0, 0), goalsAgainst: -1 }],
    ["defesas negativas", goalkeeper(1, 0, -1)],
    ["G/A acima do placar", line("ATA", 2, 0, 2, 1)],
    ["vitória informada como derrota", line("ATA", 2, 0, 1, 0, "L")],
    ["derrota informada como empate", line("ATA", 0, 2, 0, 0, "D")],
  ])("rejeita %s", (_name, input) => {
    expect(() => calculateRatingV1(input)).toThrow(RangeError);
  });
});

describe("seleção de versão", () => {
  it("a versão vigente é a v1 e é a usada por padrão", () => {
    const input = line("ATA", 4, 1, 2, 1);
    expect(CURRENT_RATING_VERSION).toBe("v1");
    expect(calculateRating(input)).toEqual(calculateRatingV1(input));
    expect(calculateRating(input, "v1").version).toBe("v1");
  });
});
