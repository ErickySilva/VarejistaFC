import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { ActionButton } from "@/components/gameplay/action-button";
import { CloseGameplayButton } from "@/components/gameplay/close-gameplay-button";
import { LivePanel } from "@/components/gameplay/live-panel";
import { LiveRefresh } from "@/components/gameplay/live-refresh";
import {
  AwardList,
  MatchStrip,
  nightPlayerIds,
  OverallRanking,
  playerLookup,
} from "@/components/gameplay/night-view";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { Page, PageHeader, Section } from "@/components/ui/layout";
import { summarizeNight } from "@/domain/night";
import { formatReferenceDate, referenceDateFor } from "@/domain/reference-date";
import {
  cancelGameplay,
  startGameplay,
} from "@/server/actions/gameplay-actions";
import { getActorWithPermission } from "@/server/auth/page-access";
import {
  getLatestClosedNight,
  getNightAwards,
  getOpenNight,
  toDomainNight,
  type NightDetail,
} from "@/server/nights/queries";
import { getPlayerPhotos } from "@/server/players/directory";
import { getOverallRanking } from "@/server/players/queries";

export const metadata: Metadata = { title: "Gameplay" };

async function OpenNight({ night }: { night: NightDetail }) {
  const summary = summarizeNight(toDomainNight(night));
  const lookup = playerLookup(
    night,
    await getPlayerPhotos(nightPlayerIds(night)),
  );
  const today = referenceDateFor(new Date());
  const startedOnAnotherDay = night.referenceDate !== today;
  const isEmpty = night.matches.length === 0;

  return (
    <>
      <LivePanel night={night} summary={summary} lookup={lookup}>
        {startedOnAnotherDay && !isEmpty && (
          <Notice tone="info">
            Esta gameplay começou em {formatReferenceDate(night.referenceDate)}{" "}
            e continua aberta. As partidas registradas agora entram nela. Para
            começar a de hoje, encerre esta primeiro.
          </Notice>
        )}

        {startedOnAnotherDay && isEmpty ? (
          <>
            <Notice tone="info">
              A gameplay de {formatReferenceDate(night.referenceDate)} ficou
              aberta sem nenhuma partida. Ao iniciar a de hoje, ela é
              descartada.
            </Notice>
            <ActionButton
              action={startGameplay}
              label="Dar início à gameplay de hoje"
              pendingLabel="Iniciando"
            />
          </>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <ButtonLink
              href="/gameplay/partida/nova"
              variant="primary"
              size="lg"
            >
              <PlusIcon />
              Registrar partida
            </ButtonLink>
            {isEmpty ? (
              <ActionButton
                action={cancelGameplay}
                label="Cancelar gameplay"
                pendingLabel="Cancelando"
                variant="secondary"
                confirm={{
                  title: "Cancelar esta gameplay?",
                  message: "Ela não tem partidas e será removida.",
                  confirmLabel: "Cancelar gameplay",
                }}
              />
            ) : (
              <CloseGameplayButton />
            )}
          </div>
        )}
        {isEmpty && !startedOnAnotherDay && (
          <p className="text-muted text-xs">
            Para encerrar, registre pelo menos uma partida. Se não houve jogo,
            cancele a gameplay.
          </p>
        )}
        {!isEmpty && (
          <p className="text-muted text-xs">
            Para corrigir ou excluir uma partida, toque nela na fita acima.
          </p>
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

async function NoOpenNight() {
  const latest = await getLatestClosedNight();
  const awards = latest ? await getNightAwards(latest.id) : [];
  const photos = await getPlayerPhotos(awards.map((award) => award.playerId));

  return (
    <>
      <section className="bg-surface animate-rise -mx-4 flex flex-col gap-4 px-4 py-6 sm:mx-0 sm:rounded-xl sm:px-6">
        <div>
          <h2 className="display text-2xl">Nenhuma gameplay em andamento</h2>
          <p className="text-soft mt-1.5 text-sm">
            Ao iniciar, a gameplay de hoje fica aberta para registrar as
            partidas até você encerrar.
          </p>
        </div>
        <ActionButton
          action={startGameplay}
          label="Dar início à gameplay"
          pendingLabel="Iniciando"
        />
      </section>

      {latest && (
        <Section
          title="Última gameplay"
          aside={formatReferenceDate(latest.referenceDate)}
          more={{ href: `/premiacao/${latest.id}`, label: "Premiação" }}
        >
          <MatchStrip matches={latest.matches} />
          <AwardList
            awards={awards.map((award) => ({
              award: award.award,
              value: award.value,
              playerName: award.playerName,
              photoUrl: photos.get(award.playerId)?.photoUrl ?? null,
              slug: photos.get(award.playerId)?.slug ?? null,
            }))}
          />
          {latest.summary && (
            <p className="text-soft text-sm">{latest.summary}</p>
          )}
        </Section>
      )}
    </>
  );
}

export default async function GameplayPage() {
  const actor = await getActorWithPermission({ action: "stats.manage" });
  if (!actor) return <AccessDenied />;

  const [openNight, ranking] = await Promise.all([
    getOpenNight(),
    getOverallRanking(),
  ]);

  return (
    <Page>
      <LiveRefresh renderId={crypto.randomUUID()} />
      {openNight ? (
        <>
          <h1 className="sr-only">Gameplay</h1>
          <OpenNight night={openNight} />
        </>
      ) : (
        <>
          <PageHeader title="Gameplay" />
          <NoOpenNight />
        </>
      )}
      {ranking.length > 0 && (
        <Section title="Ranking geral" aside="desde a criação do Clube">
          <OverallRanking ranking={ranking} />
          <p className="text-muted text-xs">
            Partidas principais do sistema mais o histórico. O Rush não entra.
          </p>
        </Section>
      )}
    </Page>
  );
}
