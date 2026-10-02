import Link from "next/link";
import type { MatchResult } from "@/domain/match";
import { MATCH_TYPE_LABEL, type MatchType } from "@/domain/match-type";
import { ResultMark } from "../ui/badge";
import { LinkPending } from "../ui/link-pending";
import { FORWARD } from "../ui/transitions";

export interface MatchRowData {
  id: number;
  opponentName: string;
  matchType: MatchType;
  goalsFor: number;
  goalsAgainst: number;
  wentToPenalties: boolean;
  penaltyScoreFor: number | null;
  penaltyScoreAgainst: number | null;
  result: MatchResult;
}

// Placar no formato do clube: gols do Varejista primeiro.
export function Score({
  goalsFor,
  goalsAgainst,
  className = "",
}: {
  goalsFor: number;
  goalsAgainst: number;
  className?: string;
}) {
  return (
    <span className={`numeral relative whitespace-nowrap ${className}`}>
      {goalsFor}
      <span aria-hidden="true" className="text-muted mx-[0.2em] font-medium">
        ×
      </span>
      <span className="sr-only"> a </span>
      {goalsAgainst}
    </span>
  );
}

interface MatchRowProps {
  match: MatchRowData;
  // Linha extra sob o adversário (ex.: os números de um jogador na partida).
  detail?: React.ReactNode;
  // Ação ao lado da linha (ex.: corrigir a partida), fora do link principal.
  action?: React.ReactNode;
}

// Uma partida em lista: resultado, adversário e placar. A linha inteira leva à
// página da partida.
export function MatchRow({ match, detail, action }: MatchRowProps) {
  return (
    <li className="flex items-stretch">
      <Link
        href={`/partidas/${match.id}`}
        transitionTypes={FORWARD}
        className="hover:bg-surface active:bg-surface has-[[data-pending=true]]:bg-surface -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-3 transition-colors"
      >
        <LinkPending />
        <ResultMark
          result={match.result}
          wentToPenalties={match.wentToPenalties}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {match.opponentName}
          </span>
          <span className="text-muted flex flex-wrap gap-x-2 text-xs">
            <span>{MATCH_TYPE_LABEL[match.matchType]}</span>
            {match.wentToPenalties && (
              <span>
                Pênaltis {match.penaltyScoreFor} × {match.penaltyScoreAgainst}
              </span>
            )}
          </span>
          {detail && <span className="mt-1 block text-sm">{detail}</span>}
        </span>
        <Score
          goalsFor={match.goalsFor}
          goalsAgainst={match.goalsAgainst}
          className="text-xl"
        />
      </Link>
      {action}
    </li>
  );
}

// Lista de partidas: linhas sobre o fundo, separadas por um fio.
export function MatchRows({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-line/40 border-line/40 divide-y border-y">
      {children}
    </ul>
  );
}
