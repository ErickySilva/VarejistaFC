import type { Metadata } from "next";
import Link from "next/link";
import { MatchRow } from "@/components/matches/match-row";
import { formatReferenceDate } from "@/domain/reference-date";
import { plural } from "@/lib/format";
import {
  countMatches,
  listMatches,
  type MatchSummary,
} from "@/server/matches/queries";

export const metadata: Metadata = { title: "Partidas" };

const PAGE_SIZE = 30;

// Agrupa as partidas pela gameplay a que pertencem, mantendo a ordem.
function groupByNight(matches: MatchSummary[]) {
  const groups: {
    nightId: number;
    referenceDate: string;
    matches: MatchSummary[];
  }[] = [];
  for (const match of matches) {
    const last = groups.at(-1);
    if (last && last.nightId === match.nightId) last.matches.push(match);
    else {
      groups.push({
        nightId: match.nightId,
        referenceDate: match.referenceDate,
        matches: [match],
      });
    }
  }
  return groups;
}

export default async function MatchesPage({
  searchParams,
}: PageProps<"/partidas">) {
  const { pagina } = await searchParams;
  const requested = Number(typeof pagina === "string" ? pagina : 1);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const [matches, total] = await Promise.all([
    listMatches({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countMatches(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Partidas</h1>
        <p className="text-sm opacity-70">
          {plural(total, "partida registrada", "partidas registradas")}
        </p>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm opacity-70">
          {total === 0
            ? "Nenhuma partida registrada ainda."
            : "Não há partidas nesta página."}
        </p>
      ) : (
        groupByNight(matches).map((group) => (
          <section key={group.nightId}>
            <h2 className="mb-2 text-sm font-semibold">
              Gameplay de {formatReferenceDate(group.referenceDate)}
            </h2>
            <ul className="flex flex-col gap-2">
              {group.matches.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </ul>
          </section>
        ))
      )}

      {pages > 1 && (
        <nav
          aria-label="Páginas"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link href={`/partidas?pagina=${page - 1}`} className="underline">
              Mais recentes
            </Link>
          ) : (
            <span />
          )}
          <span className="opacity-70">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={`/partidas?pagina=${page + 1}`} className="underline">
              Mais antigas
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
