import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { ActionButton } from "@/components/gameplay/action-button";
import { MatchForm } from "@/components/gameplay/match-form";
import { Page, PageHeader } from "@/components/ui/layout";
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
    <Page className="overflow-x-clip">
      <PageHeader
        title="Corrigir partida"
        back={{ href: "/gameplay", label: "Gameplay" }}
        description="As notas de todos os jogadores são recalculadas ao salvar."
      />

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
            fifaRating: participation.fifaRating,
          })),
        }}
      />

      <div className="border-line/50 border-t pt-6">
        <ActionButton
          action={deleteMatch.bind(null, { matchId: match.id })}
          label="Excluir esta partida"
          pendingLabel="Excluindo"
          variant="danger"
          size="md"
          redirectTo="/gameplay"
          confirm={{
            title: "Excluir esta partida?",
            message: "Ela sai das estatísticas da noite.",
            confirmLabel: "Excluir partida",
          }}
        />
      </div>
    </Page>
  );
}
