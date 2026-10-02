import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import {
  ChevronRightIcon,
  PersonIcon,
  WhistleIcon,
} from "@/components/ui/icons";
import { Page, PageHeader } from "@/components/ui/layout";
import { getActorWithPermission } from "@/server/auth/page-access";

export const metadata: Metadata = { title: "Admin" };

const AREAS = [
  {
    href: "/admin/contas",
    title: "Contas e permissões",
    description:
      "Criar contas, definir quem é admin, vincular jogadores, redefinir senhas e desativar acessos.",
    Icon: PersonIcon,
  },
  {
    href: "/gameplay",
    title: "Gameplay",
    description: "Iniciar, registrar partidas, corrigir e encerrar.",
    Icon: WhistleIcon,
  },
];

// Área administrativa. A página confere o papel no servidor; cada operação é
// conferida de novo pelo serviço que a executa.
export default async function AdminPage() {
  const actor = await getActorWithPermission({ action: "accounts.manage" });
  if (!actor) return <AccessDenied />;

  return (
    <Page>
      <PageHeader title="Admin" description={`Logado como ${actor.name}.`} />

      <ul className="bg-surface divide-line/40 divide-y overflow-hidden rounded-lg">
        {AREAS.map(({ href, title, description, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="hover:bg-raised/50 flex items-center gap-4 px-4 py-4 transition-colors"
            >
              <span className="bg-raised text-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-md">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{title}</span>
                <span className="text-muted block text-sm">{description}</span>
              </span>
              <ChevronRightIcon className="text-muted h-5 w-5 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
