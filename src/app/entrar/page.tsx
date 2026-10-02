import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EntryBackdrop } from "@/components/entry/backdrop";
import { PlayerTiles } from "@/components/entry/player-tiles";
import { ChevronRightIcon, EyeIcon, ShieldIcon } from "@/components/ui/icons";
import { FORWARD } from "@/components/ui/transitions";
import { getActor } from "@/server/auth/session";
import { listEntryPlayers } from "@/server/players/entry";

export const metadata: Metadata = { title: "Entrar" };

// Entrada do clube: a porta da frente. Em cima, o logo sobre o fundo do
// elenco; embaixo, cada jogador escolhe o seu retrato. Admin fica separado e
// visitante, discreto.
export default async function EntryPage() {
  if (await getActor()) redirect("/");

  const players = await listEntryPlayers();

  return (
    <EntryBackdrop>
      <div className="mx-auto grid w-full max-w-5xl flex-1 content-end gap-7 px-4 pt-10 pb-8 sm:px-6 lg:grid-cols-[4fr_8fr] lg:content-center lg:items-center lg:gap-14">
        <Image
          src="/brand/logo-mark.webp"
          alt="Varejista FC"
          width={641}
          height={580}
          priority
          className="animate-pop mx-auto w-full max-w-44 sm:max-w-60 lg:max-w-sm"
        />

        <div className="flex flex-col gap-8">
          <section aria-labelledby="escolha" className="flex flex-col gap-6">
            <div
              className="animate-rise stagger text-center lg:text-left"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <h1 id="escolha" className="display text-3xl sm:text-4xl">
                Escolha seu jogador
              </h1>
              <p className="text-soft mt-1.5 text-sm">
                Toque no seu retrato e entre com a sua senha.
              </p>
            </div>
            <PlayerTiles players={players} />
          </section>

          <nav
            aria-label="Outras entradas"
            className="animate-fade stagger flex flex-col gap-1"
            style={{ "--i": 8 } as React.CSSProperties}
          >
            <Link
              href="/entrar/admin"
              transitionTypes={FORWARD}
              className="bg-raised/80 hover:bg-raised flex min-h-13 items-center gap-3 rounded-md px-4 font-semibold transition-[background-color,transform] active:scale-[0.98]"
            >
              <ShieldIcon />
              Administração
              <span className="text-muted ml-auto flex items-center gap-1 text-sm font-normal">
                Área restrita
                <ChevronRightIcon className="h-4 w-4" />
              </span>
            </Link>
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                className="text-soft hover:text-fg -ml-1 inline-flex min-h-11 items-center gap-2 px-1 text-sm font-medium transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
                Entrar como visitante
              </Link>
              <Link
                href="/login"
                transitionTypes={FORWARD}
                className="text-muted hover:text-fg inline-flex min-h-11 items-center px-1 text-sm transition-colors"
              >
                Entrar com e-mail
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </EntryBackdrop>
  );
}
