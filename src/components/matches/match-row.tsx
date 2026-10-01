import Link from "next/link";
import type { MatchResult } from "@/domain/match";
import { MATCH_TYPE_LABEL, type MatchType } from "@/domain/match-type";
import { RESULT_LABEL, RESULT_SHORT } from "@/lib/format";

const RESULT_CLASS: Record<MatchResult, string> = {
  W: "bg-green-600/15 text-green-700 dark:text-green-400",
  D: "bg-foreground/10",
  L: "bg-red-600/15 text-red-700 dark:text-red-400",
};

// Resultado da partida. O texto acompanha a cor: a cor sozinha não informa.
export function ResultBadge({
  result,
  wentToPenalties,
  short = false,
}: {
  result: MatchResult;
  wentToPenalties: boolean;
  short?: boolean;
}) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-medium whitespace-nowrap ${RESULT_CLASS[result]}`}
      title={RESULT_LABEL[result]}
    >
      {short ? RESULT_SHORT[result] : RESULT_LABEL[result]}
      {wentToPenalties && " (pên.)"}
    </span>
  );
}

export function MatchTypeBadge({ matchType }: { matchType: MatchType }) {
  return (
    <span className="border-foreground/20 rounded border px-2 py-0.5 text-xs whitespace-nowrap">
      {MATCH_TYPE_LABEL[matchType]}
    </span>
  );
}

interface MatchRowProps {
  match: {
    id: number;
    opponentName: string;
    matchType: MatchType;
    goalsFor: number;
    goalsAgainst: number;
    wentToPenalties: boolean;
    penaltyScoreFor: number | null;
    penaltyScoreAgainst: number | null;
    result: MatchResult;
  };
  // Linha extra sob o placar (ex.: os números de um jogador na partida).
  detail?: React.ReactNode;
}

// Uma partida em lista, levando à página permanente dela.
export function MatchRow({ match, detail }: MatchRowProps) {
  return (
    <li>
      <Link
        href={`/partidas/${match.id}`}
        className="border-foreground/15 flex items-center justify-between gap-3 rounded border p-3"
      >
        <span className="min-w-0">
          <span className="block font-medium">
            Varejista FC{" "}
            <span className="tabular-nums">
              {match.goalsFor} × {match.goalsAgainst}
            </span>{" "}
            {match.opponentName}
          </span>
          {match.wentToPenalties && (
            <span className="block text-xs opacity-70">
              Pênaltis: {match.penaltyScoreFor} × {match.penaltyScoreAgainst}
            </span>
          )}
          {detail && <span className="block text-sm">{detail}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <ResultBadge
            result={match.result}
            wentToPenalties={match.wentToPenalties}
          />
          <MatchTypeBadge matchType={match.matchType} />
        </span>
      </Link>
    </li>
  );
}
