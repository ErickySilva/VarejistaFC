import { Page, Skeleton } from "./layout";

// Esqueletos de carregamento. Repetem o desenho da tela que está chegando
// (título, destaque, linhas), para o conteúdo entrar sem a página pular.

function Rows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  );
}

function Status() {
  return (
    <p role="status" className="sr-only">
      Carregando
    </p>
  );
}

// Título e uma lista: partidas, admin, gameplay.
export function ListSkeleton() {
  return (
    <Page>
      <Status />
      <Skeleton className="h-10 w-2/3" />
      <Rows count={5} />
    </Page>
  );
}

// Duas colunas no desktop: início e perfil.
export function WideSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <Page width="wide">
      <Status />
      {!hero && <Skeleton className="h-12 w-2/3 sm:w-1/3" />}
      <div className="grid gap-8 lg:grid-cols-[5fr_7fr] lg:gap-10">
        <Skeleton className={hero ? "h-96 rounded-xl!" : "h-56 rounded-xl!"} />
        <div className="flex flex-col gap-8">
          <Skeleton className="h-24" />
          <Rows count={4} />
        </div>
      </div>
    </Page>
  );
}

// Placar e participantes: página da partida.
export function MatchSkeleton() {
  return (
    <Page>
      <Status />
      <Skeleton className="h-64 rounded-xl!" />
      <Rows count={4} />
    </Page>
  );
}
