import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerTiles } from "@/components/entry/player-tiles";
import { getActor } from "@/server/auth/session";
import { listEntryPlayers } from "@/server/players/entry";

export const metadata: Metadata = { title: "Entrar" };

const entryClass =
  "border-foreground/20 flex min-h-14 items-center justify-between rounded border px-4 py-3";

// Entrada do clube: jogadores, admin ou visitante.
export default async function EntryPage() {
  if (await getActor()) redirect("/");

  const players = await listEntryPlayers();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <Image
        src="/brand/logo.webp"
        alt="Varejista FC"
        width={800}
        height={641}
        priority
        className="mx-auto w-full max-w-xs rounded"
      />

      <section>
        <h1 className="mb-3 text-sm font-semibold tracking-widest">
          JOGADORES
        </h1>
        <PlayerTiles players={players} />
      </section>

      <section className="flex flex-col gap-3">
        <Link href="/entrar/admin" className={entryClass}>
          <span className="font-semibold tracking-widest">ADMIN</span>
          <span className="text-sm opacity-70">Área restrita</span>
        </Link>
        <Link href="/" className={entryClass}>
          <span className="font-semibold tracking-widest">VISITANTE</span>
          <span className="text-sm opacity-70">Só visualizar</span>
        </Link>
      </section>

      <Link href="/login" className="text-center text-sm underline opacity-70">
        Entrar com e-mail
      </Link>
    </main>
  );
}
