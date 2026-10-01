import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { AccountsManager } from "@/components/admin/accounts-manager";
import { getActorWithPermission } from "@/server/auth/page-access";
import { requireContext } from "@/server/auth/session";
import { listActivePlayers } from "@/server/players/queries";
import { listAccounts } from "@/server/users/service";

export const metadata: Metadata = { title: "Contas e permissões" };

export default async function AccountsPage() {
  const actor = await getActorWithPermission({ action: "accounts.manage" });
  if (!actor) return <AccessDenied />;

  // O serviço confere a permissão de novo antes de devolver as contas.
  const [accounts, players] = await Promise.all([
    listAccounts(await requireContext()),
    listActivePlayers(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <Link href="/admin" className="text-sm underline">
          Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Contas e permissões
        </h1>
        <p className="text-sm opacity-70">
          Cada conta entra pelo tile do jogador a que está vinculada. Só
          administradores acessam esta área.
        </p>
      </div>

      <AccountsManager
        accounts={accounts}
        players={players.map((player) => ({
          id: player.id,
          name: player.name,
          shirtNumber: player.shirtNumber,
        }))}
        currentUserId={actor.userId}
      />
    </main>
  );
}
