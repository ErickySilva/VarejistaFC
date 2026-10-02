import { ButtonLink } from "./ui/button";
import { ShieldIcon } from "./ui/icons";

export function AccessDenied() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-28 text-center">
      <span className="bg-surface text-muted flex h-14 w-14 items-center justify-center rounded-lg">
        <ShieldIcon className="h-7 w-7" />
      </span>
      <div>
        <h1 className="display text-2xl">Acesso restrito</h1>
        <p className="text-muted mt-1.5 text-sm">
          Esta área é exclusiva de administradores.
        </p>
      </div>
      <ButtonLink href="/conta">Voltar para a minha conta</ButtonLink>
    </main>
  );
}
