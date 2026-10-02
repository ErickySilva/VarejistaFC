import Link from "next/link";
import {
  AWARD_LABEL,
  type AwardType,
  type NightScopeSummary,
} from "@/domain/night";
import { formatRating } from "@/lib/format";
import type { MatchDetail, NightDetail } from "@/server/nights/queries";
import type { PlayerLink } from "@/server/players/directory";
import type { OverallRankingRow } from "@/server/players/queries";
import { Score } from "../matches/match-row";
import { ResultMark } from "../ui/badge";
import { FlashValue } from "../ui/flash-value";
import { AssistIcon, BallIcon, GloveIcon } from "../ui/icons";
import { PlayerAvatar } from "../ui/player-avatar";
import { Table, Td, Th, Tr } from "../ui/table";
import { FORWARD, ListItemTransition } from "../ui/transitions";

// Componentes de exibição da gameplay. Não buscam dados nem calculam nada:
// recebem o que a página já carregou.

export interface NightPlayerInfo {
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
  slug: string | null;
}

export type PlayerLookup = (playerId: number) => NightPlayerInfo;

// Junta o nome e o número (que vêm das participações) com a foto e o perfil.
export function playerLookup(
  night: NightDetail,
  photos: Map<number, PlayerLink>,
): PlayerLookup {
  const players = new Map<number, NightPlayerInfo>();
  for (const match of night.matches) {
    for (const participation of match.participations) {
      const link = photos.get(participation.playerId);
      players.set(participation.playerId, {
        name: participation.playerName,
        shirtNumber: participation.shirtNumber,
        photoUrl: link?.photoUrl ?? null,
        slug: link?.slug ?? null,
      });
    }
  }
  return (playerId) =>
    players.get(playerId) ?? {
      name: `Jogador ${playerId}`,
      shirtNumber: 0,
      photoUrl: null,
      slug: null,
    };
}

export function nightPlayerIds(night: NightDetail): number[] {
  return [
    ...new Set(
      night.matches.flatMap((match) =>
        match.participations.map((participation) => participation.playerId),
      ),
    ),
  ];
}

// Fita de partidas da noite: um selo por partida, na ordem em que foram
// jogadas. Rola na horizontal; a partida nova entra no fim.
export function MatchStrip({ matches }: { matches: MatchDetail[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-muted text-sm">Nenhuma partida registrada ainda.</p>
    );
  }
  return (
    // "relative": o texto para leitor de tela dentro dos selos é posicionado
    // de forma absoluta; sem isto ele escapa da rolagem e alarga a página.
    <ol className="relative -mx-4 flex snap-x [scrollbar-width:none] gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
      {matches.map((match) => (
        <ListItemTransition key={match.id}>
          <li className="shrink-0 snap-start">
            <Link
              href={`/partidas/${match.id}`}
              transitionTypes={FORWARD}
              className="bg-raised/70 hover:bg-raised flex items-center gap-2.5 rounded-md py-2 pr-3 pl-2 transition-[background-color,transform] active:scale-[0.97]"
            >
              <ResultMark
                result={match.result}
                wentToPenalties={match.wentToPenalties}
              />
              <span className="flex flex-col">
                <Score
                  goalsFor={match.goalsFor}
                  goalsAgainst={match.goalsAgainst}
                  className="text-lg"
                />
                <span className="text-muted max-w-28 truncate text-xs">
                  {match.opponentName}
                </span>
              </span>
            </Link>
          </li>
        </ListItemTransition>
      ))}
    </ol>
  );
}

function Count({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <span
      className={`flex w-11 items-center justify-end gap-1 ${value === 0 ? "text-muted" : ""}`}
    >
      {icon}
      <FlashValue value={value} className="numeral text-lg" />
      <span className="sr-only"> {label}</span>
    </span>
  );
}

// Os jogadores da noite, um por linha: partidas, gols, assistências, defesas
// de quem foi para o gol e a média da Nota VFC. Quando um número muda (partida
// nova registrada), ele pisca.
export function NightPlayers({
  scope,
  lookup,
}: {
  scope: NightScopeSummary;
  lookup: PlayerLookup;
}) {
  if (scope.players.length === 0) return null;
  const saves = new Map(
    scope.goalkeepers.map((goalkeeper) => [
      goalkeeper.playerId,
      goalkeeper.saves,
    ]),
  );
  const iconClass = "h-4 w-4 opacity-70";

  return (
    <ul className="divide-line/40 divide-y">
      {scope.players.map((player) => {
        const info = lookup(player.playerId);
        const playerSaves = saves.get(player.playerId);
        return (
          <ListItemTransition key={player.playerId}>
            <li className="flex items-center gap-3 py-2.5">
              <PlayerAvatar
                name={info.name}
                shirtNumber={info.shirtNumber}
                photoUrl={info.photoUrl}
                size="sm"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{info.name}</span>
                <span className="text-muted text-xs">
                  <FlashValue value={player.matches} />{" "}
                  {player.matches === 1 ? "partida" : "partidas"}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Count
                  icon={<BallIcon className={iconClass} />}
                  label="gols"
                  value={player.goals}
                />
                <Count
                  icon={<AssistIcon className={iconClass} />}
                  label="assistências"
                  value={player.assists}
                />
                {playerSaves !== undefined && (
                  <Count
                    icon={<GloveIcon className={iconClass} />}
                    label="defesas"
                    value={playerSaves}
                  />
                )}
              </span>
              <span className="w-12 text-right">
                <FlashValue
                  value={formatRating(player.averageRating, 2)}
                  className="numeral text-lg"
                />
                <span className="text-muted block text-[0.65rem]">VFC</span>
              </span>
            </li>
          </ListItemTransition>
        );
      })}
    </ul>
  );
}

export interface AwardLine {
  award: AwardType;
  playerName: string;
  shirtNumber?: number;
  photoUrl: string | null;
  slug: string | null;
  value: number;
}

const AWARD_UNIT: Record<AwardType, string> = {
  top_scorer: "gols",
  top_assists: "assistências",
  mvp: "média VFC",
  rush_mvp: "média VFC",
};

export function formatAwardValue(award: AwardType, value: number): string {
  return award === "mvp" || award === "rush_mvp"
    ? formatRating(value, 2)
    : String(value);
}

export function awardUnit(award: AwardType, value: number): string {
  if (award === "top_scorer" && value === 1) return "gol";
  if (award === "top_assists" && value === 1) return "assistência";
  return AWARD_UNIT[award];
}

// Prêmios da noite. É aqui (e na premiação) que o destaque visual é
// permitido: retrato com moldura amarela, o nome do prêmio e o número que o
// rendeu. Co-vencedores aparecem lado a lado, com o mesmo prêmio.
export function AwardList({ awards }: { awards: AwardLine[] }) {
  if (awards.length === 0) return null;

  return (
    <ul
      className={`grid gap-x-2 gap-y-6 ${
        awards.length <= 3
          ? "grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
      }`}
    >
      {awards.map((award) => {
        const content = (
          <>
            <PlayerAvatar
              name={award.playerName}
              shirtNumber={award.shirtNumber}
              photoUrl={award.photoUrl}
              size="lg"
              ring="accent"
              className="ease-out-quint h-auto! w-full max-w-24 transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
            />
            <span className="text-accent mt-2 text-xs font-bold">
              {AWARD_LABEL[award.award]}
            </span>
            <span className="max-w-full truncate text-base font-bold">
              {award.playerName}
            </span>
            <span className="text-soft text-xs">
              <FlashValue
                value={formatAwardValue(award.award, award.value)}
                className="numeral text-fg text-base"
              />{" "}
              {awardUnit(award.award, award.value)}
            </span>
          </>
        );
        const tileClass = "group flex flex-col items-center text-center";
        return (
          <li key={`${award.award}:${award.playerName}`}>
            {award.slug ? (
              <Link
                href={`/jogadores/${award.slug}`}
                transitionTypes={FORWARD}
                className={tileClass}
              >
                {content}
              </Link>
            ) : (
              <div className={tileClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function OverallRanking({ ranking }: { ranking: OverallRankingRow[] }) {
  if (ranking.length === 0) return null;
  return (
    <Table>
      <thead>
        <tr>
          <Th align="left">Jogador</Th>
          <Th title="Jogos">J</Th>
          <Th title="Gols">G</Th>
          <Th title="Assistências">A</Th>
          <Th>G/A</Th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((row) => (
          <Tr key={row.playerId}>
            <Td align="left">
              <span className="text-muted mr-2 inline-block w-6 tabular-nums">
                {row.shirtNumber}
              </span>
              <span className="font-medium">{row.playerName}</span>
            </Td>
            <Td>{row.matches}</Td>
            <Td>{row.goals}</Td>
            <Td>{row.assists}</Td>
            <Td strong>{row.goalContributions}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
