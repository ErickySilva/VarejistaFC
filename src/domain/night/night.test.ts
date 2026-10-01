import { describe, expect, it } from "vitest";
import type { MatchType } from "../match-type";
import type { Position } from "../positions";
import { calculateNightAwards, minimumMatchesForMvp } from "./awards";
import { summarizeNight } from "./summary";
import type {
  AwardType,
  NightAward,
  NightMatch,
  NightParticipation,
} from "./types";

const ERICKY = 1;
const LUCAO = 2;
const FELP = 3;
const HEIT = 4;

function match(
  id: number,
  matchType: MatchType = "match",
  goalsFor = 3,
  goalsAgainst = 0,
  result: NightMatch["result"] = "W",
  wentToPenalties = false,
): NightMatch {
  return { id, matchType, goalsFor, goalsAgainst, result, wentToPenalties };
}

// `count` partidas principais, com ids 1..count.
function mainMatches(count: number): NightMatch[] {
  return Array.from({ length: count }, (_, index) => match(index + 1));
}

function played(
  playerId: number,
  matchId: number,
  rating: number,
  goals = 0,
  assists = 0,
  position: Position = "MC",
  saves: number | null = null,
  penaltiesSaved: number | null = null,
): NightParticipation {
  return {
    playerId,
    matchId,
    position,
    goals,
    assists,
    saves,
    penaltiesSaved,
    rating,
  };
}

function winners(awards: NightAward[], award: AwardType) {
  return awards
    .filter((entry) => entry.award === award)
    .map((entry) => [entry.playerId, entry.value]);
}

describe("mínimo de partidas", () => {
  it("é metade das partidas do recorte, arredondando para cima", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(minimumMatchesForMvp)).toEqual([
      1, 1, 2, 2, 3, 3, 4,
    ]);
  });
});

describe("craque da noite", () => {
  it("vence a maior média de Nota VFC entre os elegíveis", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(2),
      participations: [
        played(ERICKY, 1, 8.0),
        played(ERICKY, 2, 7.0),
        played(LUCAO, 1, 7.0),
        played(LUCAO, 2, 7.4),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 7.5]]);
  });

  it("em noite de 5 partidas, quem jogou 2 não concorre e quem jogou 3 concorre", () => {
    const participations = [
      // Lucão: 2 partidas com média 10, abaixo do mínimo de 3.
      played(LUCAO, 1, 10.0),
      played(LUCAO, 2, 10.0),
      // Ericky: 3 partidas com média 7.
      played(ERICKY, 1, 7.0),
      played(ERICKY, 2, 7.0),
      played(ERICKY, 3, 7.0),
      // Felp: 5 partidas com média 6.
      ...[1, 2, 3, 4, 5].map((matchId) => played(FELP, matchId, 6.0)),
    ];
    const awards = calculateNightAwards({
      matches: mainMatches(5),
      participations,
    });
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 7]]);
  });

  it("o mínimo usa as partidas da noite, não as do jogador", () => {
    // 4 partidas na noite; só a primeira tem participação registrada aqui.
    const awards = calculateNightAwards({
      matches: mainMatches(4),
      participations: [played(ERICKY, 1, 9.0)],
    });
    expect(winners(awards, "mvp")).toEqual([]);
  });

  it("empate na média é desempatado por G/A", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(1),
      participations: [
        played(ERICKY, 1, 8.0, 1, 1),
        played(LUCAO, 1, 8.0, 1, 0),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 8]]);
  });

  it("empate na média e no G/A é desempatado por gols", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(1),
      participations: [
        played(ERICKY, 1, 8.0, 0, 2),
        played(LUCAO, 1, 8.0, 2, 0),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[LUCAO, 8]]);
  });

  it("empate completo gera co-vencedores", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(1),
      participations: [
        played(ERICKY, 1, 8.0, 1, 1),
        played(LUCAO, 1, 8.0, 1, 1),
        played(FELP, 1, 7.9, 3, 0),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([
      [ERICKY, 8],
      [LUCAO, 8],
    ]);
  });

  it("compara médias de forma exata com números de partidas diferentes", () => {
    // Ericky: (7,3 + 7,4 + 7,3) / 3 = 7,333...; Lucão: (7,3 + 7,4) / 2 = 7,35.
    const awards = calculateNightAwards({
      matches: mainMatches(3),
      participations: [
        played(ERICKY, 1, 7.3),
        played(ERICKY, 2, 7.4),
        played(ERICKY, 3, 7.3),
        played(LUCAO, 1, 7.3),
        played(LUCAO, 2, 7.4),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[LUCAO, 7.35]]);
  });

  it("goleiro concorre como qualquer jogador", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(1),
      participations: [
        played(HEIT, 1, 9.3, 0, 0, "GOL", 5, 1),
        played(LUCAO, 1, 8.8, 2, 0, "ATA"),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[HEIT, 9.3]]);
  });
});

describe("craque da noite e Rush", () => {
  // Noite com 2 partidas principais (X1 e Partida) e 4 de Rush.
  const matches = [
    match(1, "x1"),
    match(2, "match"),
    match(3, "rush"),
    match(4, "rush"),
    match(5, "rush"),
    match(6, "rush"),
  ];

  it("considera só X1 e Partida: nota e mínimo ignoram o Rush", () => {
    const awards = calculateNightAwards({
      matches,
      participations: [
        // Ericky jogou as 2 principais (média 7) e nenhuma de Rush.
        played(ERICKY, 1, 7.0),
        played(ERICKY, 2, 7.0),
        // Lucão jogou 1 principal (nota 6) e foi muito bem em todo o Rush.
        played(LUCAO, 1, 6.0),
        ...[3, 4, 5, 6].map((id) => played(LUCAO, id, 10.0, 3, 0)),
      ],
    });

    // Mínimo de 1 (metade de 2 principais): os dois concorrem, e a média do
    // Lucão é 6,0, sem as notas 10 do Rush.
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 7]]);
  });

  it("quem só jogou Rush não concorre a craque", () => {
    const awards = calculateNightAwards({
      matches,
      participations: [
        played(ERICKY, 1, 6.0),
        ...[3, 4, 5, 6].map((id) => played(FELP, id, 9.5)),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 6]]);
  });

  it("noite só com Rush não tem craque da noite", () => {
    const awards = calculateNightAwards({
      matches: [match(1, "rush"), match(2, "rush")],
      participations: [played(ERICKY, 1, 9.0), played(ERICKY, 2, 9.0)],
    });
    expect(winners(awards, "mvp")).toEqual([]);
    expect(winners(awards, "rush_mvp")).toEqual([[ERICKY, 9]]);
  });
});

describe("destaque do Rush", () => {
  const matches = [
    match(1, "match"),
    match(2, "rush"),
    match(3, "rush"),
    match(4, "rush"),
  ];

  it("usa a mesma regra do craque, só com as partidas de Rush", () => {
    const awards = calculateNightAwards({
      matches,
      participations: [
        // Nota alta na partida principal não entra no Rush.
        played(ERICKY, 1, 10.0),
        played(ERICKY, 2, 6.0),
        played(ERICKY, 3, 6.0),
        played(LUCAO, 2, 8.0),
        played(LUCAO, 3, 7.0),
        played(LUCAO, 4, 9.0),
      ],
    });
    expect(winners(awards, "rush_mvp")).toEqual([[LUCAO, 8]]);
  });

  it("exige metade das partidas de Rush, arredondando para cima", () => {
    const awards = calculateNightAwards({
      matches,
      participations: [
        // 1 de 3 partidas de Rush: abaixo do mínimo de 2.
        played(ERICKY, 2, 10.0),
        played(LUCAO, 2, 6.0),
        played(LUCAO, 3, 6.0),
      ],
    });
    expect(winners(awards, "rush_mvp")).toEqual([[LUCAO, 6]]);
  });

  it("desempata por G/A, depois gols, e aceita co-vencedores", () => {
    const tie = (felpGoals: number, felpAssists: number) =>
      winners(
        calculateNightAwards({
          matches: [match(1, "rush")],
          participations: [
            played(ERICKY, 1, 8.0, 1, 1),
            played(FELP, 1, 8.0, felpGoals, felpAssists),
          ],
        }),
        "rush_mvp",
      );

    expect(tie(1, 0)).toEqual([[ERICKY, 8]]);
    expect(tie(2, 0)).toEqual([[FELP, 8]]);
    expect(tie(1, 1)).toEqual([
      [ERICKY, 8],
      [FELP, 8],
    ]);
  });

  it("noite sem Rush não tem o prêmio", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(2),
      participations: [played(ERICKY, 1, 9.0), played(ERICKY, 2, 9.0)],
    });
    expect(winners(awards, "rush_mvp")).toEqual([]);
  });
});

describe("artilheiro e assistente", () => {
  const participations = [
    played(ERICKY, 1, 7.0, 1, 2),
    played(LUCAO, 1, 8.0, 2, 0),
    played(ERICKY, 2, 7.0, 0, 1),
    played(LUCAO, 2, 8.0, 1, 0),
    played(FELP, 2, 6.0, 0, 0),
  ];
  const awards = calculateNightAwards({
    matches: mainMatches(2),
    participations,
  });

  it("maior número de gols e de assistências na gameplay", () => {
    expect(winners(awards, "top_scorer")).toEqual([[LUCAO, 3]]);
    expect(winners(awards, "top_assists")).toEqual([[ERICKY, 3]]);
  });

  it("os únicos prêmios são artilheiro, assistente, craque e destaque do Rush", () => {
    expect([...new Set(awards.map((award) => award.award))]).toEqual([
      "top_scorer",
      "top_assists",
      "mvp",
    ]);
  });

  it("empate gera co-vencedores", () => {
    const tied = calculateNightAwards({
      matches: mainMatches(1),
      participations: [
        played(ERICKY, 1, 7.0, 2, 0),
        played(LUCAO, 1, 7.0, 2, 0),
      ],
    });
    expect(winners(tied, "top_scorer")).toEqual([
      [ERICKY, 2],
      [LUCAO, 2],
    ]);
  });

  it("noite sem gols não tem artilheiro nem assistente", () => {
    const goalless = calculateNightAwards({
      matches: mainMatches(1),
      participations: [played(ERICKY, 1, 6.0), played(LUCAO, 1, 5.6)],
    });
    expect(winners(goalless, "top_scorer")).toEqual([]);
    expect(winners(goalless, "top_assists")).toEqual([]);
    // O craque não depende de gols.
    expect(winners(goalless, "mvp")).toEqual([[ERICKY, 6]]);
  });

  it("gols sem assistência: há artilheiro e não há assistente", () => {
    const noAssists = calculateNightAwards({
      matches: mainMatches(1),
      participations: [played(LUCAO, 1, 8.0, 2, 0)],
    });
    expect(winners(noAssists, "top_scorer")).toEqual([[LUCAO, 2]]);
    expect(winners(noAssists, "top_assists")).toEqual([]);
  });

  it("contam só X1 e Partida: gols e assistências de Rush ficam de fora", () => {
    const mixed = calculateNightAwards({
      matches: [match(1, "match"), match(2, "x1"), match(3, "rush")],
      participations: [
        played(ERICKY, 1, 7.0, 1, 1),
        played(ERICKY, 2, 7.0, 1, 0),
        // No Rush, Lucão fez mais gols e Felp deu mais assistências.
        played(LUCAO, 3, 7.0, 5, 0),
        played(FELP, 3, 7.0, 0, 4),
      ],
    });
    expect(winners(mixed, "top_scorer")).toEqual([[ERICKY, 2]]);
    expect(winners(mixed, "top_assists")).toEqual([[ERICKY, 1]]);
  });

  it("noite só com Rush não tem artilheiro nem assistente", () => {
    const rushOnly = calculateNightAwards({
      matches: [match(1, "rush")],
      participations: [played(LUCAO, 1, 8.0, 3, 1)],
    });
    expect(winners(rushOnly, "top_scorer")).toEqual([]);
    expect(winners(rushOnly, "top_assists")).toEqual([]);
    expect(winners(rushOnly, "rush_mvp")).toEqual([[LUCAO, 8]]);
  });
});

describe("noite vazia", () => {
  it("noite sem partidas não tem prêmios", () => {
    expect(calculateNightAwards({ matches: [], participations: [] })).toEqual(
      [],
    );
  });

  it("participação de partida que não é da noite é ignorada", () => {
    const awards = calculateNightAwards({
      matches: mainMatches(1),
      participations: [played(ERICKY, 1, 7.0, 1), played(LUCAO, 99, 9.0, 5)],
    });
    expect(winners(awards, "top_scorer")).toEqual([[ERICKY, 1]]);
  });
});

describe("resumo da noite", () => {
  const matches: NightMatch[] = [
    match(1, "match", 3, 0, "W"),
    match(2, "x1", 2, 2, "W", true),
    match(3, "match", 1, 1, "L", true),
    match(4, "match", 0, 0, "D"),
    match(5, "match", 1, 4, "L"),
    match(6, "rush", 5, 3, "W"),
    match(7, "rush", 2, 0, "W"),
  ];
  const participations = [
    played(LUCAO, 1, 9.0, 2, 0, "ATA"),
    played(ERICKY, 1, 8.0, 0, 2, "MEI"),
    played(HEIT, 1, 8.5, 0, 0, "GOL", 6, 1),
    played(LUCAO, 2, 7.0, 1, 0, "ATA"),
    played(ERICKY, 2, 7.5, 1, 1, "MEI"),
    played(HEIT, 2, 6.0, 0, 0, "GOL", 3, 0),
    played(LUCAO, 3, 6.0, 0, 0, "ATA"),
    played(ERICKY, 4, 6.0, 0, 0, "MEI"),
    played(LUCAO, 5, 6.5, 1, 0, "ATA"),
    // Rush: Felp joga as duas, uma delas no gol.
    played(FELP, 6, 8.0, 3, 1, "ATA"),
    played(FELP, 7, 9.0, 0, 0, "GOL", 4, 0),
    played(LUCAO, 6, 7.0, 2, 0, "ATA"),
  ];
  const summary = summarizeNight({ matches, participations });

  it("conta todas as partidas e separa principais de Rush", () => {
    expect(summary.matchCount).toBe(7);
    expect(summary.main).toMatchObject({
      matchCount: 5,
      wins: 2,
      draws: 1,
      losses: 2,
      penaltyWins: 1,
      penaltyLosses: 1,
    });
    expect(summary.rush).toMatchObject({
      matchCount: 2,
      wins: 2,
      draws: 0,
      losses: 0,
    });
  });

  it("soma gols e clean sheets do time por recorte", () => {
    expect(summary.main).toMatchObject({
      goalsFor: 7,
      goalsAgainst: 7,
      goalDifference: 0,
      cleanSheets: 2,
    });
    expect(summary.rush).toMatchObject({
      goalsFor: 7,
      goalsAgainst: 3,
      goalDifference: 4,
      cleanSheets: 1,
    });
  });

  it("lista os jogadores das principais por G/A e depois gols, sem os números do Rush", () => {
    expect(summary.main.players).toEqual([
      {
        playerId: LUCAO,
        matches: 4,
        goals: 4,
        assists: 0,
        goalContributions: 4,
        averageRating: 7.13,
      },
      {
        playerId: ERICKY,
        matches: 3,
        goals: 1,
        assists: 3,
        goalContributions: 4,
        averageRating: 7.17,
      },
      {
        playerId: HEIT,
        matches: 2,
        goals: 0,
        assists: 0,
        goalContributions: 0,
        averageRating: 7.25,
      },
    ]);
  });

  it("o Rush tem a própria lista de jogadores", () => {
    expect(summary.rush.players).toEqual([
      {
        playerId: FELP,
        matches: 2,
        goals: 3,
        assists: 1,
        goalContributions: 4,
        averageRating: 8.5,
      },
      {
        playerId: LUCAO,
        matches: 1,
        goals: 2,
        assists: 0,
        goalContributions: 2,
        averageRating: 7,
      },
    ]);
  });

  it("goleiros: só as partidas no gol, com gols sofridos derivados do placar", () => {
    expect(summary.main.goalkeepers).toEqual([
      {
        playerId: HEIT,
        matches: 2,
        saves: 9,
        penaltiesSaved: 1,
        // 3x0 e 2x2: sofreu 2 gols e teve 1 jogo sem sofrer gol.
        goalsConceded: 2,
        cleanSheets: 1,
        averageRating: 7.25,
      },
    ]);
    // No Rush o Felp jogou uma partida no gol e outra na linha.
    expect(summary.rush.goalkeepers).toEqual([
      {
        playerId: FELP,
        matches: 1,
        saves: 4,
        penaltiesSaved: 0,
        goalsConceded: 0,
        cleanSheets: 1,
        averageRating: 9,
      },
    ]);
  });

  it("inclui os prêmios calculados com as mesmas regras", () => {
    expect(summary.awards).toEqual(
      calculateNightAwards({ matches, participations }),
    );
    // Só as principais: os 2 gols do Lucão no Rush não entram.
    expect(winners(summary.awards, "top_scorer")).toEqual([[LUCAO, 4]]);
    // Heit jogou 2 de 5 principais: fora do craque.
    expect(winners(summary.awards, "mvp")).toEqual([[ERICKY, 7.17]]);
    expect(winners(summary.awards, "rush_mvp")).toEqual([[FELP, 8.5]]);
  });

  it("noite sem partidas gera resumo zerado", () => {
    const empty = {
      matchCount: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      penaltyWins: 0,
      penaltyLosses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      cleanSheets: 0,
      players: [],
      goalkeepers: [],
    };
    expect(summarizeNight({ matches: [], participations: [] })).toEqual({
      matchCount: 0,
      main: empty,
      rush: empty,
      awards: [],
    });
  });
});
