import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchTypeBadge, ResultBadge } from "@/components/matches/match-row";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { isGoalkeeper, POSITION_LABEL } from "@/domain/positions";
import { formatReferenceDate } from "@/domain/reference-date";
import { formatDateTime, formatRating, UNAVAILABLE } from "@/lib/format";
import { getMatchPage } from "@/server/matches/queries";
import { getPlayerPhotos } from "@/server/players/directory";

type Props = PageProps<"/partidas/[id]">;

async function loadMatch(params: Props["params"]) {
  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) return null;
  return getMatchPage(matchId);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await loadMatch(params);
  if (!page) return { title: "Partida" };
  const { match } = page;
  return {
    title: `Varejista FC ${match.goalsFor} × ${match.goalsAgainst} ${match.opponentName}`,
  };
}

export default async function MatchPage({ params }: Props) {
  const page = await loadMatch(params);
  if (!page) notFound();

  const { match, night } = page;
  const photos = await getPlayerPhotos(
    match.participations.map((participation) => participation.playerId),
  );
  const goalkeepers = match.participations.filter((participation) =>
    isGoalkeeper(participation.position),
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <Link href="/partidas" className="text-sm underline">
        Todas as partidas
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MatchTypeBadge matchType={match.matchType} />
          <ResultBadge
            result={match.result}
            wentToPenalties={match.wentToPenalties}
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Varejista FC{" "}
          <span className="tabular-nums">
            {match.goalsFor} × {match.goalsAgainst}
          </span>{" "}
          {match.opponentName}
        </h1>
        {match.wentToPenalties && (
          <p className="text-sm">
            Decidida nos pênaltis:{" "}
            <strong className="tabular-nums">
              {match.penaltyScoreFor} × {match.penaltyScoreAgainst}
            </strong>
            . Os gols da disputa não contam como gols da partida.
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="opacity-70">Registrada em</dt>
          <dd>{formatDateTime(match.playedAt)}</dd>
          <dt className="opacity-70">Gameplay</dt>
          <dd>
            {formatReferenceDate(night.referenceDate)}
            {night.status === "open" && " (em andamento)"}
          </dd>
          <dt className="opacity-70">Temporada</dt>
          <dd>{night.seasonName}</dd>
        </dl>
        {match.matchType === "rush" && (
          <p className="text-xs opacity-70">
            Partida de Rush: fica fora das estatísticas principais.
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-2 font-semibold">Participantes</h2>
        <ul className="flex flex-col gap-2">
          {match.participations.map((participation) => (
            <li
              key={participation.playerId}
              className="border-foreground/15 flex items-center gap-3 rounded border p-3"
            >
              <PlayerAvatar
                name={participation.playerName}
                shirtNumber={participation.shirtNumber}
                photoUrl={photos.get(participation.playerId)?.photoUrl ?? null}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/jogadores/${photos.get(participation.playerId)?.slug ?? ""}`}
                  className="font-medium"
                >
                  {participation.playerName}{" "}
                  <span className="font-normal opacity-60">
                    #{participation.shirtNumber}
                  </span>
                </Link>
                <p className="text-sm opacity-80">
                  {participation.position} ·{" "}
                  {POSITION_LABEL[participation.position]}
                </p>
                <p className="text-sm tabular-nums">
                  {participation.goals} gols · {participation.assists}{" "}
                  assistências
                </p>
              </div>
              <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-2 text-right text-sm tabular-nums">
                <dt className="opacity-70">VFC</dt>
                <dd className="font-semibold">
                  {formatRating(participation.rating)}
                </dd>
                <dt className="opacity-70">FIFA</dt>
                <dd>
                  {participation.fifaRating === null
                    ? UNAVAILABLE
                    : formatRating(participation.fifaRating)}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs opacity-70">
          VFC: nota calculada pelo sistema (fórmula{" "}
          {match.participations[0]?.ratingVersion ?? ""}). FIFA: nota do jogo,
          informada à mão; {UNAVAILABLE} quando não informada.
        </p>
      </section>

      {goalkeepers.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Goleiro</h2>
          {goalkeepers.map((goalkeeper) => (
            <dl
              key={goalkeeper.playerId}
              className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm"
            >
              <dt className="opacity-70">Jogador</dt>
              <dd>{goalkeeper.playerName}</dd>
              <dt className="opacity-70">Defesas</dt>
              <dd className="tabular-nums">{goalkeeper.saves ?? 0}</dd>
              <dt className="opacity-70">Defesas de pênalti</dt>
              <dd className="tabular-nums">{goalkeeper.penaltiesSaved ?? 0}</dd>
              <dt className="opacity-70">Gols sofridos</dt>
              <dd className="tabular-nums">{match.goalsAgainst}</dd>
              <dt className="opacity-70">Sem sofrer gol</dt>
              <dd>{match.goalsAgainst === 0 ? "Sim" : "Não"}</dd>
            </dl>
          ))}
        </section>
      )}
    </main>
  );
}
