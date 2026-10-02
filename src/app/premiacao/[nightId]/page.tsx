import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Ceremony } from "@/components/awards/ceremony";
import type { AwardWinner } from "@/components/awards/types";
import { awardUnit, formatAwardValue } from "@/components/gameplay/night-view";
import {
  AWARD_LABEL,
  AWARD_TYPES,
  summarizeNight,
  type NightSummary,
} from "@/domain/night";
import { formatReferenceDate } from "@/domain/reference-date";
import { formatRating } from "@/lib/format";
import {
  getNightAwards,
  getNightDetail,
  toDomainNight,
  type NightAwardDetail,
} from "@/server/nights/queries";
import { getPlayerPhotos } from "@/server/players/directory";

export const metadata: Metadata = { title: "Premiação da noite" };

// Números de apoio de cada prêmio, tirados do resumo da própria noite. Nada é
// recalculado aqui: os vencedores e os valores são os gravados no
// encerramento.
function supportingStats(
  award: NightAwardDetail,
  summary: NightSummary,
): AwardWinner["stats"] {
  const scope = award.award === "rush_mvp" ? summary.rush : summary.main;
  const player = scope.players.find((row) => row.playerId === award.playerId);
  if (!player) return [];

  const matches = { label: "jogos", value: String(player.matches) };
  const goals = { label: "gols", value: String(player.goals) };
  const assists = { label: "assist.", value: String(player.assists) };

  if (award.award === "top_scorer") {
    return [
      matches,
      assists,
      { label: "média VFC", value: formatRating(player.averageRating, 2) },
    ];
  }
  if (award.award === "top_assists") {
    return [
      matches,
      goals,
      { label: "média VFC", value: formatRating(player.averageRating, 2) },
    ];
  }

  // Craque da Noite e Destaque do Rush: G/A e, se jogou no gol, as defesas.
  const stats = [goals, assists, matches];
  const goalkeeper = scope.goalkeepers.find(
    (row) => row.playerId === award.playerId,
  );
  if (goalkeeper) {
    stats.push({ label: "defesas", value: String(goalkeeper.saves) });
  }
  return stats;
}

export default async function CeremonyPage({
  params,
}: PageProps<"/premiacao/[nightId]">) {
  const { nightId } = await params;
  const id = Number(nightId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const night = await getNightDetail(id);
  if (!night) notFound();
  // A premiação só existe depois de a gameplay ser encerrada.
  if (night.status !== "closed") redirect("/");

  const awards = await getNightAwards(night.id);
  const photos = await getPlayerPhotos(awards.map((award) => award.playerId));
  const summary = summarizeNight(toDomainNight(night));
  const shirtNumbers = new Map(
    night.matches.flatMap((match) =>
      match.participations.map(
        (participation) =>
          [participation.playerId, participation.shirtNumber] as const,
      ),
    ),
  );

  // Ordem da cerimônia: Artilheiro, Assistente, Craque da Noite e Rush.
  const winners: AwardWinner[] = AWARD_TYPES.flatMap((type) =>
    awards
      .filter((award) => award.award === type)
      .map((award) => ({
        award: award.award,
        label: AWARD_LABEL[award.award],
        name: award.playerName,
        shirtNumber: shirtNumbers.get(award.playerId) ?? 0,
        photoUrl: photos.get(award.playerId)?.photoUrl ?? null,
        value: formatAwardValue(award.award, award.value),
        unit: awardUnit(award.award, award.value),
        countTo: Number.isInteger(award.value) ? award.value : undefined,
        stats: supportingStats(award, summary),
      })),
  );

  return (
    <Ceremony
      night={{
        id: night.id,
        date: formatReferenceDate(night.referenceDate),
        summary: night.summary,
        score: {
          matches: summary.main.matchCount,
          wins: summary.main.wins,
          draws: summary.main.draws,
          losses: summary.main.losses,
          goalsFor: summary.main.goalsFor,
          goalsAgainst: summary.main.goalsAgainst,
        },
      }}
      winners={winners}
    />
  );
}
