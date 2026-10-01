import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seed } from "@/db/seed/seed";
import { MAX_FAILED_ATTEMPTS, resetAttempts } from "@/server/auth/attempts";
import { can } from "@/server/auth/policy";
import { signIn, signInAsPlayer } from "@/server/auth/service";
import { getActorFromHeaders } from "@/server/auth/session";
import { getAuth } from "@/server/auth/auth";
import {
  getEntryPlayer,
  listAdminEntryPlayers,
  listEntryPlayers,
} from "@/server/players/entry";
import { createAccount, PASSWORD } from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Entrada do clube: jogadores (tile + senha), admin e visitante.

const sql = postgres(getTestDatabaseUrl(), { max: 2, onnotice: () => {} });

let ericky: number;
let lucao: number;
let felp: number;

async function insertPlayer(slug: string, name: string, shirtNumber: number) {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position, photo_url)
    values (${slug}, ${name}, ${shirtNumber}, 'MC', ${`/players/${slug}.webp`})
    returning id`;
  return row.id as number;
}

// Faz a entrada pelo jogador como o navegador faria e devolve os cabeçalhos
// com o cookie de sessão criado.
async function enterAs(
  playerSlug: string,
  password = PASSWORD,
  origin = "10.0.0.1",
): Promise<Headers> {
  const requestHeaders = new Headers({ "x-forwarded-for": origin });
  await signInAsPlayer(requestHeaders, { playerSlug, password });

  // signInAsPlayer cria a sessão; o cookie é recuperado com um login direto
  // equivalente, só para os testes conseguirem seguir autenticados.
  const [account] = await sql`
    select u.email from users u join players p on p.id = u.player_id
    where p.slug = ${playerSlug}`;
  const { headers } = await getAuth().api.signInEmail({
    body: { email: account.email, password },
    returnHeaders: true,
  });
  return new Headers({
    cookie: headers
      .getSetCookie()
      .map((entry) => entry.split(";")[0])
      .join("; "),
  });
}

const attempt = (playerSlug: string, password: string, origin = "10.0.0.1") =>
  signInAsPlayer(new Headers({ "x-forwarded-for": origin }), {
    playerSlug,
    password,
  });

beforeEach(async () => {
  resetAttempts();
  await resetDatabase(sql);
  ericky = await insertPlayer("ericky", "Ericky", 7);
  lucao = await insertPlayer("lucao", "Lucão", 10);
  felp = await insertPlayer("felp", "Felp", 11);
  await insertPlayer("heit", "Heit", 69);
  await createAccount({
    email: "ericky@test.dev",
    role: "admin",
    playerId: ericky,
  });
  await createAccount({ email: "felp@test.dev", playerId: felp });
});

afterAll(async () => {
  await sql.end();
});

describe("tiles de entrada", () => {
  it("lista os jogadores ativos com foto, nome, número e se há conta, sem e-mail", async () => {
    const players = await listEntryPlayers();

    expect(players).toEqual([
      {
        slug: "ericky",
        name: "Ericky",
        shirtNumber: 7,
        photoUrl: "/players/ericky.webp",
        hasAccount: true,
      },
      {
        slug: "lucao",
        name: "Lucão",
        shirtNumber: 10,
        photoUrl: "/players/lucao.webp",
        hasAccount: false,
      },
      {
        slug: "felp",
        name: "Felp",
        shirtNumber: 11,
        photoUrl: "/players/felp.webp",
        hasAccount: true,
      },
      {
        slug: "heit",
        name: "Heit",
        shirtNumber: 69,
        photoUrl: "/players/heit.webp",
        hasAccount: false,
      },
    ]);
    expect(JSON.stringify(players)).not.toContain("@");
  });

  it("jogador inativo não aparece; conta desativada conta como sem conta", async () => {
    await sql`update players set is_active = false where slug = 'heit'`;
    // Outro admin precisa existir para o Ericky poder ser desativado.
    await createAccount({
      email: "lucao@test.dev",
      role: "admin",
      playerId: lucao,
    });
    await sql`update users set banned = true where email = 'ericky@test.dev'`;

    const players = await listEntryPlayers();
    expect(players.map((player) => [player.slug, player.hasAccount])).toEqual([
      ["ericky", false],
      ["lucao", true],
      ["felp", true],
    ]);
    expect(await getEntryPlayer("heit")).toBeNull();
    expect(await getEntryPlayer("felp")).toMatchObject({ name: "Felp" });
  });

  it("a entrada Admin mostra só os jogadores com conta de administrador", async () => {
    expect((await listAdminEntryPlayers()).map((p) => p.slug)).toEqual([
      "ericky",
    ]);

    await createAccount({
      email: "lucao@test.dev",
      role: "admin",
      playerId: lucao,
    });
    expect((await listAdminEntryPlayers()).map((p) => p.slug)).toEqual([
      "ericky",
      "lucao",
    ]);
  });
});

describe("entrar como jogador", () => {
  it("a senha certa autentica a conta do jogador, e a sessão já sabe quem ele é", async () => {
    const headers = await enterAs("felp");

    expect(await getActorFromHeaders(headers)).toMatchObject({
      role: "player",
      playerId: felp,
      email: "felp@test.dev",
    });
  });

  it("jogador não é admin: não gerencia contas nem estatísticas", async () => {
    const actor = await getActorFromHeaders(await enterAs("felp"));

    expect(can(actor, { action: "accounts.manage" })).toBe(false);
    expect(can(actor, { action: "stats.manage" })).toBe(false);
    expect(can(actor, { action: "players.edit-photo", playerId: felp })).toBe(
      true,
    );
  });

  it("o admin entra pelo próprio tile e tem acesso administrativo", async () => {
    const actor = await getActorFromHeaders(await enterAs("ericky"));

    expect(actor).toMatchObject({ role: "admin", playerId: ericky });
    expect(can(actor, { action: "accounts.manage" })).toBe(true);
  });

  it("senha errada é recusada e não cria sessão", async () => {
    await expect(attempt("felp", "senha-errada")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    const [{ count }] = await sql`select count(*)::int as count from sessions`;
    expect(count).toBe(0);
  });

  it("senha de outro jogador não serve", async () => {
    await createAccount({
      email: "lucao@test.dev",
      playerId: lucao,
      password: "senha-do-lucao-1",
    });
    await expect(attempt("felp", "senha-do-lucao-1")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });

  it("jogador sem conta, inexistente ou inativo não entra", async () => {
    for (const slug of ["lucao", "ninguem"]) {
      await expect(attempt(slug, PASSWORD), slug).rejects.toMatchObject({
        code: "PLAYER_WITHOUT_ACCOUNT",
      });
    }

    await sql`update players set is_active = false where slug = 'felp'`;
    await expect(attempt("felp", PASSWORD)).rejects.toMatchObject({
      code: "PLAYER_WITHOUT_ACCOUNT",
    });
  });

  it("conta desativada não entra", async () => {
    await sql`update users set banned = true where email = 'felp@test.dev'`;
    await expect(attempt("felp", PASSWORD)).rejects.toMatchObject({
      code: "ACCOUNT_DISABLED",
    });
  });
});

describe("limite de tentativas", () => {
  it("depois de muitas senhas erradas, até a senha certa é recusada daquela origem", async () => {
    for (let index = 0; index < MAX_FAILED_ATTEMPTS; index++) {
      await expect(attempt("felp", "errada")).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }

    await expect(attempt("felp", PASSWORD)).rejects.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    });
    // O dono da conta, de outra origem, continua entrando.
    await attempt("felp", PASSWORD, "10.0.0.99");
    // E a outra conta não foi afetada.
    await attempt("ericky", PASSWORD);
  });

  it("um login certo zera a contagem", async () => {
    for (let index = 0; index < MAX_FAILED_ATTEMPTS - 1; index++) {
      await attempt("felp", "errada").catch(() => {});
    }
    await attempt("felp", PASSWORD);
    await attempt("felp", "errada").catch(() => {});

    await attempt("felp", PASSWORD);
  });

  it("vale também para a entrada com e-mail", async () => {
    const origin = new Headers({ "x-forwarded-for": "10.0.0.5" });
    for (let index = 0; index < MAX_FAILED_ATTEMPTS; index++) {
      await signIn(origin, {
        email: "felp@test.dev",
        password: "errada",
      }).catch(() => {});
    }

    await expect(
      signIn(origin, { email: "felp@test.dev", password: PASSWORD }),
    ).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });
});

describe("fotos dos jogadores", () => {
  it("o seed cadastra a foto de cada jogador", async () => {
    await resetDatabase(sql);
    await seed(drizzle(sql));

    const rows = await sql`
      select slug, photo_url from players order by shirt_number`;
    expect(rows).toEqual([
      { slug: "ericky", photo_url: "/players/ericky.webp" },
      { slug: "lucao", photo_url: "/players/lucao.webp" },
      { slug: "felp", photo_url: "/players/felp.webp" },
      { slug: "heit", photo_url: "/players/heit.webp" },
    ]);
  });

  it("a migration preenche só quem não tem foto, sem sobrescrever uma já trocada", async () => {
    await sql`update players set photo_url = null where slug in ('ericky', 'lucao')`;
    await sql`update players set photo_url = '/players/outra.webp' where slug = 'felp'`;

    const migration = readFileSync(
      "src/db/migrations/0006_player_photos.sql",
      "utf8",
    );
    for (const statement of migration.split("--> statement-breakpoint")) {
      await sql.unsafe(statement);
    }

    const rows = await sql`
      select slug, photo_url from players order by shirt_number`;
    expect(rows).toEqual([
      { slug: "ericky", photo_url: "/players/ericky.webp" },
      { slug: "lucao", photo_url: "/players/lucao.webp" },
      { slug: "felp", photo_url: "/players/outra.webp" },
      { slug: "heit", photo_url: "/players/heit.webp" },
    ]);
  });

  it("os arquivos de foto e do escudo existem no projeto", () => {
    for (const file of [
      "public/players/ericky.webp",
      "public/players/lucao.webp",
      "public/players/felp.webp",
      "public/players/heit.webp",
      "public/brand/logo.webp",
      "public/brand/crest.webp",
    ]) {
      expect(readFileSync(file).length, file).toBeGreaterThan(1000);
    }
  });
});
