import { can } from "@/server/auth/policy";
import { getActor } from "@/server/auth/session";
import { getOpenNight } from "@/server/nights/queries";
import { getPlayerPhotos } from "@/server/players/directory";
import { AppNav, type NavUser } from "./shell/app-nav";

// Carrega o que a navegação precisa saber (quem está logado e se há gameplay
// em andamento) e entrega à navegação, que cuida do estado ativo de cada link.
// Os atalhos de admin são só atalhos: cada área confere a permissão de novo.
export async function SiteHeader() {
  const [actor, openNight] = await Promise.all([getActor(), getOpenNight()]);

  let user: NavUser | null = null;
  if (actor) {
    const link = actor.playerId
      ? (await getPlayerPhotos([actor.playerId])).get(actor.playerId)
      : undefined;
    user = {
      name: actor.name,
      player: link
        ? { href: `/jogadores/${link.slug}`, photoUrl: link.photoUrl }
        : null,
    };
  }

  return (
    <AppNav
      user={user}
      canManageGameplay={can(actor, { action: "stats.manage" })}
      canManageAccounts={can(actor, { action: "accounts.manage" })}
      live={openNight !== null}
    />
  );
}
