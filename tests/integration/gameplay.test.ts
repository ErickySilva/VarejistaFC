import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ParticipationEntry } from "@/domain/match-entry";
import { calculateRating } from "@/domain/rating";
import type { RequestContext } from "@/server/auth/session";
import {
  deleteMatch,
  registerMatch,
  updateMatch,
  type MatchInput,
} from "@/server/matches/service";
import {
  getLatestClosedNight,
  getNightAwards,
  getOpenNight,
} from "@/server/nights/queries";
import {
  cancelGameplay,
  closeGameplay,
  startGameplay,
} from "@/server/nights/service";
import { getOverallRanking } from "@/server/players/queries";
import { contextFor, createAccount } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

// Sexta, 2/10/2026, 20h em São Paulo.
const FRIDAY_EVENING = new Date("2026-10-02T23:00:00Z");
// Sábado, 3/10/2026, 00h30 em São Paulo: a mesma sessão depois da meia-noite.
const AFTER_MIDNIGHT = new Date("2026-10-03T03:30:00Z");
const SATURDAY_EVENING = new Date("2026-10-03T23:00:00Z");

let admin: RequestContext;
let player: RequestContext;
let ericky: number;
let lucao: number;
let felp: number;
let heit: number;

async function insertPlayer(
  slug: string,
  shirtNumber: number,
  position: string,
) {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position)
    values (${slug}, ${slug}, ${shirtNumber}, ${position}) returning id`;
  return row.id as number;
}

function line(
  playerId: number,
  position: ParticipationEntry["position"],
  goals = 0,
  assists = 0,
): ParticipationEntry {
  return {
    playerId,
    position,
    goals,
    assists,
    saves: null,
    penaltiesSaved: null,
  };
}

function keeper(
  playerId: number,
  saves: number,
  penaltiesSaved: number | null = null,
): ParticipationEntry {
  return {
    playerId,
    position: "GOL",
    goals: 0,
    assists: 0,
    saves,
    penaltiesSaved,
  };
}

function matchInput(overrides: Partial<MatchInput> = {}): MatchInput {
  return {
    opponentName: "Rivais FC",
    matchType: null,
    goalsFor: 3,
    goalsAgainst: 1,
    wentToPenalties: false,
    penaltyScoreFor: null,
    penaltyScoreAgainst: null,
    participations: [
      line(lucao, "ATA", 2, 0),
      line(ericky, "MEI", 1, 2),
      keeper(heit, 5, 1),
    ],
    ...overrides,
  };
}

async function count(table: string, where = sql`true`): Promise<number> {
  const [row] = await sql`
    select count(*)::int as count from ${sql(table)} where ${where}`;
  return row.count;
}

async function totals(playerId: number) {
  const [row] = await sql`
    select * from v_player_totals_system where player_id = ${playerId}`;
  return row;
}

async function audits(entity: string) {
  return sql`
    select actor_user_id, action, entity_id, before, after
    from audit_log where entity = ${entity} order by id`;
}

async function nightRows() {
  return sql`
    select id, reference_date::text, status, closed_at, summary
    from nights order by reference_date`;
}

beforeEach(async () => {
  await resetDatabase(sql);
  await sql`
    insert into seasons (slug, name, game_edition, starts_on)
    values ('fc-26', 'FC 26', 'FC 26', '2026-06-06')`;
  ericky = await insertPlayer("Ericky", 7, "MEI");
  lucao = await insertPlayer("Lucão", 10, "ATA");
  felp = await insertPlayer("Felp", 11, "PD");
  heit = await insertPlayer("Heit", 69, "GOL");
  await createAccount({ email: "admin@test.dev", role: "admin" });
  await createAccount({ email: "jogador@test.dev", playerId: ericky });
  admin = await contextFor("admin@test.dev");
  player = await contextFor("jogador@test.dev");
});

afterAll(async () => {
  await sql.end();
});

describe("dar início à gameplay", () => {
  it("cria a noite do dia, aberta, na temporada vigente, e audita", async () => {
    const result = await startGameplay(admin, FRIDAY_EVENING);

    expect(result).toEqual({
      nightId: expect.any(Number),
      referenceDate: "2026-10-02",
      outcome: "created",
    });
    const [night] = await sql`
      select n.reference_date::text, n.status, s.slug, n.started_at
      from nights n join seasons s on s.id = n.season_id`;
    expect(night).toMatchObject({
      reference_date: "2026-10-02",
      status: "open",
      slug: "fc-26",
    });
    expect(night.started_at).toEqual(FRIDAY_EVENING);
    expect(await audits("nights")).toMatchObject([
      {
        actor_user_id: admin.actor.userId,
        action: "create",
        entity_id: String(result.nightId),
      },
    ]);
  });

  it("chamar de novo no mesmo dia não cria outra noite", async () => {
    const first = await startGameplay(admin, FRIDAY_EVENING);
    const second = await startGameplay(admin, FRIDAY_EVENING);

    expect(second).toEqual({ ...first, outcome: "already-open" });
    expect(await count("nights")).toBe(1);
  });

  it("player não inicia gameplay", async () => {
    await expect(startGameplay(player, FRIDAY_EVENING)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await count("nights")).toBe(0);
  });

  it("sem temporada para a data: erro e nenhuma noite criada", async () => {
    await expect(
      startGameplay(admin, new Date("2026-01-10T23:00:00Z")),
    ).rejects.toMatchObject({ code: "NO_ACTIVE_SEASON" });
    expect(await count("nights")).toBe(0);
  });

  it("depois da meia-noite a sessão continua na data em que começou", async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    const match = await registerMatch(admin, matchInput(), AFTER_MIDNIGHT);

    expect(await nightRows()).toMatchObject([
      { reference_date: "2026-10-02", status: "open" },
    ]);
    // played_at é o momento real do registro, já no sábado.
    expect(match.playedAt).toEqual(AFTER_MIDNIGHT);
    const [row] = await sql`
      select reference_date::text, reference_month::text
      from v_player_match where match_id = ${match.id} limit 1`;
    expect(row).toEqual({
      reference_date: "2026-10-02",
      reference_month: "2026-10-01",
    });
  });

  it("com gameplay de outra data aberta e com partidas, exige encerrá-la primeiro", async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    await registerMatch(admin, matchInput(), FRIDAY_EVENING);

    await expect(startGameplay(admin, SATURDAY_EVENING)).rejects.toMatchObject({
      code: "PREVIOUS_NIGHT_OPEN",
      message: expect.stringContaining("02/10/2026"),
    });
    expect(await nightRows()).toMatchObject([
      { reference_date: "2026-10-02", status: "open" },
    ]);
  });

  it("gameplay de outra data que ficou vazia é descartada ao iniciar a de hoje", async () => {
    const stale = await startGameplay(admin, FRIDAY_EVENING);

    const result = await startGameplay(admin, SATURDAY_EVENING);

    expect(result).toMatchObject({
      referenceDate: "2026-10-03",
      outcome: "created",
    });
    expect(await nightRows()).toMatchObject([
      { reference_date: "2026-10-03", status: "open" },
    ]);
    expect(await audits("nights")).toMatchObject([
      { action: "create", entity_id: String(stale.nightId) },
      { action: "delete", entity_id: String(stale.nightId) },
      { action: "create", entity_id: String(result.nightId) },
    ]);
  });

  it("noite fechada do mesmo dia é reaberta, sem os prêmios antigos", async () => {
    const started = await startGameplay(admin, FRIDAY_EVENING);
    await registerMatch(admin, matchInput(), FRIDAY_EVENING);
    await closeGameplay(admin, FRIDAY_EVENING);
    expect(await count("night_awards")).toBeGreaterThan(0);

    const reopened = await startGameplay(admin, FRIDAY_EVENING);

    expect(reopened).toEqual({
      nightId: started.nightId,
      referenceDate: "2026-10-02",
      outcome: "reopened",
    });
    expect(await nightRows()).toEqual([
      {
        id: started.nightId,
        reference_date: "2026-10-02",
        status: "open",
        closed_at: null,
        summary: null,
      },
    ]);
    expect(await count("night_awards")).toBe(0);
    // As partidas da noite continuam lá.
    expect(await count("matches")).toBe(1);
    const nightAudits = await audits("nights");
    expect(nightAudits.at(-1)).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "reopen",
      before: { status: "closed" },
      after: { status: "open", awards: 0 },
    });
  });
});

describe("registrar partida", () => {
  beforeEach(async () => {
    await startGameplay(admin, FRIDAY_EVENING);
  });

  it("grava partida, adversário e participações, com a nota calculada pela v2", async () => {
    const match = await registerMatch(admin, matchInput(), FRIDAY_EVENING);

    expect(match).toMatchObject({
      sequence: 1,
      opponentName: "Rivais FC",
      goalsFor: 3,
      goalsAgainst: 1,
      result: "W",
    });

    const expectedRating = (participation: ParticipationEntry) =>
      calculateRating({
        ...participation,
        goalsFor: 3,
        goalsAgainst: 1,
        result: "W",
      }).rating;
    const input = matchInput();
    const rows = await sql`
      select player_id, position, goals, assists, saves, penalties_saved,
        rating::float8 as rating, rating_version
      from match_players where match_id = ${match.id} order by player_id`;
    expect(rows).toEqual(
      [...input.participations]
        .sort((a, b) => a.playerId - b.playerId)
        .map((participation) => ({
          player_id: participation.playerId,
          position: participation.position,
          goals: participation.goals,
          assists: participation.assists,
          saves: participation.saves,
          penalties_saved: participation.penaltiesSaved,
          rating: expectedRating(participation),
          rating_version: "v2",
        })),
    );
  });

  it("só quem foi selecionado ganha jogo; quem jogou com 0/0 também ganha", async () => {
    await registerMatch(
      admin,
      matchInput({
        participations: [line(lucao, "ATA", 2), line(ericky, "MEI")],
      }),
    );

    expect(await totals(lucao)).toMatchObject({ matches: 1, goals: 2 });
    expect(await totals(ericky)).toMatchObject({
      matches: 1,
      goals: 0,
      assists: 0,
    });
    expect(await totals(felp)).toMatchObject({ matches: 0 });
    expect(await totals(heit)).toMatchObject({ matches: 0 });
  });

  it("as estatísticas e o ranking refletem a partida na hora", async () => {
    await sql`
      insert into legacy_stats (player_id, matches, goals, assists)
      values (${lucao}, 266, 200, 124)`;
    await registerMatch(admin, matchInput());

    expect(await totals(heit)).toMatchObject({
      matches: 1,
      goalkeeper_matches: 1,
      saves: 5,
      penalties_saved: 1,
      goals_conceded: 1,
    });
    const ranking = await getOverallRanking();
    expect(ranking[0]).toMatchObject({
      playerId: lucao,
      matches: 267,
      goals: 202,
      goalContributions: 326,
    });
    expect(ranking.find((row) => row.playerId === ericky)).toMatchObject({
      matches: 1,
      goals: 1,
      assists: 2,
      goalContributions: 3,
    });

    const open = await getOpenNight();
    expect(open?.matches).toHaveLength(1);
    expect(open?.matches[0].participations.map((p) => p.playerId)).toEqual([
      ericky,
      lucao,
      heit,
    ]);
  });

  it("defesa de pênalti soma 0,5 à nota do goleiro e não conta como defesa extra", async () => {
    const withPenalty = await registerMatch(
      admin,
      matchInput({ participations: [keeper(heit, 5, 1)] }),
    );
    const without = await registerMatch(
      admin,
      matchInput({ participations: [keeper(heit, 5)] }),
    );

    const rating = (match: typeof withPenalty) =>
      match.participations[0].rating;
    expect(rating(withPenalty)).toBeCloseTo(rating(without) + 0.5, 6);
    expect(await totals(heit)).toMatchObject({ saves: 10, penalties_saved: 1 });
  });

  it("reaproveita o adversário sem diferenciar maiúsculas e numera as partidas", async () => {
    const first = await registerMatch(admin, matchInput());
    const second = await registerMatch(
      admin,
      matchInput({ opponentName: "  rivais   fc " }),
    );

    expect(await count("opponents")).toBe(1);
    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect(second.opponentName).toBe("Rivais FC");
  });

  it("empate decidido nos pênaltis: resultado e nota seguem a disputa, sem somar gols", async () => {
    const match = await registerMatch(
      admin,
      matchInput({
        goalsFor: 2,
        goalsAgainst: 2,
        wentToPenalties: true,
        penaltyScoreFor: 4,
        penaltyScoreAgainst: 3,
        matchType: "playoff",
        participations: [line(lucao, "ATA", 2), keeper(heit, 3)],
      }),
    );

    expect(match).toMatchObject({
      result: "W",
      goalsFor: 2,
      goalsAgainst: 2,
      penaltyScoreFor: 4,
      penaltyScoreAgainst: 3,
      matchType: "playoff",
    });
    expect(match.participations.find((p) => p.playerId === lucao)?.rating).toBe(
      calculateRating({
        ...line(lucao, "ATA", 2),
        goalsFor: 2,
        goalsAgainst: 2,
        result: "W",
      }).rating,
    );
    expect(await totals(lucao)).toMatchObject({ goals: 2, wins: 1 });
    expect(await totals(heit)).toMatchObject({ goals_conceded: 2 });
  });

  it("audita a partida com o autor da sessão e as participações", async () => {
    const match = await registerMatch(admin, matchInput());

    const [audit] = await audits("matches");
    expect(audit).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "create",
      entity_id: String(match.id),
      before: null,
      after: {
        opponent: "Rivais FC",
        goalsFor: 3,
        goalsAgainst: 1,
        result: "W",
      },
    });
    expect(audit.after.participations).toHaveLength(3);
    expect(audit.after.participations[0]).toHaveProperty("rating");
  });

  it("rejeita dados inválidos sem gravar nada", async () => {
    const invalid: [string, MatchInput][] = [
      [
        "gols acima do placar",
        matchInput({
          goalsFor: 2,
          participations: [line(lucao, "ATA", 2), line(ericky, "MEI", 1)],
        }),
      ],
      [
        "assistências acima do placar",
        matchInput({
          goalsFor: 1,
          participations: [line(lucao, "ATA", 1), line(ericky, "MEI", 0, 2)],
        }),
      ],
      [
        "dois goleiros",
        matchInput({ participations: [keeper(heit, 1), keeper(felp, 1)] }),
      ],
      [
        "defesas de pênalti acima das defesas",
        matchInput({ participations: [keeper(heit, 1, 2)] }),
      ],
      [
        "defesas em jogador de linha",
        matchInput({
          participations: [{ ...line(lucao, "ATA"), saves: 2 }],
        }),
      ],
      ["sem jogadores", matchInput({ participations: [] })],
      [
        "pênaltis sem empate",
        matchInput({
          wentToPenalties: true,
          penaltyScoreFor: 4,
          penaltyScoreAgainst: 3,
        }),
      ],
    ];

    for (const [name, input] of invalid) {
      await expect(registerMatch(admin, input), name).rejects.toMatchObject({
        code: "INVALID_MATCH",
      });
    }
    expect(await count("matches")).toBe(0);
    expect(await count("match_players")).toBe(0);
    expect(await count("opponents")).toBe(0);
    expect(await audits("matches")).toEqual([]);
  });

  it("jogador inexistente ou inativo é recusado", async () => {
    await expect(
      registerMatch(admin, matchInput({ participations: [line(9999, "MC")] })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await sql`update players set is_active = false where id = ${felp}`;
    await expect(
      registerMatch(admin, matchInput({ participations: [line(felp, "PD")] })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await count("matches")).toBe(0);
  });

  it("é atômico: se a auditoria falha, nem o adversário novo fica gravado", async () => {
    const ghost: RequestContext = {
      ...admin,
      actor: { ...admin.actor, userId: "usuario-inexistente" },
    };

    await expect(registerMatch(ghost, matchInput())).rejects.toThrow();

    expect(await count("matches")).toBe(0);
    expect(await count("match_players")).toBe(0);
    expect(await count("opponents")).toBe(0);
    expect(await count("audit_log", sql`entity = 'matches'`)).toBe(0);
  });

  it("player não registra partida", async () => {
    await expect(registerMatch(player, matchInput())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await count("matches")).toBe(0);
  });
});

describe("registrar partida sem gameplay aberta", () => {
  it("é recusado quando não há noite", async () => {
    await expect(registerMatch(admin, matchInput())).rejects.toMatchObject({
      code: "NO_OPEN_NIGHT",
    });
    expect(await count("matches")).toBe(0);
  });

  it("é recusado depois de encerrar", async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    await registerMatch(admin, matchInput());
    await closeGameplay(admin);

    await expect(registerMatch(admin, matchInput())).rejects.toMatchObject({
      code: "NO_OPEN_NIGHT",
    });
    expect(await count("matches")).toBe(1);
  });
});

describe("editar partida", () => {
  let matchId: number;

  beforeEach(async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    matchId = (await registerMatch(admin, matchInput())).id;
  });

  it("recalcula as notas de todos e as estatísticas refletem a correção", async () => {
    const before = await sql`
      select player_id, rating::float8 as rating from match_players
      where match_id = ${matchId} order by player_id`;

    // Correção: foi 2x1 (não 3x1), Felp jogou e Ericky não.
    const corrected = matchInput({
      goalsFor: 2,
      participations: [
        line(lucao, "ATA", 2, 0),
        line(felp, "PD", 0, 1),
        keeper(heit, 5, 1),
      ],
    });
    const updated = await updateMatch(admin, { ...corrected, matchId });

    expect(updated).toMatchObject({ id: matchId, sequence: 1, goalsFor: 2 });
    for (const participation of corrected.participations) {
      const stored = updated.participations.find(
        (p) => p.playerId === participation.playerId,
      );
      expect(stored?.rating).toBe(
        calculateRating({
          ...participation,
          goalsFor: 2,
          goalsAgainst: 1,
          result: "W",
        }).rating,
      );
    }
    // A nota do Lucão mudou só por causa do placar: a participação dele nos
    // gols passou de 2/3 para 2/2.
    const lucaoBefore = before.find((row) => row.player_id === lucao)!.rating;
    const lucaoAfter = updated.participations.find(
      (p) => p.playerId === lucao,
    )!.rating;
    expect(lucaoAfter).not.toBe(lucaoBefore);

    expect(await totals(ericky)).toMatchObject({ matches: 0, goals: 0 });
    expect(await totals(felp)).toMatchObject({ matches: 1, assists: 1 });
    expect(await totals(lucao)).toMatchObject({ matches: 1, goals: 2 });
    expect(await count("matches")).toBe(1);
  });

  it("audita com o antes e o depois", async () => {
    await updateMatch(admin, {
      ...matchInput({ opponentName: "Outro Time", goalsAgainst: 0 }),
      matchId,
    });

    const [, update] = await audits("matches");
    expect(update).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "update",
      entity_id: String(matchId),
      before: { opponent: "Rivais FC", goalsAgainst: 1 },
      after: { opponent: "Outro Time", goalsAgainst: 0 },
    });
  });

  it("correção inválida é recusada e a partida fica como estava", async () => {
    await expect(
      updateMatch(admin, {
        ...matchInput({
          goalsFor: 1,
          participations: [line(lucao, "ATA", 2)],
        }),
        matchId,
      }),
    ).rejects.toMatchObject({ code: "INVALID_MATCH" });

    expect(await totals(lucao)).toMatchObject({ goals: 2 });
    expect(await count("match_players")).toBe(3);
    expect(await audits("matches")).toHaveLength(1);
  });

  it("não edita partida de noite encerrada", async () => {
    await closeGameplay(admin);

    await expect(
      updateMatch(admin, { ...matchInput({ goalsFor: 9 }), matchId }),
    ).rejects.toMatchObject({ code: "NIGHT_CLOSED" });
    const [row] =
      await sql`select goals_for from matches where id = ${matchId}`;
    expect(row.goals_for).toBe(3);
  });

  it("partida inexistente e player sem permissão", async () => {
    await expect(
      updateMatch(admin, { ...matchInput(), matchId: 9999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateMatch(player, { ...matchInput(), matchId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("excluir partida", () => {
  let matchId: number;

  beforeEach(async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    matchId = (await registerMatch(admin, matchInput())).id;
  });

  it("tira a partida das estatísticas, mantém a linha e audita", async () => {
    await deleteMatch(admin, { matchId });

    expect(await totals(lucao)).toMatchObject({ matches: 0, goals: 0 });
    expect(await totals(heit)).toMatchObject({ matches: 0, saves: 0 });
    expect((await getOpenNight())?.matches).toEqual([]);

    const [row] = await sql`
      select deleted_at is not null as deleted from matches where id = ${matchId}`;
    expect(row.deleted).toBe(true);

    const [, removal] = await audits("matches");
    expect(removal).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "delete",
      entity_id: String(matchId),
      before: { opponent: "Rivais FC", goalsFor: 3 },
      after: null,
    });
  });

  it("a próxima partida é registrada normalmente depois da exclusão", async () => {
    await deleteMatch(admin, { matchId });
    const next = await registerMatch(admin, matchInput());

    expect(next.sequence).toBe(1);
    expect((await getOpenNight())?.matches.map((m) => m.id)).toEqual([next.id]);
  });

  it("não exclui duas vezes nem em noite encerrada", async () => {
    await deleteMatch(admin, { matchId });
    await expect(deleteMatch(admin, { matchId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const other = await registerMatch(admin, matchInput());
    await closeGameplay(admin);
    await expect(
      deleteMatch(admin, { matchId: other.id }),
    ).rejects.toMatchObject({ code: "NIGHT_CLOSED" });
    expect(await totals(lucao)).toMatchObject({ matches: 1 });
  });

  it("player não exclui partida", async () => {
    await expect(deleteMatch(player, { matchId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await totals(lucao)).toMatchObject({ matches: 1 });
  });
});

describe("encerrar gameplay", () => {
  beforeEach(async () => {
    await startGameplay(admin, FRIDAY_EVENING);
  });

  it("não encerra noite sem partidas", async () => {
    await expect(closeGameplay(admin)).rejects.toMatchObject({
      code: "NIGHT_WITHOUT_MATCHES",
      message: expect.stringContaining("pelo menos uma partida"),
    });
    expect(await nightRows()).toMatchObject([{ status: "open" }]);
    expect(await count("night_awards")).toBe(0);
  });

  it("não encerra quando todas as partidas foram excluídas", async () => {
    const match = await registerMatch(admin, matchInput());
    await deleteMatch(admin, { matchId: match.id });

    await expect(closeGameplay(admin)).rejects.toMatchObject({
      code: "NIGHT_WITHOUT_MATCHES",
    });
    expect(await nightRows()).toMatchObject([{ status: "open" }]);
  });

  it("grava prêmios, resumo e status, e audita", async () => {
    await registerMatch(admin, matchInput(), FRIDAY_EVENING);
    await registerMatch(
      admin,
      matchInput({
        opponentName: "Segundo Time",
        goalsFor: 1,
        goalsAgainst: 2,
        participations: [line(lucao, "ATA", 1), keeper(heit, 2)],
      }),
      FRIDAY_EVENING,
    );

    const closed = await closeGameplay(admin, AFTER_MIDNIGHT);

    expect(closed).toMatchObject({
      status: "closed",
      closedAt: AFTER_MIDNIGHT,
    });
    expect(closed.summary).toContain(
      "2 partidas: 1 vitória, 0 empates e 1 derrota.",
    );
    expect(closed.summary).toContain("Artilheiro: Lucão (3 gols).");

    const awards = await getNightAwards(closed.id);
    const winners = (award: string) =>
      awards
        .filter((entry) => entry.award === award)
        .map((entry) => [entry.playerName, entry.value]);
    expect(winners("top_scorer")).toEqual([["Lucão", 3]]);
    expect(winners("top_assists")).toEqual([["Ericky", 2]]);
    // Lucão 3 gols; Ericky 1 gol + 2 assistências: empate em G/A.
    expect(winners("top_ga")).toEqual([
      ["Ericky", 3],
      ["Lucão", 3],
    ]);
    expect(winners("best_goalkeeper")).toEqual([["Heit", expect.any(Number)]]);
    expect(winners("mvp")).toHaveLength(1);

    const closeAudit = (await audits("nights")).at(-1);
    expect(closeAudit).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "close",
      before: { status: "open" },
      after: { status: "closed", matchCount: 2, wins: 1, losses: 1 },
    });
    expect((await getLatestClosedNight())?.id).toBe(closed.id);
    expect(await getOpenNight()).toBeNull();
  });

  it("reabrir, registrar mais uma partida e encerrar de novo recalcula tudo", async () => {
    await registerMatch(
      admin,
      matchInput({ participations: [line(lucao, "ATA", 1)] }),
      FRIDAY_EVENING,
    );
    const first = await closeGameplay(admin, FRIDAY_EVENING);
    expect(
      (await getNightAwards(first.id)).find((a) => a.award === "top_scorer"),
    ).toMatchObject({ playerName: "Lucão", value: 1 });

    await startGameplay(admin, FRIDAY_EVENING);
    await registerMatch(
      admin,
      matchInput({ participations: [line(ericky, "MEI", 3)] }),
      FRIDAY_EVENING,
    );
    const second = await closeGameplay(admin, FRIDAY_EVENING);

    expect(second.id).toBe(first.id);
    const awards = await getNightAwards(second.id);
    expect(awards.filter((a) => a.award === "top_scorer")).toMatchObject([
      { playerName: "Ericky", value: 3 },
    ]);
    expect(second.summary).toContain("2 partidas");
  });

  it("sem gameplay aberta e sem permissão", async () => {
    await expect(closeGameplay(player)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await registerMatch(admin, matchInput());
    await closeGameplay(admin);
    await expect(closeGameplay(admin)).rejects.toMatchObject({
      code: "NO_OPEN_NIGHT",
    });
  });
});

describe("cancelar gameplay vazia", () => {
  it("remove a noite sem partidas, para não deixar noite vazia no histórico", async () => {
    const started = await startGameplay(admin, FRIDAY_EVENING);

    await cancelGameplay(admin);

    expect(await count("nights")).toBe(0);
    expect((await audits("nights")).at(-1)).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "delete",
      entity_id: String(started.nightId),
    });
  });

  it("remove também quando só restam partidas excluídas", async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    const match = await registerMatch(admin, matchInput());
    await deleteMatch(admin, { matchId: match.id });

    await cancelGameplay(admin);

    expect(await count("nights")).toBe(0);
    expect(await count("matches")).toBe(0);
    expect(await count("match_players")).toBe(0);
    // O conteúdo da partida excluída continua na auditoria.
    expect(await audits("matches")).toMatchObject([
      { action: "create" },
      { action: "delete" },
    ]);
  });

  it("não cancela gameplay que tem partidas", async () => {
    await startGameplay(admin, FRIDAY_EVENING);
    await registerMatch(admin, matchInput());

    await expect(cancelGameplay(admin)).rejects.toMatchObject({
      code: "NIGHT_HAS_MATCHES",
    });
    expect(await count("nights")).toBe(1);
  });

  it("sem gameplay aberta e sem permissão", async () => {
    await expect(cancelGameplay(admin)).rejects.toMatchObject({
      code: "NO_OPEN_NIGHT",
    });
    await startGameplay(admin, FRIDAY_EVENING);
    await expect(cancelGameplay(player)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await count("nights")).toBe(1);
  });
});
