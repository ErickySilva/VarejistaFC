import { describe, expect, it } from "vitest";
import {
  validateMatchEntry,
  type MatchEntry,
  type ParticipationEntry,
} from "./match-entry";
import { formatReferenceDate, referenceDateFor } from "./reference-date";

function player(
  playerId: number,
  overrides: Partial<ParticipationEntry> = {},
): ParticipationEntry {
  return {
    playerId,
    position: "MC",
    goals: 0,
    assists: 0,
    saves: null,
    penaltiesSaved: null,
    ...overrides,
  };
}

function keeper(
  playerId: number,
  saves: number | null = 0,
  penaltiesSaved: number | null = null,
): ParticipationEntry {
  return player(playerId, { position: "GOL", saves, penaltiesSaved });
}

function match(overrides: Partial<MatchEntry> = {}): MatchEntry {
  return {
    goalsFor: 3,
    goalsAgainst: 1,
    wentToPenalties: false,
    penaltyScoreFor: null,
    penaltyScoreAgainst: null,
    participations: [player(1)],
    ...overrides,
  };
}

const codes = (entry: MatchEntry) =>
  validateMatchEntry(entry).map((issue) => issue.code);

describe("validação da partida: casos válidos", () => {
  it("jogador com 0 gols e 0 assistências é uma participação válida", () => {
    expect(validateMatchEntry(match())).toEqual([]);
  });

  it("soma de gols igual ao placar, com goleiro e linha", () => {
    const entry = match({
      participations: [
        player(1, { position: "ATA", goals: 2 }),
        player(2, { position: "MEI", goals: 1, assists: 2 }),
        keeper(3, 5, 1),
      ],
    });
    expect(validateMatchEntry(entry)).toEqual([]);
  });

  it("soma de gols menor que o placar (gols de bots)", () => {
    expect(
      validateMatchEntry(
        match({ goalsFor: 5, participations: [player(1, { goals: 1 })] }),
      ),
    ).toEqual([]);
  });

  it("goleiro com zero defesas e sem defesas de pênalti informadas", () => {
    expect(
      validateMatchEntry(match({ participations: [keeper(1, 0)] })),
    ).toEqual([]);
  });

  it("empate decidido nos pênaltis", () => {
    const entry = match({
      goalsFor: 2,
      goalsAgainst: 2,
      wentToPenalties: true,
      penaltyScoreFor: 4,
      penaltyScoreAgainst: 3,
    });
    expect(validateMatchEntry(entry)).toEqual([]);
  });
});

describe("validação da partida: jogadores", () => {
  it("exige pelo menos um jogador", () => {
    expect(codes(match({ participations: [] }))).toEqual(["NO_PLAYERS"]);
  });

  it("rejeita jogador repetido", () => {
    expect(codes(match({ participations: [player(1), player(1)] }))).toEqual([
      "DUPLICATE_PLAYER",
    ]);
  });

  it("rejeita dois goleiros", () => {
    expect(codes(match({ participations: [keeper(1), keeper(2)] }))).toEqual([
      "MULTIPLE_GOALKEEPERS",
    ]);
  });

  it("rejeita números negativos ou fracionados", () => {
    expect(
      codes(match({ participations: [player(1, { goals: -1 })] })),
    ).toEqual(["INVALID_NUMBER"]);
    expect(
      codes(match({ participations: [player(1, { assists: 0.5 })] })),
    ).toEqual(["INVALID_NUMBER"]);
    expect(codes(match({ goalsFor: -1 }))).toEqual(["INVALID_NUMBER"]);
  });
});

describe("validação da partida: totais", () => {
  it("rejeita soma de gols acima do placar", () => {
    const entry = match({
      goalsFor: 2,
      participations: [player(1, { goals: 2 }), player(2, { goals: 1 })],
    });
    expect(codes(entry)).toEqual(["GOALS_EXCEED_SCORE"]);
  });

  it("rejeita soma de assistências acima do placar", () => {
    const entry = match({
      goalsFor: 2,
      participations: [
        player(1, { goals: 2 }),
        player(2, { assists: 2 }),
        player(3, { assists: 1 }),
      ],
    });
    expect(codes(entry)).toEqual(["ASSISTS_EXCEED_SCORE"]);
  });

  it("rejeita gols + assistências de um jogador acima do placar e aponta quem", () => {
    const entry = match({
      goalsFor: 2,
      participations: [player(7, { goals: 2, assists: 1 })],
    });
    expect(validateMatchEntry(entry)).toMatchObject([
      { code: "CONTRIBUTIONS_EXCEED_SCORE", playerId: 7 },
    ]);
  });
});

describe("validação da partida: goleiro", () => {
  it("goleiro precisa do número de defesas", () => {
    expect(codes(match({ participations: [keeper(1, null)] }))).toEqual([
      "SAVES_REQUIRED",
    ]);
  });

  it("jogador de linha não tem defesas nem defesas de pênalti", () => {
    expect(codes(match({ participations: [player(1, { saves: 2 })] }))).toEqual(
      ["SAVES_NOT_ALLOWED"],
    );
    expect(
      codes(match({ participations: [player(1, { penaltiesSaved: 1 })] })),
    ).toEqual(["SAVES_NOT_ALLOWED"]);
  });

  it("defesas de pênalti não podem passar do total de defesas", () => {
    expect(codes(match({ participations: [keeper(1, 2, 3)] }))).toEqual([
      "PENALTIES_SAVED_EXCEED_SAVES",
    ]);
    expect(codes(match({ participations: [keeper(1, 3, 3)] }))).toEqual([]);
  });
});

describe("validação da partida: disputa de pênaltis", () => {
  const draw = { goalsFor: 2, goalsAgainst: 2 };

  it("só existe depois de empate", () => {
    const entry = match({
      wentToPenalties: true,
      penaltyScoreFor: 4,
      penaltyScoreAgainst: 3,
    });
    expect(codes(entry)).toEqual(["PENALTIES_REQUIRE_DRAW"]);
  });

  it("exige o placar da disputa", () => {
    expect(codes(match({ ...draw, wentToPenalties: true }))).toEqual([
      "PENALTY_SCORE_REQUIRED",
    ]);
  });

  it("não pode terminar empatada", () => {
    const entry = match({
      ...draw,
      wentToPenalties: true,
      penaltyScoreFor: 3,
      penaltyScoreAgainst: 3,
    });
    expect(codes(entry)).toEqual(["PENALTY_SCORE_TIED"]);
  });

  it("placar de pênaltis sem marcar a disputa é rejeitado", () => {
    const entry = match({
      ...draw,
      penaltyScoreFor: 4,
      penaltyScoreAgainst: 3,
    });
    expect(codes(entry)).toEqual(["PENALTY_SCORE_NOT_ALLOWED"]);
  });

  it("gols da disputa não aumentam o limite de gols dos jogadores", () => {
    const entry = match({
      ...draw,
      wentToPenalties: true,
      penaltyScoreFor: 4,
      penaltyScoreAgainst: 3,
      participations: [player(1, { goals: 2 }), player(2, { goals: 1 })],
    });
    expect(codes(entry)).toEqual(["GOALS_EXCEED_SCORE"]);
  });
});

describe("validação da partida: vários problemas", () => {
  it("devolve todos de uma vez", () => {
    const entry = match({
      goalsFor: 1,
      participations: [player(1, { goals: 2 }), keeper(2, 1, 2), keeper(3, 0)],
    });
    expect(codes(entry).sort()).toEqual(
      [
        "CONTRIBUTIONS_EXCEED_SCORE",
        "GOALS_EXCEED_SCORE",
        "MULTIPLE_GOALKEEPERS",
        "PENALTIES_SAVED_EXCEED_SAVES",
      ].sort(),
    );
  });
});

describe("data de referência", () => {
  it("usa a data de São Paulo, não a UTC", () => {
    // 02:30 UTC de 3/10 ainda é 23:30 de 2/10 em São Paulo.
    expect(referenceDateFor(new Date("2026-10-03T02:30:00Z"))).toBe(
      "2026-10-02",
    );
    // 03:00 UTC é meia-noite em São Paulo: já é dia 3.
    expect(referenceDateFor(new Date("2026-10-03T03:00:00Z"))).toBe(
      "2026-10-03",
    );
  });

  it("vira o mês e o ano no horário local", () => {
    expect(referenceDateFor(new Date("2026-11-01T02:59:59Z"))).toBe(
      "2026-10-31",
    );
    expect(referenceDateFor(new Date("2027-01-01T02:59:59Z"))).toBe(
      "2026-12-31",
    );
    expect(referenceDateFor(new Date("2027-01-01T03:00:00Z"))).toBe(
      "2027-01-01",
    );
  });

  it("aceita outro fuso", () => {
    expect(referenceDateFor(new Date("2026-10-03T02:30:00Z"), "UTC")).toBe(
      "2026-10-03",
    );
  });

  it("formata no padrão brasileiro", () => {
    expect(formatReferenceDate("2026-10-02")).toBe("02/10/2026");
  });
});
