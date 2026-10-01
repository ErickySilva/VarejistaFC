import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { ActionButton } from "@/components/gameplay/action-button";
import { MatchForm } from "@/components/gameplay/match-form";
import { deleteMatch } from "@/server/actions/gameplay-actions";
import { getActorWithPermission } from "@/server/auth/page-access";
import { getMatchDetail, getOpenNight } from "@/server/nights/queries";
import {
  listOpponentNames,
  listPlayersForMatch,
} from "@/server/players/queries";

export const metadata: Metadata = { title: "Corrigir partida" };

export default async function EditMatchPage(
  props: PageProps<"/gameplay/partida/[id]">,
) {
  const actor = await getActorWithPermission({ action: "stats.manage" });
  if (!actor) return <AccessDenied />;

  const { id } = await props.params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) notFound();

  const [match, night] = await Promise.all([
    getMatchDetail(matchId),
    getOpenNight(),
  ]);
  if (!match) notFound();
  // Só partidas da gameplay em andamento podem ser corrigidas.
  if (!night || night.id !== match.nightId) redirect("/gameplay");

  const [players, opponentNames] = await Promise.all([
    listPlayersForMatch(match.id),
    listOpponentNames(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <Link href="/gameplay" className="text-sm underline">
          Voltar para a gameplay
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Corrigir partida
        </h1>
        <p className="text-sm opacity-70">
          As notas de todos os jogadores são recalculadas ao salvar.
        </p>
      </div>

      <MatchForm
        players={players}
        opponentNames={opponentNames}
        initial={{
          matchId: match.id,
          opponentName: match.opponentName,
          matchType: match.matchType,
          goalsFor: match.goalsFor,
          goalsAgainst: match.goalsAgainst,
          wentToPenalties: match.wentToPenalties,
          penaltyScoreFor: match.penaltyScoreFor,
          penaltyScoreAgainst: match.penaltyScoreAgainst,
          participations: match.participations.map((participation) => ({
            playerId: participation.playerId,
            position: participation.position,
            goals: participation.goals,
            assists: participation.assists,
            saves: participation.saves,
            penaltiesSaved: participation.penaltiesSaved,
          })),
        }}
      />

      <div className="border-foreground/15 border-t pt-5">
        <ActionButton
          action={deleteMatch.bind(null, { matchId: match.id })}
          label="Excluir esta partida"
          pendingLabel="Excluindo..."
          confirmMessage="Excluir esta partida? Ela sai das estatísticas da noite."
          variant="danger"
          redirectTo="/gameplay"
        />
      </div>
    </main>
  );
}
