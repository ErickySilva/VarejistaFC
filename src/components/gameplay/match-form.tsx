"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  validateMatchEntry,
  type MatchEntryIssue,
  type ParticipationEntry,
} from "@/domain/match-entry";
import {
  MATCH_TYPE_LABEL,
  MATCH_TYPES,
  type MatchType,
} from "@/domain/match-type";
import {
  isGoalkeeper,
  POSITION_LABEL,
  POSITIONS,
  type Position,
} from "@/domain/positions";
import { registerMatch, updateMatch } from "@/server/actions/gameplay-actions";
import type { MatchInputValues } from "@/server/actions/gameplay-schemas";
import type { RosterPlayer } from "@/server/players/queries";

// Texto digitado da Nota FIFA → número, aceitando vírgula. Vazio é "não
// informada"; texto que não é número vira NaN e é recusado pela validação.
function parseFifaRating(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return Number(trimmed.replace(",", "."));
}

const fieldClass =
  "border-foreground/20 w-full rounded border bg-transparent px-3 py-2 text-base";

// Questões que dizem respeito só ao passo 1 (placar e disputa de pênaltis).
const SCORE_ISSUES = new Set<MatchEntryIssue["code"]>([
  "PENALTIES_REQUIRE_DRAW",
  "PENALTY_SCORE_REQUIRED",
  "PENALTY_SCORE_TIED",
  "PENALTY_SCORE_NOT_ALLOWED",
]);

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function Stepper({ label, value, onChange }: StepperProps) {
  const buttonClass =
    "border-foreground/20 flex h-11 w-11 items-center justify-center rounded border text-xl disabled:opacity-40";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
          aria-label={`Diminuir ${label}`}
        >
          −
        </button>
        <span
          className="w-8 text-center text-lg tabular-nums"
          aria-live="polite"
        >
          {value}
        </span>
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(value + 1)}
          disabled={value >= 99}
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface PlayerStats {
  position: Position;
  goals: number;
  assists: number;
  saves: number;
  penaltiesSaved: number;
  // Como foi digitada; vazia quando não informada.
  fifaRating: string;
}

export interface MatchFormProps {
  players: RosterPlayer[];
  opponentNames: string[];
  // Presente na edição: a partida que está sendo corrigida.
  initial?: MatchInputValues & { matchId: number };
}

function initialSelection(
  initial: MatchFormProps["initial"],
): Map<number, PlayerStats> {
  return new Map(
    (initial?.participations ?? []).map((participation) => [
      participation.playerId,
      {
        position: participation.position,
        goals: participation.goals,
        assists: participation.assists,
        saves: participation.saves ?? 0,
        penaltiesSaved: participation.penaltiesSaved ?? 0,
        fifaRating:
          participation.fifaRating === null
            ? ""
            : participation.fifaRating.toFixed(1).replace(".", ","),
      },
    ]),
  );
}

export function MatchForm({ players, opponentNames, initial }: MatchFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2>(1);
  const [serverError, setServerError] = useState<string | null>(null);

  const [opponentName, setOpponentName] = useState(initial?.opponentName ?? "");
  const [matchType, setMatchType] = useState<MatchType>(
    initial?.matchType ?? "match",
  );
  const [goalsFor, setGoalsFor] = useState(initial?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(initial?.goalsAgainst ?? 0);
  const [wentToPenalties, setWentToPenalties] = useState(
    initial?.wentToPenalties ?? false,
  );
  const [penaltyScoreFor, setPenaltyScoreFor] = useState(
    initial?.penaltyScoreFor ?? 0,
  );
  const [penaltyScoreAgainst, setPenaltyScoreAgainst] = useState(
    initial?.penaltyScoreAgainst ?? 0,
  );
  const [selection, setSelection] = useState(() => initialSelection(initial));

  const isDraw = goalsFor === goalsAgainst;

  const participations: ParticipationEntry[] = useMemo(
    () =>
      players
        .filter((player) => selection.has(player.id))
        .map((player) => {
          const stats = selection.get(player.id)!;
          const goalkeeper = isGoalkeeper(stats.position);
          return {
            playerId: player.id,
            position: stats.position,
            goals: stats.goals,
            assists: stats.assists,
            saves: goalkeeper ? stats.saves : null,
            penaltiesSaved: goalkeeper ? stats.penaltiesSaved : null,
            fifaRating: parseFifaRating(stats.fifaRating),
          };
        }),
    [players, selection],
  );

  const values: MatchInputValues = {
    opponentName,
    matchType,
    goalsFor,
    goalsAgainst,
    wentToPenalties: wentToPenalties && isDraw,
    penaltyScoreFor: wentToPenalties && isDraw ? penaltyScoreFor : null,
    penaltyScoreAgainst: wentToPenalties && isDraw ? penaltyScoreAgainst : null,
    participations,
  };

  // As mesmas regras que o servidor e o banco aplicam, para avisar na hora.
  const issues = validateMatchEntry(values);
  const scoreIssues = issues.filter((issue) => SCORE_ISSUES.has(issue.code));
  const playerIssues = issues.filter((issue) => !SCORE_ISSUES.has(issue.code));
  const canAdvance = opponentName.trim().length > 0 && scoreIssues.length === 0;

  function togglePlayer(player: RosterPlayer) {
    setSelection((current) => {
      const next = new Map(current);
      if (next.has(player.id)) next.delete(player.id);
      else {
        next.set(player.id, {
          position: player.defaultPosition,
          goals: 0,
          assists: 0,
          saves: 0,
          penaltiesSaved: 0,
          fifaRating: "",
        });
      }
      return next;
    });
  }

  function updatePlayer(playerId: number, change: Partial<PlayerStats>) {
    setSelection((current) => {
      const stats = current.get(playerId);
      if (!stats) return current;
      const next = new Map(current);
      next.set(playerId, { ...stats, ...change });
      return next;
    });
  }

  function submit() {
    setServerError(null);
    startTransition(async () => {
      const result = initial
        ? await updateMatch({ ...values, matchId: initial.matchId })
        : await registerMatch(values);
      if (!result.ok) {
        setServerError(result.error.message);
        return;
      }
      router.push("/gameplay");
    });
  }

  if (step === 1) {
    return (
      <div className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tipo de partida</legend>
          <div className="grid grid-cols-3 gap-2">
            {MATCH_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMatchType(type)}
                aria-pressed={matchType === type}
                className={`min-h-11 rounded border px-2 py-2 text-sm font-medium ${
                  matchType === type
                    ? "bg-foreground text-background border-foreground"
                    : "border-foreground/20"
                }`}
              >
                {MATCH_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
          {matchType === "rush" && (
            <p className="mt-2 text-xs opacity-70">
              O Rush é registrado normalmente, mas fica fora das estatísticas
              principais e tem as suas próprias.
            </p>
          )}
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          Adversário
          <input
            className={fieldClass}
            value={opponentName}
            onChange={(event) => setOpponentName(event.target.value)}
            list="adversarios"
            maxLength={60}
            autoComplete="off"
            placeholder="Nome do time adversário"
          />
          <datalist id="adversarios">
            {opponentNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Placar final</legend>
          <Stepper
            label="Varejista FC"
            value={goalsFor}
            onChange={setGoalsFor}
          />
          <Stepper
            label={opponentName.trim() || "Adversário"}
            value={goalsAgainst}
            onChange={setGoalsAgainst}
          />
        </fieldset>

        {isDraw && (
          <fieldset className="flex flex-col gap-3">
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={wentToPenalties}
                onChange={(event) => setWentToPenalties(event.target.checked)}
              />
              Foi para a disputa de pênaltis
            </label>
            {wentToPenalties && (
              <>
                <Stepper
                  label="Pênaltis do Varejista"
                  value={penaltyScoreFor}
                  onChange={setPenaltyScoreFor}
                />
                <Stepper
                  label="Pênaltis do adversário"
                  value={penaltyScoreAgainst}
                  onChange={setPenaltyScoreAgainst}
                />
                <p className="text-xs opacity-70">
                  Os gols da disputa não contam como gols da partida.
                </p>
              </>
            )}
          </fieldset>
        )}

        {scoreIssues.map((issue) => (
          <p key={issue.code} role="alert" className="text-sm text-red-600">
            {issue.message}
          </p>
        ))}

        <button
          type="button"
          onClick={() => setStep(2)}
          disabled={!canAdvance}
          className="bg-foreground text-background min-h-12 rounded px-4 py-3 font-medium disabled:opacity-50"
        >
          Continuar: quem jogou
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm">
        <span className="opacity-70">{MATCH_TYPE_LABEL[matchType]} · </span>
        Varejista FC{" "}
        <strong className="tabular-nums">
          {goalsFor} × {goalsAgainst}
        </strong>{" "}
        {opponentName.trim()}
        {values.wentToPenalties &&
          ` (pênaltis ${penaltyScoreFor} × ${penaltyScoreAgainst})`}
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">
          Quem participou desta partida
        </legend>
        {players.map((player) => {
          const stats = selection.get(player.id);
          const issue = playerIssues.find(
            (entry) => entry.playerId === player.id,
          );
          return (
            <div
              key={player.id}
              className="border-foreground/15 rounded border p-3"
            >
              <label className="flex min-h-11 items-center gap-3 font-medium">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={stats !== undefined}
                  onChange={() => togglePlayer(player)}
                />
                #{player.shirtNumber} {player.name}
                {!player.isActive && (
                  <span className="text-xs font-normal opacity-70">
                    (inativo)
                  </span>
                )}
              </label>
              {!player.isActive && (
                <p className="mt-1 text-xs opacity-70">
                  Este jogador está desativado, mas participou desta partida.
                  Desmarque para remover a participação.
                </p>
              )}

              {stats && (
                <div className="mt-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    Posição nesta partida
                    <select
                      className={fieldClass}
                      value={stats.position}
                      onChange={(event) =>
                        updatePlayer(player.id, {
                          position: event.target.value as Position,
                        })
                      }
                    >
                      {POSITIONS.map((position) => (
                        <option key={position} value={position}>
                          {position} · {POSITION_LABEL[position]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Stepper
                    label="Gols"
                    value={stats.goals}
                    onChange={(goals) => updatePlayer(player.id, { goals })}
                  />
                  <Stepper
                    label="Assistências"
                    value={stats.assists}
                    onChange={(assists) => updatePlayer(player.id, { assists })}
                  />
                  {isGoalkeeper(stats.position) && (
                    <>
                      <Stepper
                        label="Defesas (total)"
                        value={stats.saves}
                        onChange={(saves) => updatePlayer(player.id, { saves })}
                      />
                      <Stepper
                        label="Defesas de pênalti"
                        value={stats.penaltiesSaved}
                        onChange={(penaltiesSaved) =>
                          updatePlayer(player.id, { penaltiesSaved })
                        }
                      />
                      <p className="text-xs opacity-70">
                        As defesas de pênalti já fazem parte do total de
                        defesas.
                      </p>
                    </>
                  )}
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      Nota FIFA <span className="opacity-70">(opcional)</span>
                    </span>
                    <input
                      className={`${fieldClass} w-24 text-center tabular-nums`}
                      value={stats.fifaRating}
                      onChange={(event) =>
                        updatePlayer(player.id, {
                          fifaRating: event.target.value,
                        })
                      }
                      inputMode="decimal"
                      maxLength={4}
                      placeholder="7,5"
                      aria-label={`Nota FIFA de ${player.name}`}
                    />
                  </label>
                  <p className="text-xs opacity-70">
                    A Nota VFC é calculada pelo sistema ao salvar.
                  </p>
                  {issue && (
                    <p role="alert" className="text-sm text-red-600">
                      {issue.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {playerIssues
        .filter((issue) => issue.playerId === undefined)
        .map((issue) => (
          <p key={issue.code} role="alert" className="text-sm text-red-600">
            {issue.message}
          </p>
        ))}
      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={pending}
          className="border-foreground/20 min-h-12 flex-1 rounded border px-4 py-3 font-medium"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || issues.length > 0}
          className="bg-foreground text-background min-h-12 flex-1 rounded px-4 py-3 font-medium disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar partida"}
        </button>
      </div>
    </div>
  );
}
