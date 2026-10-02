import type { NightSummary } from "@/domain/night";
import { formatReferenceDate } from "@/domain/reference-date";
import type { NightDetail } from "@/server/nights/queries";
import { FlashValue } from "../ui/flash-value";
import { DrawIcon, LossIcon, WinIcon } from "../ui/icons";
import { Elapsed } from "./elapsed";
import { MatchStrip, NightPlayers, type PlayerLookup } from "./night-view";

interface LivePanelProps {
  night: NightDetail;
  summary: NightSummary;
  lookup: PlayerLookup;
  // Botões de operação e avisos, para quem pode operar a gameplay.
  children?: React.ReactNode;
}

function Tally({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      <FlashValue value={value} className="numeral text-base" />
      <span className="sr-only"> {label}</span>
    </span>
  );
}

// O "modo ao vivo": a gameplay aberta ocupa a faixa de cima da tela, de ponta
// a ponta no celular. Tem o sinal de ao vivo, o relógio correndo, a fita de
// partidas e os números de cada jogador na noite. É o elemento mais forte da
// tela enquanto a sessão está em andamento.
export function LivePanel({
  night,
  summary,
  lookup,
  children,
}: LivePanelProps) {
  const { main, rush } = summary;

  return (
    <section
      aria-labelledby="gameplay-ao-vivo"
      className="bg-surface border-accent -mx-4 -mt-5 flex flex-col gap-5 border-t-2 px-4 pt-4 pb-5 sm:mx-0 sm:mt-0 sm:rounded-xl sm:px-6"
    >
      <div>
        <p
          id="gameplay-ao-vivo"
          className="text-accent flex items-center gap-2 text-xs font-bold tracking-[0.12em]"
        >
          <span
            aria-hidden="true"
            className="bg-accent animate-live h-2 w-2 rounded-full"
          />
          GAMEPLAY EM ANDAMENTO
        </p>
        <Elapsed
          since={night.startedAt.toISOString()}
          className="mt-1 block text-6xl sm:text-7xl"
        />
        <div className="text-soft mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <FlashValue
              value={summary.matchCount}
              className="text-fg font-bold"
            />{" "}
            {summary.matchCount === 1 ? "partida" : "partidas"} desde{" "}
            {formatReferenceDate(night.referenceDate).slice(0, 5)}
          </span>
          {main.matchCount > 0 && (
            <span className="flex items-center gap-3">
              <Tally
                icon={<WinIcon className="text-win h-4 w-4" />}
                value={main.wins}
                label="vitórias"
              />
              <Tally
                icon={<DrawIcon className="text-draw h-4 w-4" />}
                value={main.draws}
                label="empates"
              />
              <Tally
                icon={<LossIcon className="text-loss h-4 w-4" />}
                value={main.losses}
                label="derrotas"
              />
            </span>
          )}
        </div>
      </div>

      <MatchStrip matches={night.matches} />

      {main.players.length > 0 && <NightPlayers scope={main} lookup={lookup} />}

      {rush.players.length > 0 && (
        <div>
          <h3 className="text-muted mb-1 text-xs font-semibold">
            No Torneio de Rush, fora das estatísticas principais
          </h3>
          <NightPlayers scope={rush} lookup={lookup} />
        </div>
      )}

      {children}
    </section>
  );
}
