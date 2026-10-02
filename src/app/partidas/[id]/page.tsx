import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/gameplay/action-button";
import { DeleteMatchButton } from "@/components/gameplay/delete-match-button";
import { Score } from "@/components/matches/match-row";
import { MatchTypeBadge, ResultMark } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";
import { EditIcon, PlusIcon } from "@/components/ui/icons";
import { Page, PageHeaderBack, Section } from "@/components/ui/layout";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { FORWARD } from "@/components/ui/transitions";
import { Stat, StatGroup } from "@/components/ui/stat";
import type { MatchResult } from "@/domain/match";
import { isGoalkeeper, POSITION_LABEL } from "@/domain/positions";
import { formatReferenceDate, referenceDateFor } from "@/domain/reference-date";
import { formatDateTime, formatRating, UNAVAILABLE } from "@/lib/format";
import { can } from "@/server/auth/policy";
import { getActor } from "@/server/auth/session";
import { startGameplay } from "@/server/actions/gameplay-actions";
import { getMatchPage } from "@/server/matches/queries";
import { getNightDetail } from "@/server/nights/queries";
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

// Faixa no topo do placar. Cada resultado tem cor e desenho próprios: cheia na
// vitória, tracejada no empate, listrada na derrota.
const RESULT_BAND: Record<MatchResult, string> = {
  W: "bg-win",
  D: "bg-[repeating-linear-gradient(90deg,var(--color-draw)_0_14px,transparent_14px_22px)]",
  L: "bg-[repeating-linear-gradient(135deg,var(--color-loss)_0_6px,transparent_6px_11px)]",
};

export default async function MatchPage({ params, searchParams }: Props) {
  const page = await loadMatch(params);
  if (!page) notFound();

  const { match, night } = page;
  const [{ nova }, actor, photos] = await Promise.all([
    searchParams,
    getActor(),
    getPlayerPhotos(
      match.participations.map((participation) => participation.playerId),
    ),
  ]);
  const goalkeepers = match.participations.filter((participation) =>
    isGoalkeeper(participation.position),
  );
  // Só a gameplay em andamento pode ser operada; o servidor confere de novo.
  const isAdmin = can(actor, { action: "stats.manage" });
  const canOperate = night.status === "open" && isAdmin;
  // Gameplay encerrada só pode ser reaberta no mesmo dia (regra da gameplay).
  const canReopen =
    isAdmin &&
    night.status === "closed" &&
    night.referenceDate === referenceDateFor(new Date());
  const nightMatchCount = canOperate
    ? ((await getNightDetail(night.id))?.matches.length ?? 0)
    : 0;

  return (
    <Page>
      <PageHeaderBack href="/partidas" label="Todas as partidas" />

      {nova === "1" && canOperate && (
        <Notice tone="success">
          Partida registrada. As notas VFC já foram calculadas.
        </Notice>
      )}

      <header className="bg-surface animate-rise overflow-hidden rounded-xl">
        <div
          aria-hidden="true"
          className={`h-2 ${RESULT_BAND[match.result]}`}
        />
        <div className="flex flex-col items-center gap-5 px-4 pt-5 pb-6">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <ResultMark
              result={match.result}
              wentToPenalties={match.wentToPenalties}
              variant="label"
            />
            <MatchTypeBadge matchType={match.matchType} />
          </div>

          <h1 className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
            <span className="flex flex-col items-center gap-2 text-center">
              <Image
                src="/brand/crest-mark.webp"
                alt=""
                width={112}
                height={117}
                className="h-14 w-auto sm:h-16"
              />
              <span className="text-sm font-bold sm:text-base">
                Varejista FC
              </span>
            </span>
            <Score
              goalsFor={match.goalsFor}
              goalsAgainst={match.goalsAgainst}
              className="animate-stamp text-6xl sm:text-7xl"
            />
            <span className="flex flex-col items-center gap-2 text-center">
              <span
                aria-hidden="true"
                className="clip-hex bg-raised numeral text-soft flex aspect-[7/8] h-14 items-center justify-center text-xl sm:h-16"
              >
                {match.opponentName.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-bold break-words sm:text-base">
                {match.opponentName}
              </span>
            </span>
          </h1>

          {match.wentToPenalties && (
            <p className="text-soft text-center text-sm">
              Decidida nos pênaltis:{" "}
              <strong className="text-fg tabular-nums">
                {match.penaltyScoreFor} × {match.penaltyScoreAgainst}
              </strong>
              . Os gols da disputa não contam como gols da partida.
            </p>
          )}

          <dl className="border-line/50 grid w-full grid-cols-3 gap-3 border-t pt-4 text-center text-sm">
            <div>
              <dt className="text-muted text-xs">Registrada em</dt>
              <dd className="font-medium">{formatDateTime(match.playedAt)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Gameplay</dt>
              <dd className="font-medium">
                {formatReferenceDate(night.referenceDate)}
                {night.status === "open" && (
                  <span className="text-accent block text-xs">
                    em andamento
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Temporada</dt>
              <dd className="font-medium">{night.seasonName}</dd>
            </div>
          </dl>

          {match.matchType === "rush" && (
            <p className="text-muted text-center text-xs">
              Partida de Rush: fica fora das estatísticas principais.
            </p>
          )}
        </div>
      </header>

      {canOperate && (
        <div className="grid gap-2 sm:grid-cols-3">
          <ButtonLink href="/gameplay/partida/nova" variant="primary">
            <PlusIcon />
            Registrar próxima
          </ButtonLink>
          <ButtonLink href="/gameplay">Painel da gameplay</ButtonLink>
          <ButtonLink href={`/gameplay/partida/${match.id}`} variant="ghost">
            <EditIcon />
            Corrigir
          </ButtonLink>
        </div>
      )}

      <Section title="Participantes">
        <ul className="divide-line/40 border-line/40 divide-y border-y">
          {match.participations.map((participation, index) => {
            const link = photos.get(participation.playerId);
            return (
              <li
                key={participation.playerId}
                className="animate-rise stagger"
                style={{ "--i": index + 1 } as React.CSSProperties}
              >
                <Link
                  href={`/jogadores/${link?.slug ?? ""}`}
                  transitionTypes={FORWARD}
                  className="hover:bg-surface active:bg-surface -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors"
                >
                  <PlayerAvatar
                    name={participation.playerName}
                    shirtNumber={participation.shirtNumber}
                    photoUrl={link?.photoUrl ?? null}
                    size="md"
                    sharedAs={link?.slug}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold">
                      {participation.playerName}
                      <span className="text-muted ml-1.5 text-sm font-normal tabular-nums">
                        {participation.shirtNumber}
                      </span>
                    </p>
                    <p className="text-muted text-xs">
                      {POSITION_LABEL[participation.position]}
                    </p>
                    <p className="text-soft mt-1 flex flex-wrap gap-x-3 text-sm tabular-nums">
                      <span>
                        <strong className="text-fg">
                          {participation.goals}
                        </strong>{" "}
                        {participation.goals === 1 ? "gol" : "gols"}
                      </span>
                      <span>
                        <strong className="text-fg">
                          {participation.assists}
                        </strong>{" "}
                        {participation.assists === 1
                          ? "assistência"
                          : "assistências"}
                      </span>
                    </p>
                  </div>
                  <dl className="shrink-0 text-right">
                    <div className="flex flex-col-reverse">
                      <dt className="text-muted text-[0.7rem]">Nota VFC</dt>
                      <dd className="numeral text-2xl">
                        {formatRating(participation.rating)}
                      </dd>
                    </div>
                    <div className="text-muted mt-1 flex items-baseline justify-end gap-1 text-xs">
                      <dt>FIFA</dt>
                      <dd className="text-soft font-semibold tabular-nums">
                        {participation.fifaRating === null
                          ? UNAVAILABLE
                          : formatRating(participation.fifaRating)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-muted text-xs">
          Nota VFC: calculada pelo sistema (fórmula{" "}
          {match.participations[0]?.ratingVersion ?? ""}). FIFA: nota do jogo,
          informada à mão; {UNAVAILABLE} quando não informada.
        </p>
      </Section>

      {goalkeepers.map((goalkeeper) => (
        <Section
          key={goalkeeper.playerId}
          title="No gol"
          aside={goalkeeper.playerName}
        >
          <StatGroup>
            <Stat label="Defesas" value={goalkeeper.saves ?? 0} />
            <Stat label="De pênalti" value={goalkeeper.penaltiesSaved ?? 0} />
            <Stat label="Gols sofridos" value={match.goalsAgainst} />
            <Stat
              label="Sem sofrer gol"
              value={match.goalsAgainst === 0 ? "Sim" : "Não"}
            />
          </StatGroup>
        </Section>
      ))}

      {isAdmin && (
        <Section title="Administração da partida">
          {canOperate ? (
            <DeleteMatchButton
              matchId={match.id}
              opponentName={match.opponentName}
              goalsFor={match.goalsFor}
              goalsAgainst={match.goalsAgainst}
              onlyMatchOfNight={nightMatchCount === 1}
            />
          ) : canReopen ? (
            <>
              <Notice tone="info">
                Esta gameplay está encerrada. Para corrigir ou excluir a
                partida, reabra a gameplay. Só dá para reabrir no mesmo dia.
              </Notice>
              <ActionButton
                action={startGameplay}
                label="Reabrir gameplay"
                pendingLabel="Reabrindo"
                variant="secondary"
                size="md"
                confirm={{
                  title: `Reabrir a gameplay de ${formatReferenceDate(night.referenceDate)}?`,
                  message:
                    "Os prêmios e o resumo desta noite são apagados agora e calculados de novo quando a gameplay for encerrada.",
                  confirmLabel: "Reabrir gameplay",
                }}
              />
            </>
          ) : (
            <Notice tone="info">
              Esta partida é de uma gameplay encerrada em outro dia. Ela não
              pode mais ser corrigida nem excluída: a gameplay só pode ser
              reaberta no próprio dia.
            </Notice>
          )}
        </Section>
      )}
    </Page>
  );
}
