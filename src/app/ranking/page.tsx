import type { Metadata } from "next";
import Link from "next/link";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import {
  hasGoalkeeperStats,
  RANKING_TAB_LABEL,
  RANKING_TABS,
  rankPlayers,
  type RankingTab,
} from "@/domain/ranking";
import { formatAverage } from "@/lib/format";
import { resolvePeriod } from "@/server/stats/period";
import { getPlayerStats, type PlayerStats } from "@/server/stats/queries";

export const metadata: Metadata = { title: "Ranking" };

const cell = "px-2 py-2 text-right tabular-nums";
const head = "px-2 py-2 text-right font-medium";

interface Column {
  label: string;
  title?: string;
  value: (player: PlayerStats) => string | number;
}

const matches: Column = { label: "J", title: "Jogos", value: (p) => p.matches };
const goals: Column = { label: "G", title: "Gols", value: (p) => p.goals };
const assists: Column = {
  label: "A",
  title: "Assistências",
  value: (p) => p.assists,
};
const goalContributions: Column = {
  label: "G/A",
  value: (p) => p.goalContributions,
};
const rating: Column = {
  label: "VFC",
  title: "Média da Nota VFC",
  value: (p) => formatAverage(p.averageRating),
};
const rated: Column = {
  label: "Aval.",
  title: "Partidas avaliadas",
  value: (p) => p.ratedMatches,
};

// As colunas de goleiro só existem na aba Goleiros.
const COLUMNS: Record<RankingTab, Column[]> = {
  geral: [matches, goals, assists, goalContributions, rating],
  gols: [matches, goals],
  assistencias: [matches, assists],
  ga: [matches, goalContributions],
  nota: [rated, rating],
  goleiros: [
    {
      label: "J",
      title: "Partidas como goleiro",
      value: (p) => p.goalkeeper.matches,
    },
    {
      label: "VFC",
      title: "Média da Nota VFC como goleiro",
      value: (p) => formatAverage(p.goalkeeper.averageRating),
    },
    {
      label: "Def/J",
      title: "Defesas por partida",
      value: (p) => formatAverage(p.goalkeeper.savesPerMatch),
    },
    {
      label: "CS",
      title: "Jogos sem sofrer gol",
      value: (p) => p.goalkeeper.cleanSheets,
    },
  ],
};

function isTab(value: unknown): value is RankingTab {
  return RANKING_TABS.includes(value as RankingTab);
}

export default async function RankingPage({
  searchParams,
}: PageProps<"/ranking">) {
  const { periodo, aba } = await searchParams;
  const tab: RankingTab = isTab(aba) ? aba : "geral";
  const selection = await resolvePeriod(
    typeof periodo === "string" ? periodo : undefined,
  );

  const stats = await getPlayerStats(selection.period, "main");
  // Jogadores ativos e quem tem números no período; na aba de goleiros, só
  // quem já jogou no gol.
  const listed = stats.filter((player) =>
    tab === "goleiros"
      ? hasGoalkeeperStats(player)
      : player.isActive || player.matches > 0,
  );
  const ranking = rankPlayers(listed, tab);
  const columns = COLUMNS[tab];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Ranking do Varejista
      </h1>

      <PeriodSwitcher
        selection={selection}
        basePath="/ranking"
        params={{ aba: tab }}
      />

      <nav aria-label="Rankings" className="flex flex-wrap gap-2">
        {RANKING_TABS.map((option) => (
          <Link
            key={option}
            href={`/ranking?aba=${option}&periodo=${selection.param}`}
            aria-current={option === tab ? "page" : undefined}
            className={`flex min-h-10 items-center rounded border px-3 text-sm ${
              option === tab
                ? "bg-foreground text-background border-foreground font-medium"
                : "border-foreground/20"
            }`}
          >
            {RANKING_TAB_LABEL[option]}
          </Link>
        ))}
      </nav>

      {ranking.length === 0 ? (
        <p className="text-sm opacity-70">
          {tab === "goleiros"
            ? "Ninguém jogou no gol neste período."
            : "Nenhum jogador para listar neste período."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Ranking {RANKING_TAB_LABEL[tab]}, {selection.label}
            </caption>
            <thead>
              <tr className="border-foreground/15 border-b">
                <th className="w-8 px-2 py-2 text-left font-medium">#</th>
                <th className="px-2 py-2 text-left font-medium">Jogador</th>
                {columns.map((column) => (
                  <th key={column.label} className={head} title={column.title}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((player, index) => (
                <tr
                  key={player.playerId}
                  className="border-foreground/10 border-b"
                >
                  <td className="px-2 py-2 tabular-nums">{index + 1}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/jogadores/${player.slug}?periodo=${selection.param}`}
                      className="flex items-center gap-2"
                    >
                      <PlayerAvatar
                        name={player.name}
                        shirtNumber={player.shirtNumber}
                        photoUrl={player.photoUrl}
                        size="sm"
                      />
                      <span>
                        {player.name}{" "}
                        <span className="opacity-60">
                          #{player.shirtNumber}
                        </span>
                      </span>
                    </Link>
                  </td>
                  {columns.map((column) => (
                    <td key={column.label} className={cell}>
                      {column.value(player)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs opacity-70">
        {tab === "nota" &&
          "Ordem: quantidade de partidas avaliadas, depois média da Nota VFC, G/A e gols. "}
        {tab === "goleiros" &&
          "Conta só as partidas como goleiro registradas no sistema. "}
        Considera X1 e Partida; o Torneio de Rush tem estatísticas próprias.
        {selection.period.kind === "club" &&
          " Inclui o histórico anterior ao sistema, que não tem Nota VFC."}
      </p>
    </main>
  );
}
