import Link from "next/link";
import { getActor } from "@/server/auth/session";

const linkClass = "flex min-h-11 items-center px-2 text-sm";

// Navegação comum a todas as páginas. As páginas de estatística são abertas a
// visitantes; "Entrar" leva ao login e, logado, vira o atalho para a conta.
export async function SiteHeader() {
  const actor = await getActor();

  return (
    <header className="border-foreground/15 border-b">
      <nav
        aria-label="Principal"
        className="mx-auto flex w-full max-w-xl items-center justify-between px-2"
      >
        <div className="flex items-center">
          <Link href="/" className={`${linkClass} font-semibold`}>
            Varejista FC
          </Link>
          <Link href="/ranking" className={linkClass}>
            Ranking
          </Link>
          <Link href="/partidas" className={linkClass}>
            Partidas
          </Link>
        </div>
        <Link href={actor ? "/conta" : "/login"} className={linkClass}>
          {actor ? "Conta" : "Entrar"}
        </Link>
      </nav>
    </header>
  );
}
