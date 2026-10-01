import type { NightScopeSummary, NightSummary } from "./summary";
import type { AwardType, NightAward } from "./types";

// Texto do resumo da noite, gravado em `nights.summary` no encerramento. É
// montado a partir do resumo estruturado, sem nenhum cálculo novo.

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function formatAverage(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

export const AWARD_LABEL: Record<AwardType, string> = {
  top_scorer: "Artilheiro",
  top_assists: "Assistente",
  mvp: "Craque da Noite",
  rush_mvp: "Destaque do Rush",
};

function awardValue(award: NightAward): string {
  switch (award.award) {
    case "top_scorer":
      return plural(award.value, "gol", "gols");
    case "top_assists":
      return plural(award.value, "assistência", "assistências");
    case "mvp":
    case "rush_mvp":
      return `média ${formatAverage(award.value)}`;
  }
}

function scopeSentences(label: string, scope: NightScopeSummary): string[] {
  const sentences = [
    `${label}${plural(scope.matchCount, "partida", "partidas")}: ${plural(scope.wins, "vitória", "vitórias")}, ${plural(scope.draws, "empate", "empates")} e ${plural(scope.losses, "derrota", "derrotas")}.`,
  ];

  const penalties: string[] = [];
  if (scope.penaltyWins > 0) {
    penalties.push(plural(scope.penaltyWins, "vitória", "vitórias"));
  }
  if (scope.penaltyLosses > 0) {
    penalties.push(plural(scope.penaltyLosses, "derrota", "derrotas"));
  }
  if (penalties.length > 0) {
    sentences.push(`Nos pênaltis: ${penalties.join(" e ")}.`);
  }

  sentences.push(
    `${plural(scope.goalsFor, "gol marcado", "gols marcados")} e ${plural(scope.goalsAgainst, "sofrido", "sofridos")}.`,
  );
  return sentences;
}

export function renderNightSummary(
  summary: NightSummary,
  playerName: (playerId: number) => string,
): string {
  const sentences: string[] = [];

  if (summary.main.matchCount > 0) {
    sentences.push(...scopeSentences("", summary.main));
  }
  if (summary.rush.matchCount > 0) {
    sentences.push(...scopeSentences("Torneio de Rush, ", summary.rush));
  }

  // Os prêmios já vêm agrupados por tipo; co-vencedores dividem a frase.
  const byAward = new Map<AwardType, NightAward[]>();
  for (const award of summary.awards) {
    byAward.set(award.award, [...(byAward.get(award.award) ?? []), award]);
  }
  for (const [type, winners] of byAward) {
    const names = joinNames(winners.map((award) => playerName(award.playerId)));
    sentences.push(
      `${AWARD_LABEL[type]}: ${names} (${awardValue(winners[0])}).`,
    );
  }

  return sentences.join(" ");
}
