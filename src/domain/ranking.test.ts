import { describe, expect, it } from "vitest";
import { buildEvolution, type NightTotals } from "./evolution";
import {
  hasGoalkeeperStats,
  rankPlayers,
  type RankablePlayer,
} from "./ranking";

interface Named extends RankablePlayer {
  name: string;
}

function player(
  name: string,
  shirtNumber: number,
  overrides: Partial<Omit<RankablePlayer, "goalkeeper">> & {
    goalkeeper?: Partial<RankablePlayer["goalkeeper"]>;
  } = {},
): Named {
  const { goalkeeper, ...rest } = overrides;
  const goals = rest.goals ?? 0;
  const assists = rest.assists ?? 0;
  return {
    name,
    shirtNumber,
    goals,
    assists,
    goalContributions: goals + assists,
    ratedMatches: 0,
    averageRating: null,
    ...rest,
    goalkeeper: {
      matches: 0,
      averageRating: null,
      savesPerMatch: null,
      cleanSheets: 0,
      ...goalkeeper,
    },
  };
}

const names = (players: Named[]) => players.map((entry) => entry.name);

describe("ranking geral e G/A", () => {
  it("ordena por G/A, depois gols, depois assistências", () => {
    const players = [
      player("A", 1, { goals: 5, assists: 5 }),
      player("B", 2, { goals: 8, assists: 4 }),
      player("C", 3, { goals: 6, assists: 4 }),
      player("D", 4, { goals: 7, assists: 3 }),
    ];
    // B tem 12 G/A; A, C e D têm 10: desempata por gols (D 7, C 6, A 5).
    expect(names(rankPlayers(players, "geral"))).toEqual(["B", "D", "C", "A"]);
    expect(names(rankPlayers(players, "ga"))).toEqual(["B", "D", "C", "A"]);
  });

  it("empate completo mantém a ordem do número da camisa", () => {
    const players = [
      player("B", 10, { goals: 2, assists: 2 }),
      player("A", 7, { goals: 2, assists: 2 }),
    ];
    expect(names(rankPlayers(players, "geral"))).toEqual(["A", "B"]);
  });

  it("não altera a lista recebida", () => {
    const players = [player("A", 1), player("B", 2, { goals: 3 })];
    rankPlayers(players, "geral");
    expect(names(players)).toEqual(["A", "B"]);
  });
});

describe("rankings de gols e de assistências", () => {
  const players = [
    player("A", 1, { goals: 10, assists: 0 }),
    player("B", 2, { goals: 4, assists: 9 }),
    player("C", 3, { goals: 10, assists: 3 }),
  ];

  it("gols: mais gols primeiro, desempate por G/A", () => {
    expect(names(rankPlayers(players, "gols"))).toEqual(["C", "A", "B"]);
  });

  it("assistências: mais assistências primeiro", () => {
    expect(names(rankPlayers(players, "assistencias"))).toEqual([
      "B",
      "C",
      "A",
    ]);
  });
});

describe("ranking de Nota VFC", () => {
  it("a quantidade de partidas avaliadas vem antes da média", () => {
    const players = [
      player("PoucosJogos", 1, { ratedMatches: 2, averageRating: 9.5 }),
      player("MuitosJogos", 2, { ratedMatches: 20, averageRating: 7.1 }),
    ];
    expect(names(rankPlayers(players, "nota"))).toEqual([
      "MuitosJogos",
      "PoucosJogos",
    ]);
  });

  it("com a mesma quantidade: média, depois G/A, depois gols", () => {
    const players = [
      player("A", 1, { ratedMatches: 5, averageRating: 7.5, goals: 1 }),
      player("B", 2, { ratedMatches: 5, averageRating: 8.0, goals: 0 }),
      player("C", 3, { ratedMatches: 5, averageRating: 7.5, goals: 3 }),
      player("D", 4, {
        ratedMatches: 5,
        averageRating: 7.5,
        goals: 2,
        assists: 1,
      }),
    ];
    // B pela média; C e D empatam em G/A (3) e C tem mais gols; A por último.
    expect(names(rankPlayers(players, "nota"))).toEqual(["B", "C", "D", "A"]);
  });

  it("quem não tem partida avaliada fica por último", () => {
    const players = [
      player("SoHistorico", 1, { goals: 200, assists: 100 }),
      player("Avaliado", 2, { ratedMatches: 1, averageRating: 5.0 }),
    ];
    expect(names(rankPlayers(players, "nota"))).toEqual([
      "Avaliado",
      "SoHistorico",
    ]);
  });
});

describe("ranking de goleiros", () => {
  it("partidas no gol, média como goleiro, defesas por partida, clean sheets", () => {
    const players = [
      player("A", 1, {
        goalkeeper: { matches: 3, averageRating: 7.0, savesPerMatch: 5 },
      }),
      player("B", 2, {
        goalkeeper: { matches: 10, averageRating: 6.0, savesPerMatch: 3 },
      }),
      player("C", 3, {
        goalkeeper: { matches: 3, averageRating: 7.0, savesPerMatch: 6 },
      }),
      player("D", 4, {
        goalkeeper: {
          matches: 3,
          averageRating: 7.0,
          savesPerMatch: 6,
          cleanSheets: 2,
        },
      }),
    ];
    expect(names(rankPlayers(players, "goleiros"))).toEqual([
      "B",
      "D",
      "C",
      "A",
    ]);
  });

  it("só entra quem já jogou no gol", () => {
    expect(hasGoalkeeperStats(player("Linha", 1, { goals: 9 }))).toBe(false);
    expect(
      hasGoalkeeperStats(player("Goleiro", 2, { goalkeeper: { matches: 1 } })),
    ).toBe(true);
  });
});

describe("evolução do jogador", () => {
  const ERICKY = 1;
  const LUCAO = 2;
  const baselines = [
    { playerId: ERICKY, shirtNumber: 7, legacyGoals: 10, legacyAssists: 10 },
    { playerId: LUCAO, shirtNumber: 10, legacyGoals: 15, legacyAssists: 6 },
  ];
  const nights: NightTotals[] = [
    {
      nightId: 1,
      referenceDate: "2026-10-02",
      players: [
        {
          playerId: ERICKY,
          matches: 2,
          goals: 1,
          assists: 1,
          ratingTenths: 150,
        },
        {
          playerId: LUCAO,
          matches: 2,
          goals: 0,
          assists: 0,
          ratingTenths: 120,
        },
      ],
    },
    {
      // Ericky não jogou.
      nightId: 2,
      referenceDate: "2026-10-09",
      players: [
        {
          playerId: LUCAO,
          matches: 3,
          goals: 4,
          assists: 0,
          ratingTenths: 255,
        },
      ],
    },
    {
      nightId: 3,
      referenceDate: "2026-10-16",
      players: [
        {
          playerId: ERICKY,
          matches: 1,
          goals: 2,
          assists: 2,
          ratingTenths: 95,
        },
      ],
    },
  ];

  it("acumula o G/A a partir do histórico do período", () => {
    const points = buildEvolution(ERICKY, baselines, nights);
    expect(points.map((point) => point.cumulativeGoalContributions)).toEqual([
      22, 22, 26,
    ]);
  });

  it("média da noite só quando jogou; média acumulada só das partidas avaliadas", () => {
    const points = buildEvolution(ERICKY, baselines, nights);
    expect(points.map((point) => point.played)).toEqual([true, false, true]);
    expect(points.map((point) => point.nightAverageRating)).toEqual([
      7.5,
      null,
      9.5,
    ]);
    // (15,0 + 9,5) / 3 partidas = 8,17.
    expect(points.map((point) => point.cumulativeAverageRating)).toEqual([
      7.5, 7.5, 8.17,
    ]);
  });

  it("a posição no ranking muda mesmo na noite em que o jogador não jogou", () => {
    // Depois da 1ª: Ericky 22 x Lucão 21. Depois da 2ª: Lucão 25. Depois da
    // 3ª: Ericky 26.
    const points = buildEvolution(ERICKY, baselines, nights);
    expect(points.map((point) => point.rank)).toEqual([1, 2, 1]);
    expect(
      buildEvolution(LUCAO, baselines, nights).map((point) => point.rank),
    ).toEqual([2, 1, 2]);
  });

  it("sem gameplays não há pontos; jogador desconhecido também não", () => {
    expect(buildEvolution(ERICKY, baselines, [])).toEqual([]);
    expect(buildEvolution(99, baselines, nights)).toEqual([]);
  });

  it("antes da primeira partida avaliada a média acumulada é indisponível", () => {
    const points = buildEvolution(ERICKY, baselines, [
      { nightId: 1, referenceDate: "2026-10-02", players: [] },
    ]);
    expect(points[0]).toMatchObject({
      played: false,
      cumulativeAverageRating: null,
      nightAverageRating: null,
    });
  });
});
