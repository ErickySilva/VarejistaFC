import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-28 text-center">
      <p aria-hidden="true" className="numeral text-raised text-8xl">
        404
      </p>
      <div>
        <h1 className="display text-2xl">Página não encontrada</h1>
        <p className="text-muted mt-1.5 text-sm">
          O endereço pode ter mudado ou a partida foi excluída.
        </p>
      </div>
      <ButtonLink href="/" variant="primary">
        Voltar ao início
      </ButtonLink>
    </main>
  );
}
