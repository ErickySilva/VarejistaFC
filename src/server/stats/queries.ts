import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { StatsScope } from "@/domain/match-type";
import type { Position } from "@/domain/positions";

// Estatísticas por jogador em um período e um recorte (ADR 0013). Tudo aqui é
// leitura pública e derivado das participações; nada é contador armazenado.

// "Desde a criação do clube" ou uma temporada específica.
export type StatsPeriod =
  { kind: "club" } | { kind: "season"; seasonId: number };

export interface GoalkeeperStats {
  // Partidas como goleiro registradas no sistema.
  matches: number;
  saves: number;
  savesPerMatch: number | null;
  penaltiesSaved: number;
  goalsConceded: number;
  // Jogos sem sofrer gol: os do sistema e os do histórico, separados.
  systemCleanSheets: number;
  // null = histórico sem essa anotação.
  legacyCleanSheets: number | null;
  cleanSheets: number;
  // Média da Nota VFC só nas partidas como goleiro; null se não jogou no gol.
  averageRating: number | null;
}

export interface PlayerStats {
  playerId: number;
  slug: string;
  name: string;
  shirtNumber: number;
  defaultPosition: Position;
  photoUrl: string | null;
  isActive: boolean;
  // Histórico pré-sistema + partidas registradas. O histórico só existe no
  // recorte principal; no Rush estes números são só do sistema.
  matches: number;
  goals: number;
  assists: number;
  goalContributions: number;
  systemMatches: number;
  legacyMatches: number;
  // Resultados das partidas do sistema.
  wins: number;
  draws: number;
  losses: number;
  // Partidas com Nota VFC: só as registradas no sistema têm avaliação.
  ratedMatches: number;
  // null quando não há partida avaliada: o histórico não tem Nota VFC.
  averageRating: number | null;
  fifaRatedMatches: number;
  averageFifaRating: number | null;
  goalkeeper: GoalkeeperStats;
}

function average(sum: number, count: number): number | null {
  return count === 0 ? null : Math.round((sum / count) * 100) / 100;
}

type Row = Record<string, string | number | boolean | null>;

export async function getPlayerStats(
  period: StatsPeriod,
  scope: StatsScope,
): Promise<PlayerStats[]> {
  const seasonId = period.kind === "season" ? period.seasonId : null;

  const rows = await getDb().execute<Row>(sql`
    select
      p.id, p.slug, p.name, p.shirt_number, p.default_position, p.photo_url,
      p.is_active,
      coalesce(s.matches, 0) as system_matches,
      coalesce(s.goals, 0) as system_goals,
      coalesce(s.assists, 0) as system_assists,
      coalesce(s.wins, 0) as wins,
      coalesce(s.draws, 0) as draws,
      coalesce(s.losses, 0) as losses,
      coalesce(s.rating_sum, 0) as rating_sum,
      coalesce(s.fifa_rated_matches, 0) as fifa_rated_matches,
      coalesce(s.fifa_rating_sum, 0) as fifa_rating_sum,
      coalesce(s.goalkeeper_matches, 0) as goalkeeper_matches,
      coalesce(s.saves, 0) as saves,
      coalesce(s.penalties_saved, 0) as penalties_saved,
      coalesce(s.goals_conceded, 0) as goals_conceded,
      coalesce(s.clean_sheets, 0) as clean_sheets,
      coalesce(s.goalkeeper_rating_sum, 0) as goalkeeper_rating_sum,
      coalesce(l.matches, 0) as legacy_matches,
      coalesce(l.goals, 0) as legacy_goals,
      coalesce(l.assists, 0) as legacy_assists,
      l.clean_sheets as legacy_clean_sheets
    from players p
    left join (
      select
        player_id,
        sum(matches)::int as matches,
        sum(goals)::int as goals,
        sum(assists)::int as assists,
        sum(wins)::int as wins,
        sum(draws)::int as draws,
        sum(losses)::int as losses,
        sum(rating_sum) as rating_sum,
        sum(fifa_rated_matches)::int as fifa_rated_matches,
        sum(fifa_rating_sum) as fifa_rating_sum,
        sum(goalkeeper_matches)::int as goalkeeper_matches,
        sum(saves)::int as saves,
        sum(penalties_saved)::int as penalties_saved,
        sum(goals_conceded)::int as goals_conceded,
        sum(clean_sheets)::int as clean_sheets,
        sum(goalkeeper_rating_sum) as goalkeeper_rating_sum
      from v_player_period_totals
      where stats_scope = ${scope}
        and (${seasonId}::int is null or season_id = ${seasonId}::int)
      group by player_id
    ) s on s.player_id = p.id
    left join (
      select
        player_id,
        sum(matches)::int as matches,
        sum(goals)::int as goals,
        sum(assists)::int as assists,
        sum(clean_sheets)::int as clean_sheets
      from legacy_stats
      where ${scope} = 'main'
        and (${seasonId}::int is null or season_id = ${seasonId}::int)
      group by player_id
    ) l on l.player_id = p.id
    order by p.shirt_number`);

  return [...rows].map((row) => {
    const number = (key: string) => Number(row[key]);
    const systemMatches = number("system_matches");
    const legacyMatches = number("legacy_matches");
    const goals = number("system_goals") + number("legacy_goals");
    const assists = number("system_assists") + number("legacy_assists");
    const goalkeeperMatches = number("goalkeeper_matches");
    const legacyCleanSheets =
      row.legacy_clean_sheets === null ? null : number("legacy_clean_sheets");

    return {
      playerId: number("id"),
      slug: String(row.slug),
      name: String(row.name),
      shirtNumber: number("shirt_number"),
      defaultPosition: row.default_position as Position,
      photoUrl: row.photo_url === null ? null : String(row.photo_url),
      isActive: Boolean(row.is_active),
      matches: systemMatches + legacyMatches,
      goals,
      assists,
      goalContributions: goals + assists,
      systemMatches,
      legacyMatches,
      wins: number("wins"),
      draws: number("draws"),
      losses: number("losses"),
      ratedMatches: systemMatches,
      averageRating: average(number("rating_sum"), systemMatches),
      fifaRatedMatches: number("fifa_rated_matches"),
      averageFifaRating: average(
        number("fifa_rating_sum"),
        number("fifa_rated_matches"),
      ),
      goalkeeper: {
        matches: goalkeeperMatches,
        saves: number("saves"),
        savesPerMatch: average(number("saves"), goalkeeperMatches),
        penaltiesSaved: number("penalties_saved"),
        goalsConceded: number("goals_conceded"),
        systemCleanSheets: number("clean_sheets"),
        legacyCleanSheets,
        cleanSheets: number("clean_sheets") + (legacyCleanSheets ?? 0),
        averageRating: average(
          number("goalkeeper_rating_sum"),
          goalkeeperMatches,
        ),
      },
    };
  });
}
