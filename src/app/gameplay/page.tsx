import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { ActionButton } from "@/components/gameplay/action-button";
import {
  AwardList,
  MatchList,
  NightHeader,
  NightStandings,
  OverallRanking,
} from "@/components/gameplay/night-view";
import { summarizeNight } from "@/domain/night";
import { formatReferenceDate, referenceDateFor } from "@/domain/reference-date";
import {
  cancelGameplay,
  closeGameplay,
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
import { getOverallRanking } from "@/server/players/queries";

export const metadata: Metadata = { title: "Gameplay" };

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

async function OpenNight({ night }: { night: NightDetail }) {
  const summary = summarizeNight(toDomainNight(night));
  const playerName = playerNames(night);
  const today = referenceDateFor(new Date());
  const startedOnAnotherDay = night.referenceDate !== today;
  const isEmpty = night.matches.length === 0;

  return (
    <>
      <NightHeader night={night} summary={summary} />

      {startedOnAnotherDay && !isEmpty && (
        <p className="border-foreground/20 rounded border p-3 text-sm">
          Esta gameplay começou em {formatReferenceDate(night.referenceDate)} e
          continua aberta. As partidas registradas agora entram nela. Para
          começar a de hoje, encerre esta primeiro.
        </p>
      )}

      {startedOnAnotherDay && isEmpty ? (
        <div className="flex flex-col gap-3">
          <p className="border-foreground/20 rounded border p-3 text-sm">
            A gameplay de {formatReferenceDate(night.referenceDate)} ficou
            aberta sem nenhuma partida. Ao iniciar a de hoje, ela é descartada.
          </p>
          <ActionButton
            action={startGameplay}
            label="Dar início à Gameplay de hoje"
            pendingLabel="Iniciando..."
          />
        </div>
      ) : (
        <Link
          href="/gameplay/partida/nova"
          className="bg-foreground text-background flex min-h-12 items-center justify-center rounded px-4 py-3 font-medium"
        >
          Registrar partida
        </Link>
      )}

      <section>
        <h3 className="mb-2 font-semibold">Partidas</h3>
        <MatchList matches={night.matches} editable />
      </section>

      <NightStandings summary={summary} playerName={playerName} />
      <AwardList
        title="Parciais da noite"
        awards={summary.awards.map((award) => ({
          award: award.award,
          playerName: playerName(award.playerId),
          value: award.value,
        }))}
      />

      {isEmpty ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm opacity-70">
            Para encerrar, registre pelo menos uma partida. Se não houve jogo,
            cancele a gameplay.
          </p>
          <ActionButton
            action={cancelGameplay}
            label="Cancelar gameplay"
            pendingLabel="Cancelando..."
            confirmMessage="Cancelar esta gameplay? Ela não tem partidas e será removida."
            variant="secondary"
          />
        </div>
      ) : (
        <ActionButton
          action={closeGameplay}
          label="Encerrar Gameplay"
          pendingLabel="Encerrando..."
          confirmMessage="Encerrar a gameplay? Os prêmios e o resumo da noite serão calculados."
          variant="danger"
        />
      )}
    </>
  );
}

async function NoOpenNight() {
  const latest = await getLatestClosedNight();
  const awards = latest ? await getNightAwards(latest.id) : [];

  return (
    <>
      <ActionButton
        action={startGameplay}
        label="Dar início à Gameplay"
        pendingLabel="Iniciando..."
      />

      {latest && (
        <section className="border-foreground/15 flex flex-col gap-4 rounded border p-3">
          <NightHeader
            night={latest}
            summary={summarizeNight(toDomainNight(latest))}
          />
          {latest.summary && <p className="text-sm">{latest.summary}</p>}
          <AwardList title="Prêmios da noite" awards={awards} />
          <MatchList matches={latest.matches} editable={false} />
        </section>
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Gameplay</h1>
      {openNight ? <OpenNight night={openNight} /> : <NoOpenNight />}
      <OverallRanking ranking={ranking} />
    </main>
  );
}
