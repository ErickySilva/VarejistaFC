import Link from "next/link";

export function AccessDenied() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Acesso restrito</h1>
      <p className="text-sm opacity-70">
        Esta área é exclusiva de administradores.
      </p>
      <Link href="/conta" className="text-sm underline">
        Voltar para a minha conta
      </Link>
    </main>
  );
}
