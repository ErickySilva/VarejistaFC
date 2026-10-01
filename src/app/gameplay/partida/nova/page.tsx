import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";
import { MatchForm } from "@/components/gameplay/match-form";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <Link href="/gameplay" className="text-sm underline">
          Voltar para a gameplay
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Registrar partida
        </h1>
        <p className="text-sm opacity-70">
          Gameplay de {formatReferenceDate(night.referenceDate)} · partida{" "}
          {night.matches.length + 1}
        </p>
      </div>
      <MatchForm players={players} opponentNames={opponentNames} />
    </main>
  );
}
