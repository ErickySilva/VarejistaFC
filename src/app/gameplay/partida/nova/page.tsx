import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { MatchForm } from "@/components/gameplay/match-form";
import { Page, PageHeader } from "@/components/ui/layout";
import { formatReferenceDate } from "@/domain/reference-date";
import { getActorWithPermission } from "@/server/auth/page-access";
import { getOpenNight } from "@/server/nights/queries";
import { listActivePlayers, listOpponentNames } from "@/server/players/queries";

export const metadata: Metadata = { title: "Registrar partida" };

export default async function NewMatchPage() {
  const actor = await getActorWithPermission({ action: "stats.manage" });
  if (!actor) return <AccessDenied />;

  const night = await getOpenNight();
  if (!night) redirect("/gameplay");

  const [players, opponentNames] = await Promise.all([
    listActivePlayers(),
    listOpponentNames(),
  ]);

  return (
    <Page className="overflow-x-clip pb-0! md:pb-0!">
      <PageHeader
        title="Registrar partida"
        back={{ href: "/gameplay", label: "Gameplay" }}
        description={`Partida ${night.matches.length + 1} da gameplay de ${formatReferenceDate(night.referenceDate)}`}
      />
      <MatchForm players={players} opponentNames={opponentNames} />
    </Page>
  );
}
