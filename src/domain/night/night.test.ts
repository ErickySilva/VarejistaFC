import { describe, expect, it } from "vitest";
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

function played(
  playerId: number,
  matchId: number,
  rating: number,
  goals = 0,
  assists = 0,
  position: Position = "MC",
): NightParticipation {
  return { playerId, matchId, position, goals, assists, rating };
}

function winners(awards: NightAward[], award: AwardType) {
  return awards
    .filter((entry) => entry.award === award)
    .map((entry) => [entry.playerId, entry.value]);
}

describe("mínimo de partidas para o craque", () => {
  it("é metade das partidas da noite, arredondando para cima", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(minimumMatchesForMvp)).toEqual([
      1, 1, 2, 2, 3, 3, 4,
    ]);
  });
});

describe("craque da noite", () => {
  it("vence a maior média de nota entre os elegíveis", () => {
    const awards = calculateNightAwards({
      matchCount: 2,
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
    const awards = calculateNightAwards({ matchCount: 5, participations });
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 7]]);
  });

  it("o mínimo usa as partidas da noite, não as do jogador", () => {
    // 4 partidas na noite; só a primeira tem participação registrada aqui.
    const awards = calculateNightAwards({
      matchCount: 4,
      participations: [played(ERICKY, 1, 9.0)],
    });
    expect(winners(awards, "mvp")).toEqual([]);
  });

  it("empate na média é desempatado por G/A", () => {
    const awards = calculateNightAwards({
      matchCount: 1,
      participations: [
        played(ERICKY, 1, 8.0, 1, 1),
        played(LUCAO, 1, 8.0, 1, 0),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[ERICKY, 8]]);
  });

  it("empate na média e no G/A é desempatado por gols", () => {
    const awards = calculateNightAwards({
      matchCount: 1,
      participations: [
        played(ERICKY, 1, 8.0, 0, 2),
        played(LUCAO, 1, 8.0, 2, 0),
      ],
    });
    expect(winners(awards, "mvp")).toEqual([[LUCAO, 8]]);
  });

  it("empate completo gera co-vencedores", () => {
    const awards = calculateNightAwards({
      matchCount: 1,
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
      matchCount: 3,
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
});

describe("prêmios de contagem", () => {
  const participations = [
    played(ERICKY, 1, 7.0, 1, 2),
    played(LUCAO, 1, 8.0, 2, 0),
    played(ERICKY, 2, 7.0, 0, 1),
    played(LUCAO, 2, 8.0, 1, 0),
    played(FELP, 2, 6.0, 0, 0),
  ];
  const awards = calculateNightAwards({ matchCount: 2, participations });

  it("artilheiro, líder de assistências e líder de G/A", () => {
    expect(winners(awards, "top_scorer")).toEqual([[LUCAO, 3]]);
    expect(winners(awards, "top_assists")).toEqual([[ERICKY, 3]]);
    expect(winners(awards, "top_ga")).toEqual([[ERICKY, 4]]);
  });

  it("empate gera co-vencedores", () => {
    const tied = calculateNightAwards({
      matchCount: 1,
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

  it("noite sem gols não tem artilheiro, líder de assistências nem de G/A", () => {
    const goalless = calculateNightAwards({
      matchCount: 1,
      participations: [played(ERICKY, 1, 6.0), played(LUCAO, 1, 5.6)],
    });
    expect(winners(goalless, "top_scorer")).toEqual([]);
    expect(winners(goalless, "top_assists")).toEqual([]);
    expect(winners(goalless, "top_ga")).toEqual([]);
    // O craque não depende de gols.
    expect(winners(goalless, "mvp")).toEqual([[ERICKY, 6]]);
  });

  it("gols sem assistência: há artilheiro e não há líder de assistências", () => {
    const noAssists = calculateNightAwards({
      matchCount: 1,
      participations: [played(LUCAO, 1, 8.0, 2, 0)],
    });
    expect(winners(noAssists, "top_scorer")).toEqual([[LUCAO, 2]]);
    expect(winners(noAssists, "top_assists")).toEqual([]);
  });
});

describe("destaque do goleiro", () => {
  it("usa só as participações como goleiro, sem mínimo de partidas", () => {
    const awards = calculateNightAwards({
      matchCount: 4,
      participations: [
        played(HEIT, 1, 9.0, 0, 0, "GOL"),
        // Partida na linha com nota baixa não entra na média de goleiro.
        played(HEIT, 2, 4.0, 0, 0, "ATA"),
        played(ERICKY, 1, 7.0),
      ],
    });
    expect(winners(awards, "best_goalkeeper")).toEqual([[HEIT, 9]]);
  });

  it("com dois goleiros na noite, vence a maior média", () => {
    const awards = calculateNightAwards({
      matchCount: 3,
      participations: [
        played(HEIT, 1, 6.0, 0, 0, "GOL"),
        played(HEIT, 2, 7.0, 0, 0, "GOL"),
        played(FELP, 3, 6.8, 0, 0, "GOL"),
      ],
    });
    expect(winners(awards, "best_goalkeeper")).toEqual([[FELP, 6.8]]);
  });

  it("empate entre goleiros gera co-vencedores", () => {
    const awards = calculateNightAwards({
      matchCount: 2,
      participations: [
        played(HEIT, 1, 7.0, 0, 0, "GOL"),
        played(FELP, 2, 7.0, 0, 0, "GOL"),
      ],
    });
    expect(winners(awards, "best_goalkeeper")).toEqual([
      [FELP, 7],
      [HEIT, 7],
    ]);
  });

  it("noite sem goleiro humano não tem o prêmio", () => {
    const awards = calculateNightAwards({
      matchCount: 1,
      participations: [played(ERICKY, 1, 7.0), played(LUCAO, 1, 8.0)],
    });
    expect(winners(awards, "best_goalkeeper")).toEqual([]);
  });
});

describe("noite vazia", () => {
  it("noite sem partidas não tem prêmios", () => {
    expect(calculateNightAwards({ matchCount: 0, participations: [] })).toEqual(
      [],
    );
  });
});

describe("resumo da noite", () => {
  const matches: NightMatch[] = [
    {
      id: 1,
      goalsFor: 3,
      goalsAgainst: 0,
      result: "W",
      wentToPenalties: false,
    },
    { id: 2, goalsFor: 2, goalsAgainst: 2, result: "W", wentToPenalties: true },
    { id: 3, goalsFor: 1, goalsAgainst: 1, result: "L", wentToPenalties: true },
    {
      id: 4,
      goalsFor: 0,
      goalsAgainst: 0,
      result: "D",
      wentToPenalties: false,
    },
    {
      id: 5,
      goalsFor: 1,
      goalsAgainst: 4,
      result: "L",
      wentToPenalties: false,
    },
  ];
  const participations = [
    played(LUCAO, 1, 9.0, 2, 0, "ATA"),
    played(ERICKY, 1, 8.0, 0, 2, "MEI"),
    played(HEIT, 1, 8.5, 0, 0, "GOL"),
    played(LUCAO, 2, 7.0, 1, 0, "ATA"),
    played(ERICKY, 2, 7.5, 1, 1, "MEI"),
    played(HEIT, 2, 6.0, 0, 0, "GOL"),
    played(LUCAO, 3, 6.0, 0, 0, "ATA"),
    played(ERICKY, 4, 6.0, 0, 0, "MEI"),
    played(LUCAO, 5, 6.5, 1, 0, "ATA"),
  ];
  const summary = summarizeNight({ matches, participations });

  it("conta resultados, separando os decididos nos pênaltis", () => {
    expect(summary).toMatchObject({
      matchCount: 5,
      wins: 2,
      draws: 1,
      losses: 2,
      penaltyWins: 1,
      penaltyLosses: 1,
    });
  });

  it("soma os gols das partidas e os clean sheets do time", () => {
    expect(summary).toMatchObject({
      goalsFor: 7,
      goalsAgainst: 7,
      goalDifference: 0,
      cleanSheets: 2,
    });
  });

  it("lista os jogadores por G/A e depois gols, com jogos contados por participação", () => {
    expect(summary.players).toEqual([
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

  it("inclui os prêmios calculados com as mesmas regras", () => {
    expect(summary.awards).toEqual(
      calculateNightAwards({ matchCount: 5, participations }),
    );
    expect(winners(summary.awards, "top_scorer")).toEqual([[LUCAO, 4]]);
    // Heit jogou 2 de 5 partidas: fora do craque, mas é o destaque do goleiro.
    expect(winners(summary.awards, "mvp")).toEqual([[ERICKY, 7.17]]);
    expect(winners(summary.awards, "best_goalkeeper")).toEqual([[HEIT, 7.25]]);
  });

  it("noite sem partidas gera resumo zerado", () => {
    expect(summarizeNight({ matches: [], participations: [] })).toEqual({
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
      awards: [],
    });
  });
});
