import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAndRedirect } from "@/server/actions/auth-actions";
import { can } from "@/server/auth/policy";
import { getActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Minha conta" };

const ROLE_LABEL = { admin: "Administrador", player: "Jogador" };

// Página provisória: confirma quem está logado e permite sair. A área do
// jogador e a administrativa entram nas próximas fases.
export default async function AccountPage() {
  const actor = await getActor();
  if (!actor) redirect("/entrar");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">
          Minha conta
        </h1>
        <dl className="mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="opacity-70">Nome</dt>
          <dd>{actor.name}</dd>
          <dt className="opacity-70">E-mail</dt>
          <dd>{actor.email}</dd>
          <dt className="opacity-70">Papel</dt>
          <dd>{ROLE_LABEL[actor.role]}</dd>
        </dl>
        {can(actor, { action: "accounts.manage" }) && (
          <Link
            href="/admin"
            className="border-foreground/20 mb-3 flex min-h-12 items-center justify-center rounded border px-4 py-3 font-medium"
          >
            Admin
          </Link>
        )}
        {can(actor, { action: "stats.manage" }) && (
          <Link
            href="/gameplay"
            className="bg-foreground text-background mb-4 flex min-h-12 items-center justify-center rounded px-4 py-3 font-medium"
          >
            Gameplay
          </Link>
        )}
        <form action={signOutAndRedirect}>
          <button
            type="submit"
            className="border-foreground/20 rounded border px-4 py-2 font-medium"
          >
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
