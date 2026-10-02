import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EntryBackdrop } from "@/components/entry/backdrop";
import { CreateAccountForm } from "@/components/entry/create-account-form";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { BACK } from "@/components/ui/transitions";
import { getActor } from "@/server/auth/session";

export const metadata: Metadata = { title: "Criar conta" };

// Cadastro por convite (ADR 0015). A página é aberta, mas nada acontece sem um
// código válido: o servidor confere o convite em cada passo.
export default async function CreateAccountPage() {
  if (await getActor()) redirect("/");

  return (
    <EntryBackdrop quiet>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 py-5">
        <Link
          href="/entrar"
          transitionTypes={BACK}
          className="text-soft hover:text-fg -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start px-1 text-sm font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar para a entrada
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center pt-4 pb-10">
          <CreateAccountForm />
        </div>
      </div>
    </EntryBackdrop>
  );
}
