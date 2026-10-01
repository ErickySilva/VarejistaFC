import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seed } from "@/db/seed/seed";
import { getTestDatabaseUrl } from "./test-database";

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });
const db = drizzle(sql);

async function count(table: string): Promise<number> {
  const [row] = await sql`select count(*)::int as count from ${sql(table)}`;
  return row.count;
}

beforeEach(async () => {
  await sql`
    truncate match_players, nickname_assignments, night_awards, matches,
      nights, seasons, opponents, nicknames, legacy_stats, players
    restart identity cascade`;
});

afterAll(async () => {
  await sql.end();
});

describe("seed", () => {
  it("insere temporada, jogadores, histórico e apelidos", async () => {
    expect(await seed(db)).toEqual({
      seasons: 1,
      players: 4,
      legacyStats: 4,
      nicknames: 8,
    });

    const [season] = await sql`
      select slug, name, game_edition, starts_on::text, ends_on::text
      from seasons`;
    expect(season).toEqual({
      slug: "fc-26",
      name: "FC 26",
      game_edition: "FC 26",
      starts_on: "2026-06-06",
      ends_on: null,
    });

    const players = await sql`
      select slug, name, shirt_number, default_position, is_active
      from players order by shirt_number`;
    expect(players).toEqual([
      {
        slug: "ericky",
        name: "Ericky",
        shirt_number: 7,
        default_position: "MEI",
        is_active: true,
      },
      {
        slug: "lucao",
        name: "Lucão",
        shirt_number: 10,
        default_position: "ATA",
        is_active: true,
      },
      {
        slug: "felp",
        name: "Felp",
        shirt_number: 11,
        default_position: "PD",
        is_active: true,
      },
      {
        slug: "heit",
        name: "Heit",
        shirt_number: 69,
        default_position: "GOL",
        is_active: true,
      },
    ]);
  });

  it("o histórico compõe o total geral e não entra nos totais do sistema", async () => {
    await seed(db);

    const overall = await sql`
      select p.slug, o.legacy_matches, o.legacy_goals, o.legacy_assists,
        o.legacy_goal_contributions, o.legacy_clean_sheets,
        o.system_matches, o.total_matches, o.total_goal_contributions
      from v_player_totals_overall o
      join players p on p.id = o.player_id
      order by p.slug`;

    // Valores da tabela do ADR 0003.
    expect(overall).toEqual([
      {
        slug: "ericky",
        legacy_matches: 203,
        legacy_goals: 131,
        legacy_assists: 138,
        legacy_goal_contributions: 269,
        legacy_clean_sheets: null,
        system_matches: 0,
        total_matches: 203,
        total_goal_contributions: 269,
      },
      {
        slug: "felp",
        legacy_matches: 207,
        legacy_goals: 104,
        legacy_assists: 88,
        legacy_goal_contributions: 192,
        legacy_clean_sheets: null,
        system_matches: 0,
        total_matches: 207,
        total_goal_contributions: 192,
      },
      {
        slug: "heit",
        legacy_matches: 144,
        legacy_goals: 47,
        legacy_assists: 20,
        legacy_goal_contributions: 67,
        legacy_clean_sheets: 5,
        system_matches: 0,
        total_matches: 144,
        total_goal_contributions: 67,
      },
      {
        slug: "lucao",
        legacy_matches: 266,
        legacy_goals: 200,
        legacy_assists: 124,
        legacy_goal_contributions: 324,
        legacy_clean_sheets: null,
        system_matches: 0,
        total_matches: 266,
        total_goal_contributions: 324,
      },
    ]);

    // O seed não cria noites, partidas nem participações.
    expect(await count("nights")).toBe(0);
    expect(await count("matches")).toBe(0);
    expect(await count("match_players")).toBe(0);
  });

  it("cadastra os apelidos da lore com o tom correto", async () => {
    await seed(db);

    const nicknames = await sql`
      select p.slug, n.tone, n.label
      from nicknames n join players p on p.id = n.player_id
      order by p.slug, n.tone`;
    expect(nicknames.map((row) => [row.slug, row.tone, row.label])).toEqual([
      ["ericky", "good", "OLISO"],
      ["ericky", "bad", "EL GARRÓ"],
      ["felp", "good", "CRAQUE"],
      ["felp", "bad", "PONTINHA BURRO"],
      ["heit", "good", "MANOEL HEIT"],
      ["heit", "bad", "MURALHA"],
      ["lucao", "good", "LUVERTZ"],
      ["lucao", "bad", "THACIANO"],
    ]);
  });

  it("é idempotente: executar de novo não insere nem duplica nada", async () => {
    await seed(db);

    expect(await seed(db)).toEqual({
      seasons: 0,
      players: 0,
      legacyStats: 0,
      nicknames: 0,
    });
    expect(await count("seasons")).toBe(1);
    expect(await count("players")).toBe(4);
    expect(await count("legacy_stats")).toBe(4);
    expect(await count("nicknames")).toBe(8);
  });

  it("nunca sobrescreve legacy_stats nem dados de jogador já existentes", async () => {
    await seed(db);
    await sql`
      update legacy_stats set matches = 210, goals = 140
      where player_id = (select id from players where slug = 'ericky')`;
    await sql`update players set default_position = 'MC' where slug = 'ericky'`;

    await seed(db);

    const [legacy] = await sql`
      select l.matches, l.goals, l.assists
      from legacy_stats l join players p on p.id = l.player_id
      where p.slug = 'ericky'`;
    expect(legacy).toEqual({ matches: 210, goals: 140, assists: 138 });

    const [player] = await sql`
      select default_position from players where slug = 'ericky'`;
    expect(player.default_position).toBe("MC");
  });

  it("completa apenas o que falta quando parte dos dados foi removida", async () => {
    await seed(db);
    await sql`delete from nicknames where label = 'OLISO'`;
    await sql`
      delete from legacy_stats
      where player_id = (select id from players where slug = 'heit')`;

    expect(await seed(db)).toEqual({
      seasons: 0,
      players: 0,
      legacyStats: 1,
      nicknames: 1,
    });
    expect(await count("legacy_stats")).toBe(4);
    expect(await count("nicknames")).toBe(8);
  });
});
