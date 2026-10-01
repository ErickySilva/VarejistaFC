import Link from "next/link";
import { MATCH_TYPE_LABEL } from "@/domain/match-type";
import {
  AWARD_LABEL,
  type AwardType,
  type NightGoalkeeperSummary,
  type NightScopeSummary,
  type NightSummary,
} from "@/domain/night";
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

export function formatRating(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function formatAwardValue(award: AwardType, value: number): string {
  if (award === "mvp" || award === "rush_mvp") {
    return `média ${formatRating(value, 2)}`;
  }
  return String(value);
}

const cellClass = "px-2 py-2 text-right tabular-nums";
const headClass = "px-2 py-2 text-right font-medium";

function scopeLine(scope: NightScopeSummary): string {
  return `${scope.matchCount} ${scope.matchCount === 1 ? "partida" : "partidas"} · ${scope.wins}V ${scope.draws}E ${scope.losses}D · gols ${scope.goalsFor}–${scope.goalsAgainst}`;
}

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
      <p className="text-sm tabular-nums">{scopeLine(summary.main)}</p>
      {summary.rush.matchCount > 0 && (
        <p className="text-sm tabular-nums opacity-80">
          Torneio de Rush: {scopeLine(summary.rush)}
        </p>
      )}
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
          <p className="text-xs opacity-70">
            Partida {order} · {MATCH_TYPE_LABEL[match.matchType]}
          </p>
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

      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {match.participations.map((participation) => (
          <li
            key={participation.playerId}
            className="flex justify-between gap-3"
          >
            <span>
              {participation.playerName}{" "}
              <span className="opacity-60">{participation.position}</span>
            </span>
            <span className="text-right tabular-nums">
              {participation.goals}G {participation.assists}A
              {participation.saves !== null && ` · ${participation.saves} def`}
              {participation.penaltiesSaved
                ? ` (${participation.penaltiesSaved} pên.)`
                : ""}
              <br />
              <span className="opacity-70">VFC</span>{" "}
              <strong>{formatRating(participation.rating)}</strong>
              {participation.fifaRating !== null && (
                <>
                  {" "}
                  · <span className="opacity-70">FIFA</span>{" "}
                  {formatRating(participation.fifaRating)}
                </>
              )}
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

// Tabela de jogadores de um recorte da noite (principais ou Rush). As colunas
// de goleiro ficam em um bloco próprio, para não poluir esta tabela.
export function NightStandings({
  title,
  note,
  scope,
  playerName,
}: {
  title: string;
  note?: string;
  scope: NightScopeSummary;
  playerName: (playerId: number) => string;
}) {
  if (scope.players.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 font-semibold">{title}</h3>
      {note && <p className="mb-2 text-xs opacity-70">{note}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-foreground/15 border-b">
              <th className="px-2 py-2 text-left font-medium">Jogador</th>
              <th className={headClass}>J</th>
              <th className={headClass}>G</th>
              <th className={headClass}>A</th>
              <th className={headClass}>G/A</th>
              <th className={headClass}>VFC</th>
            </tr>
          </thead>
          <tbody>
            {scope.players.map((player) => (
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
      <NightGoalkeepers
        goalkeepers={scope.goalkeepers}
        playerName={playerName}
      />
    </section>
  );
}

// Só quem jogou no gol naquele recorte, contando apenas as partidas no gol.
function NightGoalkeepers({
  goalkeepers,
  playerName,
}: {
  goalkeepers: NightGoalkeeperSummary[];
  playerName: (playerId: number) => string;
}) {
  if (goalkeepers.length === 0) return null;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-foreground/15 border-b">
            <th className="px-2 py-2 text-left font-medium">Goleiro</th>
            <th className={headClass}>J</th>
            <th className={headClass}>Def</th>
            <th className={headClass}>Pên.</th>
            <th className={headClass}>GS</th>
            <th className={headClass}>CS</th>
            <th className={headClass}>VFC</th>
          </tr>
        </thead>
        <tbody>
          {goalkeepers.map((goalkeeper) => (
            <tr
              key={goalkeeper.playerId}
              className="border-foreground/10 border-b"
            >
              <td className="px-2 py-2">{playerName(goalkeeper.playerId)}</td>
              <td className={cellClass}>{goalkeeper.matches}</td>
              <td className={cellClass}>{goalkeeper.saves}</td>
              <td className={cellClass}>{goalkeeper.penaltiesSaved}</td>
              <td className={cellClass}>{goalkeeper.goalsConceded}</td>
              <td className={cellClass}>{goalkeeper.cleanSheets}</td>
              <td className={cellClass}>
                {formatRating(goalkeeper.averageRating, 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-xs opacity-70">
        Def: defesas · Pên.: defesas de pênalti · GS: gols sofridos · CS: jogos
        sem sofrer gol
      </p>
    </div>
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
        Desde a criação do clube: partidas principais do sistema + histórico. O
        Rush não entra.
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
