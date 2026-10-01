import "server-only";
import { listSeasons, type Season } from "../seasons/service";
import type { StatsPeriod } from "./queries";

// Período escolhido nas telas de estatística. A visão padrão é a temporada
// atual; a alternativa é "desde a criação do clube" ou uma temporada do
// histórico. O valor vem do parâmetro `periodo` da URL.

export const CLUB_PERIOD_PARAM = "clube";
export const CLUB_PERIOD_LABEL = "Desde a criação do Clube";

export interface PeriodSelection {
  period: StatsPeriod;
  // Valor do parâmetro `periodo` que reproduz esta seleção.
  param: string;
  label: string;
  // null quando a visão é "desde a criação do clube".
  season: Season | null;
  seasons: Season[];
}

export async function resolvePeriod(
  param: string | undefined,
): Promise<PeriodSelection> {
  const seasons = await listSeasons();
  const club: PeriodSelection = {
    period: { kind: "club" },
    param: CLUB_PERIOD_PARAM,
    label: CLUB_PERIOD_LABEL,
    season: null,
    seasons,
  };
  if (param === CLUB_PERIOD_PARAM) return club;

  // Temporada pedida; se não existir (ou nada foi pedido), a temporada ativa.
  const season =
    seasons.find((candidate) => candidate.slug === param) ??
    seasons.find((candidate) => candidate.isActive);
  if (!season) return club;

  return {
    period: { kind: "season", seasonId: season.id },
    param: season.slug,
    label: season.name,
    season,
    seasons,
  };
}
