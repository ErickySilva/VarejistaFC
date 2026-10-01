import Link from "next/link";
import type { NightSummary } from "@/domain/night";
import type { AwardType } from "@/domain/night";
import { formatReferenceDate } from "@/domain/reference-date";
import type { MatchDetail, NightDetail } from "@/server/nights/queries";
import type { OverallRankingRow } from "@/server/players/queries";

// Componentes de exibição da gameplay. Não buscam dados nem calculam nada:
// recebem o que a página já carregou.

const RESULT_LABEL = { W: "Vitória", D: "Empate", L: "Derrota" };
const RESULT_CLASS = {
  W: "bg-green-600/15 text-green-700 dark:text-green-400",
  D: "bg-foreground/10",
  L: "bg-red-600/15 text-red-700 dark:text-red-400",
};

export const AWARD_LABEL: Record<AwardType, string> = {
  top_scorer: "Artilheiro",
  top_assists: "Líder de assistências",
  top_ga: "Líder de G/A",
  mvp: "Craque da noite",
  best_goalkeeper: "Destaque do goleiro",
};

export function formatRating(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function formatAwardValue(award: AwardType, value: number): string {
  if (award === "mvp" || award === "best_goalkeeper") {
    return `média ${formatRating(value, 2)}`;
  }
  return String(value);
}

const cellClass = "px-2 py-2 text-right tabular-nums";
const headClass = "px-2 py-2 text-right font-medium";

export function NightHeader({
  night,
  summary,
}: {
  night: NightDetail;
  summary: NightSummary;
}) {
  return (
    <header className="flex flex-col gap-1">
      <p className="text-sm opacity-70">
        {night.status === "open"
          ? "Gameplay em andamento"
          : "Gameplay encerrada"}
      </p>
      <h2 className="text-xl font-semibold tracking-tight">
        {formatReferenceDate(night.referenceDate)}
      </h2>
      <p className="text-sm tabular-nums">
        {summary.matchCount} {summary.matchCount === 1 ? "partida" : "partidas"}{" "}
        · {summary.wins}V {summary.draws}E {summary.losses}D · gols{" "}
        {summary.goalsFor}–{summary.goalsAgainst}
      </p>
    </header>
  );
}

function MatchCard({
  match,
  order,
  editable,
}: {
  match: MatchDetail;
  order: number;
  editable: boolean;
}) {
  return (
    <li className="border-foreground/15 rounded border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs opacity-70">Partida {order}</p>
          <p className="font-medium">
            Varejista FC{" "}
            <span className="tabular-nums">
              {match.goalsFor} × {match.goalsAgainst}
            </span>{" "}
            {match.opponentName}
          </p>
          {match.wentToPenalties && (
            <p className="text-xs opacity-70">
              Decidida nos pênaltis: {match.penaltyScoreFor} ×{" "}
              {match.penaltyScoreAgainst}
            </p>
          )}
        </div>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${RESULT_CLASS[match.result]}`}
        >
          {RESULT_LABEL[match.result]}
          {match.wentToPenalties && " (pên.)"}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-1 text-sm">
        {match.participations.map((participation) => (
          <li
            key={participation.playerId}
            className="flex justify-between gap-3"
          >
            <span>
              {participation.playerName}{" "}
              <span className="opacity-60">{participation.position}</span>
            </span>
            <span className="tabular-nums">
              {participation.goals}G {participation.assists}A
              {participation.saves !== null && ` · ${participation.saves} def`}
              {participation.penaltiesSaved
                ? ` (${participation.penaltiesSaved} pên.)`
                : ""}{" "}
              · <strong>{formatRating(participation.rating)}</strong>
            </span>
          </li>
        ))}
      </ul>

      {editable && (
        <Link
          href={`/gameplay/partida/${match.id}`}
          className="mt-3 inline-flex min-h-11 items-center text-sm underline"
        >
          Corrigir ou excluir
        </Link>
      )}
    </li>
  );
}

export function MatchList({
  matches,
  editable,
}: {
  matches: MatchDetail[];
  editable: boolean;
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm opacity-70">Nenhuma partida registrada ainda.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {matches.map((match, index) => (
        <MatchCard
          key={match.id}
          match={match}
          order={index + 1}
          editable={editable}
        />
      ))}
    </ol>
  );
}

export function NightStandings({
  summary,
  playerName,
}: {
  summary: NightSummary;
  playerName: (playerId: number) => string;
}) {
  if (summary.players.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 font-semibold">Estatísticas da noite</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-foreground/15 border-b">
              <th className="px-2 py-2 text-left font-medium">Jogador</th>
              <th className={headClass}>J</th>
              <th className={headClass}>G</th>
              <th className={headClass}>A</th>
              <th className={headClass}>G/A</th>
              <th className={headClass}>Média</th>
            </tr>
          </thead>
          <tbody>
            {summary.players.map((player) => (
              <tr
                key={player.playerId}
                className="border-foreground/10 border-b"
              >
                <td className="px-2 py-2">{playerName(player.playerId)}</td>
                <td className={cellClass}>{player.matches}</td>
                <td className={cellClass}>{player.goals}</td>
                <td className={cellClass}>{player.assists}</td>
                <td className={cellClass}>{player.goalContributions}</td>
                <td className={cellClass}>
                  {formatRating(player.averageRating, 2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export interface AwardLine {
  award: AwardType;
  playerName: string;
  value: number;
}

export function AwardList({
  title,
  awards,
}: {
  title: string;
  awards: AwardLine[];
}) {
  if (awards.length === 0) return null;

  const byAward = new Map<AwardType, AwardLine[]>();
  for (const award of awards) {
    byAward.set(award.award, [...(byAward.get(award.award) ?? []), award]);
  }

  return (
    <section>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {[...byAward].map(([award, winners]) => (
          <div key={award} className="contents">
            <dt className="opacity-70">{AWARD_LABEL[award]}</dt>
            <dd>
              {winners.map((winner) => winner.playerName).join(", ")} (
              {formatAwardValue(award, winners[0].value)})
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function OverallRanking({ ranking }: { ranking: OverallRankingRow[] }) {
  if (ranking.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 font-semibold">Ranking geral</h3>
      <p className="mb-2 text-xs opacity-70">
        Sistema + histórico anterior ao sistema.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-foreground/15 border-b">
              <th className="px-2 py-2 text-left font-medium">Jogador</th>
              <th className={headClass}>J</th>
              <th className={headClass}>G</th>
              <th className={headClass}>A</th>
              <th className={headClass}>G/A</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => (
              <tr key={row.playerId} className="border-foreground/10 border-b">
                <td className="px-2 py-2">
                  #{row.shirtNumber} {row.playerName}
                </td>
                <td className={cellClass}>{row.matches}</td>
                <td className={cellClass}>{row.goals}</td>
                <td className={cellClass}>{row.assists}</td>
                <td className={cellClass}>{row.goalContributions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
