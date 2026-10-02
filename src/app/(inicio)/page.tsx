import { CloseGameplayButton } from "@/components/gameplay/close-gameplay-button";
import { LivePanel } from "@/components/gameplay/live-panel";
import { LiveRefresh } from "@/components/gameplay/live-refresh";
import {
  AwardList,
  nightPlayerIds,
  playerLookup,
} from "@/components/gameplay/night-view";
import { MatchRow, MatchRows } from "@/components/matches/match-row";
import {
  Leaderboard,
  type LeaderboardEntry,
} from "@/components/ranking/leaderboard";
import { Lineup } from "@/components/squad/lineup";
import { ResultMark } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { EmptyState, Page, Section } from "@/components/ui/layout";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { RecordBar } from "@/components/ui/record-bar";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { summarizeNight } from "@/domain/night";
import { rankPlayers } from "@/domain/ranking";
import { formatReferenceDate } from "@/domain/reference-date";
import { formatAverage } from "@/lib/format";
import { can } from "@/server/auth/policy";
import { getActor } from "@/server/auth/session";
import { listMatches } from "@/server/matches/queries";
import {
  getLatestClosedNight,
  getNightAwards,
  getOpenNight,
  toDomainNight,
  type NightDetail,
} from "@/server/nights/queries";
import { getPlayerPhotos, type PlayerLink } from "@/server/players/directory";
import { getTeamRecord } from "@/server/stats/history";
import { CLUB_PERIOD_PARAM, resolvePeriod } from "@/server/stats/period";
import { getPlayerStats, type PlayerStats } from "@/server/stats/queries";

// A sessão em andamento, no topo da tela: o painel ao vivo e as parciais dos
// prêmios. Todos acompanham; só administradores operam.
function OpenSession({
  night,
  photos,
  isAdmin,
}: {
  night: NightDetail;
  photos: Map<number, PlayerLink>;
  isAdmin: boolean;
}) {
  const summary = summarizeNight(toDomainNight(night));
  const lookup = playerLookup(night, photos);

  return (
    <>
      <LivePanel night={night} summary={summary} lookup={lookup}>
        {isAdmin && (
          <div className="grid gap-2 sm:grid-cols-2">
            <ButtonLink
              href="/gameplay/partida/nova"
              variant="primary"
              size="lg"
            >
              <PlusIcon />
              Registrar partida
            </ButtonLink>
            {night.matches.length > 0 ? (
              <CloseGameplayButton />
            ) : (
              <ButtonLink href="/gameplay" size="lg">
                Abrir o painel
              </ButtonLink>
            )}
          </div>
        )}
      </LivePanel>

      {summary.awards.length > 0 && (
        <Section title="Parciais dos prêmios" aside="até agora">
          <AwardList
            awards={summary.awards.map((award) => ({
              award: award.award,
              value: award.value,
              playerName: lookup(award.playerId).name,
              shirtNumber: lookup(award.playerId).shirtNumber,
              photoUrl: lookup(award.playerId).photoUrl,
              slug: lookup(award.playerId).slug,
            }))}
          />
        </Section>
      )}
    </>
  );
}

function toEntries(
  ranking: PlayerStats[],
  periodQuery: string,
): LeaderboardEntry[] {
  return ranking.map((player) => ({
    id: player.playerId,
    slug: player.slug,
    href: `/jogadores/${player.slug}?${periodQuery}`,
    name: player.name,
    shirtNumber: player.shirtNumber,
    photoUrl: player.photoUrl,
    value: String(player.goalContributions),
    details: [
      { label: "J", title: "Jogos", value: player.matches },
      { label: "G", title: "Gols", value: player.goals },
      { label: "A", title: "Assistências", value: player.assists },
      {
        label: "VFC",
        title: "Média da Nota VFC",
        value: formatAverage(player.averageRating),
      },
    ],
  }));
}

export default async function Home() {
  const actor = await getActor();
  const isAdmin = can(actor, { action: "stats.manage" });
  const selection = await resolvePeriod(undefined);

  const [openNight, stats, rushStats, record, recentMatches, latestClosed] =
    await Promise.all([
      getOpenNight(),
      getPlayerStats(selection.period, "main"),
      getPlayerStats(selection.period, "rush"),
      getTeamRecord(selection.period, "main"),
      listMatches({ limit: 5 }),
      getLatestClosedNight(),
    ]);
  const [latestAwards, openPhotos] = await Promise.all([
    latestClosed ? getNightAwards(latestClosed.id) : [],
    openNight
      ? getPlayerPhotos(nightPlayerIds(openNight))
      : new Map<number, PlayerLink>(),
  ]);
  const awardPhotos = await getPlayerPhotos(
    latestAwards.map((award) => award.playerId),
  );

  const ranking = rankPlayers(
    stats.filter((player) => player.isActive || player.matches > 0),
    "geral",
  );
  const rushRanking = rankPlayers(
    rushStats.filter((player) => player.matches > 0),
    "geral",
  );
  // A escalação segue o número da camisa, não o ranking.
  const squad = stats
    .filter((player) => player.isActive)
    .sort((a, b) => a.shirtNumber - b.shirtNumber);
  const periodQuery = `periodo=${selection.param}`;

  return (
    <Page width="wide">
      <LiveRefresh renderId={crypto.randomUUID()} />

      {openNight && (
        <OpenSession night={openNight} photos={openPhotos} isAdmin={isAdmin} />
      )}

      <header className="grid gap-6 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-10">
        <div className="flex flex-col gap-5">
          <h1 className="display animate-rise text-4xl sm:text-5xl">
            {selection.season
              ? `Temporada ${selection.season.name}`
              : "Varejista FC"}
          </h1>
          <Lineup players={squad} query={periodQuery} />
        </div>

        {record.matches === 0 ? (
          <EmptyState
            title="A temporada ainda não começou"
            action={
              isAdmin &&
              !openNight && (
                <ButtonLink href="/gameplay" variant="primary">
                  Ir para a gameplay
                </ButtonLink>
              )
            }
          >
            Nenhuma partida principal registrada neste período.
          </EmptyState>
        ) : (
          <div
            className="animate-rise stagger flex flex-col gap-3"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-soft text-sm">
                <span className="numeral text-fg mr-1.5 text-3xl">
                  {record.matches}
                </span>
                {record.matches === 1 ? "partida" : "partidas"} no sistema
              </span>
              <span className="text-soft text-sm">
                gols
                <span className="numeral text-fg ml-1.5 text-3xl">
                  {record.goalsFor}
                  <span className="text-muted font-medium">:</span>
                  {record.goalsAgainst}
                </span>
              </span>
            </p>
            <RecordBar
              wins={record.wins}
              draws={record.draws}
              losses={record.losses}
            />
          </div>
        )}
      </header>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-10">
        <div className="flex min-w-0 flex-col gap-10">
          <Section
            title="Ranking"
            aside={selection.label}
            more={{ href: `/ranking?${periodQuery}`, label: "Completo" }}
          >
            {/* Os retratos da escalação, acima, é que viajam até o perfil. */}
            <Leaderboard
              entries={toEntries(ranking, periodQuery)}
              metric="G/A"
              sharePortraits={false}
            />
            <ButtonLink
              href={`/ranking?periodo=${CLUB_PERIOD_PARAM}`}
              variant="ghost"
              className="-ml-3 self-start"
            >
              Ver desde a criação do Clube
            </ButtonLink>
          </Section>

          {rushRanking.length > 0 && (
            <Section title="Torneio de Rush" aside={selection.label}>
              <Table caption={`Torneio de Rush, ${selection.label}`}>
                <thead>
                  <tr>
                    <Th align="left">Jogador</Th>
                    <Th title="Jogos">J</Th>
                    <Th title="Gols">G</Th>
                    <Th title="Assistências">A</Th>
                    <Th>G/A</Th>
                    <Th title="Média da Nota VFC">VFC</Th>
                  </tr>
                </thead>
                <tbody>
                  {rushRanking.map((player) => (
                    <Tr key={player.playerId}>
                      <Td align="left">
                        <span className="flex items-center gap-2">
                          <PlayerAvatar
                            name={player.name}
                            shirtNumber={player.shirtNumber}
                            photoUrl={player.photoUrl}
                            size="xs"
                          />
                          <span className="font-medium">{player.name}</span>
                        </span>
                      </Td>
                      <Td>{player.matches}</Td>
                      <Td>{player.goals}</Td>
                      <Td>{player.assists}</Td>
                      <Td strong>{player.goalContributions}</Td>
                      <Td strong>{formatAverage(player.averageRating)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <p className="text-muted text-xs">
                Estatísticas próprias, fora do ranking principal.
              </p>
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-10">
          <Section
            title="Últimos resultados"
            more={{ href: "/partidas", label: "Todas" }}
          >
            {recentMatches.length === 0 ? (
              <EmptyState title="Nenhuma partida registrada ainda" />
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted mr-1.5 text-xs">
                    Últimas {recentMatches.length}
                  </span>
                  {/* Do mais antigo para o mais recente. */}
                  {[...recentMatches].reverse().map((match) => (
                    <ResultMark
                      key={match.id}
                      result={match.result}
                      className="h-6! w-6! text-xs!"
                    />
                  ))}
                </div>
                <MatchRows>
                  {recentMatches.map((match) => (
                    <MatchRow key={match.id} match={match} />
                  ))}
                </MatchRows>
              </>
            )}
          </Section>

          {latestClosed && latestAwards.length > 0 && (
            <Section
              title="Prêmios da última gameplay"
              aside={formatReferenceDate(latestClosed.referenceDate)}
              more={{
                href: `/premiacao/${latestClosed.id}`,
                label: "Premiação",
              }}
            >
              <AwardList
                awards={latestAwards.map((award) => ({
                  award: award.award,
                  value: award.value,
                  playerName: award.playerName,
                  photoUrl: awardPhotos.get(award.playerId)?.photoUrl ?? null,
                  slug: awardPhotos.get(award.playerId)?.slug ?? null,
                }))}
              />
            </Section>
          )}
        </div>
      </div>
    </Page>
  );
}
