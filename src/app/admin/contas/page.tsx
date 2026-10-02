import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { AccountsManager } from "@/components/admin/accounts-manager";
import { Page, PageHeader } from "@/components/ui/layout";
import { getActorWithPermission } from "@/server/auth/page-access";
import { requireContext } from "@/server/auth/session";
import { listPendingInvites } from "@/server/invites/service";
import { listActivePlayers } from "@/server/players/queries";
import { listAccounts } from "@/server/users/service";

export const metadata: Metadata = { title: "Contas e permissões" };

export default async function AccountsPage() {
  const actor = await getActorWithPermission({ action: "accounts.manage" });
  if (!actor) return <AccessDenied />;

  // Os serviços conferem a permissão de novo antes de devolver os dados.
  const context = await requireContext();
  const [accounts, invites, players] = await Promise.all([
    listAccounts(context),
    listPendingInvites(context),
    listActivePlayers(),
  ]);

  return (
    <Page>
      <PageHeader
        title="Contas e permissões"
        back={{ href: "/admin", label: "Admin" }}
        description="Cada jogador cria a própria conta com um convite gerado aqui e entra pelo seu retrato. Só administradores acessam esta área."
      />

      <AccountsManager
        accounts={accounts}
        invites={invites}
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
