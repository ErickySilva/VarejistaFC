export const CLUB_TIME_ZONE = "America/Sao_Paulo";

// Data (AAAA-MM-DD) de um instante no fuso do clube. É a data de referência de
// uma noite que começa naquele instante (ADR 0007). A noite é uma sessão: se
// atravessar a meia-noite, continua com a data em que começou.
export function referenceDateFor(
  instant: Date,
  timeZone: string = CLUB_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// "2026-10-02" → "02/10/2026", sem passar por fuso horário.
export function formatReferenceDate(referenceDate: string): string {
  const [year, month, day] = referenceDate.split("-");
  return `${day}/${month}/${year}`;
}
