import {
  CLUB_PERIOD_LABEL,
  CLUB_PERIOD_PARAM,
  type PeriodSelection,
} from "@/server/stats/period";
import { LinkTabs } from "./tabs";

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
  const hrefFor = (periodo: string) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    query.set("periodo", periodo);
    return `${basePath}?${query}`;
  };

  const options = [
    ...selection.seasons.map((season) => ({
      param: season.slug,
      label: season.isActive ? `Temporada ${season.name}` : season.name,
    })),
    { param: CLUB_PERIOD_PARAM, label: CLUB_PERIOD_LABEL },
  ].map((option) => ({
    href: hrefFor(option.param),
    label: option.label,
    current: option.param === selection.param,
  }));

  return <LinkTabs label="Período" options={options} variant="quiet" />;
}
