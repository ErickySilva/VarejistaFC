import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EntryBackdrop } from "@/components/entry/backdrop";
import { PlayerLoginForm } from "@/components/entry/player-login-form";
import { Ribbon } from "@/components/ui/badge";
import { ArrowLeftIcon, ShieldIcon } from "@/components/ui/icons";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { BACK } from "@/components/ui/transitions";
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
    <EntryBackdrop quiet>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-5">
        <Link
          href={destination ? "/entrar/admin" : "/entrar"}
          transitionTypes={BACK}
          className="text-soft hover:text-fg -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Trocar de jogador
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-10">
          <div className="flex flex-col items-center">
            <PlayerAvatar
              name={player.name}
              shirtNumber={player.shirtNumber}
              photoUrl={player.photoUrl}
              size="hero"
              ring="crest"
              priority
              sharedAs={player.slug}
            />
            <Ribbon className="relative -mt-5 h-8! px-5! text-base!">
              <span className="sr-only">Camisa </span>
              {player.shirtNumber}
            </Ribbon>
            <h1 className="display mt-3 text-4xl">{player.name}</h1>
            {destination && (
              <p className="text-soft mt-2 flex items-center gap-1.5 text-sm font-medium">
                <ShieldIcon className="h-4 w-4" />
                Entrada de administrador
              </p>
            )}
          </div>

          <div
            className="animate-rise stagger w-full"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            {player.hasAccount ? (
              <PlayerLoginForm
                playerSlug={player.slug}
                playerName={player.name}
                destination={destination}
              />
            ) : (
              <p className="text-soft text-center text-sm">
                Este jogador ainda não tem conta. Peça um convite a um
                administrador e{" "}
                <Link
                  href="/criar-conta"
                  className="text-fg font-medium underline underline-offset-4"
                >
                  crie a sua conta
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </div>
    </EntryBackdrop>
  );
}
