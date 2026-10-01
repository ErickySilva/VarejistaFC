import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlayerTiles } from "@/components/entry/player-tiles";
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <Link href="/entrar" className="text-sm underline">
        Voltar
      </Link>
      <div>
        <h1 className="text-sm font-semibold tracking-widest">ADMIN</h1>
        <p className="mt-1 text-sm opacity-70">
          Acesso restrito aos administradores do clube.
        </p>
      </div>

      {admins.length === 0 ? (
        <p className="text-sm opacity-70">
          Nenhum administrador está vinculado a um jogador. Use a entrada com
          e-mail.
        </p>
      ) : (
        <PlayerTiles players={admins} destination="admin" />
      )}

      <Link href="/login" className="text-center text-sm underline opacity-70">
        Entrar com e-mail
      </Link>
    </main>
  );
}
