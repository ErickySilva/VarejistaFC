import { isGoalkeeper, type Position } from "./positions";

// Uma partida como é registrada: placar e participações. As regras daqui são
// as mesmas que o banco impõe (constraints e gatilhos); servem para dar
// retorno claro no formulário e no servidor antes de a gravação ser tentada.

export interface ParticipationEntry {
  playerId: number;
  position: Position;
  goals: number;
  assists: number;
  // Só para goleiro; null para jogador de linha.
  saves: number | null;
  // Pênaltis defendidos durante a partida, já incluídos em `saves`.
  penaltiesSaved: number | null;
}

export interface MatchEntry {
  goalsFor: number;
  goalsAgainst: number;
  wentToPenalties: boolean;
  penaltyScoreFor: number | null;
  penaltyScoreAgainst: number | null;
  participations: ParticipationEntry[];
}

export type MatchEntryIssueCode =
  | "INVALID_NUMBER"
  | "NO_PLAYERS"
  | "DUPLICATE_PLAYER"
  | "MULTIPLE_GOALKEEPERS"
  | "GOALS_EXCEED_SCORE"
  | "ASSISTS_EXCEED_SCORE"
  | "CONTRIBUTIONS_EXCEED_SCORE"
  | "SAVES_REQUIRED"
  | "SAVES_NOT_ALLOWED"
  | "PENALTIES_SAVED_EXCEED_SAVES"
  | "PENALTIES_REQUIRE_DRAW"
  | "PENALTY_SCORE_REQUIRED"
  | "PENALTY_SCORE_TIED"
  | "PENALTY_SCORE_NOT_ALLOWED";

export interface MatchEntryIssue {
  code: MatchEntryIssueCode;
  message: string;
  // Jogador a que o problema se refere, quando é de uma participação.
  playerId?: number;
}

function isCount(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0;
}

export function validateMatchEntry(entry: MatchEntry): MatchEntryIssue[] {
  const issues: MatchEntryIssue[] = [];
  const add = (code: MatchEntryIssueCode, message: string, playerId?: number) =>
    issues.push({ code, message, playerId });

  if (!isCount(entry.goalsFor) || !isCount(entry.goalsAgainst)) {
    add(
      "INVALID_NUMBER",
      "O placar precisa ser de números inteiros a partir de zero.",
    );
    return issues;
  }

  // Disputa de pênaltis: só depois de empate, e alguém precisa vencer.
  const hasPenaltyScore =
    entry.penaltyScoreFor !== null || entry.penaltyScoreAgainst !== null;
  if (entry.wentToPenalties) {
    if (entry.goalsFor !== entry.goalsAgainst) {
      add(
        "PENALTIES_REQUIRE_DRAW",
        "Só há disputa de pênaltis quando a partida termina empatada.",
      );
    }
    if (
      !isCount(entry.penaltyScoreFor) ||
      !isCount(entry.penaltyScoreAgainst)
    ) {
      add("PENALTY_SCORE_REQUIRED", "Informe o placar da disputa de pênaltis.");
    } else if (entry.penaltyScoreFor === entry.penaltyScoreAgainst) {
      add(
        "PENALTY_SCORE_TIED",
        "A disputa de pênaltis não pode terminar empatada.",
      );
    }
  } else if (hasPenaltyScore) {
    add(
      "PENALTY_SCORE_NOT_ALLOWED",
      "Placar de pênaltis informado sem marcar que houve disputa.",
    );
  }

  if (entry.participations.length === 0) {
    add("NO_PLAYERS", "Selecione pelo menos um jogador que participou.");
    return issues;
  }

  const seen = new Set<number>();
  let goalkeepers = 0;
  let goals = 0;
  let assists = 0;

  for (const participation of entry.participations) {
    const { playerId } = participation;

    if (seen.has(playerId)) {
      add("DUPLICATE_PLAYER", "O mesmo jogador aparece duas vezes.", playerId);
      continue;
    }
    seen.add(playerId);

    if (!isCount(participation.goals) || !isCount(participation.assists)) {
      add(
        "INVALID_NUMBER",
        "Gols e assistências precisam ser inteiros a partir de zero.",
        playerId,
      );
      continue;
    }
    goals += participation.goals;
    assists += participation.assists;

    if (participation.goals + participation.assists > entry.goalsFor) {
      add(
        "CONTRIBUTIONS_EXCEED_SCORE",
        "Gols + assistências do jogador passam do placar do time.",
        playerId,
      );
    }

    if (isGoalkeeper(participation.position)) {
      goalkeepers++;
      if (!isCount(participation.saves)) {
        add("SAVES_REQUIRED", "Informe as defesas do goleiro.", playerId);
      } else if (participation.penaltiesSaved !== null) {
        if (!isCount(participation.penaltiesSaved)) {
          add(
            "INVALID_NUMBER",
            "Defesas de pênalti precisam ser um inteiro a partir de zero.",
            playerId,
          );
        } else if (participation.penaltiesSaved > participation.saves) {
          add(
            "PENALTIES_SAVED_EXCEED_SAVES",
            "As defesas de pênalti já fazem parte do total de defesas e não podem ser maiores que ele.",
            playerId,
          );
        }
      }
    } else if (
      participation.saves !== null ||
      participation.penaltiesSaved !== null
    ) {
      add(
        "SAVES_NOT_ALLOWED",
        "Só o goleiro tem defesas e defesas de pênalti.",
        playerId,
      );
    }
  }

  if (goalkeepers > 1) {
    add("MULTIPLE_GOALKEEPERS", "A partida só pode ter um goleiro.");
  }
  if (goals > entry.goalsFor) {
    add(
      "GOALS_EXCEED_SCORE",
      `Os jogadores somam ${goals} gols, mas o placar do Varejista é ${entry.goalsFor}.`,
    );
  }
  if (assists > entry.goalsFor) {
    add(
      "ASSISTS_EXCEED_SCORE",
      `Os jogadores somam ${assists} assistências, mas o placar do Varejista é ${entry.goalsFor}.`,
    );
  }

  return issues;
}
