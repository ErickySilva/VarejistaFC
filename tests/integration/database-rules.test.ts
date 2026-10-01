import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

const sql = postgres(getTestDatabaseUrl(), { max: 4, onnotice: () => {} });

type Position =
  | "GOL"
  | "ZAG"
  | "LD"
  | "LE"
  | "VOL"
  | "MC"
  | "MD"
  | "ME"
  | "MEI"
  | "PD"
  | "PE"
  | "SA"
  | "ATA";

type Db = postgres.Sql | postgres.TransactionSql;

interface Fixture {
  seasonId: number;
  opponentId: number;
  nightId: number;
  ericky: number;
  lucao: number;
  felp: number;
  heit: number;
}

let fx: Fixture;

async function createPlayer(
  slug: string,
  shirtNumber: number,
  position: Position,
): Promise<number> {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position)
    values (${slug}, ${slug}, ${shirtNumber}, ${position})
    returning id`;
  return row.id;
}

async function createNight(referenceDate: string): Promise<number> {
  const [row] = await sql`
    insert into nights (season_id, reference_date)
    values (${fx.seasonId}, ${referenceDate})
    returning id`;
  return row.id;
}

async function closeNight(nightId: number) {
  await sql`update nights set status = 'closed', closed_at = now() where id = ${nightId}`;
}

async function reopenNight(nightId: number) {
  await sql`update nights set status = 'open', closed_at = null where id = ${nightId}`;
}

interface MatchInput {
  nightId?: number;
  sequence?: number;
  matchType?: "x1" | "match" | "rush";
  goalsFor: number;
  goalsAgainst: number;
  wentToPenalties?: boolean;
  penaltyScoreFor?: number | null;
  penaltyScoreAgainst?: number | null;
}

async function createMatch(db: Db, input: MatchInput) {
  const [row] = await db`
    insert into matches (
      night_id, sequence, opponent_id, match_type, played_at, goals_for,
      goals_against, went_to_penalties, penalty_score_for, penalty_score_against
    ) values (
      ${input.nightId ?? fx.nightId}, ${input.sequence ?? 1}, ${fx.opponentId},
      ${input.matchType ?? "match"}, now(), ${input.goalsFor}, ${input.goalsAgainst},
      ${input.wentToPenalties ?? false},
      ${input.penaltyScoreFor ?? null}, ${input.penaltyScoreAgainst ?? null}
    )
    returning id, result, goals_for, goals_against`;
  return row as {
    id: number;
    result: "W" | "D" | "L";
    goals_for: number;
    goals_against: number;
  };
}

interface ParticipationInput {
  position?: Position;
  goals?: number;
  assists?: number;
  saves?: number | null;
  penaltiesSaved?: number | null;
  rating?: number;
}

async function addPlayer(
  db: Db,
  matchId: number,
  playerId: number,
  input: ParticipationInput = {},
) {
  await db`
    insert into match_players (
      match_id, player_id, position, goals, assists, saves, penalties_saved,
      rating, rating_version
    ) values (
      ${matchId}, ${playerId}, ${input.position ?? "MC"}, ${input.goals ?? 0},
      ${input.assists ?? 0}, ${input.saves ?? null},
      ${input.penaltiesSaved ?? null}, ${input.rating ?? 6.0}, 'v1'
    )`;
}

async function systemTotals(playerId: number) {
  const [row] = await sql`
    select * from v_player_totals_system where player_id = ${playerId}`;
  return row;
}

// Executa a operação e devolve o erro do PostgreSQL, ou falha se não houver.
async function pgError(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    if (error instanceof postgres.PostgresError) return error;
    throw error;
  }
  throw new Error("A operação deveria ter sido rejeitada pelo banco.");
}

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";

beforeEach(async () => {
  await resetDatabase(sql);

  const [season] = await sql`
    insert into seasons (slug, name, game_edition, starts_on)
    values ('fc-26', 'FC 26', 'FC 26', '2025-09-26')
    returning id`;
  const [opponent] = await sql`
    insert into opponents (name) values ('Adversário FC') returning id`;

  fx = {
    seasonId: season.id,
    opponentId: opponent.id,
    nightId: 0,
    ericky: await createPlayer("ericky", 7, "MEI"),
    lucao: await createPlayer("lucao", 10, "ATA"),
    felp: await createPlayer("felp", 11, "PE"),
    heit: await createPlayer("heit", 69, "GOL"),
  };
  fx.nightId = await createNight("2026-10-02");
});

afterAll(async () => {
  await sql.end();
});

describe("participação e contagem de jogos", () => {
  it("participação com 0 gols e 0 assistências conta como um jogo", async () => {
    const match = await createMatch(sql, { goalsFor: 3, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.ericky, { position: "MEI" });

    expect(await systemTotals(fx.ericky)).toMatchObject({
      matches: 1,
      goals: 0,
      assists: 0,
      goal_contributions: 0,
      wins: 1,
    });
    // Quem não participou da partida não ganha jogo.
    expect(await systemTotals(fx.lucao)).toMatchObject({ matches: 0 });
  });

  it("um jogador só entra uma vez na mesma partida", async () => {
    const match = await createMatch(sql, { goalsFor: 1, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.ericky);

    const error = await pgError(() => addPlayer(sql, match.id, fx.ericky));
    expect(error.code).toBe(UNIQUE_VIOLATION);
  });

  it("partida excluída logicamente sai das estatísticas", async () => {
    const match = await createMatch(sql, { goalsFor: 2, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.lucao, { position: "ATA", goals: 2 });
    expect(await systemTotals(fx.lucao)).toMatchObject({
      matches: 1,
      goals: 2,
    });

    await sql`update matches set deleted_at = now() where id = ${match.id}`;
    expect(await systemTotals(fx.lucao)).toMatchObject({
      matches: 0,
      goals: 0,
    });
  });
});

describe("totais da partida", () => {
  it("aceita soma de gols igual ao placar", async () => {
    await sql.begin(async (tx) => {
      const match = await createMatch(tx, { goalsFor: 3, goalsAgainst: 1 });
      await addPlayer(tx, match.id, fx.lucao, { position: "ATA", goals: 2 });
      await addPlayer(tx, match.id, fx.felp, { position: "PE", goals: 1 });
    });

    expect(await systemTotals(fx.lucao)).toMatchObject({
      matches: 1,
      goals: 2,
    });
    expect(await systemTotals(fx.felp)).toMatchObject({ matches: 1, goals: 1 });
  });

  it("aceita soma de gols menor que o placar (gols de bots)", async () => {
    await sql.begin(async (tx) => {
      const match = await createMatch(tx, { goalsFor: 4, goalsAgainst: 0 });
      await addPlayer(tx, match.id, fx.lucao, { position: "ATA", goals: 1 });
    });

    expect(await systemTotals(fx.lucao)).toMatchObject({
      matches: 1,
      goals: 1,
    });
  });

  it("rejeita soma de gols acima do placar", async () => {
    const error = await pgError(() =>
      sql.begin(async (tx) => {
        const match = await createMatch(tx, { goalsFor: 2, goalsAgainst: 0 });
        await addPlayer(tx, match.id, fx.lucao, { position: "ATA", goals: 2 });
        await addPlayer(tx, match.id, fx.felp, { position: "PE", goals: 1 });
      }),
    );

    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.constraint_name).toBe("match_totals_goals");
    // A transação inteira é desfeita: nem a partida fica gravada.
    const [{ count }] = await sql`select count(*)::int as count from matches`;
    expect(count).toBe(0);
  });

  it("rejeita soma de assistências acima do placar", async () => {
    const error = await pgError(() =>
      sql.begin(async (tx) => {
        const match = await createMatch(tx, { goalsFor: 2, goalsAgainst: 0 });
        await addPlayer(tx, match.id, fx.lucao, { position: "ATA", goals: 2 });
        await addPlayer(tx, match.id, fx.ericky, {
          position: "MEI",
          assists: 2,
        });
        await addPlayer(tx, match.id, fx.felp, { position: "PE", assists: 1 });
      }),
    );

    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.constraint_name).toBe("match_totals_assists");
  });

  it("rejeita contribuição individual acima do placar", async () => {
    const error = await pgError(() =>
      sql.begin(async (tx) => {
        const match = await createMatch(tx, { goalsFor: 2, goalsAgainst: 0 });
        await addPlayer(tx, match.id, fx.lucao, {
          position: "ATA",
          goals: 2,
          assists: 1,
        });
      }),
    );

    expect(error.code).toBe(CHECK_VIOLATION);
    expect(error.constraint_name).toBe("match_totals_contributions");
  });

  it("rejeita reduzir o placar abaixo dos gols já registrados", async () => {
    const match = await createMatch(sql, { goalsFor: 3, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.lucao, { position: "ATA", goals: 3 });

    const error = await pgError(
      () => sql`update matches set goals_for = 2 where id = ${match.id}`,
    );
    expect(error.constraint_name).toBe("match_totals_goals");
  });
});

describe("noites", () => {
  it("noite fechada impede criar, alterar e remover partidas e participações", async () => {
    const match = await createMatch(sql, { goalsFor: 2, goalsAgainst: 1 });
    await addPlayer(sql, match.id, fx.lucao, { position: "ATA", goals: 1 });
    await closeNight(fx.nightId);

    const operations = [
      () => createMatch(sql, { sequence: 2, goalsFor: 1, goalsAgainst: 0 }),
      () => sql`update matches set goals_for = 5 where id = ${match.id}`,
      () => sql`update matches set deleted_at = now() where id = ${match.id}`,
      () => addPlayer(sql, match.id, fx.felp),
      () =>
        sql`update match_players set goals = 2
            where match_id = ${match.id} and player_id = ${fx.lucao}`,
      () =>
        sql`delete from match_players
            where match_id = ${match.id} and player_id = ${fx.lucao}`,
    ];

    for (const operation of operations) {
      const error = await pgError(operation);
      expect(error.code).toBe(CHECK_VIOLATION);
      expect(error.constraint_name).toBe("night_is_closed");
    }

    // Nada mudou enquanto a noite esteve fechada.
    expect(await systemTotals(fx.lucao)).toMatchObject({
      matches: 1,
      goals: 1,
    });
  });

  it("reabrir a noite libera a correção", async () => {
    const match = await createMatch(sql, { goalsFor: 2, goalsAgainst: 1 });
    await addPlayer(sql, match.id, fx.lucao, { position: "ATA", goals: 1 });
    await closeNight(fx.nightId);
    await reopenNight(fx.nightId);

    await sql`update match_players set goals = 2
              where match_id = ${match.id} and player_id = ${fx.lucao}`;
    expect(await systemTotals(fx.lucao)).toMatchObject({ goals: 2 });
  });

  it("só existe uma noite aberta por vez", async () => {
    const error = await pgError(() => createNight("2026-10-09"));
    expect(error.code).toBe(UNIQUE_VIOLATION);
    expect(error.constraint_name).toBe("nights_single_open_idx");

    await closeNight(fx.nightId);
    await expect(createNight("2026-10-09")).resolves.toBeTypeOf("number");
  });

  it("não aceita duas noites na mesma data de referência", async () => {
    await closeNight(fx.nightId);
    const error = await pgError(() => createNight("2026-10-02"));
    expect(error.code).toBe(UNIQUE_VIOLATION);
    expect(error.constraint_name).toBe("nights_reference_date_unique");
  });
});

describe("goleiro", () => {
  it("rejeita um segundo goleiro na mesma partida", async () => {
    const match = await createMatch(sql, { goalsFor: 1, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.heit, { position: "GOL", saves: 3 });

    const error = await pgError(() =>
      addPlayer(sql, match.id, fx.felp, { position: "GOL", saves: 1 }),
    );
    expect(error.code).toBe(UNIQUE_VIOLATION);
    expect(error.constraint_name).toBe("match_players_single_goalkeeper_idx");
  });

  it("saves só existe para goleiro, e goleiro sempre tem saves", async () => {
    const match = await createMatch(sql, { goalsFor: 1, goalsAgainst: 0 });

    const lineWithSaves = await pgError(() =>
      addPlayer(sql, match.id, fx.ericky, { position: "MEI", saves: 2 }),
    );
    expect(lineWithSaves.constraint_name).toBe(
      "match_players_saves_only_for_goalkeeper",
    );

    const goalkeeperWithoutSaves = await pgError(() =>
      addPlayer(sql, match.id, fx.heit, { position: "GOL", saves: null }),
    );
    expect(goalkeeperWithoutSaves.constraint_name).toBe(
      "match_players_saves_only_for_goalkeeper",
    );

    // Goleiro com zero defesas é válido.
    await addPlayer(sql, match.id, fx.heit, { position: "GOL", saves: 0 });
  });

  it("goleiro pode jogar na linha sem estatísticas de goleiro", async () => {
    const match = await createMatch(sql, { goalsFor: 2, goalsAgainst: 2 });
    await addPlayer(sql, match.id, fx.heit, { position: "ATA", goals: 1 });

    expect(await systemTotals(fx.heit)).toMatchObject({
      matches: 1,
      goals: 1,
      goalkeeper_matches: 0,
      goals_conceded: 0,
    });
  });

  it("penalties_saved não pode passar de saves nem existir fora do gol", async () => {
    const match = await createMatch(sql, { goalsFor: 1, goalsAgainst: 1 });

    const tooMany = await pgError(() =>
      addPlayer(sql, match.id, fx.heit, {
        position: "GOL",
        saves: 2,
        penaltiesSaved: 3,
      }),
    );
    expect(tooMany.constraint_name).toBe("match_players_penalties_saved_valid");

    const outfield = await pgError(() =>
      addPlayer(sql, match.id, fx.ericky, {
        position: "MEI",
        penaltiesSaved: 1,
      }),
    );
    expect(outfield.constraint_name).toBe(
      "match_players_penalties_saved_valid",
    );

    await addPlayer(sql, match.id, fx.heit, {
      position: "GOL",
      saves: 3,
      penaltiesSaved: 3,
    });
    expect(await systemTotals(fx.heit)).toMatchObject({
      saves: 3,
      penalties_saved: 3,
    });
  });

  it("12 defesas em derrota por 0x7 são aceitas e os derivados batem", async () => {
    const match = await createMatch(sql, { goalsFor: 0, goalsAgainst: 7 });
    await addPlayer(sql, match.id, fx.heit, {
      position: "GOL",
      saves: 12,
      rating: 5.5,
    });

    const [row] = await sql`
      select result, saves, goals_conceded, clean_sheet, rating
      from v_player_match where match_id = ${match.id}`;
    expect(row).toMatchObject({
      result: "L",
      saves: 12,
      goals_conceded: 7,
      clean_sheet: false,
    });
    expect(Number(row.rating)).toBe(5.5);
    expect(await systemTotals(fx.heit)).toMatchObject({
      matches: 1,
      losses: 1,
      goalkeeper_matches: 1,
      saves: 12,
      goals_conceded: 7,
      clean_sheets: 0,
    });
  });

  it("clean sheet é derivado: goleiro em partida sem gol sofrido", async () => {
    const match = await createMatch(sql, { goalsFor: 1, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.heit, { position: "GOL", saves: 4 });
    await addPlayer(sql, match.id, fx.ericky, { position: "MEI" });

    expect(await systemTotals(fx.heit)).toMatchObject({ clean_sheets: 1 });
    // Jogador de linha não recebe clean sheet.
    expect(await systemTotals(fx.ericky)).toMatchObject({ clean_sheets: 0 });
  });
});

describe("resultado e disputa de pênaltis", () => {
  it("empate sem pênaltis é D", async () => {
    const match = await createMatch(sql, { goalsFor: 2, goalsAgainst: 2 });
    expect(match.result).toBe("D");
  });

  it("vitória e derrota no tempo normal são W e L", async () => {
    const win = await createMatch(sql, { goalsFor: 3, goalsAgainst: 1 });
    const loss = await createMatch(sql, {
      sequence: 2,
      goalsFor: 0,
      goalsAgainst: 1,
    });
    expect(win.result).toBe("W");
    expect(loss.result).toBe("L");
  });

  it("2x2 com pênaltis 4x3 é W", async () => {
    const match = await createMatch(sql, {
      goalsFor: 2,
      goalsAgainst: 2,
      wentToPenalties: true,
      penaltyScoreFor: 4,
      penaltyScoreAgainst: 3,
    });
    expect(match.result).toBe("W");
  });

  it("2x2 com pênaltis 3x4 é L", async () => {
    const match = await createMatch(sql, {
      goalsFor: 2,
      goalsAgainst: 2,
      wentToPenalties: true,
      penaltyScoreFor: 3,
      penaltyScoreAgainst: 4,
    });
    expect(match.result).toBe("L");
  });

  it("gols das cobranças não entram nos gols da partida", async () => {
    const error = await pgError(() =>
      sql.begin(async (tx) => {
        const match = await createMatch(tx, {
          goalsFor: 2,
          goalsAgainst: 2,
          wentToPenalties: true,
          penaltyScoreFor: 4,
          penaltyScoreAgainst: 3,
        });
        // 3 gols individuais contra um placar de 2: os 4 da disputa não contam.
        await addPlayer(tx, match.id, fx.lucao, { position: "ATA", goals: 2 });
        await addPlayer(tx, match.id, fx.felp, { position: "PE", goals: 1 });
      }),
    );
    expect(error.constraint_name).toBe("match_totals_goals");

    const match = await sql.begin(async (tx) => {
      const created = await createMatch(tx, {
        goalsFor: 2,
        goalsAgainst: 2,
        wentToPenalties: true,
        penaltyScoreFor: 4,
        penaltyScoreAgainst: 3,
      });
      await addPlayer(tx, created.id, fx.lucao, { position: "ATA", goals: 2 });
      await addPlayer(tx, created.id, fx.heit, { position: "GOL", saves: 5 });
      return created;
    });

    expect(match).toMatchObject({
      goals_for: 2,
      goals_against: 2,
      result: "W",
    });
    expect(await systemTotals(fx.lucao)).toMatchObject({ goals: 2, wins: 1 });
    // O goleiro sofreu 2 gols, não 2 + 3 das cobranças.
    expect(await systemTotals(fx.heit)).toMatchObject({ goals_conceded: 2 });
  });

  it("rejeita disputa de pênaltis incoerente", async () => {
    const notADraw = await pgError(() =>
      createMatch(sql, {
        goalsFor: 3,
        goalsAgainst: 2,
        wentToPenalties: true,
        penaltyScoreFor: 4,
        penaltyScoreAgainst: 3,
      }),
    );
    expect(notADraw.constraint_name).toBe("matches_penalties_only_after_draw");

    const tiedShootout = await pgError(() =>
      createMatch(sql, {
        goalsFor: 2,
        goalsAgainst: 2,
        wentToPenalties: true,
        penaltyScoreFor: 3,
        penaltyScoreAgainst: 3,
      }),
    );
    expect(tiedShootout.constraint_name).toBe("matches_penalty_scores_valid");

    const scoreWithoutFlag = await pgError(() =>
      createMatch(sql, {
        goalsFor: 2,
        goalsAgainst: 2,
        penaltyScoreFor: 4,
        penaltyScoreAgainst: 3,
      }),
    );
    expect(scoreWithoutFlag.constraint_name).toBe(
      "matches_penalty_scores_presence",
    );

    const flagWithoutScore = await pgError(() =>
      createMatch(sql, {
        goalsFor: 2,
        goalsAgainst: 2,
        wentToPenalties: true,
      }),
    );
    expect(flagWithoutScore.constraint_name).toBe(
      "matches_penalty_scores_presence",
    );
  });
});

describe("auditoria", () => {
  it("audit_log aceita inserção e rejeita UPDATE, DELETE e TRUNCATE", async () => {
    const [entry] = await sql`
      insert into audit_log (action, entity, entity_id, after)
      values ('create', 'matches', '1', ${sql.json({ goals_for: 2 })})
      returning id`;

    const operations = [
      () => sql`update audit_log set entity = 'x' where id = ${entry.id}`,
      () => sql`delete from audit_log where id = ${entry.id}`,
      () => sql`truncate audit_log`,
    ];
    for (const operation of operations) {
      const error = await pgError(operation);
      expect(error.code).toBe(INSUFFICIENT_PRIVILEGE);
    }

    const [row] = await sql`
      select entity from audit_log where id = ${entry.id}`;
    expect(row.entity).toBe("matches");
  });
});

describe("histórico pré-sistema", () => {
  it("fica separado das estatísticas do sistema e compõe o total geral", async () => {
    await sql`
      insert into legacy_stats
        (player_id, season_id, matches, goals, assists, clean_sheets)
      values (${fx.ericky}, ${fx.seasonId}, 203, 131, 138, null),
             (${fx.heit}, ${fx.seasonId}, 144, 47, 20, 5)`;

    const match = await createMatch(sql, { goalsFor: 2, goalsAgainst: 0 });
    await addPlayer(sql, match.id, fx.ericky, {
      position: "MEI",
      goals: 1,
      assists: 1,
    });
    await addPlayer(sql, match.id, fx.heit, { position: "GOL", saves: 2 });

    // O histórico não vira partida nem entra nos totais do sistema.
    const [{ count }] = await sql`
      select count(*)::int as count from v_player_match
      where player_id = ${fx.ericky}`;
    expect(count).toBe(1);
    expect(await systemTotals(fx.ericky)).toMatchObject({
      matches: 1,
      goals: 1,
      assists: 1,
      goal_contributions: 2,
    });

    const [ericky] = await sql`
      select * from v_player_totals_overall where player_id = ${fx.ericky}`;
    expect(ericky).toMatchObject({
      system_matches: 1,
      legacy_matches: 203,
      total_matches: 204,
      system_goals: 1,
      legacy_goals: 131,
      total_goals: 132,
      system_assists: 1,
      legacy_assists: 138,
      total_assists: 139,
      system_goal_contributions: 2,
      legacy_goal_contributions: 269,
      total_goal_contributions: 271,
      legacy_clean_sheets: null,
      total_clean_sheets: 0,
    });

    const [heit] = await sql`
      select * from v_player_totals_overall where player_id = ${fx.heit}`;
    expect(heit).toMatchObject({
      system_matches: 1,
      legacy_matches: 144,
      total_matches: 145,
      system_clean_sheets: 1,
      legacy_clean_sheets: 5,
      total_clean_sheets: 6,
    });

    // Jogador sem histórico e sem partidas aparece zerado.
    const [felp] = await sql`
      select * from v_player_totals_overall where player_id = ${fx.felp}`;
    expect(felp).toMatchObject({
      system_matches: 0,
      legacy_matches: 0,
      total_matches: 0,
    });
  });

  it("rejeita clean sheets históricos acima do número de jogos", async () => {
    const error = await pgError(
      () => sql`
        insert into legacy_stats
          (player_id, season_id, matches, goals, assists, clean_sheets)
        values (${fx.heit}, ${fx.seasonId}, 10, 0, 0, 11)`,
    );
    expect(error.constraint_name).toBe("legacy_stats_clean_sheets_range");
  });
});
