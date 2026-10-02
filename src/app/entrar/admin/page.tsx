import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EntryBackdrop } from "@/components/entry/backdrop";
import { PlayerTiles } from "@/components/entry/player-tiles";
import { ArrowLeftIcon, ShieldIcon } from "@/components/ui/icons";
import { BACK } from "@/components/ui/transitions";
import { can } from "@/server/auth/policy";
import { getActor } from "@/server/auth/session";
import { listAdminEntryPlayers } from "@/server/players/entry";

export const metadata: Metadata = { title: "Admin" };

// Entrada separada da administração. Só aparecem os jogadores cuja conta é de
// administrador; a área em si confere o papel de novo no servidor.
export default async function AdminEntryPage() {
  const actor = await getActor();
  if (actor) {
    redirect(can(actor, { action: "accounts.manage" }) ? "/admin" : "/");
  }

  const admins = await listAdminEntryPlayers();

  return (
    <EntryBackdrop quiet>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-5">
        <Link
          href="/entrar"
          transitionTypes={BACK}
          className="text-soft hover:text-fg -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar
        </Link>

        <div className="flex flex-1 flex-col justify-center gap-8 pb-10">
          <div className="animate-rise text-center">
            <span className="bg-raised mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md">
              <ShieldIcon className="h-6 w-6" />
            </span>
            <h1 className="display text-3xl">Administração</h1>
            <p className="text-soft mt-1.5 text-sm">
              Acesso restrito aos administradores do clube.
            </p>
          </div>

          {admins.length === 0 ? (
            <p className="text-soft text-center text-sm">
              Nenhum administrador está vinculado a um jogador. Use a entrada
              com e-mail.
            </p>
          ) : (
            <div className="[&>ul]:grid-cols-2!">
              <PlayerTiles players={admins} destination="admin" />
            </div>
          )}

          <Link
            href="/login"
            className="text-muted hover:text-fg inline-flex min-h-11 items-center self-center px-1 text-sm transition-colors"
          >
            Entrar com e-mail
          </Link>
        </div>
      </div>
    </EntryBackdrop>
  );
}
