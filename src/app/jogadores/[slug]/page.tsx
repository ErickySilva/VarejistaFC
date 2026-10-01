import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { MatchRow } from "@/components/matches/match-row";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { buildEvolution } from "@/domain/evolution";
import { AWARD_LABEL, AWARD_TYPES } from "@/domain/night";
import { POSITION_LABEL } from "@/domain/positions";
import { formatReferenceDate } from "@/domain/reference-date";
import { formatAverage, formatRating, plural, UNAVAILABLE } from "@/lib/format";
import { listPlayerMatches } from "@/server/matches/queries";
import { getPlayerProfile } from "@/server/players/queries";
import {
  getAwardCounts,
  getNightTotals,
  getPlayerSeasonHistory,
} from "@/server/stats/history";
import { resolvePeriod } from "@/server/stats/period";
import { getPlayerStats } from "@/server/stats/queries";

type Props = PageProps<"/jogadores/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerProfile(slug);
  return { title: player ? player.name : "Jogador" };
}

const cell = "px-2 py-2 text-right tabular-nums";
const head = "px-2 py-2 text-right font-medium";

function shortDate(referenceDate: string): string {
  return formatReferenceDate(referenceDate).slice(0, 5);
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { periodo } = await searchParams;

  const player = await getPlayerProfile(slug);
  if (!player) notFound();

  const selection = await resolvePeriod(
    typeof periodo === "string" ? periodo : undefined,
  );
  const [mainStats, rushStats, awards, recent, seasons, nights] =
    await Promise.all([
      getPlayerStats(selection.period, "main"),
      getPlayerStats(selection.period, "rush"),
      getAwardCounts(player.id, selection.period),
      listPlayerMatches(player.id, 5),
      getPlayerSeasonHistory(player.id),
      getNightTotals(selection.period),
    ]);

  const stats = mainStats.find((row) => row.playerId === player.id)!;
  const rush = rushStats.find((row) => row.playerId === player.id)!;
  const goalkeeper = stats.goalkeeper;
  const hasGoalkeeperSection =
    goalkeeper.matches > 0 || goalkeeper.legacyCleanSheets !== null;

  const evolution = buildEvolution(
    player.id,
    mainStats.map((row) => ({
      playerId: row.playerId,
      shirtNumber: row.shirtNumber,
      legacyGoals: row.legacyGoals,
      legacyAssists: row.legacyAssists,
    })),
    nights,
  );
  const series = (
    value: (point: (typeof evolution)[number]) => number | null,
    display: (value: number) => string,
  ): TrendPoint[] =>
    evolution.map((point) => {
      const current = value(point);
      return {
        label: shortDate(point.referenceDate),
        value: current,
        display: current === null ? "não jogou" : display(current),
      };
    });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center gap-4">
        <PlayerAvatar
          name={player.name}
          shirtNumber={player.shirtNumber}
          photoUrl={player.photoUrl}
          size="lg"
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {player.name}
          </h1>
          <p className="text-sm">
            #{player.shirtNumber} · {POSITION_LABEL[player.defaultPosition]}
            {!player.isActive && " · inativo"}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 text-sm">
            {player.goodNicknames.length > 0 && (
              <>
                <dt className="opacity-70">Apelido bom</dt>
                <dd>{player.goodNicknames.join(", ")}</dd>
              </>
            )}
            {player.badNicknames.length > 0 && (
              <>
                <dt className="opacity-70">Apelido ruim</dt>
                <dd>{player.badNicknames.join(", ")}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      <PeriodSwitcher
        selection={selection}
        basePath={`/jogadores/${player.slug}`}
      />

      <section>
        <h2 className="mb-2 font-semibold">Números · {selection.label}</h2>
        <StatGrid>
          <StatTile label="Jogos" value={stats.matches} />
          <StatTile label="Gols" value={stats.goals} />
          <StatTile label="Assistências" value={stats.assists} />
          <StatTile label="G/A" value={stats.goalContributions} />
          <StatTile
            label="Média VFC"
            value={
              stats.averageRating === null
                ? "indisponível"
                : formatRating(stats.averageRating, 2)
            }
          />
          <StatTile label="Partidas avaliadas" value={stats.ratedMatches} />
        </StatGrid>
        {stats.legacyMatches > 0 && (
          <p className="mt-2 text-xs opacity-70">
            Inclui {plural(stats.legacyMatches, "jogo", "jogos")} do histórico
            anterior ao sistema, que não têm Nota VFC. A média considera só as
            partidas avaliadas.
          </p>
        )}
        {stats.averageFifaRating !== null && (
          <p className="mt-1 text-xs opacity-70">
            Média da Nota FIFA: {formatRating(stats.averageFifaRating, 2)} em{" "}
            {plural(stats.fifaRatedMatches, "partida", "partidas")} com a nota
            informada.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Conquistas · {selection.label}</h2>
        <StatGrid>
          {AWARD_TYPES.map((award) => (
            <StatTile
              key={award}
              label={AWARD_LABEL[award]}
              value={awards[award]}
            />
          ))}
        </StatGrid>
      </section>

      {hasGoalkeeperSection && (
        <section>
          <h2 className="mb-2 font-semibold">
            Como goleiro · {selection.label}
          </h2>
          <StatGrid>
            <StatTile label="Partidas no gol" value={goalkeeper.matches} />
            <StatTile label="Defesas" value={goalkeeper.saves} />
            <StatTile
              label="Defesas por partida"
              value={formatAverage(goalkeeper.savesPerMatch)}
            />
            <StatTile
              label="Defesas de pênalti"
              value={goalkeeper.penaltiesSaved}
            />
            <StatTile label="Clean sheets" value={goalkeeper.cleanSheets} />
            <StatTile label="Gols sofridos" value={goalkeeper.goalsConceded} />
            <StatTile
              label="Média VFC no gol"
              value={formatAverage(goalkeeper.averageRating)}
            />
          </StatGrid>
          {goalkeeper.legacyCleanSheets !== null && (
            <p className="mt-2 text-xs opacity-70">
              Clean sheets: {goalkeeper.systemCleanSheets} no sistema e{" "}
              {goalkeeper.legacyCleanSheets} do histórico. Os demais números de
              goleiro existem só a partir do sistema.
            </p>
          )}
        </section>
      )}

      {rush.matches > 0 && (
        <section>
          <h2 className="mb-1 font-semibold">
            Torneio de Rush · {selection.label}
          </h2>
          <p className="mb-2 text-xs opacity-70">
            Fica fora das estatísticas principais.
          </p>
          <StatGrid>
            <StatTile label="Jogos" value={rush.matches} />
            <StatTile label="Gols" value={rush.goals} />
            <StatTile label="Assistências" value={rush.assists} />
            <StatTile label="G/A" value={rush.goalContributions} />
            <StatTile
              label="Média VFC"
              value={formatAverage(rush.averageRating)}
            />
          </StatGrid>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Partidas recentes</h2>
        {recent.length === 0 ? (
          <p className="text-sm opacity-70">
            Nenhuma partida registrada no sistema ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                detail={
                  <span className="tabular-nums opacity-80">
                    {match.position} · {match.goals}G {match.assists}A
                    {match.saves !== null && ` · ${match.saves} def`} · VFC{" "}
                    {formatRating(match.rating)}
                    {match.fifaRating !== null &&
                      ` · FIFA ${formatRating(match.fifaRating)}`}
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Histórico por temporada</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-foreground/15 border-b">
                <th className="px-2 py-2 text-left font-medium">Temporada</th>
                <th className={head}>J</th>
                <th className={head}>G</th>
                <th className={head}>A</th>
                <th className={head}>G/A</th>
                <th className={head}>VFC</th>
                <th className={head}>Aval.</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(({ season, main }) => (
                <tr key={season.id} className="border-foreground/10 border-b">
                  <td className="px-2 py-2">
                    {season.name}
                    {season.isActive && (
                      <span className="opacity-70"> (atual)</span>
                    )}
                  </td>
                  <td className={cell}>{main.matches}</td>
                  <td className={cell}>{main.goals}</td>
                  <td className={cell}>{main.assists}</td>
                  <td className={cell}>{main.goalContributions}</td>
                  <td className={cell}>{formatAverage(main.averageRating)}</td>
                  <td className={cell}>{main.ratedMatches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs opacity-70">
          VFC: média da Nota VFC · Aval.: partidas avaliadas · {UNAVAILABLE}:
          sem partida avaliada na temporada.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Evolução · {selection.label}</h2>
        {evolution.length === 0 ? (
          <p className="text-sm opacity-70">
            A evolução aparece depois da primeira gameplay registrada neste
            período.
          </p>
        ) : (
          <>
            <TrendChart
              title="G/A acumulado"
              integers
              points={series(
                (point) => point.cumulativeGoalContributions,
                String,
              )}
            />
            <TrendChart
              title="Média VFC por gameplay"
              points={series(
                (point) => point.nightAverageRating,
                (value) => formatRating(value, 2),
              )}
            />
            <TrendChart
              title="Posição no ranking geral"
              integers
              invert
              points={series(
                (point) => point.rank,
                (value) => `${value}º`,
              )}
            />
          </>
        )}
      </section>
    </main>
  );
}
