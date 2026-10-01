import Link from "next/link";
import { ActionButton } from "@/components/gameplay/action-button";
import {
  AwardList,
  MatchList,
  NightHeader,
  NightStandings,
} from "@/components/gameplay/night-view";
import { MatchRow, ResultBadge } from "@/components/matches/match-row";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { StatGrid, StatTile } from "@/components/ui/stat-tile";
import { summarizeNight } from "@/domain/night";
import { rankPlayers } from "@/domain/ranking";
import { formatReferenceDate } from "@/domain/reference-date";
import { formatAverage } from "@/lib/format";
import { closeGameplay } from "@/server/actions/gameplay-actions";
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
import { getPlayerSlug } from "@/server/players/directory";
import { getTeamRecord } from "@/server/stats/history";
import { CLUB_PERIOD_PARAM, resolvePeriod } from "@/server/stats/period";
import { getPlayerStats } from "@/server/stats/queries";

const cell = "px-2 py-2 text-right tabular-nums";
const head = "px-2 py-2 text-right font-medium";

function playerNames(night: NightDetail) {
  const names = new Map(
    night.matches.flatMap((match) =>
      match.participations.map(
        (participation) =>
          [participation.playerId, participation.playerName] as const,
      ),
    ),
  );
  return (playerId: number) => names.get(playerId) ?? `Jogador ${playerId}`;
}

// A gameplay aberta é o elemento principal da Home. Todos acompanham; só
// administradores veem os botões de operação (e o servidor confere de novo).
function OpenGameplay({
  night,
  isAdmin,
}: {
  night: NightDetail;
  isAdmin: boolean;
}) {
  const summary = summarizeNight(toDomainNight(night));
  const playerName = playerNames(night);

  return (
    <section className="border-foreground flex flex-col gap-5 rounded border-2 p-3">
      <p className="text-sm font-semibold tracking-wide">
        <span aria-hidden="true">🟢 </span>GAMEPLAY EM ANDAMENTO
      </p>
      <NightHeader night={night} summary={summary} />

      {isAdmin && (
        <div className="flex flex-col gap-2">
          <Link
            href="/gameplay/partida/nova"
            className="bg-foreground text-background flex min-h-12 items-center justify-center rounded px-4 py-3 font-medium"
          >
            Registrar partida
          </Link>
          {night.matches.length > 0 ? (
            <ActionButton
              action={closeGameplay}
              label="Encerrar Gameplay"
              pendingLabel="Encerrando..."
              confirmMessage="Encerrar a gameplay? Os prêmios e o resumo da noite serão calculados."
              variant="danger"
            />
          ) : (
            <Link href="/gameplay" className="text-sm underline">
              Sem partidas ainda: abrir o painel para cancelar a gameplay
            </Link>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 font-semibold">Partidas registradas</h3>
        <MatchList matches={night.matches} editable={isAdmin} />
      </div>

      <NightStandings
        title="Estatísticas da sessão"
        note="Partidas principais: X1 e Partida."
        scope={summary.main}
        playerName={playerName}
      />
      <NightStandings
        title="Torneio de Rush"
        note="Fica fora das estatísticas principais."
        scope={summary.rush}
        playerName={playerName}
      />
      <AwardList
        title="Ranking parcial"
        awards={summary.awards.map((award) => ({
          award: award.award,
          playerName: playerName(award.playerId),
          value: award.value,
        }))}
      />
    </section>
  );
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
  const [latestAwards, ownSlug] = await Promise.all([
    latestClosed ? getNightAwards(latestClosed.id) : [],
    actor?.playerId ? getPlayerSlug(actor.playerId) : null,
  ]);

  const ranking = rankPlayers(
    stats.filter((player) => player.isActive || player.matches > 0),
    "geral",
  );
  const rushRanking = rankPlayers(
    rushStats.filter((player) => player.matches > 0),
    "geral",
  );
  const periodQuery = `periodo=${selection.param}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Varejista FC</h1>
        <p className="text-sm opacity-70">
          {selection.season
            ? `Temporada ${selection.season.name}`
            : "Nenhuma temporada ativa"}
        </p>
      </header>

      <section className="border-foreground/15 flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm">
        {actor ? (
          <>
            <span>
              Olá, <strong>{actor.name}</strong>
            </span>
            <span className="flex flex-wrap gap-x-4">
              {ownSlug && (
                <Link href={`/jogadores/${ownSlug}`} className="underline">
                  Meu perfil
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link href="/gameplay" className="underline">
                    Área da gameplay
                  </Link>
                  <Link href="/admin" className="underline">
                    Admin
                  </Link>
                </>
              )}
              <Link href="/conta" className="underline">
                Minha conta
              </Link>
            </span>
          </>
        ) : (
          <>
            <span className="opacity-70">Você está como visitante.</span>
            <Link href="/entrar" className="underline">
              Entrar
            </Link>
          </>
        )}
      </section>

      {openNight && <OpenGameplay night={openNight} isAdmin={isAdmin} />}

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Ranking · {selection.label}</h2>
          <Link href={`/ranking?${periodQuery}`} className="text-sm underline">
            Ranking completo
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-foreground/15 border-b">
                <th className="w-8 px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Jogador</th>
                <th className={head} title="Jogos">
                  J
                </th>
                <th className={head}>G/A</th>
                <th className={head} title="Média da Nota VFC">
                  VFC
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((player, index) => (
                <tr
                  key={player.playerId}
                  className="border-foreground/10 border-b"
                >
                  <td className="px-2 py-2 tabular-nums">{index + 1}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/jogadores/${player.slug}?${periodQuery}`}
                      className="flex items-center gap-2"
                    >
                      <PlayerAvatar
                        name={player.name}
                        shirtNumber={player.shirtNumber}
                        photoUrl={player.photoUrl}
                        size="sm"
                      />
                      {player.name}
                    </Link>
                  </td>
                  <td className={cell}>{player.matches}</td>
                  <td className={cell}>{player.goalContributions}</td>
                  <td className={cell}>
                    {formatAverage(player.averageRating)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link
          href={`/ranking?periodo=${CLUB_PERIOD_PARAM}`}
          className="mt-2 inline-flex min-h-11 items-center text-sm underline"
        >
          Ver desde a criação do Clube
        </Link>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Últimos resultados</h2>
          <Link href="/partidas" className="text-sm underline">
            Todas as partidas
          </Link>
        </div>
        {recentMatches.length === 0 ? (
          <p className="text-sm opacity-70">
            Nenhuma partida registrada ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentMatches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </ul>
        )}
      </section>

      {latestClosed && (
        <section>
          <h2 className="mb-2 font-semibold">
            Destaques · gameplay de{" "}
            {formatReferenceDate(latestClosed.referenceDate)}
          </h2>
          <div className="border-foreground/15 flex flex-col gap-3 rounded border p-3">
            <AwardList title="Prêmios da noite" awards={latestAwards} />
            {latestClosed.summary && (
              <p className="text-sm">{latestClosed.summary}</p>
            )}
          </div>
        </section>
      )}

      {rushRanking.length > 0 && (
        <section>
          <h2 className="mb-1 font-semibold">
            Torneio de Rush · {selection.label}
          </h2>
          <p className="mb-2 text-xs opacity-70">
            Estatísticas próprias, fora do ranking principal.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-foreground/15 border-b">
                  <th className="px-2 py-2 text-left font-medium">Jogador</th>
                  <th className={head}>J</th>
                  <th className={head}>G</th>
                  <th className={head}>A</th>
                  <th className={head}>G/A</th>
                  <th className={head}>VFC</th>
                </tr>
              </thead>
              <tbody>
                {rushRanking.map((player) => (
                  <tr
                    key={player.playerId}
                    className="border-foreground/10 border-b"
                  >
                    <td className="px-2 py-2">{player.name}</td>
                    <td className={cell}>{player.matches}</td>
                    <td className={cell}>{player.goals}</td>
                    <td className={cell}>{player.assists}</td>
                    <td className={cell}>{player.goalContributions}</td>
                    <td className={cell}>
                      {formatAverage(player.averageRating)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Campanha · {selection.label}</h2>
        {record.matches === 0 ? (
          <p className="text-sm opacity-70">
            Nenhuma partida principal registrada neste período.
          </p>
        ) : (
          <>
            <StatGrid>
              <StatTile label="Partidas" value={record.matches} />
              <StatTile
                label="V · E · D"
                value={`${record.wins} · ${record.draws} · ${record.losses}`}
              />
              <StatTile
                label="Gols pró · contra"
                value={`${record.goalsFor} · ${record.goalsAgainst}`}
              />
            </StatGrid>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="opacity-70">Últimos resultados:</span>
              {/* Do mais antigo para o mais recente. */}
              {[...recentMatches].reverse().map((match) => (
                <ResultBadge
                  key={match.id}
                  result={match.result}
                  wentToPenalties={false}
                  short
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
