import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { RequestContext } from "@/server/auth/session";
import { startGameplay } from "@/server/nights/service";
import {
  activateSeason,
  createSeason,
  getActiveSeason,
  listSeasons,
} from "@/server/seasons/service";
import { contextFor, createAccount } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Temporadas: troca manual por admin, no máximo uma ativa (ADR 0013).

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

let admin: RequestContext;
let player: RequestContext;

async function audits() {
  return sql`
    select actor_user_id, action, entity_id, before, after
    from audit_log where entity = 'seasons' order by id`;
}

beforeEach(async () => {
  await resetDatabase(sql);
  await sql`
    insert into seasons (slug, name, game_edition, starts_on, is_active)
    values ('fc-25', 'FC 25', 'FC 25', null, false),
           ('fc-26', 'FC 26', 'FC 26', '2026-06-06', true)`;
  await createAccount({ email: "admin@test.dev", role: "admin" });
  await createAccount({ email: "jogador@test.dev" });
  admin = await contextFor("admin@test.dev");
  player = await contextFor("jogador@test.dev");
});

afterAll(async () => {
  await sql.end();
});

describe("consulta", () => {
  it("lista as temporadas com a ativa primeiro", async () => {
    const seasons = await listSeasons();
    expect(seasons.map((season) => [season.slug, season.isActive])).toEqual([
      ["fc-26", true],
      ["fc-25", false],
    ]);
    expect(await getActiveSeason()).toMatchObject({ slug: "fc-26" });
  });
});

describe("criar temporada", () => {
  it("admin cria a temporada, que nasce inativa, e a criação é auditada", async () => {
    const created = await createSeason(admin, {
      name: "FC 27",
      gameEdition: "FC 27",
    });

    expect(created).toEqual({
      id: expect.any(Number),
      slug: "fc-27",
      name: "FC 27",
      gameEdition: "FC 27",
      isActive: false,
    });
    // A temporada ativa não mudou sozinha.
    expect(await getActiveSeason()).toMatchObject({ slug: "fc-26" });
    expect(await audits()).toMatchObject([
      {
        actor_user_id: admin.actor.userId,
        action: "create",
        entity_id: String(created.id),
      },
    ]);
  });

  it("nome repetido é recusado", async () => {
    await expect(
      createSeason(admin, { name: "FC 26", gameEdition: "FC 26" }),
    ).rejects.toMatchObject({ code: "SEASON_ALREADY_EXISTS" });
    expect(await audits()).toEqual([]);
  });

  it("player não cria temporada", async () => {
    await expect(
      createSeason(player, { name: "FC 27", gameEdition: "FC 27" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await listSeasons()).toHaveLength(2);
  });
});

describe("ativar temporada", () => {
  it("a troca é manual: a nova fica ativa e a anterior deixa de ser", async () => {
    const fc27 = await createSeason(admin, {
      name: "FC 27",
      gameEdition: "FC 27",
    });

    const activated = await activateSeason(admin, { seasonId: fc27.id });

    expect(activated).toMatchObject({ slug: "fc-27", isActive: true });
    const rows = await sql`
      select slug from seasons where is_active order by slug`;
    expect(rows.map((row) => row.slug)).toEqual(["fc-27"]);
    expect((await audits()).at(-1)).toMatchObject({
      actor_user_id: admin.actor.userId,
      action: "update",
      before: { activeSeason: "fc-26" },
      after: { activeSeason: "fc-27" },
    });
  });

  it("as novas gameplays entram na temporada ativada", async () => {
    const fc27 = await createSeason(admin, {
      name: "FC 27",
      gameEdition: "FC 27",
    });
    await activateSeason(admin, { seasonId: fc27.id });

    await startGameplay(admin, new Date("2026-10-02T23:00:00Z"));

    const [night] = await sql`
      select s.slug from nights n join seasons s on s.id = n.season_id`;
    expect(night.slug).toBe("fc-27");
  });

  it("uma gameplay aberta continua na temporada em que começou", async () => {
    await startGameplay(admin, new Date("2026-10-02T23:00:00Z"));
    const fc27 = await createSeason(admin, {
      name: "FC 27",
      gameEdition: "FC 27",
    });

    await activateSeason(admin, { seasonId: fc27.id });

    const [night] = await sql`
      select s.slug from nights n join seasons s on s.id = n.season_id`;
    expect(night.slug).toBe("fc-26");
  });

  it("ativar a que já está ativa não muda nada nem audita", async () => {
    const [active] = await sql`select id from seasons where is_active`;
    await activateSeason(admin, { seasonId: active.id });
    expect(await audits()).toEqual([]);
  });

  it("pode voltar para uma temporada antiga", async () => {
    const [fc25] = await sql`select id from seasons where slug = 'fc-25'`;
    await activateSeason(admin, { seasonId: fc25.id });
    expect(await getActiveSeason()).toMatchObject({ slug: "fc-25" });
  });

  it("temporada inexistente e player sem permissão", async () => {
    await expect(
      activateSeason(admin, { seasonId: 9999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const [fc25] = await sql`select id from seasons where slug = 'fc-25'`;
    await expect(
      activateSeason(player, { seasonId: fc25.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await getActiveSeason()).toMatchObject({ slug: "fc-26" });
  });

  it("o banco impede duas temporadas ativas", async () => {
    await expect(
      sql`update seasons set is_active = true where slug = 'fc-25'`,
    ).rejects.toMatchObject({ constraint_name: "seasons_single_active_idx" });
  });

  it("a data não troca a temporada: uma data fora do período não muda a ativa", async () => {
    // FC 26 "terminou" ontem pelas datas; continua sendo a ativa até um admin
    // trocar.
    await sql`update seasons set ends_on = '2026-10-01' where slug = 'fc-26'`;

    await startGameplay(admin, new Date("2026-10-02T23:00:00Z"));

    const [night] = await sql`
      select s.slug from nights n join seasons s on s.id = n.season_id`;
    expect(night.slug).toBe("fc-26");
  });
});
