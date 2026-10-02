import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { AccountsManager } from "@/components/admin/accounts-manager";
import { Page, PageHeader } from "@/components/ui/layout";
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
    <Page width="wide">
      <PageHeader
        title="Contas e permissões"
        back={{ href: "/admin", label: "Admin" }}
        description="Cada conta entra pelo retrato do jogador a que está vinculada. Só administradores acessam esta área."
      />

      <AccountsManager
        accounts={accounts}
        players={players.map((player) => ({
          id: player.id,
          name: player.name,
          shirtNumber: player.shirtNumber,
          photoUrl: player.photoUrl,
        }))}
        currentUserId={actor.userId}
      />
    </Page>
  );
}
