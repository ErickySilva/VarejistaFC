import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayerLoginForm } from "@/components/entry/player-login-form";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { getActor } from "@/server/auth/session";
import { getEntryPlayer } from "@/server/players/entry";

export const metadata: Metadata = { title: "Entrar" };

export default async function PlayerEntryPage({
  params,
  searchParams,
}: PageProps<"/entrar/[slug]">) {
  if (await getActor()) redirect("/");

  const { slug } = await params;
  const { destino } = await searchParams;
  const destination = destino === "admin" ? "admin" : undefined;

  const player = await getEntryPlayer(slug);
  if (!player) notFound();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-5 px-4 py-6">
      <Link
        href={destination ? "/entrar/admin" : "/entrar"}
        className="self-start text-sm underline"
      >
        Voltar
      </Link>

      <PlayerAvatar
        name={player.name}
        shirtNumber={player.shirtNumber}
        photoUrl={player.photoUrl}
        size="xl"
      />
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{player.name}</h1>
        <p className="text-sm tabular-nums opacity-70">
          #{player.shirtNumber}
          {destination && " · entrada de administrador"}
        </p>
      </div>

      {player.hasAccount ? (
        <PlayerLoginForm
          playerSlug={player.slug}
          playerName={player.name}
          destination={destination}
        />
      ) : (
        <p className="text-center text-sm opacity-70">
          Este jogador ainda não tem conta. Peça a um administrador para criar.
        </p>
      )}
    </main>
  );
}
