import Link from "next/link";
import {
  CLUB_PERIOD_LABEL,
  CLUB_PERIOD_PARAM,
  type PeriodSelection,
} from "@/server/stats/period";

interface PeriodSwitcherProps {
  selection: PeriodSelection;
  // Caminho da página e demais parâmetros que devem ser mantidos na troca.
  basePath: string;
  params?: Record<string, string | undefined>;
}

// Alterna entre a temporada (a atual vem primeiro) e "desde a criação do
// clube". A escolha vai no parâmetro `periodo` da URL.
export function PeriodSwitcher({
  selection,
  basePath,
  params = {},
}: PeriodSwitcherProps) {
  const options = [
    ...selection.seasons.map((season) => ({
      param: season.slug,
      label: season.isActive ? `Temporada ${season.name}` : season.name,
    })),
    { param: CLUB_PERIOD_PARAM, label: CLUB_PERIOD_LABEL },
  ];

  const hrefFor = (periodo: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    query.set("periodo", periodo);
    return `${basePath}?${query}`;
  };

  return (
    <nav aria-label="Período" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const current = option.param === selection.param;
        return (
          <Link
            key={option.param}
            href={hrefFor(option.param)}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-full border px-3 text-sm ${
              current
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-foreground/20"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
