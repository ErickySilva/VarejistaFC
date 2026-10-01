import type { MatchResult } from "@/domain/match";
import { CLUB_TIME_ZONE } from "@/domain/reference-date";

// Formatação para exibição, em um lugar só, para que o redesign mude a
// apresentação sem tocar nas páginas.

export const UNAVAILABLE = "—";

export function formatRating(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

// Média que pode não existir (ex.: histórico sem Nota VFC).
export function formatAverage(value: number | null, digits = 2): string {
  return value === null ? UNAVAILABLE : formatRating(value, digits);
}

export const RESULT_LABEL: Record<MatchResult, string> = {
  W: "Vitória",
  D: "Empate",
  L: "Derrota",
};

export const RESULT_SHORT: Record<MatchResult, string> = {
  W: "V",
  D: "E",
  L: "D",
};

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CLUB_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// "02/10/2026 20:15", no horário do clube.
export function formatDateTime(instant: Date): string {
  return dateTimeFormat.format(instant).replace(",", "");
}

export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
