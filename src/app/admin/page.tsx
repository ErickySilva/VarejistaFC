import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { getActorWithPermission } from "@/server/auth/page-access";

export const metadata: Metadata = { title: "Admin" };

const itemClass = "border-foreground/15 flex flex-col gap-1 rounded border p-4";

// Área administrativa. A página confere o papel no servidor; cada operação é
// conferida de novo pelo serviço que a executa.
export default async function AdminPage() {
  const actor = await getActorWithPermission({ action: "accounts.manage" });
  if (!actor) return <AccessDenied />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm opacity-70">Logado como {actor.name}.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link href="/admin/contas" className={itemClass}>
            <span className="font-semibold">Contas e permissões</span>
            <span className="text-sm opacity-70">
              Criar contas, definir quem é admin, vincular jogadores, redefinir
              senhas e desativar acessos.
            </span>
          </Link>
        </li>
        <li>
          <Link href="/gameplay" className={itemClass}>
            <span className="font-semibold">Gameplay</span>
            <span className="text-sm opacity-70">
              Iniciar, registrar partidas, corrigir e encerrar.
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
