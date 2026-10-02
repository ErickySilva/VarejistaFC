import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrendChart, type TrendPoint } from "@/components/charts/trend-chart";
import { MatchRow, MatchRows } from "@/components/matches/match-row";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/ui/count-up";
import { EmptyState, Page, Section, Surface } from "@/components/ui/layout";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Stat, StatGrid, StatGroup } from "@/components/ui/stat";
import { Table, Td, Th, Tr } from "@/components/ui/table";
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

const MAX_RATING = 10;

function shortDate(referenceDate: string): string {
  return formatReferenceDate(referenceDate).slice(0, 5);
}

function Nicknames({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="font-bold">{names.join(", ")}</dd>
    </div>
  );
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
    <Page width="wide">
      <div className="grid gap-8 lg:grid-cols-[4fr_8fr] lg:items-start lg:gap-10">
        {/*
          Página de atleta: o número da camisa gigante ao fundo, o retrato por
          cima (ele chega viajando da tela anterior) e o nome em seguida.
        */}
        <header className="relative flex flex-col items-center text-center lg:sticky lg:top-20">
          <span
            aria-hidden="true"
            className="numeral text-surface animate-fade text-[11rem] leading-[0.8] select-none sm:text-[13rem]"
          >
            {player.shirtNumber}
          </span>
          <PlayerAvatar
            name={player.name}
            shirtNumber={player.shirtNumber}
            photoUrl={player.photoUrl}
            size="hero"
            ring="crest"
            priority
            sharedAs={player.slug}
            className="relative -mt-20 h-72! sm:-mt-24"
          />
          <h1
            className="display animate-rise stagger mt-4 text-6xl"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            {player.name}
          </h1>
          <p
            className="text-soft animate-rise stagger mt-2 flex flex-wrap items-center justify-center gap-2 text-sm"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <span>
              Camisa <span className="font-bold">{player.shirtNumber}</span>
            </span>
            <Badge tone="outline">
              {POSITION_LABEL[player.defaultPosition]}
            </Badge>
            {!player.isActive && <Badge>Inativo</Badge>}
          </p>
          {(player.goodNicknames.length > 0 ||
            player.badNicknames.length > 0) && (
            <dl
              className="border-line/50 animate-fade stagger mt-5 grid w-full grid-cols-2 gap-3 border-y py-3 text-sm"
              style={{ "--i": 5 } as React.CSSProperties}
            >
              <Nicknames label="Apelido bom" names={player.goodNicknames} />
              <Nicknames label="Apelido ruim" names={player.badNicknames} />
            </dl>
          )}
        </header>

        <div className="flex min-w-0 flex-col gap-8">
          <PeriodSwitcher
            selection={selection}
            basePath={`/jogadores/${player.slug}`}
          />

          <Section title="Números" aside={selection.label}>
            <StatGroup key={selection.param}>
              <Stat
                label="Jogos"
                size="lg"
                order={3}
                value={<CountUp value={stats.matches} />}
              />
              <Stat
                label="Gols"
                size="lg"
                order={4}
                value={<CountUp value={stats.goals} />}
              />
              <Stat
                label="Assist."
                size="lg"
                order={5}
                value={<CountUp value={stats.assists} />}
              />
              <Stat
                label="G/A"
                size="lg"
                order={6}
                accent
                value={<CountUp value={stats.goalContributions} />}
              />
            </StatGroup>

            <Surface className="flex flex-col gap-3 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-muted text-xs">Média da Nota VFC</p>
                  <p className="numeral mt-1 text-4xl">
                    {stats.averageRating === null
                      ? UNAVAILABLE
                      : formatRating(stats.averageRating, 2)}
                  </p>
                </div>
                <p className="text-soft text-right text-sm">
                  {stats.ratedMatches === 0
                    ? "Sem partida avaliada"
                    : plural(
                        stats.ratedMatches,
                        "partida avaliada",
                        "partidas avaliadas",
                      )}
                </p>
              </div>
              {stats.averageRating !== null && (
                <div
                  aria-hidden="true"
                  className="bg-line/40 h-1.5 overflow-hidden rounded-full"
                >
                  <div
                    key={selection.param}
                    className="bg-accent animate-grow h-full origin-left rounded-full"
                    style={{
                      width: `${(stats.averageRating / MAX_RATING) * 100}%`,
                    }}
                  />
                </div>
              )}
              {stats.averageFifaRating !== null && (
                <p className="text-muted text-xs">
                  Média da Nota FIFA:{" "}
                  <span className="text-soft font-semibold">
                    {formatRating(stats.averageFifaRating, 2)}
                  </span>{" "}
                  em {plural(stats.fifaRatedMatches, "partida", "partidas")} com
                  a nota informada.
                </p>
              )}
            </Surface>
            {stats.legacyMatches > 0 && (
              <p className="text-muted text-xs">
                Inclui {plural(stats.legacyMatches, "jogo", "jogos")} do
                histórico anterior ao sistema, que não têm Nota VFC. A média
                considera só as partidas avaliadas.
              </p>
            )}
          </Section>

          <Section title="Conquistas" aside={selection.label}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
              {AWARD_TYPES.map((award) => (
                <Stat
                  key={award}
                  label={AWARD_LABEL[award]}
                  value={awards[award]}
                  accent={awards[award] > 0}
                  className={
                    awards[award] === 0 ? "opacity-50" : "animate-stamp"
                  }
                />
              ))}
            </dl>
          </Section>

          {hasGoalkeeperSection && (
            <Section title="Como goleiro" aside={selection.label}>
              <StatGrid>
                <Stat label="Partidas no gol" value={goalkeeper.matches} />
                <Stat label="Defesas" value={goalkeeper.saves} />
                <Stat
                  label="Defesas por partida"
                  value={formatAverage(goalkeeper.savesPerMatch)}
                />
                <Stat
                  label="Defesas de pênalti"
                  value={goalkeeper.penaltiesSaved}
                />
                <Stat
                  label="Jogos sem sofrer gol"
                  value={goalkeeper.cleanSheets}
                />
                <Stat label="Gols sofridos" value={goalkeeper.goalsConceded} />
                <Stat
                  label="Média VFC no gol"
                  value={formatAverage(goalkeeper.averageRating)}
                />
              </StatGrid>
              {goalkeeper.legacyCleanSheets !== null && (
                <p className="text-muted text-xs">
                  Jogos sem sofrer gol: {goalkeeper.systemCleanSheets} no
                  sistema e {goalkeeper.legacyCleanSheets} do histórico. Os
                  demais números de goleiro existem só a partir do sistema.
                </p>
              )}
            </Section>
          )}

          {rush.matches > 0 && (
            <Section title="Torneio de Rush" aside={selection.label}>
              <StatGroup>
                <Stat label="Jogos" size="sm" value={rush.matches} />
                <Stat label="Gols" size="sm" value={rush.goals} />
                <Stat label="Assist." size="sm" value={rush.assists} />
                <Stat label="G/A" size="sm" value={rush.goalContributions} />
                <Stat
                  label="VFC"
                  size="sm"
                  value={formatAverage(rush.averageRating)}
                />
              </StatGroup>
              <p className="text-muted text-xs">
                Fica fora das estatísticas principais.
              </p>
            </Section>
          )}

          <Section title="Partidas recentes">
            {recent.length === 0 ? (
              <EmptyState title="Nenhuma partida registrada no sistema ainda" />
            ) : (
              <MatchRows>
                {recent.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    detail={
                      <span className="text-soft flex flex-wrap gap-x-3 tabular-nums">
                        <span>{match.position}</span>
                        <span>
                          {match.goals}G {match.assists}A
                        </span>
                        {match.saves !== null && <span>{match.saves} def</span>}
                        <span>
                          VFC{" "}
                          <strong className="text-fg">
                            {formatRating(match.rating)}
                          </strong>
                        </span>
                        {match.fifaRating !== null && (
                          <span>FIFA {formatRating(match.fifaRating)}</span>
                        )}
                      </span>
                    }
                  />
                ))}
              </MatchRows>
            )}
          </Section>

          <Section title="Histórico por temporada">
            <Table caption={`Histórico de ${player.name} por temporada`}>
              <thead>
                <tr>
                  <Th align="left">Temporada</Th>
                  <Th title="Jogos">J</Th>
                  <Th title="Gols">G</Th>
                  <Th title="Assistências">A</Th>
                  <Th>G/A</Th>
                  <Th title="Média da Nota VFC">VFC</Th>
                  <Th title="Partidas avaliadas">Aval.</Th>
                </tr>
              </thead>
              <tbody>
                {seasons.map(({ season, main }) => (
                  <Tr key={season.id}>
                    <Td align="left">
                      <span className="font-medium">{season.name}</span>
                      {season.isActive && (
                        <span className="text-muted"> atual</span>
                      )}
                    </Td>
                    <Td>{main.matches}</Td>
                    <Td>{main.goals}</Td>
                    <Td>{main.assists}</Td>
                    <Td strong>{main.goalContributions}</Td>
                    <Td strong>{formatAverage(main.averageRating)}</Td>
                    <Td>{main.ratedMatches}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <p className="text-muted text-xs">
              {UNAVAILABLE} na média: sem partida avaliada na temporada.
            </p>
          </Section>

          <Section title="Evolução" aside={selection.label}>
            {evolution.length === 0 ? (
              <EmptyState title="Ainda sem evolução para mostrar">
                Aparece depois da primeira gameplay registrada neste período.
              </EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2" key={selection.param}>
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
              </div>
            )}
          </Section>
        </div>
      </div>
    </Page>
  );
}
