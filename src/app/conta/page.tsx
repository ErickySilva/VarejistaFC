import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ShieldIcon, WhistleIcon } from "@/components/ui/icons";
import { Page, PageHeader, Surface } from "@/components/ui/layout";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { signOutAndRedirect } from "@/server/actions/auth-actions";
import { can } from "@/server/auth/policy";
import { getActor } from "@/server/auth/session";
import { getPlayerPhotos } from "@/server/players/directory";

export const metadata: Metadata = { title: "Minha conta" };

const ROLE_LABEL = { admin: "Administrador", player: "Jogador" };

// Quem está logado, os atalhos que o papel permite e a saída.
export default async function AccountPage() {
  const actor = await getActor();
  if (!actor) redirect("/entrar");

  const link = actor.playerId
    ? (await getPlayerPhotos([actor.playerId])).get(actor.playerId)
    : undefined;

  return (
    <Page width="narrow">
      <PageHeader title="Minha conta" />

      <Surface className="flex items-center gap-4 p-4">
        <PlayerAvatar
          name={actor.name}
          photoUrl={link?.photoUrl ?? null}
          size="lg"
          ring="crest"
        />
        <div className="min-w-0">
          <p className="display text-2xl">{actor.name}</p>
          <p className="text-muted truncate text-sm">{actor.email}</p>
          <Badge className="mt-2">{ROLE_LABEL[actor.role]}</Badge>
        </div>
      </Surface>

      <div className="flex flex-col gap-2">
        {link && (
          <ButtonLink href={`/jogadores/${link.slug}`} size="lg">
            Ver meu perfil
          </ButtonLink>
        )}
        {can(actor, { action: "stats.manage" }) && (
          <ButtonLink href="/gameplay" size="lg">
            <WhistleIcon />
            Gameplay
          </ButtonLink>
        )}
        {can(actor, { action: "accounts.manage" }) && (
          <ButtonLink href="/admin" size="lg">
            <ShieldIcon />
            Admin
          </ButtonLink>
        )}
      </div>

      <form action={signOutAndRedirect}>
        <Button type="submit" variant="ghost">
          Sair da conta
        </Button>
      </form>
    </Page>
  );
}
