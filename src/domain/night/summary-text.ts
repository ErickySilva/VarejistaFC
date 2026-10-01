import type { NightSummary } from "./summary";
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

const AWARD_LABEL: Record<AwardType, string> = {
  top_scorer: "Artilheiro",
  top_assists: "Líder de assistências",
  top_ga: "Líder de G/A",
  mvp: "Craque da noite",
  best_goalkeeper: "Destaque do goleiro",
};

function awardValue(award: NightAward): string {
  switch (award.award) {
    case "top_scorer":
      return plural(award.value, "gol", "gols");
    case "top_assists":
      return plural(award.value, "assistência", "assistências");
    case "top_ga":
      return `${award.value} G/A`;
    case "mvp":
    case "best_goalkeeper":
      return `média ${formatAverage(award.value)}`;
  }
}

export function renderNightSummary(
  summary: NightSummary,
  playerName: (playerId: number) => string,
): string {
  const sentences: string[] = [];

  const record = [
    plural(summary.wins, "vitória", "vitórias"),
    plural(summary.draws, "empate", "empates"),
    plural(summary.losses, "derrota", "derrotas"),
  ];
  sentences.push(
    `${plural(summary.matchCount, "partida", "partidas")}: ${record[0]}, ${record[1]} e ${record[2]}.`,
  );

  const penalties: string[] = [];
  if (summary.penaltyWins > 0) {
    penalties.push(plural(summary.penaltyWins, "vitória", "vitórias"));
  }
  if (summary.penaltyLosses > 0) {
    penalties.push(plural(summary.penaltyLosses, "derrota", "derrotas"));
  }
  if (penalties.length > 0) {
    sentences.push(`Nos pênaltis: ${penalties.join(" e ")}.`);
  }

  sentences.push(
    `${plural(summary.goalsFor, "gol marcado", "gols marcados")} e ${plural(summary.goalsAgainst, "sofrido", "sofridos")}.`,
  );

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
