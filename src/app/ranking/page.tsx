import type { Metadata } from "next";
import {
  Leaderboard,
  type LeaderboardDetail,
  type LeaderboardEntry,
} from "@/components/ranking/leaderboard";
import { EmptyState, Page, PageHeader } from "@/components/ui/layout";
import { PeriodSwitcher } from "@/components/ui/period-switcher";
import { LinkTabs } from "@/components/ui/tabs";
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

const matches = (p: PlayerStats): LeaderboardDetail => ({
  label: "J",
  title: "Jogos",
  value: p.matches,
});
const goals = (p: PlayerStats): LeaderboardDetail => ({
  label: "G",
  title: "Gols",
  value: p.goals,
});
const assists = (p: PlayerStats): LeaderboardDetail => ({
  label: "A",
  title: "Assistências",
  value: p.assists,
});
const rating = (p: PlayerStats): LeaderboardDetail => ({
  label: "VFC",
  title: "Média da Nota VFC",
  value: formatAverage(p.averageRating),
});

interface Board {
  // Nome da métrica em destaque.
  metric: string;
  // Valor numérico da métrica; null quando o jogador não tem.
  value: (player: PlayerStats) => number | null;
  // Média (duas casas) em vez de contagem inteira.
  average?: boolean;
  // Scout em que o líder ganha a coroa sobre a foto.
  crown?: boolean;
  details: ((player: PlayerStats) => LeaderboardDetail)[];
}

// O que cada aba destaca e o que mostra de apoio. As colunas de goleiro só
// existem na aba Goleiros.
const BOARDS: Record<RankingTab, Board> = {
  geral: {
    metric: "G/A",
    value: (p) => p.goalContributions,
    details: [matches, goals, assists, rating],
  },
  gols: {
    metric: "gols",
    value: (p) => p.goals,
    crown: true,
    details: [matches],
  },
  assistencias: {
    metric: "assistências",
    value: (p) => p.assists,
    crown: true,
    details: [matches],
  },
  ga: {
    metric: "G/A",
    value: (p) => p.goalContributions,
    crown: true,
    details: [matches],
  },
  nota: {
    metric: "média VFC",
    value: (p) => p.averageRating,
    average: true,
    details: [
      (p) => ({
        label: "Aval.",
        title: "Partidas avaliadas",
        value: p.ratedMatches,
      }),
    ],
  },
  goleiros: {
    metric: "média VFC no gol",
    value: (p) => p.goalkeeper.averageRating,
    average: true,
    details: [
      (p) => ({
        label: "J",
        title: "Partidas como goleiro",
        value: p.goalkeeper.matches,
      }),
      (p) => ({
        label: "Def/J",
        title: "Defesas por partida",
        value: formatAverage(p.goalkeeper.savesPerMatch),
      }),
      (p) => ({
        label: "SG",
        title: "Jogos sem sofrer gol",
        value: p.goalkeeper.cleanSheets,
      }),
    ],
  },
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

  const board = BOARDS[tab];
  // Coroa: só indicação visual de quem tem o maior valor do scout. Empatados
  // no topo recebem todos; com todo mundo zerado, ninguém recebe. A ordem da
  // lista não muda.
  const best = board.crown
    ? Math.max(0, ...ranking.map((player) => board.value(player) ?? 0))
    : 0;
  const entries: LeaderboardEntry[] = ranking.map((player) => {
    const value = board.value(player);
    return {
      id: player.playerId,
      slug: player.slug,
      href: `/jogadores/${player.slug}?periodo=${selection.param}`,
      name: player.name,
      shirtNumber: player.shirtNumber,
      photoUrl: player.photoUrl,
      value: board.average ? formatAverage(value) : String(value ?? 0),
      crowned: best > 0 && value === best,
      details: board.details.map((detail) => detail(player)),
    };
  });

  return (
    <Page>
      <PageHeader title="Ranking do Varejista">
        <PeriodSwitcher
          selection={selection}
          basePath="/ranking"
          params={{ aba: tab }}
        />
      </PageHeader>

      <div className="flex flex-col gap-4">
        <LinkTabs
          label="Rankings"
          options={RANKING_TABS.map((option) => ({
            href: `/ranking?aba=${option}&periodo=${selection.param}`,
            label: RANKING_TAB_LABEL[option],
            current: option === tab,
          }))}
        />

        {entries.length === 0 ? (
          <EmptyState
            title={
              tab === "goleiros"
                ? "Ninguém jogou no gol neste período"
                : "Nenhum jogador para listar neste período"
            }
          />
        ) : (
          <Leaderboard entries={entries} metric={board.metric} />
        )}

        <p className="text-muted text-xs">
          {tab === "nota" &&
            "Ordem: quantidade de partidas avaliadas, depois média da Nota VFC, G/A e gols. "}
          {tab === "goleiros" &&
            "Ordem: partidas no gol, depois média da Nota VFC. Conta só as partidas como goleiro registradas no sistema. "}
          Considera X1 e Partida; o Torneio de Rush tem estatísticas próprias.
          {selection.period.kind === "club" &&
            " Inclui o histórico anterior ao sistema, que não tem Nota VFC."}
        </p>
      </div>
    </Page>
  );
}
