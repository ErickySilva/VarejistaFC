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
import { Score } from "../matches/match-row";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { controlClass, Field, Input, Notice, Select } from "../ui/field";
import { CheckIcon } from "../ui/icons";
import { NumberStepper } from "../ui/number-stepper";
import { PlayerAvatar } from "../ui/player-avatar";

// Texto digitado da Nota FIFA → número, aceitando vírgula. Vazio é "não
// informada"; texto que não é número vira NaN e é recusado pela validação.
function parseFifaRating(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return Number(trimmed.replace(",", "."));
}

// A que etapa cada problema pertence. O que não está aqui é da etapa 3.
const SCORE_ISSUES = new Set<MatchEntryIssue["code"]>([
  "PENALTIES_REQUIRE_DRAW",
  "PENALTY_SCORE_REQUIRED",
  "PENALTY_SCORE_TIED",
  "PENALTY_SCORE_NOT_ALLOWED",
]);
const SQUAD_ISSUES = new Set<MatchEntryIssue["code"]>([
  "NO_PLAYERS",
  "DUPLICATE_PLAYER",
  "MULTIPLE_GOALKEEPERS",
]);

const STEPS = ["Partida", "Elenco", "Números"] as const;
type Step = 0 | 1 | 2;

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

// Progresso do registro. As etapas concluídas viram atalhos para voltar.
function Progress({
  step,
  onStep,
}: {
  step: Step;
  onStep: (step: Step) => void;
}) {
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((label, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onStep(index as Step)}
              disabled={!done}
              aria-current={current ? "step" : undefined}
              className="group flex min-h-11 w-full flex-col gap-2 text-left disabled:cursor-default"
            >
              <span
                aria-hidden="true"
                className={`h-1 rounded-full transition-colors duration-300 ${
                  done || current ? "bg-accent" : "bg-line/50"
                }`}
              />
              <span
                className={`flex items-center gap-1.5 text-xs font-semibold ${
                  current ? "text-fg" : "text-muted"
                } ${done ? "group-hover:text-fg" : ""}`}
              >
                {done ? (
                  <CheckIcon className="text-accent h-3.5 w-3.5" />
                ) : (
                  <span className="tabular-nums">{index + 1}</span>
                )}
                {label}
                {done && <span className="sr-only"> (concluída)</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Issues({ issues }: { issues: MatchEntryIssue[] }) {
  return issues.map((issue) => (
    <Notice key={`${issue.code}:${issue.playerId ?? ""}`} tone="error">
      {issue.message}
    </Notice>
  ));
}

// Barra de ações da etapa: fica presa ao rodapé, ao alcance do polegar.
function StepActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg/95 border-line/50 pb-safe sticky bottom-0 -mx-4 mt-2 flex gap-2 border-t px-4 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}

export function MatchForm({ players, initial }: MatchFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(0);
  // Para onde a etapa está indo: define o lado de onde a nova entra.
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const [saved, setSaved] = useState(false);
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
  const scoreIssues = issues.filter(
    (issue) =>
      SCORE_ISSUES.has(issue.code) ||
      (issue.code === "INVALID_NUMBER" && issue.playerId === undefined),
  );
  const squadIssues = issues.filter((issue) => SQUAD_ISSUES.has(issue.code));
  const statIssues = issues.filter(
    (issue) => !scoreIssues.includes(issue) && !squadIssues.includes(issue),
  );
  const matchReady = opponentName.trim().length > 0 && scoreIssues.length === 0;
  const squadReady = squadIssues.length === 0;

  const totalGoals = participations.reduce((sum, row) => sum + row.goals, 0);
  const totalAssists = participations.reduce(
    (sum, row) => sum + row.assists,
    0,
  );

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

  function goTo(next: Step) {
    setServerError(null);
    setDirection(next > step ? "next" : "prev");
    setStep(next);
    window.scrollTo({ top: 0 });
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
      // Confirma no próprio botão e segue para a partida salva, já com as
      // notas calculadas.
      setSaved(true);
      const destination = `/partidas/${result.data.matchId}?nova=1`;
      setTimeout(() => router.push(destination), 650);
    });
  }

  // A primeira etapa aparece parada; o movimento é só da troca.
  const stepMotion =
    direction === "next"
      ? "animate-next"
      : direction === "prev"
        ? "animate-prev"
        : "";

  const summary = step > 0 && (
    <div className="bg-surface flex items-center justify-between gap-3 rounded-lg px-4 py-3">
      <span className="min-w-0">
        <span className="text-muted block text-xs">
          {MATCH_TYPE_LABEL[matchType]}
          {values.wentToPenalties &&
            `, pênaltis ${penaltyScoreFor} × ${penaltyScoreAgainst}`}
        </span>
        <span className="block truncate font-semibold">
          Varejista FC <span className="text-muted font-normal">contra</span>{" "}
          {opponentName.trim()}
        </span>
      </span>
      <Score
        goalsFor={goalsFor}
        goalsAgainst={goalsAgainst}
        className="text-3xl"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Progress step={step} onStep={goTo} />
      {summary}

      {step === 0 && (
        <div key="partida" className={`${stepMotion} flex flex-col gap-6`}>
          <fieldset>
            <legend className="text-soft mb-1.5 text-sm font-medium">
              Tipo de partida
            </legend>
            <div className="bg-surface grid grid-cols-3 gap-1 rounded-lg p-1">
              {MATCH_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMatchType(type)}
                  aria-pressed={matchType === type}
                  className={`min-h-11 rounded-md px-2 text-sm font-semibold transition-colors duration-200 active:scale-[0.97] ${
                    matchType === type
                      ? "bg-accent text-accent-ink"
                      : "text-soft hover:text-fg"
                  }`}
                >
                  {MATCH_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
            {matchType === "rush" && (
              <p className="text-muted mt-2 text-xs">
                O Rush é registrado normalmente, mas fica fora das estatísticas
                principais e tem as suas próprias.
              </p>
            )}
          </fieldset>

          {/* Texto livre, só desta partida: sem lista nem sugestão de anteriores. */}
          <Field label="Adversário">
            <Input
              value={opponentName}
              onChange={(event) => setOpponentName(event.target.value)}
              maxLength={60}
              autoComplete="off"
              placeholder="Nome do time adversário"
            />
          </Field>

          <fieldset>
            <legend className="text-soft mb-3 text-sm font-medium">
              Placar final
            </legend>
            <div className="bg-surface grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-3 py-5">
              <NumberStepper
                variant="score"
                label="Varejista FC"
                value={goalsFor}
                onChange={setGoalsFor}
              />
              <span aria-hidden="true" className="text-muted mt-3 text-2xl">
                ×
              </span>
              <NumberStepper
                variant="score"
                label={opponentName.trim() || "Adversário"}
                value={goalsAgainst}
                onChange={setGoalsAgainst}
              />
            </div>
          </fieldset>

          {isDraw && (
            <fieldset className="animate-rise flex flex-col gap-3">
              <label className="bg-surface flex min-h-13 cursor-pointer items-center gap-3 rounded-lg px-4 text-sm font-medium">
                <input
                  type="checkbox"
                  className="accent-accent h-5 w-5"
                  checked={wentToPenalties}
                  onChange={(event) => setWentToPenalties(event.target.checked)}
                />
                Foi para a disputa de pênaltis
              </label>
              {wentToPenalties && (
                <div className="animate-rise flex flex-col gap-3 px-1">
                  <NumberStepper
                    label="Pênaltis do Varejista"
                    value={penaltyScoreFor}
                    onChange={setPenaltyScoreFor}
                  />
                  <NumberStepper
                    label="Pênaltis do adversário"
                    value={penaltyScoreAgainst}
                    onChange={setPenaltyScoreAgainst}
                  />
                  <p className="text-muted text-xs">
                    Os gols da disputa não contam como gols da partida.
                  </p>
                </div>
              )}
            </fieldset>
          )}

          <Issues issues={scoreIssues} />

          <StepActions>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => goTo(1)}
              disabled={!matchReady}
            >
              Continuar para o elenco
            </Button>
          </StepActions>
        </div>
      )}

      {step === 1 && (
        <div key="elenco" className={`${stepMotion} flex flex-col gap-4`}>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-soft mb-2 text-sm font-medium">
              Quem jogou esta partida
            </legend>
            {players.map((player) => {
              const stats = selection.get(player.id);
              const selected = stats !== undefined;
              return (
                <div
                  key={player.id}
                  className={`rounded-lg transition-colors duration-200 ${
                    selected ? "bg-raised" : "bg-surface"
                  }`}
                >
                  <label className="flex min-h-16 cursor-pointer items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={selected}
                      onChange={() => togglePlayer(player)}
                    />
                    <PlayerAvatar
                      name={player.name}
                      shirtNumber={player.shirtNumber}
                      photoUrl={player.photoUrl}
                      size="sm"
                      ring={selected ? "accent" : "quiet"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {player.name}
                        <span className="text-muted ml-1.5 text-sm font-normal tabular-nums">
                          {player.shirtNumber}
                        </span>
                      </span>
                      {!player.isActive && (
                        <span className="text-muted block text-xs">
                          Desativado, mas participou desta partida. Desmarque
                          para remover a participação.
                        </span>
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`peer-focus-visible:outline-focus flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${
                        selected
                          ? "bg-accent text-accent-ink"
                          : "ring-line ring-1 ring-inset"
                      }`}
                    >
                      {selected && (
                        <CheckIcon className="animate-pop h-4.5 w-4.5" />
                      )}
                    </span>
                  </label>
                  {stats && (
                    <div className="animate-fade px-3 pb-3">
                      <Field label={`Posição de ${player.name}`}>
                        <Select
                          value={stats.position}
                          onChange={(event) =>
                            updatePlayer(player.id, {
                              position: event.target.value as Position,
                            })
                          }
                        >
                          {POSITIONS.map((position) => (
                            <option key={position} value={position}>
                              {POSITION_LABEL[position]} ({position})
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>

          <Issues issues={squadIssues} />

          <StepActions>
            <Button size="lg" onClick={() => goTo(0)}>
              Voltar
            </Button>
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => goTo(2)}
              disabled={!squadReady}
            >
              Continuar para os números
            </Button>
          </StepActions>
        </div>
      )}

      {step === 2 && (
        <div key="numeros" className={`${stepMotion} flex flex-col gap-4`}>
          <dl className="text-soft flex gap-5 text-sm">
            <div className="flex gap-1.5">
              <dt>Gols lançados</dt>
              <dd className="text-fg font-bold tabular-nums">
                {totalGoals} de {goalsFor}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Assistências</dt>
              <dd className="text-fg font-bold tabular-nums">
                {totalAssists} de {goalsFor}
              </dd>
            </div>
          </dl>

          {players
            .filter((player) => selection.has(player.id))
            .map((player) => {
              const stats = selection.get(player.id)!;
              const playerIssues = statIssues.filter(
                (issue) => issue.playerId === player.id,
              );
              // Até onde este jogador pode ir sem estourar o placar do time.
              const maxGoals = Math.min(
                goalsFor - (totalGoals - stats.goals),
                goalsFor - stats.assists,
              );
              const maxAssists = Math.min(
                goalsFor - (totalAssists - stats.assists),
                goalsFor - stats.goals,
              );
              return (
                <section
                  key={player.id}
                  aria-label={player.name}
                  className="bg-surface flex flex-col gap-3 rounded-lg p-3"
                >
                  <h3 className="flex items-center gap-3">
                    <PlayerAvatar
                      name={player.name}
                      shirtNumber={player.shirtNumber}
                      photoUrl={player.photoUrl}
                      size="sm"
                    />
                    <span className="flex-1 font-bold">{player.name}</span>
                    <Badge tone="outline">{stats.position}</Badge>
                  </h3>
                  <NumberStepper
                    label="Gols"
                    value={stats.goals}
                    max={Math.max(stats.goals, maxGoals)}
                    maxReason={`O placar do Varejista é ${goalsFor}; gols e assistências do jogador não passam disso.`}
                    onChange={(goals) => updatePlayer(player.id, { goals })}
                  />
                  <NumberStepper
                    label="Assistências"
                    value={stats.assists}
                    max={Math.max(stats.assists, maxAssists)}
                    maxReason={`O placar do Varejista é ${goalsFor}; gols e assistências do jogador não passam disso.`}
                    onChange={(assists) => updatePlayer(player.id, { assists })}
                  />
                  {isGoalkeeper(stats.position) && (
                    <>
                      <NumberStepper
                        label="Defesas"
                        hint="Total, com as de pênalti"
                        value={stats.saves}
                        onChange={(saves) => updatePlayer(player.id, { saves })}
                      />
                      <NumberStepper
                        label="Defesas de pênalti"
                        value={stats.penaltiesSaved}
                        max={Math.max(stats.penaltiesSaved, stats.saves)}
                        maxReason="As defesas de pênalti fazem parte do total de defesas."
                        onChange={(penaltiesSaved) =>
                          updatePlayer(player.id, { penaltiesSaved })
                        }
                      />
                    </>
                  )}
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      Nota FIFA
                      <span className="text-muted block text-xs">
                        Opcional, como aparece no jogo
                      </span>
                    </span>
                    <input
                      className={`${controlClass} numeral w-24! text-center text-xl!`}
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
                  <Issues issues={playerIssues} />
                </section>
              );
            })}

          <p className="text-muted text-xs">
            A Nota VFC de cada jogador é calculada pelo sistema ao salvar.
          </p>

          <Issues
            issues={statIssues.filter((issue) => issue.playerId === undefined)}
          />
          {serverError && <Notice tone="error">{serverError}</Notice>}

          <StepActions>
            <Button
              size="lg"
              onClick={() => goTo(1)}
              disabled={pending || saved}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              size="lg"
              className={`flex-1 ${saved ? "bg-win! text-win-ink! opacity-100!" : ""}`}
              onClick={submit}
              loading={pending && !saved}
              disabled={issues.length > 0 || saved}
            >
              {saved ? (
                <>
                  <CheckIcon className="animate-stamp" />
                  Partida salva
                </>
              ) : pending ? (
                "Salvando"
              ) : (
                "Salvar partida"
              )}
            </Button>
          </StepActions>
        </div>
      )}
    </div>
  );
}
