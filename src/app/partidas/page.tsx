import type { Metadata } from "next";
import { MatchRow, MatchRows } from "@/components/matches/match-row";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Page, PageHeader, Section } from "@/components/ui/layout";
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
    <Page>
      <PageHeader
        title="Partidas"
        description={plural(
          total,
          "partida registrada",
          "partidas registradas",
        )}
      />

      {matches.length === 0 ? (
        <EmptyState
          title={
            total === 0
              ? "Nenhuma partida registrada ainda"
              : "Não há partidas nesta página"
          }
        >
          {total === 0
            ? "As partidas aparecem aqui assim que a primeira gameplay for registrada."
            : undefined}
        </EmptyState>
      ) : (
        groupByNight(matches).map((group, index) => (
          <Section
            key={group.nightId}
            title={`Gameplay de ${formatReferenceDate(group.referenceDate)}`}
            aside={plural(group.matches.length, "partida", "partidas")}
            className="animate-rise stagger"
            style={{ "--i": Math.min(index, 5) } as React.CSSProperties}
          >
            <MatchRows>
              {group.matches.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </MatchRows>
          </Section>
        ))
      )}

      {pages > 1 && (
        <nav
          aria-label="Páginas"
          className="flex items-center justify-between gap-3 text-sm"
        >
          {page > 1 ? (
            <ButtonLink href={`/partidas?pagina=${page - 1}`}>
              Mais recentes
            </ButtonLink>
          ) : (
            <span />
          )}
          <span className="text-muted">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <ButtonLink href={`/partidas?pagina=${page + 1}`}>
              Mais antigas
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      )}
    </Page>
  );
}
