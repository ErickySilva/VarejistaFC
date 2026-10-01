import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ParticipationEntry } from "@/domain/match-entry";
import { calculateRating } from "@/domain/rating";
import type { RequestContext } from "@/server/auth/session";
import {
  registerMatch,
  updateMatch,
  type MatchInput,
} from "@/server/matches/service";
import { startGameplay } from "@/server/nights/service";
import {
  listActivePlayers,
  listPlayersForMatch,
} from "@/server/players/queries";
import { contextFor, createAccount } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Jogador desativado depois de ter jogado: continua na partida em que
// participou, pode ser mantido ou removido na edição, e não entra em outras.

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

let admin: RequestContext;
let ericky: number;
let lucao: number;
let felp: number;
// Partida de que o Felp participou e partida de que não participou.
let withFelp: number;
let withoutFelp: number;

async function insertPlayer(name: string, shirtNumber: number) {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position)
    values (${name}, ${name}, ${shirtNumber}, 'MC') returning id`;
  return row.id as number;
}

function line(playerId: number, goals = 0, assists = 0): ParticipationEntry {
  return {
    playerId,
    position: "MC",
    goals,
    assists,
    saves: null,
    penaltiesSaved: null,
  };
}

function matchInput(participations: ParticipationEntry[]): MatchInput {
  return {
    opponentName: "Rivais FC",
    matchType: null,
    goalsFor: 3,
    goalsAgainst: 1,
    wentToPenalties: false,
    penaltyScoreFor: null,
    penaltyScoreAgainst: null,
    participations,
  };
}

async function participantIds(matchId: number): Promise<number[]> {
  const rows = await sql`
    select player_id from match_players
    where match_id = ${matchId} order by player_id`;
  return rows.map((row) => row.player_id);
}

async function totals(playerId: number) {
  const [row] = await sql`
    select matches, goals, assists from v_player_totals_system
    where player_id = ${playerId}`;
  return row;
}

const ids = (players: { id: number }[]) => players.map((player) => player.id);

beforeEach(async () => {
  await resetDatabase(sql);
  await sql`
    insert into seasons (slug, name, game_edition, starts_on)
    values ('fc-26', 'FC 26', 'FC 26', '2026-06-06')`;
  ericky = await insertPlayer("Ericky", 7);
  lucao = await insertPlayer("Lucão", 10);
  felp = await insertPlayer("Felp", 11);
  await createAccount({ email: "admin@test.dev", role: "admin" });
  admin = await contextFor("admin@test.dev");

  await startGameplay(admin, new Date("2026-10-02T23:00:00Z"));
  withFelp = (
    await registerMatch(admin, matchInput([line(ericky, 1), line(felp, 1, 1)]))
  ).id;
  withoutFelp = (
    await registerMatch(admin, matchInput([line(ericky, 2), line(lucao, 1)]))
  ).id;

  await sql`update players set is_active = false where id = ${felp}`;
});

afterAll(async () => {
  await sql.end();
});

describe("elenco oferecido no formulário", () => {
  it("na criação lista só os jogadores ativos", async () => {
    expect(ids(await listActivePlayers())).toEqual([ericky, lucao]);
  });

  it("na edição da partida em que ele jogou, o inativo aparece e vem marcado", async () => {
    const roster = await listPlayersForMatch(withFelp);

    expect(ids(roster)).toEqual([ericky, lucao, felp]);
    expect(roster.find((player) => player.id === felp)).toMatchObject({
      name: "Felp",
      isActive: false,
    });
    expect(
      roster.filter((player) => player.id !== felp).map((p) => p.isActive),
    ).toEqual([true, true]);
  });

  it("na edição de outra partida, o inativo não aparece", async () => {
    expect(ids(await listPlayersForMatch(withoutFelp))).toEqual([
      ericky,
      lucao,
    ]);
  });
});

describe("editar a partida em que o inativo jogou", () => {
  it("manter a participação: ele continua na partida, com a nota recalculada", async () => {
    // Correção do placar para 4x1, mantendo o Felp e mudando os números dele.
    const input = {
      ...matchInput([line(ericky, 1), line(felp, 2, 1)]),
      goalsFor: 4,
    };

    const updated = await updateMatch(admin, { ...input, matchId: withFelp });

    expect(await participantIds(withFelp)).toEqual([ericky, felp]);
    expect(
      updated.participations.find((p) => p.playerId === felp),
    ).toMatchObject({
      goals: 2,
      assists: 1,
      rating: calculateRating({
        ...line(felp, 2, 1),
        goalsFor: 4,
        goalsAgainst: 1,
        result: "W",
      }).rating,
    });
    expect(await totals(felp)).toMatchObject({
      matches: 1,
      goals: 2,
      assists: 1,
    });
    // Ele continua inativo: a edição não o reativa.
    const [row] = await sql`select is_active from players where id = ${felp}`;
    expect(row.is_active).toBe(false);
  });

  it("salvar sem alterar nada não tira o inativo da partida", async () => {
    await updateMatch(admin, {
      ...matchInput([line(ericky, 1), line(felp, 1, 1)]),
      matchId: withFelp,
    });

    expect(await participantIds(withFelp)).toEqual([ericky, felp]);
    expect(await totals(felp)).toMatchObject({ matches: 1, goals: 1 });
  });

  it("remover explicitamente: a participação sai e ele perde o jogo", async () => {
    await updateMatch(admin, {
      ...matchInput([line(ericky, 1)]),
      matchId: withFelp,
    });

    expect(await participantIds(withFelp)).toEqual([ericky]);
    expect(await totals(felp)).toMatchObject({ matches: 0, goals: 0 });

    const [audit] = await sql`
      select before, after from audit_log
      where entity = 'matches' and action = 'update'`;
    const playerIds = (snapshot: { participations: { playerId: number }[] }) =>
      snapshot.participations.map((p) => p.playerId).sort();
    expect(playerIds(audit.before)).toEqual([ericky, felp]);
    expect(playerIds(audit.after)).toEqual([ericky]);
  });

  it("depois de removido, não pode ser colocado de volta", async () => {
    await updateMatch(admin, {
      ...matchInput([line(ericky, 1)]),
      matchId: withFelp,
    });

    expect(ids(await listPlayersForMatch(withFelp))).toEqual([ericky, lucao]);
    await expect(
      updateMatch(admin, {
        ...matchInput([line(ericky, 1), line(felp)]),
        matchId: withFelp,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await participantIds(withFelp)).toEqual([ericky]);
  });
});

describe("as outras partidas não mudam de comportamento", () => {
  it("o inativo não pode ser adicionado a uma partida em que não jogou", async () => {
    await expect(
      updateMatch(admin, {
        ...matchInput([line(ericky, 2), line(lucao, 1), line(felp)]),
        matchId: withoutFelp,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await participantIds(withoutFelp)).toEqual([ericky, lucao]);
  });

  it("o inativo não pode entrar em uma partida nova", async () => {
    await expect(
      registerMatch(admin, matchInput([line(ericky), line(felp)])),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const [{ count }] = await sql`select count(*)::int as count from matches`;
    expect(count).toBe(2);
  });

  it("editar a outra partida segue funcionando normalmente", async () => {
    await updateMatch(admin, {
      ...matchInput([line(ericky, 3)]),
      matchId: withoutFelp,
    });

    expect(await participantIds(withoutFelp)).toEqual([ericky]);
    // A partida do Felp não foi tocada.
    expect(await participantIds(withFelp)).toEqual([ericky, felp]);
    expect(await totals(felp)).toMatchObject({ matches: 1, goals: 1 });
  });

  it("jogador inexistente continua recusado na edição", async () => {
    await expect(
      updateMatch(admin, {
        ...matchInput([line(ericky, 1), line(9999)]),
        matchId: withFelp,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await participantIds(withFelp)).toEqual([ericky, felp]);
  });
});
