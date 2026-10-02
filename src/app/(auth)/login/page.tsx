import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EntryBackdrop } from "@/components/entry/backdrop";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { BACK } from "@/components/ui/transitions";
import { getActor } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar com e-mail" };

export default async function LoginPage() {
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
          Voltar
        </Link>
        <div className="animate-rise flex flex-1 flex-col justify-center gap-6 pb-10">
          <div>
            <h1 className="display text-3xl">Entrar com e-mail</h1>
            <p className="text-soft mt-1.5 text-sm">
              Para contas que não estão vinculadas a um jogador.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </EntryBackdrop>
  );
}
