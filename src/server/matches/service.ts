import "server-only";
import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { matches, matchPlayers, nights, opponents, players } from "@/db/schema";
import { matchResult } from "@/domain/match";
import {
  validateMatchEntry,
  type MatchEntry,
  type ParticipationEntry,
} from "@/domain/match-entry";
import type { MatchType } from "@/domain/match-type";
import { calculateRating } from "@/domain/rating";
import { ineligiblePlayerIds } from "@/domain/roster";
import { recordAudit } from "../audit";
import { assertCan, type RequestContext } from "../auth/session";
import { ServiceError, toServiceError } from "../errors";
import { getMatchDetail, type MatchDetail } from "../nights/queries";

// Registro, edição e exclusão de partidas da gameplay em andamento (ADR 0012).
// Só jogadores informados em `participations` recebem uma participação, e
// portanto um jogo. A nota é sempre calculada aqui, nunca recebida do cliente.

const MANAGE_STATS = { action: "stats.manage" } as const;

export interface MatchInput extends MatchEntry {
  opponentName: string;
  matchType: MatchType;
}

async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withTransaction(fn);
  } catch (error) {
    throw toServiceError(error);
  }
}

function assertValidEntry(input: MatchInput) {
  const issues = validateMatchEntry(input);
  if (issues.length > 0) {
    // Mensagens repetidas (o mesmo problema em dois jogadores) aparecem uma vez.
    const messages = [...new Set(issues.map((issue) => issue.message))];
    throw new ServiceError("INVALID_MATCH", messages.join(" "));
  }
}

// Só jogadores ativos entram em uma partida. Na edição, quem já participa dela
// pode ser mantido mesmo que tenha sido desativado depois.
async function assertPlayersEligible(
  participations: ParticipationEntry[],
  currentParticipantIds: number[] = [],
) {
  const ids = participations.map((participation) => participation.playerId);
  const found = await getDb()
    .select({ id: players.id, isActive: players.isActive })
    .from(players)
    .where(inArray(players.id, ids));
  if (ineligiblePlayerIds(ids, found, currentParticipantIds).length > 0) {
    throw new ServiceError("NOT_FOUND", "Jogador não encontrado ou inativo.");
  }
}

// Adversário pelo nome, sem diferenciar maiúsculas; criado se ainda não existe.
async function findOrCreateOpponent(rawName: string): Promise<number> {
  const name = rawName.trim().replace(/\s+/g, " ");
  const db = getDb();
  await db.insert(opponents).values({ name }).onConflictDoNothing();
  const [opponent] = await db
    .select({ id: opponents.id })
    .from(opponents)
    .where(sql`lower(${opponents.name}) = lower(${name})`);
  return opponent.id;
}

function matchValues(input: MatchInput, opponentId: number) {
  return {
    opponentId,
    matchType: input.matchType,
    goalsFor: input.goalsFor,
    goalsAgainst: input.goalsAgainst,
    wentToPenalties: input.wentToPenalties,
    penaltyScoreFor: input.wentToPenalties ? input.penaltyScoreFor : null,
    penaltyScoreAgainst: input.wentToPenalties
      ? input.penaltyScoreAgainst
      : null,
  };
}

// Grava as participações com a nota calculada pela versão vigente da fórmula.
async function insertParticipations(matchId: number, input: MatchInput) {
  const result = matchResult(input);

  await getDb()
    .insert(matchPlayers)
    .values(
      input.participations.map((participation) => {
        const { rating, version } = calculateRating({
          position: participation.position,
          goals: participation.goals,
          assists: participation.assists,
          saves: participation.saves,
          penaltiesSaved: participation.penaltiesSaved,
          goalsFor: input.goalsFor,
          goalsAgainst: input.goalsAgainst,
          result,
        });
        return {
          matchId,
          playerId: participation.playerId,
          position: participation.position,
          goals: participation.goals,
          assists: participation.assists,
          saves: participation.saves,
          penaltiesSaved: participation.penaltiesSaved,
          rating,
          ratingVersion: version,
          // Só é guardada: não participa do cálculo acima.
          fifaRating: participation.fifaRating,
        };
      }),
    );
}

// Retrato da partida para a auditoria.
function snapshot(match: MatchDetail) {
  return {
    nightId: match.nightId,
    sequence: match.sequence,
    opponent: match.opponentName,
    matchType: match.matchType,
    goalsFor: match.goalsFor,
    goalsAgainst: match.goalsAgainst,
    wentToPenalties: match.wentToPenalties,
    penaltyScoreFor: match.penaltyScoreFor,
    penaltyScoreAgainst: match.penaltyScoreAgainst,
    result: match.result,
    participations: match.participations.map((participation) => ({
      playerId: participation.playerId,
      position: participation.position,
      goals: participation.goals,
      assists: participation.assists,
      saves: participation.saves,
      penaltiesSaved: participation.penaltiesSaved,
      rating: participation.rating,
      ratingVersion: participation.ratingVersion,
      fifaRating: participation.fifaRating,
    })),
  };
}

// Partida existente em uma noite aberta. O FOR SHARE na noite impede que ela
// seja encerrada enquanto a partida é alterada.
async function loadEditableMatch(matchId: number): Promise<MatchDetail> {
  const match = await getMatchDetail(matchId);
  if (!match) throw new ServiceError("NOT_FOUND", "Partida não encontrada.");

  const [night] = await getDb()
    .select({ status: nights.status })
    .from(nights)
    .where(eq(nights.id, match.nightId))
    .for("share");
  if (night.status !== "open") throw new ServiceError("NIGHT_CLOSED");

  return match;
}

export async function registerMatch(
  context: RequestContext,
  input: MatchInput,
  now: Date = new Date(),
): Promise<MatchDetail> {
  assertCan(context.actor, MANAGE_STATS);
  assertValidEntry(input);

  return inTransaction(async () => {
    const db = getDb();
    const [night] = await db
      .select({ id: nights.id })
      .from(nights)
      .where(eq(nights.status, "open"))
      .for("share");
    if (!night) throw new ServiceError("NO_OPEN_NIGHT");

    await assertPlayersEligible(input.participations);
    const opponentId = await findOrCreateOpponent(input.opponentName);

    const [{ last }] = await db
      .select({ last: max(matches.sequence) })
      .from(matches)
      .where(and(eq(matches.nightId, night.id), isNull(matches.deletedAt)));

    const [created] = await db
      .insert(matches)
      .values({
        ...matchValues(input, opponentId),
        nightId: night.id,
        sequence: (last ?? 0) + 1,
        playedAt: now,
      })
      .returning({ id: matches.id });
    await insertParticipations(created.id, input);

    const match = (await getMatchDetail(created.id))!;
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "create",
      entity: "matches",
      entityId: match.id,
      after: snapshot(match),
    });
    return match;
  });
}

// Corrige uma partida da noite aberta. As participações são regravadas e todas
// as notas recalculadas, porque o placar entra na nota de cada jogador.
export async function updateMatch(
  context: RequestContext,
  input: MatchInput & { matchId: number },
): Promise<MatchDetail> {
  assertCan(context.actor, MANAGE_STATS);
  assertValidEntry(input);

  return inTransaction(async () => {
    const db = getDb();
    const before = await loadEditableMatch(input.matchId);

    await assertPlayersEligible(
      input.participations,
      before.participations.map((participation) => participation.playerId),
    );
    const opponentId = await findOrCreateOpponent(input.opponentName);

    await db
      .update(matches)
      .set(matchValues(input, opponentId))
      .where(eq(matches.id, input.matchId));
    await db
      .delete(matchPlayers)
      .where(eq(matchPlayers.matchId, input.matchId));
    await insertParticipations(input.matchId, input);

    const after = (await getMatchDetail(input.matchId))!;
    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "matches",
      entityId: input.matchId,
      before: snapshot(before),
      after: snapshot(after),
    });
    return after;
  });
}

// Exclusão lógica: a partida sai das estatísticas, mas a linha permanece.
export async function deleteMatch(
  context: RequestContext,
  input: { matchId: number },
  now: Date = new Date(),
): Promise<void> {
  assertCan(context.actor, MANAGE_STATS);

  await inTransaction(async () => {
    const before = await loadEditableMatch(input.matchId);

    await getDb()
      .update(matches)
      .set({ deletedAt: now })
      .where(eq(matches.id, input.matchId));

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "delete",
      entity: "matches",
      entityId: input.matchId,
      before: snapshot(before),
    });
  });
}
