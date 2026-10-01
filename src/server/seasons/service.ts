import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { seasons } from "@/db/schema";
import { recordAudit } from "../audit";
import { assertCan, type RequestContext } from "../auth/session";
import { ServiceError, toServiceError } from "../errors";

// Temporadas (ADR 0013). São ligadas à edição do EA FC e trocadas à mão por um
// admin: nenhuma data ativa ou desativa uma temporada.

const MANAGE_STATS = { action: "stats.manage" } as const;

export interface Season {
  id: number;
  slug: string;
  name: string;
  gameEdition: string;
  isActive: boolean;
}

const seasonColumns = {
  id: seasons.id,
  slug: seasons.slug,
  name: seasons.name,
  gameEdition: seasons.gameEdition,
  isActive: seasons.isActive,
};

// Leitura pública: a ativa primeiro, depois as mais recentes.
export async function listSeasons(): Promise<Season[]> {
  return getDb()
    .select(seasonColumns)
    .from(seasons)
    .orderBy(desc(seasons.isActive), desc(seasons.id));
}

export async function getActiveSeason(): Promise<Season | null> {
  const [season] = await getDb()
    .select(seasonColumns)
    .from(seasons)
    .where(eq(seasons.isActive, true));
  return season ?? null;
}

export async function getSeasonBySlug(slug: string): Promise<Season | null> {
  const [season] = await getDb()
    .select(seasonColumns)
    .from(seasons)
    .where(eq(seasons.slug, slug))
    .orderBy(asc(seasons.id));
  return season ?? null;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withTransaction(fn);
  } catch (error) {
    throw toServiceError(error);
  }
}

// Cadastra uma temporada, sempre inativa. Ativar é um passo à parte.
export async function createSeason(
  context: RequestContext,
  input: { name: string; gameEdition: string },
): Promise<Season> {
  assertCan(context.actor, MANAGE_STATS);

  const slug = slugify(input.name);
  if (!slug) throw new ServiceError("INVALID_INPUT");

  return inTransaction(async () => {
    const [created] = await getDb()
      .insert(seasons)
      .values({ slug, name: input.name, gameEdition: input.gameEdition })
      .returning(seasonColumns);

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "create",
      entity: "seasons",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

// Troca manual da temporada ativa. As noites já registradas continuam na
// temporada em que começaram, inclusive uma gameplay que esteja aberta.
export async function activateSeason(
  context: RequestContext,
  input: { seasonId: number },
): Promise<Season> {
  assertCan(context.actor, MANAGE_STATS);

  return inTransaction(async () => {
    const db = getDb();
    const [target] = await db
      .select(seasonColumns)
      .from(seasons)
      .where(eq(seasons.id, input.seasonId))
      .for("update");
    if (!target)
      throw new ServiceError("NOT_FOUND", "Temporada não encontrada.");
    if (target.isActive) return target;

    const [previous] = await db
      .select(seasonColumns)
      .from(seasons)
      .where(eq(seasons.isActive, true))
      .for("update");

    // Primeiro desativa: o banco só aceita uma temporada ativa por vez.
    if (previous) {
      await db
        .update(seasons)
        .set({ isActive: false })
        .where(eq(seasons.id, previous.id));
    }
    await db
      .update(seasons)
      .set({ isActive: true })
      .where(eq(seasons.id, target.id));

    await recordAudit({
      actorUserId: context.actor.userId,
      action: "update",
      entity: "seasons",
      entityId: target.id,
      before: { activeSeason: previous?.slug ?? null },
      after: { activeSeason: target.slug },
    });
    return { ...target, isActive: true };
  });
}
