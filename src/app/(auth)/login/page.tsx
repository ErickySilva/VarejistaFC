import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar com e-mail" };

export default async function LoginPage() {
  if (await getActor()) redirect("/");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/entrar" className="text-sm underline">
          Voltar
        </Link>
        <h1 className="mt-2 mb-1 text-2xl font-semibold tracking-tight">
          Entrar com e-mail
        </h1>
        <p className="mb-6 text-sm opacity-70">
          Para contas que não estão vinculadas a um jogador.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
