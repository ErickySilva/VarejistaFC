import type { MatchResult } from "@/domain/match";
import { MATCH_TYPE_LABEL, type MatchType } from "@/domain/match-type";
import { RESULT_LABEL, RESULT_SHORT } from "@/lib/format";
import { DrawIcon, LossIcon, WinIcon } from "./icons";

const TONES = {
  neutral: "bg-raised text-soft",
  accent: "bg-accent text-accent-ink",
  win: "bg-win/15 text-win",
  loss: "bg-loss/15 text-loss",
  outline: "text-muted ring-1 ring-line ring-inset",
};

interface BadgeProps {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}

// Rótulo curto de estado ou categoria.
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-semibold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// Faixa do escudo: reservada para prêmio e para o número da camisa na entrada.
// Não marca posição de ranking.
export function Ribbon({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`clip-ribbon bg-accent text-accent-ink inline-flex h-6 items-center px-3.5 text-xs font-bold whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function MatchTypeBadge({ matchType }: { matchType: MatchType }) {
  return (
    <Badge tone={matchType === "rush" ? "neutral" : "outline"}>
      {MATCH_TYPE_LABEL[matchType]}
    </Badge>
  );
}

// Resultado da partida. Além da cor, cada resultado tem ícone e letra
// próprios: vitória (seta para cima), empate (igual) e derrota (seta para
// baixo).
const RESULT_STYLE: Record<MatchResult, { box: string; Icon: typeof WinIcon }> =
  {
    W: { box: "bg-win text-win-ink", Icon: WinIcon },
    D: {
      box: "bg-raised text-soft ring-1 ring-line ring-inset",
      Icon: DrawIcon,
    },
    L: { box: "bg-loss text-loss-ink", Icon: LossIcon },
  };

interface ResultMarkProps {
  result: MatchResult;
  wentToPenalties?: boolean;
  // "tile": quadrado com a letra, para listas. "label": com o nome por extenso.
  variant?: "tile" | "label";
  className?: string;
}

export function ResultMark({
  result,
  wentToPenalties = false,
  variant = "tile",
  className = "",
}: ResultMarkProps) {
  const { box, Icon } = RESULT_STYLE[result];
  const label = `${RESULT_LABEL[result]}${wentToPenalties ? " nos pênaltis" : ""}`;

  if (variant === "label") {
    return (
      <span
        className={`inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-bold ${box} ${className}`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </span>
    );
  }

  return (
    <span
      title={label}
      className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-sm font-extrabold ${box} ${className}`}
    >
      <span aria-hidden="true">{RESULT_SHORT[result]}</span>
      <span className="sr-only">{label}</span>
      {wentToPenalties && (
        <span
          aria-hidden="true"
          className="bg-bg text-fg absolute -right-1.5 -bottom-1.5 rounded-sm px-1 text-[0.6rem] leading-4 font-bold"
        >
          P
        </span>
      )}
    </span>
  );
}
