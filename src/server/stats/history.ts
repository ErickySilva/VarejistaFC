import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { NightTotals } from "@/domain/evolution";
import type { StatsScope } from "@/domain/match-type";
import { AWARD_TYPES, type AwardType } from "@/domain/night";
import { listSeasons, type Season } from "../seasons/service";
import { getPlayerStats, type PlayerStats, type StatsPeriod } from "./queries";

// Leituras públicas usadas por perfil, ranking e Home: campanha do time,
// totais por gameplay, conquistas e histórico por temporada.

type Row = Record<string, string | number | boolean | null>;

function seasonIdOf(period: StatsPeriod): number | null {
  return period.kind === "season" ? period.seasonId : null;
}

export interface TeamRecord {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

// Campanha do time nas partidas registradas no sistema.
export async function getTeamRecord(
  period: StatsPeriod,
  scope: StatsScope,
): Promise<TeamRecord> {
  const seasonId = seasonIdOf(period);
  const [row] = await getDb().execute<Row>(sql`
    select
      count(*)::int as matches,
      count(*) filter (where m.result = 'W')::int as wins,
      count(*) filter (where m.result = 'D')::int as draws,
      count(*) filter (where m.result = 'L')::int as losses,
      coalesce(sum(m.goals_for), 0)::int as goals_for,
      coalesce(sum(m.goals_against), 0)::int as goals_against
    from matches m
    join nights n on n.id = m.night_id
    where m.deleted_at is null
      and (case when m.match_type = 'rush' then 'rush' else 'main' end) = ${scope}
      and (${seasonId}::int is null or n.season_id = ${seasonId}::int)`);

  return {
    matches: Number(row.matches),
    wins: Number(row.wins),
    draws: Number(row.draws),
    losses: Number(row.losses),
    goalsFor: Number(row.goals_for),
    goalsAgainst: Number(row.goals_against),
  };
}

// Totais de cada jogador em cada gameplay do período, nas partidas
// principais, da mais antiga para a mais recente. Entrada da evolução.
export async function getNightTotals(
  period: StatsPeriod,
): Promise<NightTotals[]> {
  const seasonId = seasonIdOf(period);
  const rows = await getDb().execute<Row>(sql`
    select
      pm.night_id,
      pm.reference_date::text as reference_date,
      pm.player_id,
      count(*)::int as matches,
      sum(pm.goals)::int as goals,
      sum(pm.assists)::int as assists,
      (sum(pm.rating) * 10)::int as rating_tenths
    from v_player_match pm
    where pm.stats_scope = 'main'
      and (${seasonId}::int is null or pm.season_id = ${seasonId}::int)
    group by pm.night_id, pm.reference_date, pm.player_id
    order by pm.reference_date, pm.night_id, pm.player_id`);

  const nights = new Map<number, NightTotals>();
  for (const row of rows) {
    const nightId = Number(row.night_id);
    let night = nights.get(nightId);
    if (!night) {
      night = {
        nightId,
        referenceDate: String(row.reference_date),
        players: [],
      };
      nights.set(nightId, night);
    }
    night.players.push({
      playerId: Number(row.player_id),
      matches: Number(row.matches),
      goals: Number(row.goals),
      assists: Number(row.assists),
      ratingTenths: Number(row.rating_tenths),
    });
  }
  return [...nights.values()];
}

export type AwardCounts = Record<AwardType, number>;

// Conquistas: quantas vezes o jogador ganhou cada prêmio no período.
export async function getAwardCounts(
  playerId: number,
  period: StatsPeriod,
): Promise<AwardCounts> {
  const seasonId = seasonIdOf(period);
  const rows = await getDb().execute<Row>(sql`
    select a.award::text as award, count(*)::int as total
    from night_awards a
    join nights n on n.id = a.night_id
    where a.player_id = ${playerId}
      and n.status = 'closed'
      and (${seasonId}::int is null or n.season_id = ${seasonId}::int)
    group by a.award`);

  const counts = Object.fromEntries(
    AWARD_TYPES.map((award) => [award, 0]),
  ) as AwardCounts;
  for (const row of rows) {
    counts[row.award as AwardType] = Number(row.total);
  }
  return counts;
}

export interface SeasonStats {
  season: Season;
  main: PlayerStats;
  rush: PlayerStats;
}

// Histórico por temporada de um jogador, da mais recente para a mais antiga.
export async function getPlayerSeasonHistory(
  playerId: number,
): Promise<SeasonStats[]> {
  const seasons = await listSeasons();
  const history: SeasonStats[] = [];

  for (const season of seasons) {
    const period: StatsPeriod = { kind: "season", seasonId: season.id };
    const [main, rush] = await Promise.all([
      getPlayerStats(period, "main"),
      getPlayerStats(period, "rush"),
    ]);
    const mine = main.find((row) => row.playerId === playerId);
    const mineRush = rush.find((row) => row.playerId === playerId);
    if (mine && mineRush) history.push({ season, main: mine, rush: mineRush });
  }
  return history;
}
