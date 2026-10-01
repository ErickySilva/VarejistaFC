import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ParticipationEntry } from "@/domain/match-entry";
import { MATCH_TYPES, statsScope } from "@/domain/match-type";
import { calculateRating } from "@/domain/rating";
import type { RequestContext } from "@/server/auth/session";
import {
  registerMatch,
  updateMatch,
  type MatchInput,
} from "@/server/matches/service";
import { getNightAwards, getOpenNight } from "@/server/nights/queries";
import { closeGameplay, startGameplay } from "@/server/nights/service";
import { getOverallRanking } from "@/server/players/queries";
import { getPlayerStats, type PlayerStats } from "@/server/stats/queries";
import { contextFor, createAccount } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Tipos de partida, Rush separado das estatísticas principais, Nota FIFA e
// estatísticas por temporada ou desde a criação do clube (ADR 0013).

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

const NOW = new Date("2026-10-02T23:00:00Z");

let admin: RequestContext;
let fc25: number;
let fc26: number;
let ericky: number;
let lucao: number;
let felp: number;
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

async function insertSeason(slug: string, name: string, isActive: boolean) {
  const [row] = await sql`
    insert into seasons (slug, name, game_edition, is_active)
    values (${slug}, ${name}, ${name}, ${isActive}) returning id`;
  return row.id as number;
}

function line(
  playerId: number,
  goals = 0,
  assists = 0,
  fifaRating: number | null = null,
): ParticipationEntry {
  return {
    playerId,
    position: "ATA",
    goals,
    assists,
    saves: null,
    penaltiesSaved: null,
    fifaRating,
  };
}

function keeper(
  playerId: number,
  saves: number,
  penaltiesSaved: number | null = null,
  fifaRating: number | null = null,
): ParticipationEntry {
  return {
    playerId,
    position: "GOL",
    goals: 0,
    assists: 0,
    saves,
    penaltiesSaved,
    fifaRating,
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
    participations: [line(lucao, 2)],
    ...overrides,
  };
}

async function systemTotals(playerId: number) {
  const [row] = await sql`
    select matches, goals, assists from v_player_totals_system
    where player_id = ${playerId}`;
  return row;
}

function of(stats: PlayerStats[], playerId: number): PlayerStats {
  return stats.find((row) => row.playerId === playerId)!;
}

beforeEach(async () => {
  await resetDatabase(sql);
  fc25 = await insertSeason("fc-25", "FC 25", false);
  fc26 = await insertSeason("fc-26", "FC 26", true);
  ericky = await insertPlayer("Ericky", 7, "MEI");
  lucao = await insertPlayer("Lucão", 10, "ATA");
  felp = await insertPlayer("Felp", 11, "PD");
  heit = await insertPlayer("Heit", 69, "GOL");
  await createAccount({ email: "admin@test.dev", role: "admin" });
  admin = await contextFor("admin@test.dev");
  await startGameplay(admin, NOW);
});

afterAll(async () => {
  await sql.end();
});

describe("tipos de partida", () => {
  it("existem exatamente X1, Partida e Torneio de Rush, no domínio e no banco", async () => {
    const rows =
      await sql`select unnest(enum_range(null::match_type))::text as value`;
    expect(rows.map((row) => row.value)).toEqual(["x1", "match", "rush"]);
    expect([...MATCH_TYPES]).toEqual(["x1", "match", "rush"]);
  });

  it("o recorte de estatísticas é o mesmo no domínio e na view do banco", async () => {
    for (const matchType of MATCH_TYPES) {
      const match = await registerMatch(admin, matchInput({ matchType }));
      const [row] = await sql`
        select match_type::text, stats_scope from v_player_match
        where match_id = ${match.id}`;
      expect(row, matchType).toEqual({
        match_type: matchType,
        stats_scope: statsScope(matchType),
      });
    }
  });

  it("o tipo é obrigatório no banco", async () => {
    const [night] = await sql`select id from nights`;
    const [opponent] = await sql`
      insert into opponents (name) values ('Sem Tipo') returning id`;
    await expect(
      sql`insert into matches (night_id, sequence, opponent_id, played_at, goals_for, goals_against)
          values (${night.id}, 9, ${opponent.id}, now(), 1, 0)`,
    ).rejects.toMatchObject({ code: "23502", column_name: "match_type" });
  });

  it("os tipos antigos não são aceitos", async () => {
    const [night] = await sql`select id from nights`;
    const [opponent] = await sql`
      insert into opponents (name) values ('Tipo Antigo') returning id`;
    for (const old of ["friendly", "league", "playoff", "tournament"]) {
      await expect(
        sql`insert into matches (night_id, sequence, opponent_id, match_type, played_at, goals_for, goals_against)
            values (${night.id}, 9, ${opponent.id}, ${old}::match_type, now(), 1, 0)`,
        old,
      ).rejects.toThrow(/invalid input value for enum/);
    }
  });
});

describe("X1 e Partida contam nas estatísticas principais", () => {
  it("os dois tipos entram nos totais do sistema e no ranking geral", async () => {
    await registerMatch(admin, matchInput({ matchType: "x1" }));
    await registerMatch(admin, matchInput({ matchType: "match" }));

    expect(await systemTotals(lucao)).toEqual({
      matches: 2,
      goals: 4,
      assists: 0,
    });
    const ranking = await getOverallRanking();
    expect(ranking.find((row) => row.playerId === lucao)).toMatchObject({
      matches: 2,
      goals: 4,
    });
  });
});

describe("Torneio de Rush fica fora das estatísticas principais", () => {
  beforeEach(async () => {
    await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, 1, 1)] }),
    );
    await registerMatch(
      admin,
      matchInput({
        matchType: "rush",
        goalsFor: 6,
        goalsAgainst: 2,
        participations: [
          line(lucao, 4, 1),
          line(felp, 2, 2),
          keeper(heit, 7, 1),
        ],
      }),
    );
  });

  it("é registrado por inteiro: posição, gols, assistências, defesas e notas", async () => {
    const rows = await sql`
      select p.name, mp.position::text, mp.goals, mp.assists, mp.saves,
        mp.penalties_saved, mp.rating::float8 as rating, mp.rating_version
      from match_players mp
      join players p on p.id = mp.player_id
      join matches m on m.id = mp.match_id
      where m.match_type = 'rush'
      order by p.shirt_number`;

    const vfc = (participation: ParticipationEntry) =>
      calculateRating({
        ...participation,
        goalsFor: 6,
        goalsAgainst: 2,
        result: "W",
      }).rating;
    expect(rows).toEqual([
      {
        name: "Lucão",
        position: "ATA",
        goals: 4,
        assists: 1,
        saves: null,
        penalties_saved: null,
        rating: vfc(line(lucao, 4, 1)),
        rating_version: "v2",
      },
      {
        name: "Felp",
        position: "ATA",
        goals: 2,
        assists: 2,
        saves: null,
        penalties_saved: null,
        rating: vfc(line(felp, 2, 2)),
        rating_version: "v2",
      },
      {
        name: "Heit",
        position: "GOL",
        goals: 0,
        assists: 0,
        saves: 7,
        penalties_saved: 1,
        rating: vfc(keeper(heit, 7, 1)),
        rating_version: "v2",
      },
    ]);
  });

  it("não entra nos totais principais nem no ranking geral", async () => {
    expect(await systemTotals(lucao)).toEqual({
      matches: 1,
      goals: 1,
      assists: 1,
    });
    // Felp e Heit só jogaram o Rush: sem jogo nas principais.
    expect(await systemTotals(felp)).toEqual({
      matches: 0,
      goals: 0,
      assists: 0,
    });
    expect(await systemTotals(heit)).toEqual({
      matches: 0,
      goals: 0,
      assists: 0,
    });

    const ranking = await getOverallRanking();
    expect(ranking.find((row) => row.playerId === lucao)).toMatchObject({
      matches: 1,
      goals: 1,
      assists: 1,
    });
    expect(ranking.find((row) => row.playerId === felp)).toMatchObject({
      matches: 0,
    });
  });

  it("tem estatísticas próprias", async () => {
    const rush = await getPlayerStats({ kind: "club" }, "rush");

    expect(of(rush, lucao)).toMatchObject({
      matches: 1,
      goals: 4,
      assists: 1,
      goalContributions: 5,
      ratedMatches: 1,
    });
    expect(of(rush, felp)).toMatchObject({ matches: 1, goals: 2, assists: 2 });
    expect(of(rush, heit).goalkeeper).toMatchObject({
      matches: 1,
      saves: 7,
      penaltiesSaved: 1,
      goalsConceded: 2,
    });
    expect(of(rush, ericky)).toMatchObject({ matches: 0, averageRating: null });

    const main = await getPlayerStats({ kind: "club" }, "main");
    expect(of(main, lucao)).toMatchObject({ matches: 1, goals: 1, assists: 1 });
    expect(of(main, heit).goalkeeper).toMatchObject({ matches: 0, saves: 0 });
  });

  it("mudar o tipo de uma partida move as estatísticas de recorte", async () => {
    const open = await getOpenNight();
    const rushMatch = open!.matches.find(
      (match) => match.matchType === "rush",
    )!;

    await updateMatch(admin, {
      ...matchInput({
        matchType: "match",
        goalsFor: 6,
        goalsAgainst: 2,
        participations: [
          line(lucao, 4, 1),
          line(felp, 2, 2),
          keeper(heit, 7, 1),
        ],
      }),
      matchId: rushMatch.id,
    });

    expect(await systemTotals(lucao)).toEqual({
      matches: 2,
      goals: 5,
      assists: 2,
    });
    expect(await systemTotals(felp)).toEqual({
      matches: 1,
      goals: 2,
      assists: 2,
    });
    const rush = await getPlayerStats({ kind: "club" }, "rush");
    expect(of(rush, lucao)).toMatchObject({ matches: 0, goals: 0 });
  });

  it("no encerramento: artilheiro, assistente e craque só das principais; destaque só do Rush", async () => {
    const closed = await closeGameplay(admin, NOW);
    const awards = await getNightAwards(closed.id);
    const winners = (award: string) =>
      awards
        .filter((entry) => entry.award === award)
        .map((entry) => entry.playerName);

    // Lucão fez 1 gol e deu 1 assistência na principal; os 4 gols do Rush e
    // as assistências do Felp no Rush não contam.
    expect(winners("top_scorer")).toEqual(["Lucão"]);
    expect(awards.find((entry) => entry.award === "top_scorer")?.value).toBe(1);
    expect(winners("top_assists")).toEqual(["Lucão"]);
    expect(awards.find((entry) => entry.award === "top_assists")?.value).toBe(
      1,
    );
    // Só o Lucão jogou a partida principal.
    expect(winners("mvp")).toEqual(["Lucão"]);
    expect(winners("rush_mvp")).toHaveLength(1);
    expect(["Lucão", "Felp", "Heit"]).toContain(winners("rush_mvp")[0]);

    expect(closed.summary).toContain("Torneio de Rush, 1 partida");
    expect(closed.summary).toContain("Destaque do Rush");
  });
});

describe("Nota FIFA", () => {
  it("é gravada como informada e não muda a Nota VFC", async () => {
    const withFifa = await registerMatch(
      admin,
      matchInput({
        participations: [line(lucao, 2, 0, 9.4), line(ericky, 0, 1, 6.5)],
      }),
    );
    const withoutFifa = await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, 2, 0), line(ericky, 0, 1)] }),
    );

    const ratings = (match: typeof withFifa) =>
      match.participations.map((p) => [p.playerId, p.rating, p.fifaRating]);
    const vfcLucao = calculateRating({
      ...line(lucao, 2),
      goalsFor: 3,
      goalsAgainst: 1,
      result: "W",
    }).rating;
    const vfcEricky = calculateRating({
      ...line(ericky, 0, 1),
      goalsFor: 3,
      goalsAgainst: 1,
      result: "W",
    }).rating;

    expect(ratings(withFifa)).toEqual([
      [ericky, vfcEricky, 6.5],
      [lucao, vfcLucao, 9.4],
    ]);
    // Mesmos números, sem Nota FIFA: a Nota VFC é idêntica.
    expect(ratings(withoutFifa)).toEqual([
      [ericky, vfcEricky, null],
      [lucao, vfcLucao, null],
    ]);
  });

  it("é opcional por jogador, e a média FIFA considera só quem informou", async () => {
    await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, 1, 0, 8.0)] }),
    );
    await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, 1, 0, 9.0)] }),
    );
    await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, 1, 0)] }),
    );

    const stats = of(await getPlayerStats({ kind: "club" }, "main"), lucao);
    expect(stats).toMatchObject({
      matches: 3,
      ratedMatches: 3,
      fifaRatedMatches: 2,
      averageFifaRating: 8.5,
    });
  });

  it("valores fora da faixa ou com duas casas são recusados", async () => {
    for (const fifaRating of [10.1, -1, 7.55]) {
      await expect(
        registerMatch(
          admin,
          matchInput({ participations: [line(lucao, 1, 0, fifaRating)] }),
        ),
        String(fifaRating),
      ).rejects.toMatchObject({ code: "INVALID_MATCH" });
    }
    const [{ count }] = await sql`select count(*)::int as count from matches`;
    expect(count).toBe(0);
  });

  it("o banco também limita a faixa", async () => {
    const match = await registerMatch(admin, matchInput());
    await expect(
      sql`update match_players set fifa_rating = 10.5 where match_id = ${match.id}`,
    ).rejects.toMatchObject({
      constraint_name: "match_players_fifa_rating_range",
    });
  });

  it("entra na auditoria e pode ser corrigida na edição", async () => {
    const match = await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, 2, 0, 7.0)] }),
    );
    const updated = await updateMatch(admin, {
      ...matchInput({ participations: [line(lucao, 2, 0, 8.2)] }),
      matchId: match.id,
    });

    expect(updated.participations[0]).toMatchObject({
      rating: match.participations[0].rating,
      fifaRating: 8.2,
    });
    const [audit] = await sql`
      select before, after from audit_log
      where entity = 'matches' and action = 'update'`;
    expect(audit.before.participations[0].fifaRating).toBe(7);
    expect(audit.after.participations[0].fifaRating).toBe(8.2);
  });
});

describe("estatísticas por temporada e desde a criação do clube", () => {
  beforeEach(async () => {
    // Histórico pré-sistema, ligado à temporada FC 25.
    await sql`
      insert into legacy_stats
        (player_id, season_id, matches, goals, assists, clean_sheets)
      values (${lucao}, ${fc25}, 266, 200, 124, null),
             (${heit}, ${fc25}, 144, 47, 20, 5)`;
    // Uma partida do sistema, na temporada ativa (FC 26).
    await registerMatch(
      admin,
      matchInput({
        goalsFor: 3,
        goalsAgainst: 0,
        participations: [line(lucao, 2, 1), keeper(heit, 4, 1)],
      }),
    );
  });

  it("temporada atual: só as partidas do sistema, com Nota VFC", async () => {
    const stats = await getPlayerStats(
      { kind: "season", seasonId: fc26 },
      "main",
    );

    expect(of(stats, lucao)).toMatchObject({
      matches: 1,
      goals: 2,
      assists: 1,
      goalContributions: 3,
      systemMatches: 1,
      legacyMatches: 0,
      ratedMatches: 1,
      wins: 1,
    });
    expect(of(stats, lucao).averageRating).not.toBeNull();
  });

  it("temporada histórica: os números existem, a Nota VFC é indisponível", async () => {
    const stats = await getPlayerStats(
      { kind: "season", seasonId: fc25 },
      "main",
    );

    expect(of(stats, lucao)).toMatchObject({
      matches: 266,
      goals: 200,
      assists: 124,
      goalContributions: 324,
      systemMatches: 0,
      legacyMatches: 266,
      ratedMatches: 0,
      averageRating: null,
      averageFifaRating: null,
    });
    // Nenhuma partida foi inventada para representar o histórico.
    const [{ count }] = await sql`
      select count(*)::int as count from v_player_match pm
      join nights n on n.id = pm.night_id where n.season_id = ${fc25}`;
    expect(count).toBe(0);
  });

  it("desde a criação do clube: histórico + sistema; a média VFC usa só as partidas avaliadas", async () => {
    const stats = await getPlayerStats({ kind: "club" }, "main");
    const lucaoStats = of(stats, lucao);
    const expectedRating = calculateRating({
      ...line(lucao, 2, 1),
      goalsFor: 3,
      goalsAgainst: 0,
      result: "W",
    }).rating;

    expect(lucaoStats).toMatchObject({
      matches: 267,
      goals: 202,
      assists: 125,
      goalContributions: 327,
      systemMatches: 1,
      legacyMatches: 266,
      // 267 jogos, mas só 1 tem Nota VFC.
      ratedMatches: 1,
      averageRating: expectedRating,
    });
  });

  it("goleiro: defesas e média só do sistema; clean sheets somam com o histórico", async () => {
    const stats = await getPlayerStats({ kind: "club" }, "main");

    expect(of(stats, heit).goalkeeper).toEqual({
      matches: 1,
      saves: 4,
      savesPerMatch: 4,
      penaltiesSaved: 1,
      goalsConceded: 0,
      systemCleanSheets: 1,
      legacyCleanSheets: 5,
      cleanSheets: 6,
      averageRating: calculateRating({
        ...keeper(heit, 4, 1),
        goalsFor: 3,
        goalsAgainst: 0,
        result: "W",
      }).rating,
    });
    // Quem nunca jogou no gol não tem média de goleiro.
    expect(of(stats, lucao).goalkeeper).toMatchObject({
      matches: 0,
      savesPerMatch: null,
      averageRating: null,
      legacyCleanSheets: null,
    });
  });

  it("o histórico pertence só ao recorte principal", async () => {
    const rush = await getPlayerStats({ kind: "club" }, "rush");
    expect(of(rush, lucao)).toMatchObject({ matches: 0, legacyMatches: 0 });
  });

  it("lista todos os jogadores, também quem não tem nenhum número", async () => {
    const stats = await getPlayerStats(
      { kind: "season", seasonId: fc26 },
      "main",
    );
    expect(stats.map((row) => row.name)).toEqual([
      "Ericky",
      "Lucão",
      "Felp",
      "Heit",
    ]);
    expect(of(stats, felp)).toMatchObject({
      matches: 0,
      goals: 0,
      ratedMatches: 0,
      averageRating: null,
    });
  });

  it("um jogador pode ter histórico em mais de uma temporada", async () => {
    await sql`
      insert into legacy_stats (player_id, season_id, matches, goals, assists)
      values (${lucao}, ${fc26}, 10, 5, 5)`;

    const club = of(await getPlayerStats({ kind: "club" }, "main"), lucao);
    expect(club).toMatchObject({ legacyMatches: 276, matches: 277 });
    const season = of(
      await getPlayerStats({ kind: "season", seasonId: fc26 }, "main"),
      lucao,
    );
    expect(season).toMatchObject({ legacyMatches: 10, systemMatches: 1 });

    // Mas não dois registros na mesma temporada.
    await expect(
      sql`insert into legacy_stats (player_id, season_id, matches, goals, assists)
          values (${lucao}, ${fc26}, 1, 0, 0)`,
    ).rejects.toMatchObject({
      constraint_name: "legacy_stats_player_id_season_id_pk",
    });
  });
});
