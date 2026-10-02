import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { DeleteMatchButton } from "@/components/gameplay/delete-match-button";
import { MatchForm } from "@/components/gameplay/match-form";
import { Page, PageHeader } from "@/components/ui/layout";
import { getActorWithPermission } from "@/server/auth/page-access";
import { getMatchDetail, getOpenNight } from "@/server/nights/queries";
import { listPlayersForMatch } from "@/server/players/queries";

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

  const players = await listPlayersForMatch(match.id);

  return (
    <Page className="overflow-x-clip">
      <PageHeader
        title="Corrigir partida"
        back={{ href: "/gameplay", label: "Gameplay" }}
        description="As notas de todos os jogadores são recalculadas ao salvar."
      />

      <MatchForm
        players={players}
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
        <DeleteMatchButton
          matchId={match.id}
          opponentName={match.opponentName}
          goalsFor={match.goalsFor}
          goalsAgainst={match.goalsAgainst}
          onlyMatchOfNight={night.matches.length === 1}
        />
      </div>
    </Page>
  );
}
