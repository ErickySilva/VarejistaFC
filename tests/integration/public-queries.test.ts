import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildEvolution } from "@/domain/evolution";
import type { ParticipationEntry } from "@/domain/match-entry";
import { rankPlayers } from "@/domain/ranking";
import type { RequestContext } from "@/server/auth/session";
import {
  countMatches,
  getMatchPage,
  listMatches,
  listPlayerMatches,
} from "@/server/matches/queries";
import {
  deleteMatch,
  registerMatch,
  type MatchInput,
} from "@/server/matches/service";
import { closeGameplay, startGameplay } from "@/server/nights/service";
import { getPlayerPhotos, getPlayerSlug } from "@/server/players/directory";
import { getPlayerProfile } from "@/server/players/queries";
import {
  getAwardCounts,
  getNightTotals,
  getPlayerSeasonHistory,
  getTeamRecord,
} from "@/server/stats/history";
import { CLUB_PERIOD_LABEL, resolvePeriod } from "@/server/stats/period";
import { getPlayerStats } from "@/server/stats/queries";
import { contextFor, createAccount } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Consultas das telas públicas: perfil, ranking, histórico de partidas e Home.

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

const FRIDAY = new Date("2026-10-02T23:00:00Z");
const NEXT_FRIDAY = new Date("2026-10-09T23:00:00Z");

let admin: RequestContext;
let fc25: number;
let fc26: number;
let ericky: number;
let lucao: number;
let heit: number;

async function insertPlayer(
  name: string,
  shirtNumber: number,
  position: string,
) {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position)
    values (${name.toLowerCase()}, ${name}, ${shirtNumber}, ${position})
    returning id`;
  return row.id as number;
}

function line(playerId: number, goals = 0, assists = 0): ParticipationEntry {
  return {
    playerId,
    position: "ATA",
    goals,
    assists,
    saves: null,
    penaltiesSaved: null,
    fifaRating: null,
  };
}

function keeper(playerId: number, saves: number): ParticipationEntry {
  return {
    playerId,
    position: "GOL",
    goals: 0,
    assists: 0,
    saves,
    penaltiesSaved: 0,
    fifaRating: 7.5,
  };
}

function matchInput(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    opponentName: "Rivais FC",
    matchType: "match",
    goalsFor: 3,
    goalsAgainst: 1,
    wentToPenalties: false,
    penaltyScoreFor: null,
    penaltyScoreAgainst: null,
    participations: [line(lucao, 2), line(ericky, 1, 2)],
    ...overrides,
  };
}

beforeEach(async () => {
  await resetDatabase(sql);
  const seasons = await sql`
    insert into seasons (slug, name, game_edition, is_active)
    values ('fc-25', 'FC 25', 'FC 25', false), ('fc-26', 'FC 26', 'FC 26', true)
    returning id, slug`;
  fc25 = seasons.find((season) => season.slug === "fc-25")!.id;
  fc26 = seasons.find((season) => season.slug === "fc-26")!.id;
  ericky = await insertPlayer("Ericky", 7, "MEI");
  lucao = await insertPlayer("Lucão", 10, "ATA");
  heit = await insertPlayer("Heit", 69, "GOL");
  await sql`
    insert into nicknames (player_id, label, tone)
    values (${ericky}, 'OLISO', 'good'), (${ericky}, 'EL GARRO', 'bad')`;
  await sql`
    insert into legacy_stats (player_id, season_id, matches, goals, assists)
    values (${ericky}, ${fc26}, 203, 131, 138), (${lucao}, ${fc26}, 266, 200, 124)`;
  await createAccount({
    email: "admin@test.dev",
    role: "admin",
    playerId: ericky,
  });
  admin = await contextFor("admin@test.dev");
});

afterAll(async () => {
  await sql.end();
});

describe("período", () => {
  it("o padrão é a temporada ativa", async () => {
    const selection = await resolvePeriod(undefined);
    expect(selection).toMatchObject({
      period: { kind: "season", seasonId: fc26 },
      param: "fc-26",
      label: "FC 26",
    });
    expect(selection.seasons.map((season) => season.slug)).toEqual([
      "fc-26",
      "fc-25",
    ]);
  });

  it("aceita uma temporada do histórico e a visão desde a criação do clube", async () => {
    expect(await resolvePeriod("fc-25")).toMatchObject({
      period: { kind: "season", seasonId: fc25 },
      label: "FC 25",
    });
    expect(await resolvePeriod("clube")).toMatchObject({
      period: { kind: "club" },
      param: "clube",
      label: CLUB_PERIOD_LABEL,
      season: null,
    });
  });

  it("valor desconhecido cai na temporada ativa; sem temporada ativa, no clube", async () => {
    expect(await resolvePeriod("nao-existe")).toMatchObject({ param: "fc-26" });

    await sql`update seasons set is_active = false`;
    expect(await resolvePeriod(undefined)).toMatchObject({ param: "clube" });
  });
});

describe("perfil do jogador", () => {
  it("traz dados públicos e apelidos, sem nenhum dado de conta", async () => {
    const profile = await getPlayerProfile("ericky");

    expect(profile).toEqual({
      id: ericky,
      slug: "ericky",
      name: "Ericky",
      shirtNumber: 7,
      defaultPosition: "MEI",
      photoUrl: null,
      isActive: true,
      goodNicknames: ["OLISO"],
      badNicknames: ["EL GARRO"],
    });
    expect(JSON.stringify(profile)).not.toContain("admin@test.dev");
    expect(await getPlayerProfile("ninguem")).toBeNull();
  });

  it("apelido desativado não aparece", async () => {
    await sql`update nicknames set is_active = false where label = 'EL GARRO'`;
    expect((await getPlayerProfile("ericky"))?.badNicknames).toEqual([]);
  });

  it("slug e foto para ligar ao perfil", async () => {
    await sql`update players set photo_url = '/players/ericky.webp' where id = ${ericky}`;

    expect(await getPlayerSlug(ericky)).toBe("ericky");
    expect(await getPlayerSlug(9999)).toBeNull();
    const photos = await getPlayerPhotos([ericky, lucao]);
    expect(photos.get(ericky)).toEqual({
      slug: "ericky",
      photoUrl: "/players/ericky.webp",
    });
    expect(photos.get(lucao)).toEqual({ slug: "lucão", photoUrl: null });
    expect(await getPlayerPhotos([])).toEqual(new Map());
  });
});

describe("com duas gameplays registradas", () => {
  let firstMatch: number;
  let rushMatch: number;

  beforeEach(async () => {
    // Sexta: uma partida principal (3x1) e uma de Rush.
    await startGameplay(admin, FRIDAY);
    firstMatch = (await registerMatch(admin, matchInput(), FRIDAY)).id;
    rushMatch = (
      await registerMatch(
        admin,
        matchInput({
          matchType: "rush",
          opponentName: "Time do Rush",
          goalsFor: 5,
          goalsAgainst: 2,
          participations: [line(lucao, 4)],
        }),
        new Date(FRIDAY.getTime() + 60_000),
      )
    ).id;
    await closeGameplay(admin, FRIDAY);

    // Sexta seguinte: uma partida principal (0x2), só Lucão e Heit no gol.
    await startGameplay(admin, NEXT_FRIDAY);
    await registerMatch(
      admin,
      matchInput({
        opponentName: "Outro Time",
        goalsFor: 0,
        goalsAgainst: 2,
        participations: [line(lucao), keeper(heit, 6)],
      }),
      NEXT_FRIDAY,
    );
    await closeGameplay(admin, NEXT_FRIDAY);
  });

  it("campanha do time por recorte", async () => {
    expect(await getTeamRecord({ kind: "club" }, "main")).toEqual({
      matches: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      goalsFor: 3,
      goalsAgainst: 3,
    });
    expect(await getTeamRecord({ kind: "club" }, "rush")).toMatchObject({
      matches: 1,
      wins: 1,
      goalsFor: 5,
    });
    // A outra temporada não tem nenhuma partida registrada.
    expect(
      await getTeamRecord({ kind: "season", seasonId: fc25 }, "main"),
    ).toMatchObject({ matches: 0 });
  });

  it("conquistas: contagem de prêmios por tipo, no período", async () => {
    const lucaoAwards = await getAwardCounts(lucao, { kind: "club" });
    const erickyAwards = await getAwardCounts(ericky, { kind: "club" });

    // 1ª noite: Lucão artilheiro (2 gols), Ericky assistente (2) e craque;
    // Lucão destaque do Rush. 2ª noite: sem gols; craque é quem jogou.
    expect(lucaoAwards.top_scorer).toBe(1);
    expect(lucaoAwards.rush_mvp).toBe(1);
    expect(erickyAwards.top_assists).toBe(1);
    expect(erickyAwards.top_scorer).toBe(0);
    expect(Object.keys(erickyAwards).sort()).toEqual([
      "mvp",
      "rush_mvp",
      "top_assists",
      "top_scorer",
    ]);
    // Na temporada histórica não houve gameplay.
    expect(
      await getAwardCounts(lucao, { kind: "season", seasonId: fc25 }),
    ).toEqual({ top_scorer: 0, top_assists: 0, mvp: 0, rush_mvp: 0 });
  });

  it("gameplay aberta ainda não conta como conquista", async () => {
    const before = await getAwardCounts(lucao, { kind: "club" });
    await startGameplay(admin, new Date("2026-10-16T23:00:00Z"));
    await registerMatch(admin, matchInput());

    expect(await getAwardCounts(lucao, { kind: "club" })).toEqual(before);
  });

  it("histórico por temporada do jogador", async () => {
    const history = await getPlayerSeasonHistory(lucao);

    expect(history.map((entry) => entry.season.slug)).toEqual([
      "fc-26",
      "fc-25",
    ]);
    // FC 26: o histórico (266 jogos, 200 gols) + as 2 partidas do sistema.
    expect(history[0].main).toMatchObject({
      matches: 268,
      goals: 202,
      assists: 124,
      legacyMatches: 266,
      systemMatches: 2,
      ratedMatches: 2,
    });
    expect(history[0].main.averageRating).not.toBeNull();
    expect(history[0].rush).toMatchObject({ matches: 1, goals: 4 });
    // A outra temporada não tem nenhum número.
    expect(history[1].main).toMatchObject({
      matches: 0,
      goals: 0,
      ratedMatches: 0,
      averageRating: null,
    });
  });

  it("totais por gameplay e evolução: só partidas principais, em ordem de data", async () => {
    const nights = await getNightTotals({ kind: "club" });

    expect(nights.map((night) => night.referenceDate)).toEqual([
      "2026-10-02",
      "2026-10-09",
    ]);
    // O Rush não entra: Lucão tem 2 gols na 1ª noite, não 6.
    expect(nights[0].players.find((p) => p.playerId === lucao)).toMatchObject({
      matches: 1,
      goals: 2,
    });

    const stats = await getPlayerStats({ kind: "club" }, "main");
    const baselines = stats.map((row) => ({
      playerId: row.playerId,
      shirtNumber: row.shirtNumber,
      legacyGoals: row.legacyGoals,
      legacyAssists: row.legacyAssists,
    }));
    const evolution = buildEvolution(ericky, baselines, nights);
    // Histórico 269 + (1 gol e 2 assistências) = 272; não jogou a 2ª noite.
    expect(
      evolution.map((point) => [
        point.cumulativeGoalContributions,
        point.played,
      ]),
    ).toEqual([
      [272, true],
      [272, false],
    ]);
    // Lucão tem 324 + 2: à frente do Ericky nas duas noites.
    expect(evolution.map((point) => point.rank)).toEqual([2, 2]);

    // Na FC 26 a evolução é a mesma: o histórico pertence a ela.
    const seasonNights = await getNightTotals({
      kind: "season",
      seasonId: fc26,
    });
    const seasonStats = await getPlayerStats(
      { kind: "season", seasonId: fc26 },
      "main",
    );
    const seasonEvolution = buildEvolution(
      ericky,
      seasonStats.map((row) => ({
        playerId: row.playerId,
        shirtNumber: row.shirtNumber,
        legacyGoals: row.legacyGoals,
        legacyAssists: row.legacyAssists,
      })),
      seasonNights,
    );
    expect(seasonEvolution).toEqual(evolution);

    // Em uma temporada sem histórico nem gameplays não há evolução.
    expect(await getNightTotals({ kind: "season", seasonId: fc25 })).toEqual(
      [],
    );
  });

  it("ranking: a FC 26 soma histórico e sistema; o clube soma todas as temporadas", async () => {
    const season = rankPlayers(
      await getPlayerStats({ kind: "season", seasonId: fc26 }, "main"),
      "geral",
    );
    expect(season.map((p) => [p.name, p.goalContributions])).toEqual([
      ["Lucão", 326],
      ["Ericky", 272],
      ["Heit", 0],
    ]);

    const club = rankPlayers(
      await getPlayerStats({ kind: "club" }, "main"),
      "geral",
    );
    expect(club.map((p) => [p.name, p.goalContributions])).toEqual([
      ["Lucão", 326],
      ["Ericky", 272],
      ["Heit", 0],
    ]);

    // Na aba de Nota VFC vem primeiro quem tem mais partidas avaliadas; o
    // histórico não conta como partida avaliada.
    const byRating = rankPlayers(
      await getPlayerStats({ kind: "season", seasonId: fc26 }, "main"),
      "nota",
    );
    expect(byRating.map((p) => [p.name, p.ratedMatches])).toEqual([
      ["Lucão", 2],
      ["Ericky", 1],
      ["Heit", 1],
    ]);

    const goalkeepers = rankPlayers(
      (await getPlayerStats({ kind: "club" }, "main")).filter(
        (p) => p.goalkeeper.matches > 0,
      ),
      "goleiros",
    );
    expect(goalkeepers.map((p) => p.name)).toEqual(["Heit"]);
    expect(goalkeepers[0].goalkeeper).toMatchObject({
      matches: 1,
      saves: 6,
      savesPerMatch: 6,
      goalsConceded: 2,
    });
  });

  it("lista de partidas: mais recentes primeiro, com a data da gameplay", async () => {
    const matches = await listMatches({ limit: 10 });

    expect(await countMatches()).toBe(3);
    expect(
      matches.map((m) => [
        m.opponentName,
        m.matchType,
        m.referenceDate,
        m.result,
      ]),
    ).toEqual([
      ["Outro Time", "match", "2026-10-09", "L"],
      ["Time do Rush", "rush", "2026-10-02", "W"],
      ["Rivais FC", "match", "2026-10-02", "W"],
    ]);
    expect((await listMatches({ limit: 1, offset: 1 }))[0].id).toBe(rushMatch);
  });

  it("partidas recentes do jogador trazem a linha dele", async () => {
    const recent = await listPlayerMatches(heit, 5);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      opponentName: "Outro Time",
      position: "GOL",
      saves: 6,
      fifaRating: 7.5,
      result: "L",
    });
    // Ericky não jogou a 2ª noite nem o Rush.
    expect(
      (await listPlayerMatches(ericky, 5)).map((match) => match.opponentName),
    ).toEqual(["Rivais FC"]);
  });

  it("página da partida: só os participantes dela, com gameplay e temporada", async () => {
    const page = await getMatchPage(firstMatch);

    expect(page?.night).toEqual({
      id: expect.any(Number),
      referenceDate: "2026-10-02",
      status: "closed",
      seasonName: "FC 26",
    });
    expect(page?.match.participations.map((p) => p.playerName)).toEqual([
      "Ericky",
      "Lucão",
    ]);
    expect(await getMatchPage(9999)).toBeNull();
  });

  it("partida excluída não tem página nem aparece na lista", async () => {
    await startGameplay(admin, new Date("2026-10-16T23:00:00Z"));
    const extra = await registerMatch(admin, matchInput());
    await deleteMatch(admin, { matchId: extra.id });

    expect(await getMatchPage(extra.id)).toBeNull();
    expect(await countMatches()).toBe(3);
    expect((await listMatches({ limit: 10 })).map((m) => m.id)).not.toContain(
      extra.id,
    );
  });
});
