import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import {
  matches,
  matchPlayers,
  nicknameAssignments,
  nightAwards,
  nights,
  seasons,
} from "@/db/schema";
import { summarizeNight } from "@/domain/night";
import { renderNightSummary } from "@/domain/night/summary-text";
import { formatReferenceDate, referenceDateFor } from "@/domain/reference-date";
import { recordAudit } from "../audit";
import { assertCan, type RequestContext } from "../auth/session";
import { ServiceError, toServiceError } from "../errors";
import { getNightDetail, toDomainNight, type NightDetail } from "./queries";

// Ciclo da gameplay: iniciar, encerrar e cancelar (ADR 0012). O usuário nunca
// "cria uma noite": ela nasce ou é reaberta quando a gameplay começa.

const MANAGE_STATS = { action: "stats.manage" } as const;

async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withTransaction(fn);
  } catch (error) {
    throw toServiceError(error);
  }
}

// A noite aberta, travada até o fim da transação: iniciar, encerrar e cancelar
// não se atropelam.
async function lockOpenNight() {
  const [open] = await getDb()
    .select({ id: nights.id, referenceDate: nights.referenceDate })
    .from(nights)
    .where(eq(nights.status, "open"))
    .for("update");
  return open ?? null;
}

async function countActiveMatches(nightId: number): Promise<number> {
  return getDb().$count(
    matches,
    and(eq(matches.nightId, nightId), isNull(matches.deletedAt)),
  );
}

// Remove uma noite que não tem nenhuma partida válida. As partidas que
// restarem nela já estavam excluídas logicamente; o conteúdo delas continua
// na auditoria.
async function discardEmptyNight(
  context: RequestContext,
  night: { id: number; referenceDate: string },
) {
  const db = getDb();
  const leftovers = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.nightId, night.id));
  const matchIds = leftovers.map((match) => match.id);

  if (matchIds.length > 0) {
    await db
      .delete(nicknameAssignments)
      .where(inArray(nicknameAssignments.matchId, matchIds));
    await db
      .delete(matchPlayers)
      .where(inArray(matchPlayers.matchId, matchIds));
    await db.delete(matches).where(inArray(matches.id, matchIds));
  }
  await db
    .delete(nicknameAssignments)
    .where(eq(nicknameAssignments.nightId, night.id));
  await db.delete(nightAwards).where(eq(nightAwards.nightId, night.id));
  await db.delete(nights).where(eq(nights.id, night.id));

  await recordAudit({
    actorUserId: context.actor.userId,
    action: "delete",
    entity: "nights",
    entityId: night.id,
    before: {
      referenceDate: night.referenceDate,
      reason: "gameplay sem partidas",
      removedDeletedMatches: matchIds.length,
    },
  });
}

export type StartGameplayOutcome = "created" | "reopened" | "already-open";

export interface StartGameplayResult {
  nightId: number;
  referenceDate: string;
  outcome: StartGameplayOutcome;
}

// "Dar início à Gameplay". A data de referência é a de agora em São Paulo e
// não muda depois, mesmo que a sessão atravesse a meia-noite.
export async function startGameplay(
  context: RequestContext,
  now: Date = new Date(),
): Promise<StartGameplayResult> {
  assertCan(context.actor, MANAGE_STATS);
  const today = referenceDateFor(now);

  return inTransaction(async () => {
    const db = getDb();
    const open = await lockOpenNight();

    if (open) {
      if (open.referenceDate === today) {
        return {
          nightId: open.id,
          referenceDate: today,
          outcome: "already-open",
        };
      }
      // Gameplay de outra data ainda aberta: se tem partidas, precisa ser
      // encerrada; se ficou vazia, é descartada para não travar a de hoje.
      if ((await countActiveMatches(open.id)) > 0) {
        throw new ServiceError(
          "PREVIOUS_NIGHT_OPEN",
          `A gameplay de ${formatReferenceDate(open.referenceDate)} ainda está aberta. Encerre-a antes de iniciar outra.`,
        );
      }
      await discardEmptyNight(context, open);
    }

    const [existing] = await db
      .select({ id: nights.id })
      .from(nights)
      .where(eq(nights.referenceDate, today))
      .for("update");

    if (existing) {
      // Já houve gameplay hoje e ela foi encerrada: a mesma noite é reaberta.
      // Os prêmios antigos saem e serão recalculados no novo encerramento.
      const removedAwards = await db
        .delete(nightAwards)
        .where(eq(nightAwards.nightId, existing.id))
        .returning({ id: nightAwards.id });
      await db
        .update(nights)
        .set({ status: "open", closedAt: null, summary: null })
        .where(eq(nights.id, existing.id));

      await recordAudit({
        actorUserId: context.actor.userId,
        action: "reopen",
        entity: "nights",
        entityId: existing.id,
        before: { status: "closed", awards: removedAwards.length },
        after: { status: "open", awards: 0 },
      });
      return {
        nightId: existing.id,
        referenceDate: today,
        outcome: "reopened",
      };
    }

    const [season] = await db
      .select({ id: seasons.id })
      .from(seasons)
      .where(
        and(
          lte(seasons.startsOn, today),
          or(isNull(seasons.endsOn), gte(seasons.endsOn, today)),
        ),
      )
      .orderBy(desc(seasons.startsOn))
      .limit(1);
    if (!season) throw new ServiceError("NO_ACTIVE_SEASON");

    const [created] = await db
      .insert(nights)
      .values({
        seasonId: season.id,
        referenceDate: today,
        status: "open",
        startedAt: now,
      })
      .returning({ id: nights.id });

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "create",
      entity: "nights",
      entityId: created.id,
      after: { referenceDate: today, seasonId: season.id, status: "open" },
    });
    return { nightId: created.id, referenceDate: today, outcome: "created" };
  });
}

// "Encerrar Gameplay": calcula prêmios e resumo a partir das partidas, grava
// tudo e fecha a noite. Não fecha noite sem partida.
export async function closeGameplay(
  context: RequestContext,
  now: Date = new Date(),
): Promise<NightDetail> {
  assertCan(context.actor, MANAGE_STATS);

  return inTransaction(async () => {
    const db = getDb();
    const open = await lockOpenNight();
    if (!open) throw new ServiceError("NO_OPEN_NIGHT");

    const night = (await getNightDetail(open.id))!;
    if (night.matches.length === 0) {
      throw new ServiceError("NIGHT_WITHOUT_MATCHES");
    }

    const summary = summarizeNight(toDomainNight(night));
    const names = new Map(
      night.matches.flatMap((match) =>
        match.participations.map(
          (participation) =>
            [participation.playerId, participation.playerName] as const,
        ),
      ),
    );
    const summaryText = renderNightSummary(
      summary,
      (playerId) => names.get(playerId) ?? `Jogador ${playerId}`,
    );

    await db.delete(nightAwards).where(eq(nightAwards.nightId, night.id));
    if (summary.awards.length > 0) {
      await db.insert(nightAwards).values(
        summary.awards.map((award) => ({
          nightId: night.id,
          award: award.award,
          playerId: award.playerId,
          value: award.value,
        })),
      );
    }
    await db
      .update(nights)
      .set({ status: "closed", closedAt: now, summary: summaryText })
      .where(eq(nights.id, night.id));

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "close",
      entity: "nights",
      entityId: night.id,
      before: { status: "open" },
      after: {
        status: "closed",
        matchCount: summary.matchCount,
        wins: summary.wins,
        draws: summary.draws,
        losses: summary.losses,
        awards: summary.awards,
      },
    });

    return (await getNightDetail(night.id))!;
  });
}

// Desiste de uma gameplay que não tem nenhuma partida: a noite é removida,
// para que não fique uma noite vazia no histórico.
export async function cancelGameplay(context: RequestContext): Promise<void> {
  assertCan(context.actor, MANAGE_STATS);

  await inTransaction(async () => {
    const open = await lockOpenNight();
    if (!open) throw new ServiceError("NO_OPEN_NIGHT");
    if ((await countActiveMatches(open.id)) > 0) {
      throw new ServiceError("NIGHT_HAS_MATCHES");
    }
    await discardEmptyNight(context, open);
  });
}
