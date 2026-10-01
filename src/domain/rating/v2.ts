import type { MatchResult } from "../match";
import { positionGroup, type PositionGroup } from "../positions";
import type { RatingInput, RatingOutput } from "./types";

// Fórmula v2, descrita em docs/nota-v2.md. É a v1 sem nenhuma mudança, mais
// um bônus por pênalti defendido pelo goleiro. Não altere os valores deste
// arquivo: mudanças de peso ou de regra entram como uma nova versão (ADR 0010).
//
// O arquivo é uma cópia independente da v1 de propósito: uma versão publicada
// não pode mudar de resultado porque outra versão foi editada.
//
// Todos os valores estão em milésimos de ponto de nota e toda a conta é feita
// com inteiros, para que o arredondamento não dependa de ponto flutuante.

const BASE = 6000;
const MIN_RATING = 3000;
const MAX_RATING = 10000;

const RESULT_BONUS: Record<MatchResult, number> = { W: 500, D: 0, L: -500 };

// Gols e assistências valem o valor cheio até o 2º; depois, metade.
const FULL_VALUE_COUNT = 2;

interface OutfieldWeights {
  goal: number;
  assist: number;
  noContribution: number;
  cleanSheet: number;
  // Por gol sofrido pelo time a partir do 2º.
  concededEach: number;
}

const OUTFIELD_WEIGHTS: Record<
  Exclude<PositionGroup, "GOL">,
  OutfieldWeights
> = {
  ATA: {
    goal: 1000,
    assist: 700,
    noContribution: -400,
    cleanSheet: 0,
    concededEach: 0,
  },
  MEI: {
    goal: 1100,
    assist: 800,
    noContribution: -200,
    cleanSheet: 200,
    concededEach: 0,
  },
  DEF: {
    goal: 1300,
    assist: 900,
    noContribution: 0,
    cleanSheet: 800,
    concededEach: 200,
  },
};

const OUTFIELD_CONCEDED_CAP = 1000;
const PARTICIPATION_MAX = 500;

const GOALKEEPER = {
  saveValue: 250,
  saveFullCount: 8,
  saveExtraValue: 100,
  savesCap: 3000,
  concededCap: 2500,
  cleanSheet: 1000,
  goal: 1000,
  assist: 700,
  // Única diferença da v2. Soma por fora das defesas: o pênalti defendido já
  // está contado em `saves` e não é contado de novo como defesa.
  penaltySaved: 500,
};

// Valor exato em milésimos: numerator / denominator.
interface Fraction {
  numerator: number;
  denominator: number;
}

function assertCount(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} deve ser um inteiro maior ou igual a zero.`);
  }
}

function validate(input: RatingInput) {
  assertCount("goals", input.goals);
  assertCount("assists", input.assists);
  assertCount("goalsFor", input.goalsFor);
  assertCount("goalsAgainst", input.goalsAgainst);

  if (input.goals + input.assists > input.goalsFor) {
    throw new RangeError(
      "Gols + assistências do jogador não podem passar do placar do time.",
    );
  }

  const decidedByScore =
    input.goalsFor > input.goalsAgainst
      ? "W"
      : input.goalsFor < input.goalsAgainst
        ? "L"
        : null;
  if (decidedByScore !== null && input.result !== decidedByScore) {
    throw new RangeError("O resultado informado não condiz com o placar.");
  }
}

function withDiminishingReturns(count: number, value: number): number {
  const full = Math.min(count, FULL_VALUE_COUNT);
  const reduced = Math.max(count - FULL_VALUE_COUNT, 0);
  return full * value + reduced * (value / 2);
}

function outfieldTotal(
  input: RatingInput,
  group: Exclude<PositionGroup, "GOL">,
): Fraction {
  const weights = OUTFIELD_WEIGHTS[group];
  const contributions = input.goals + input.assists;

  const fixed =
    BASE +
    RESULT_BONUS[input.result] +
    withDiminishingReturns(input.goals, weights.goal) +
    withDiminishingReturns(input.assists, weights.assist) +
    (contributions === 0 ? weights.noContribution : 0) +
    (input.goalsAgainst === 0 ? weights.cleanSheet : 0) -
    Math.min(
      OUTFIELD_CONCEDED_CAP,
      Math.max(input.goalsAgainst - 1, 0) * weights.concededEach,
    );

  if (input.goalsFor === 0) return { numerator: fixed, denominator: 1 };

  // Participação nos gols do time: 0,5 × (gols + assistências) ÷ gols do time.
  return {
    numerator: fixed * input.goalsFor + PARTICIPATION_MAX * contributions,
    denominator: input.goalsFor,
  };
}

function goalkeeperTotal(input: RatingInput): Fraction {
  if (input.saves === null) {
    throw new RangeError("Goleiro precisa do número de defesas.");
  }
  assertCount("saves", input.saves);

  const penaltiesSaved = input.penaltiesSaved ?? 0;
  assertCount("penaltiesSaved", penaltiesSaved);
  if (penaltiesSaved > input.saves) {
    throw new RangeError(
      "Pênaltis defendidos não podem passar do total de defesas.",
    );
  }

  const { saves, goalsAgainst } = input;
  const savesBonus = Math.min(
    GOALKEEPER.savesCap,
    Math.min(saves, GOALKEEPER.saveFullCount) * GOALKEEPER.saveValue +
      Math.max(saves - GOALKEEPER.saveFullCount, 0) * GOALKEEPER.saveExtraValue,
  );

  const fixed =
    BASE +
    RESULT_BONUS[input.result] +
    savesBonus +
    (goalsAgainst === 0 ? GOALKEEPER.cleanSheet : 0) +
    input.goals * GOALKEEPER.goal +
    input.assists * GOALKEEPER.assist +
    penaltiesSaved * GOALKEEPER.penaltySaved;

  if (goalsAgainst === 0) return { numerator: fixed, denominator: 1 };

  // Gols sofridos: 0,5 × GC × (1 − 0,5 × taxa de defesa), com
  // taxa = defesas ÷ (defesas + GC). Com o denominador comum (defesas + GC):
  //   500 × GC × (1 − defesas / (2 × chutes)) = 250 × GC × (defesas + 2 × GC) / chutes
  const shots = saves + goalsAgainst;
  const concededPenalty = Math.min(
    GOALKEEPER.concededCap * shots,
    250 * goalsAgainst * (saves + 2 * goalsAgainst),
  );

  return { numerator: fixed * shots - concededPenalty, denominator: shots };
}

export function calculateRatingV2(input: RatingInput): RatingOutput {
  validate(input);

  const group = positionGroup(input.position);
  const total =
    group === "GOL" ? goalkeeperTotal(input) : outfieldTotal(input, group);

  const { numerator, denominator } = total;
  const clamped = Math.min(
    MAX_RATING * denominator,
    Math.max(MIN_RATING * denominator, numerator),
  );
  // Décimos, arredondando meio para cima: floor(x / 100 + 1/2).
  const tenths = Math.floor(
    (2 * clamped + 100 * denominator) / (200 * denominator),
  );

  return {
    rating: tenths / 10,
    version: "v2",
    raw: numerator / denominator / 1000,
  };
}
