import postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createActionFactory } from "@/server/actions/action";
import {
  checkInviteSchema,
  generateInviteSchema,
  registerWithInviteSchema,
} from "@/server/actions/schemas";
import { MAX_FAILED_ATTEMPTS, resetAttempts } from "@/server/auth/attempts";
import { can } from "@/server/auth/policy";
import { signInAsPlayer } from "@/server/auth/service";
import {
  getActorFromHeaders,
  type RequestContext,
} from "@/server/auth/session";
import { ServiceError } from "@/server/errors";
import { hashInviteCode, normalizeInviteCode } from "@/server/invites/code";
import {
  checkInvite,
  generateInvite,
  INVITE_TTL_DAYS,
  listPendingInvites,
  registerWithInvite,
} from "@/server/invites/service";
import {
  listAdminEntryPlayers,
  listEntryPlayers,
} from "@/server/players/entry";
import {
  createAccount as createAccountByAdmin,
  setAccountRole,
} from "@/server/users/service";
import {
  contextFor,
  createAccount as seedAccount,
  PASSWORD,
  signIn as signInHeaders,
} from "./auth-helpers";
import { resetDatabase } from "./reset-database";
import { getTestDatabaseUrl } from "./test-database";

// Cadastro por convite (ADR 0015): geração, uso, recusas, adulteração,
// permissões e atomicidade.

const sql = postgres(getTestDatabaseUrl(), { max: 4, onnotice: () => {} });

const NEW_PASSWORD = "senha-do-jogador-456";
const DAY = 24 * 60 * 60 * 1000;

let admin: RequestContext;
let ericky: number;
let lucao: number;
let felp: number;
let heit: number;
let warnings: ReturnType<typeof vi.spyOn>;

async function insertPlayer(slug: string, name: string, shirtNumber: number) {
  const [row] = await sql`
    insert into players (slug, name, shirt_number, default_position, photo_url)
    values (${slug}, ${name}, ${shirtNumber}, 'MC', ${`/players/${slug}.webp`})
    returning id`;
  return row.id as number;
}

const from = (origin = "10.0.0.1") =>
  new Headers({ "x-forwarded-for": origin });

function register(
  code: string,
  overrides: { email?: string; password?: string; origin?: string } = {},
) {
  return registerWithInvite(from(overrides.origin), {
    code,
    email: overrides.email ?? "novo@test.dev",
    password: overrides.password ?? NEW_PASSWORD,
  });
}

async function inviteRows() {
  return sql`
    select id, player_id, role, code_hash, expires_at, used_at,
           used_by_user_id, revoked_at, created_by_user_id
    from account_invites order by id`;
}

async function audits() {
  return sql`
    select actor_user_id, action, entity, entity_id, before, after
    from audit_log order by id`;
}

// Tudo o que um cadastro pode gravar. Um cadastro que falha tem de deixar
// este retrato exatamente igual.
async function persisted() {
  const [row] = await sql`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from accounts) as credentials,
      (select count(*)::int from sessions) as sessions,
      (select count(*)::int from audit_log) as audits,
      (select count(*)::int from account_invites where used_at is not null) as used_invites,
      (select count(*)::int from account_invites
        where used_at is null and revoked_at is null) as pending_invites`;
  return row;
}

// Sessão real de uma conta criada por convite, para conferir papel e vínculo.
async function sessionOf(email: string): Promise<RequestContext> {
  const headers = await signInHeaders(email, NEW_PASSWORD);
  const actor = await getActorFromHeaders(headers);
  if (!actor) throw new Error(`Sem sessão para ${email}`);
  return { actor, headers };
}

// Envelope das Server Actions com a sessão simulada, ligado aos schemas e
// serviços reais, como em src/server/actions/invite-actions.ts.
function actionsFor(context: RequestContext | null) {
  const { protectedAction, publicAction } = createActionFactory({
    requireContext: async () => {
      if (!context) throw new ServiceError("UNAUTHENTICATED");
      return context;
    },
    headers: async () => from(),
  });
  return {
    generateInvite: protectedAction(
      { action: "accounts.manage" },
      {
        schema: generateInviteSchema,
        handler: (input, ctx) => generateInvite(ctx, input),
      },
    ),
    checkInvite: publicAction({
      schema: checkInviteSchema,
      handler: (input, ctx) => checkInvite(ctx.headers, input),
    }),
    registerWithInvite: publicAction({
      schema: registerWithInviteSchema,
      handler: ({ code, email, password }, ctx) =>
        registerWithInvite(ctx.headers, { code, email, password }),
    }),
  };
}

beforeEach(async () => {
  resetAttempts();
  warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  await resetDatabase(sql);
  ericky = await insertPlayer("ericky", "Ericky", 7);
  lucao = await insertPlayer("lucao", "Lucão", 10);
  felp = await insertPlayer("felp", "Felp", 11);
  heit = await insertPlayer("heit", "Heit", 69);
  await seedAccount({
    email: "ericky@test.dev",
    name: "Ericky",
    role: "admin",
    playerId: ericky,
  });
  admin = await contextFor("ericky@test.dev");
  // O login acima cria uma sessão; os testes contam a partir daqui.
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await sql.end();
});

describe("gerar convite", () => {
  it("admin gera o convite de cada jogador sem conta, com o papel escolhido", async () => {
    const before = Date.now();
    const invites = {
      lucao: await generateInvite(admin, { playerId: lucao, role: "admin" }),
      felp: await generateInvite(admin, { playerId: felp, role: "admin" }),
      heit: await generateInvite(admin, { playerId: heit, role: "player" }),
    };

    for (const invite of Object.values(invites)) {
      expect(invite.code).toMatch(/^([2-9A-HJ-NP-Z]{5}-){3}[2-9A-HJ-NP-Z]{5}$/);
      const lifetime = invite.expiresAt.getTime() - before;
      expect(lifetime).toBeGreaterThanOrEqual(INVITE_TTL_DAYS * DAY);
      expect(lifetime).toBeLessThan(INVITE_TTL_DAYS * DAY + 60_000);
    }
    expect(INVITE_TTL_DAYS).toBe(7);

    const rows = await inviteRows();
    expect(
      rows.map((row) => [row.player_id, row.role, row.created_by_user_id]),
    ).toEqual([
      [lucao, "admin", admin.actor.userId],
      [felp, "admin", admin.actor.userId],
      [heit, "player", admin.actor.userId],
    ]);
    for (const row of rows) {
      expect(row).toMatchObject({
        used_at: null,
        used_by_user_id: null,
        revoked_at: null,
      });
    }
  });

  it("o banco guarda só o hash: o código não aparece em nenhuma coluna nem na auditoria", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const canonical = normalizeInviteCode(code)!;

    const [row] = await inviteRows();
    expect(row.code_hash).toBe(hashInviteCode(canonical));

    const [{ dump }] = await sql`
      select (select string_agg(i::text, ' ') from account_invites i) || ' ' ||
             (select string_agg(a::text, ' ') from audit_log a) as dump`;
    expect(dump).not.toContain(code);
    expect(dump).not.toContain(canonical);
    // O hash também não vai para a auditoria.
    const trail = JSON.stringify(await audits());
    expect(trail).not.toContain(row.code_hash);
  });

  it("registra a geração na auditoria, com o autor", async () => {
    const invite = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const [row] = await inviteRows();

    expect(await audits()).toEqual([
      {
        actor_user_id: admin.actor.userId,
        action: "create",
        entity: "account_invites",
        entity_id: String(row.id),
        before: null,
        after: {
          playerId: heit,
          role: "player",
          expiresAt: invite.expiresAt.toISOString(),
          replaced: [],
        },
      },
    ]);
  });

  it("jogador que já tem conta não recebe convite", async () => {
    await expect(
      generateInvite(admin, { playerId: ericky, role: "admin" }),
    ).rejects.toMatchObject({ code: "PLAYER_ALREADY_LINKED" });

    expect(await inviteRows()).toEqual([]);
    expect(await audits()).toEqual([]);
  });

  it("jogador inexistente ou inativo não recebe convite", async () => {
    await sql`update players set is_active = false where id = ${heit}`;

    for (const playerId of [9999, heit]) {
      await expect(
        generateInvite(admin, { playerId, role: "player" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(await inviteRows()).toEqual([]);
  });

  it("gerar de novo invalida o convite anterior: nunca há dois em aberto", async () => {
    const first = await generateInvite(admin, {
      playerId: felp,
      role: "player",
    });
    const second = await generateInvite(admin, {
      playerId: felp,
      role: "admin",
    });

    const rows = await inviteRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].revoked_at).toBeInstanceOf(Date);
    expect(rows[1]).toMatchObject({ revoked_at: null, role: "admin" });
    expect((await persisted()).pending_invites).toBe(1);

    await expect(checkInvite(from(), first)).rejects.toMatchObject({
      code: "INVALID_INVITE",
    });
    await expect(register(first.code)).rejects.toMatchObject({
      code: "INVALID_INVITE",
    });
    expect(await checkInvite(from(), second)).toMatchObject({ slug: "felp" });

    expect(await audits()).toMatchObject([
      { action: "create", entity_id: String(rows[0].id) },
      {
        action: "update",
        entity: "account_invites",
        entity_id: String(rows[0].id),
        before: { status: "pending" },
        after: { status: "revoked", replacedBy: rows[1].id },
      },
      {
        action: "create",
        entity_id: String(rows[1].id),
        after: { role: "admin", replaced: [rows[0].id] },
      },
    ]);
  });

  it("um convite vencido também é substituído", async () => {
    await generateInvite(admin, { playerId: felp, role: "admin" });
    await sql`update account_invites set expires_at = now() - interval '1 minute'`;

    const fresh = await generateInvite(admin, {
      playerId: felp,
      role: "admin",
    });

    expect((await persisted()).pending_invites).toBe(1);
    expect(await checkInvite(from(), fresh)).toMatchObject({ slug: "felp" });
  });

  it("duas gerações ao mesmo tempo terminam com um único convite em aberto", async () => {
    const other = await contextFor("ericky@test.dev");
    const results = await Promise.allSettled([
      generateInvite(admin, { playerId: felp, role: "admin" }),
      generateInvite(other, { playerId: felp, role: "admin" }),
    ]);

    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({ code: "INVITE_CONFLICT" });
      }
    }
    expect((await persisted()).pending_invites).toBe(1);
  });

  it("o banco impede dois convites em aberto para o mesmo jogador", async () => {
    await generateInvite(admin, { playerId: felp, role: "admin" });

    await expect(
      sql`
        insert into account_invites
          (player_id, role, code_hash, expires_at, created_by_user_id)
        values (${felp}, 'admin', 'outro-hash', now() + interval '7 days',
                ${admin.actor.userId})`,
    ).rejects.toMatchObject({
      constraint_name: "account_invites_one_pending_per_player_idx",
    });
  });

  it("o banco recusa papel inválido, hash repetido e uso pela metade", async () => {
    const values = (role: string, hash: string) => sql`
      insert into account_invites
        (player_id, role, code_hash, expires_at, created_by_user_id)
      values (${felp}, ${role}, ${hash}, now() + interval '7 days',
              ${admin.actor.userId})`;

    await expect(values("owner", "hash-1")).rejects.toMatchObject({
      constraint_name: "account_invites_role_valid",
    });

    await values("player", "hash-2");
    await sql`update account_invites set revoked_at = now()`;
    await expect(values("player", "hash-2")).rejects.toMatchObject({
      constraint_name: "account_invites_code_hash_unique",
    });

    await expect(
      sql`update account_invites set used_at = now()`,
    ).rejects.toMatchObject({
      constraint_name: "account_invites_used_fields_together",
    });
  });
});

describe("situação dos convites na tela de contas", () => {
  it("mostra em aberto, vencido e sem validade, sem código nem hash", async () => {
    await generateInvite(admin, { playerId: lucao, role: "admin" });
    await generateInvite(admin, { playerId: felp, role: "admin" });
    await generateInvite(admin, { playerId: heit, role: "player" });
    await sql`
      update account_invites set expires_at = now() - interval '1 minute'
      where player_id = ${felp}`;
    // O convite do Heit foi gerado por alguém que deixou de ser admin.
    const former = await seedAccount({ email: "ex@test.dev", role: "player" });
    await sql`
      update account_invites set created_by_user_id = ${former.id}
      where player_id = ${heit}`;

    const invites = await listPendingInvites(admin);

    expect(
      invites
        .map((invite) => [invite.playerId, invite.role, invite.status])
        .sort(),
    ).toEqual(
      [
        [lucao, "admin", "pending"],
        [felp, "admin", "expired"],
        [heit, "player", "void"],
      ].sort(),
    );
    for (const invite of invites) {
      expect(Object.keys(invite).sort()).toEqual([
        "expiresAt",
        "playerId",
        "role",
        "status",
      ]);
    }
  });

  it("convite usado ou substituído sai da lista", async () => {
    await generateInvite(admin, { playerId: felp, role: "admin" });
    const { code } = await generateInvite(admin, {
      playerId: felp,
      role: "admin",
    });
    expect(await listPendingInvites(admin)).toHaveLength(1);

    await register(code);
    expect(await listPendingInvites(admin)).toEqual([]);
  });
});

describe("permissões", () => {
  it("jogador não gera nem lista convites", async () => {
    await seedAccount({ email: "felp@test.dev", playerId: felp });
    const player = await contextFor("felp@test.dev");

    await expect(
      generateInvite(player, { playerId: heit, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(listPendingInvites(player)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(
      await actionsFor(player).generateInvite({
        playerId: heit,
        role: "admin",
      }),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });

    expect(await inviteRows()).toEqual([]);
    expect(await audits()).toEqual([]);
  });

  it("visitante não gera convite", async () => {
    expect(
      await actionsFor(null).generateInvite({ playerId: heit, role: "admin" }),
    ).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(await inviteRows()).toEqual([]);
  });

  it("admin que perdeu o papel deixa de gerar na mesma hora", async () => {
    await seedAccount({ email: "outro@test.dev", role: "admin" });
    await setAccountRole(admin, { userId: admin.actor.userId, role: "player" });
    const former = await contextFor("ericky@test.dev");

    await expect(
      generateInvite(former, { playerId: heit, role: "admin" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("a action de gerar só aceita jogador e papel conhecidos", async () => {
    const actions = actionsFor(admin);

    for (const input of [
      { playerId: heit, role: "owner" },
      { playerId: "1; drop table users", role: "player" },
      { playerId: heit, role: "player", code: "ESCOLHIDO-PELO-CLIENTE" },
      { playerId: heit },
    ]) {
      expect(await actions.generateInvite(input)).toMatchObject({
        ok: false,
        error: { code: "INVALID_INPUT" },
      });
    }
    expect(await inviteRows()).toEqual([]);
  });
});

describe("conferir o código", () => {
  it("diz qual é o jogador do convite, sem papel, e-mail nem identificadores", async () => {
    const { code } = await generateInvite(admin, {
      playerId: lucao,
      role: "admin",
    });

    const player = await checkInvite(from(), { code });

    expect(player).toEqual({
      slug: "lucao",
      name: "Lucão",
      shirtNumber: 10,
      photoUrl: "/players/lucao.webp",
    });
  });

  it("aceita o código digitado em minúsculas, com espaços", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const typed = `  ${code.toLowerCase().replaceAll("-", " ")} `;

    expect(await checkInvite(from(), { code: typed })).toMatchObject({
      slug: "heit",
    });
  });

  it("conferir não consome o convite nem grava nada", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();

    await checkInvite(from(), { code });
    await checkInvite(from(), { code });

    expect(await persisted()).toEqual(before);
    await register(code);
  });
});

describe("criar a conta com o convite", () => {
  it("cria a conta do jogador do convite, com o papel do convite e o nome do jogador", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();

    const result = await register(code, { email: "Heit@Test.dev" });

    expect(result).toEqual({ playerSlug: "heit", playerName: "Heit" });
    const [user] = await sql`
      select id, name, email, role, banned, player_id
      from users where player_id = ${heit}`;
    expect(user).toMatchObject({
      name: "Heit",
      role: "player",
      banned: false,
      player_id: heit,
    });
    expect(await persisted()).toEqual({
      ...before,
      users: before.users + 1,
      credentials: before.credentials + 1,
      // Sem login automático: nenhuma sessão nova.
      sessions: before.sessions,
      audits: before.audits + 2,
      used_invites: 1,
      pending_invites: 0,
    });

    const [invite] = await inviteRows();
    expect(invite.used_at).toBeInstanceOf(Date);
    expect(invite.used_by_user_id).toBe(user.id);
  });

  it("a conta criada entra pelo retrato do jogador, com a senha escolhida", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    await register(code, { email: "heit@test.dev" });

    await signInAsPlayer(from(), {
      playerSlug: "heit",
      password: NEW_PASSWORD,
    });
    await expect(
      signInAsPlayer(from(), { playerSlug: "heit", password: "outra-senha-1" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    const { actor } = await sessionOf("heit@test.dev");
    expect(actor).toMatchObject({ role: "player", playerId: heit });
    expect(can(actor, { action: "accounts.manage" })).toBe(false);
    expect(can(actor, { action: "stats.manage" })).toBe(false);
    expect(
      (await listEntryPlayers()).find((player) => player.slug === "heit"),
    ).toMatchObject({ hasAccount: true });
  });

  it("convite de admin cria um administrador, que aparece na entrada Admin", async () => {
    const { code } = await generateInvite(admin, {
      playerId: lucao,
      role: "admin",
    });
    await register(code, { email: "lucao@test.dev" });

    const { actor } = await sessionOf("lucao@test.dev");
    expect(actor).toMatchObject({ role: "admin", playerId: lucao });
    expect(can(actor, { action: "accounts.manage" })).toBe(true);
    expect((await listAdminEntryPlayers()).map((p) => p.slug)).toEqual([
      "ericky",
      "lucao",
    ]);
  });

  it("Lucão e Felp viram admin, Heit vira jogador, e a conta do Ericky não muda", async () => {
    const [erickyBefore] = await sql`
      select id, email, role, player_id, updated_at from users
      where player_id = ${ericky}`;

    for (const [playerId, role, email] of [
      [lucao, "admin", "lucao@test.dev"],
      [felp, "admin", "felp@test.dev"],
      [heit, "player", "heit@test.dev"],
    ] as const) {
      const { code } = await generateInvite(admin, { playerId, role });
      await register(code, { email });
    }

    const rows = await sql`
      select p.slug, u.role from users u join players p on p.id = u.player_id
      order by p.shirt_number`;
    expect(rows).toEqual([
      { slug: "ericky", role: "admin" },
      { slug: "lucao", role: "admin" },
      { slug: "felp", role: "admin" },
      { slug: "heit", role: "player" },
    ]);
    const [erickyAfter] = await sql`
      select id, email, role, player_id, updated_at from users
      where player_id = ${ericky}`;
    expect(erickyAfter).toEqual(erickyBefore);
  });

  it("registra a conta criada e o convite usado na auditoria, sem senha, código nem hash", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    await register(code, { email: "heit@test.dev" });

    const [invite] = await inviteRows();
    const [user] = await sql`select id from users where player_id = ${heit}`;
    const [credential] = await sql`
      select password from accounts where user_id = ${user.id}`;
    const trail = await audits();

    expect(trail.slice(1)).toEqual([
      {
        actor_user_id: user.id,
        action: "create",
        entity: "users",
        entity_id: user.id,
        before: null,
        after: {
          name: "Heit",
          email: "heit@test.dev",
          role: "player",
          playerId: heit,
          source: "invite",
          inviteId: invite.id,
        },
      },
      {
        actor_user_id: user.id,
        action: "update",
        entity: "account_invites",
        entity_id: String(invite.id),
        before: { status: "pending" },
        after: { status: "used", usedByUserId: user.id },
      },
    ]);

    // A senha é guardada pelo Better Auth como hash, nunca em texto.
    expect(credential.password).not.toContain(NEW_PASSWORD);
    const dump = JSON.stringify(trail);
    for (const secret of [
      NEW_PASSWORD,
      code,
      normalizeInviteCode(code)!,
      invite.code_hash,
      credential.password,
    ]) {
      expect(dump).not.toContain(secret);
    }
  });

  it("o convite vale uma vez só", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    await register(code, { email: "heit@test.dev" });
    const before = await persisted();

    await expect(
      register(code, { email: "outro@test.dev" }),
    ).rejects.toMatchObject({ code: "INVALID_INVITE" });
    await expect(checkInvite(from(), { code })).rejects.toMatchObject({
      code: "INVALID_INVITE",
    });

    expect(await persisted()).toEqual(before);
  });

  it("dois cadastros simultâneos com o mesmo código: só um cria a conta", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();

    const results = await Promise.allSettled([
      register(code, { email: "um@test.dev" }),
      register(code, { email: "dois@test.dev" }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({
      code: "INVALID_INVITE",
    });
    expect(await persisted()).toMatchObject({
      users: before.users + 1,
      credentials: before.credentials + 1,
      used_invites: 1,
    });
  });

  it("e-mail já usado é recusado e o convite continua valendo", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();

    await expect(
      register(code, { email: "ericky@test.dev" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    expect(await persisted()).toEqual(before);

    await register(code, { email: "heit@test.dev" });
  });

  it("senha curta é recusada também no serviço, sem gastar o convite", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();

    for (const password of ["1234567", "x".repeat(129)]) {
      await expect(register(code, { password })).rejects.toMatchObject({
        code: "INVALID_PASSWORD",
      });
    }
    expect(await persisted()).toEqual(before);
  });
});

describe("convites que não valem", () => {
  // Cada caso devolve um código que não pode mais criar conta.
  const cases: Record<string, () => Promise<string>> = {
    "nunca existiu": async () => "ABCDE-FGHJK-LMNPQ-RSTUV",
    "não tem formato de convite": async () => "qualquer coisa",
    vencido: async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "player",
      });
      await sql`update account_invites set expires_at = now() - interval '1 second'`;
      return code;
    },
    "substituído por um novo": async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "player",
      });
      await generateInvite(admin, { playerId: heit, role: "player" });
      return code;
    },
    "já usado": async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "player",
      });
      await register(code, { email: "heit@test.dev" });
      return code;
    },
    "jogador ganhou conta por outro caminho": async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "player",
      });
      await createAccountByAdmin(admin, {
        email: "heit@test.dev",
        name: "Heit",
        password: PASSWORD,
        role: "player",
        playerId: heit,
      });
      return code;
    },
    "jogador saiu do elenco": async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "player",
      });
      await sql`update players set is_active = false where id = ${heit}`;
      return code;
    },
    "quem gerou deixou de ser admin": async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "admin",
      });
      await seedAccount({ email: "outro@test.dev", role: "admin" });
      await setAccountRole(admin, {
        userId: admin.actor.userId,
        role: "player",
      });
      return code;
    },
    "quem gerou foi desativado": async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "admin",
      });
      await seedAccount({ email: "outro@test.dev", role: "admin" });
      await sql`update users set banned = true where id = ${admin.actor.userId}`;
      return code;
    },
  };

  for (const [name, prepare] of Object.entries(cases)) {
    it(`${name}: não confere e não cria conta`, async () => {
      const code = await prepare();
      const before = await persisted();

      await expect(checkInvite(from(), { code })).rejects.toMatchObject({
        code: "INVALID_INVITE",
      });
      await expect(
        register(code, { email: "intruso@test.dev" }),
      ).rejects.toMatchObject({ code: "INVALID_INVITE" });

      expect(await persisted()).toEqual(before);
      const [{ count }] = await sql`
        select count(*)::int as count from users
        where email = 'intruso@test.dev'`;
      expect(count).toBe(0);
    });
  }

  it("a resposta é a mesma em todos os casos: não dá para descobrir o motivo", async () => {
    const messages = new Set<string>();

    for (const prepare of Object.values(cases)) {
      resetAttempts();
      await resetDatabase(sql);
      ericky = await insertPlayer("ericky", "Ericky", 7);
      heit = await insertPlayer("heit", "Heit", 69);
      await seedAccount({
        email: "ericky@test.dev",
        role: "admin",
        playerId: ericky,
      });
      admin = await contextFor("ericky@test.dev");

      const code = await prepare();
      for (const attempt of [
        () => checkInvite(from(), { code }),
        () => register(code, { email: "intruso@test.dev" }),
      ]) {
        const error = await attempt().catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(ServiceError);
        messages.add(
          `${(error as ServiceError).code}: ${(error as Error).message}`,
        );
      }
    }

    expect([...messages]).toHaveLength(1);
  }, 60_000);

  it("o motivo real fica só no log do servidor, sem o código digitado", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    await sql`update account_invites set expires_at = now() - interval '1 second'`;

    await register(code, { email: "heit@test.dev" }).catch(() => {});

    const [invite] = await inviteRows();
    expect(warnings).toHaveBeenCalledWith("Convite recusado:", {
      reason: "expired",
      inviteId: invite.id,
    });
    const logged = JSON.stringify(warnings.mock.calls);
    for (const secret of [
      code,
      normalizeInviteCode(code)!,
      invite.code_hash,
      NEW_PASSWORD,
      "heit@test.dev",
    ]) {
      expect(logged).not.toContain(secret);
    }
  });
});

describe("adulteração da requisição", () => {
  const payload = (code: string, extra: Record<string, unknown> = {}) => ({
    code,
    email: "heit@test.dev",
    password: NEW_PASSWORD,
    passwordConfirmation: NEW_PASSWORD,
    ...extra,
  });

  it("enviar `role` ou `playerId` faz a requisição inteira ser recusada", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();
    const actions = actionsFor(null);

    for (const extra of [
      { role: "admin" },
      { playerId: lucao },
      { role: "admin", playerId: lucao },
      { data: { role: "admin" } },
      { name: "Outro Nome" },
      { banned: false },
    ]) {
      expect(
        await actions.registerWithInvite(payload(code, extra)),
        JSON.stringify(extra),
      ).toMatchObject({ ok: false, error: { code: "INVALID_INPUT" } });
    }

    expect(await persisted()).toEqual(before);
  });

  it("mesmo chamando o serviço com campos a mais, jogador e papel saem do convite", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });

    const tampered = {
      code,
      email: "heit@test.dev",
      password: NEW_PASSWORD,
      role: "admin",
      playerId: lucao,
      name: "Lucão",
    };
    await registerWithInvite(from(), tampered);

    const [user] = await sql`
      select name, role, player_id from users where email = 'heit@test.dev'`;
    expect(user).toEqual({ name: "Heit", role: "player", player_id: heit });
    const [{ count }] = await sql`
      select count(*)::int as count from users where player_id = ${lucao}`;
    expect(count).toBe(0);
  });

  it("um convite não serve para o jogador de outro convite", async () => {
    const forHeit = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    await generateInvite(admin, { playerId: lucao, role: "admin" });

    await register(forHeit.code, { email: "heit@test.dev" });

    const rows = await sql`
      select p.slug, u.role from users u join players p on p.id = u.player_id
      where u.email = 'heit@test.dev'`;
    expect(rows).toEqual([{ slug: "heit", role: "player" }]);
  });

  it("valida no servidor: senha curta, senhas diferentes e e-mail inválido", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    const before = await persisted();
    const actions = actionsFor(null);

    expect(
      await actions.registerWithInvite(
        payload(code, { password: "1234567", passwordConfirmation: "1234567" }),
      ),
    ).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        fieldErrors: { password: [expect.any(String)] },
      },
    });
    expect(
      await actions.registerWithInvite(
        payload(code, { passwordConfirmation: "senha-diferente-9" }),
      ),
    ).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        fieldErrors: { passwordConfirmation: ["As senhas não são iguais."] },
      },
    });
    expect(
      await actions.registerWithInvite(payload(code, { email: "sem-arroba" })),
    ).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        fieldErrors: { email: [expect.any(String)] },
      },
    });
    for (const missing of [
      "code",
      "email",
      "password",
      "passwordConfirmation",
    ]) {
      const incomplete = Object.fromEntries(
        Object.entries(payload(code)).filter(([field]) => field !== missing),
      );
      expect(
        await actions.registerWithInvite(incomplete),
        missing,
      ).toMatchObject({
        ok: false,
        error: { code: "INVALID_INPUT" },
      });
    }

    expect(await persisted()).toEqual(before);
  });

  it("o cadastro pela action funciona com a entrada certa e normaliza o e-mail", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });

    expect(
      await actionsFor(null).registerWithInvite(
        payload(code, { email: "Heit@Test.DEV" }),
      ),
    ).toEqual({ ok: true, data: { playerSlug: "heit", playerName: "Heit" } });

    const [user] = await sql`
      select email from users where player_id = ${heit}`;
    expect(user.email).toBe("heit@test.dev");
  });

  it("texto de injeção no código é tratado como um código qualquer", async () => {
    await generateInvite(admin, { playerId: heit, role: "player" });
    const before = await persisted();
    const actions = actionsFor(null);

    for (const code of [
      "' or '1'='1",
      "'; drop table account_invites; --",
      "%",
      "x".repeat(65),
    ]) {
      expect(await actions.checkInvite({ code }), code).toMatchObject({
        ok: false,
      });
      expect(await actions.registerWithInvite(payload(code))).toMatchObject({
        ok: false,
      });
    }

    expect(await persisted()).toEqual(before);
  });
});

describe("limite de tentativas de código", () => {
  it("depois de muitos códigos inválidos, a origem é barrada, mesmo com um código certo", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });

    for (let index = 0; index < MAX_FAILED_ATTEMPTS; index++) {
      await expect(
        checkInvite(from("10.9.9.9"), { code: "ABCDE-FGHJK-LMNPQ-RSTUV" }),
      ).rejects.toMatchObject({ code: "INVALID_INVITE" });
    }

    await expect(checkInvite(from("10.9.9.9"), { code })).rejects.toMatchObject(
      { code: "TOO_MANY_ATTEMPTS" },
    );
    await expect(register(code, { origin: "10.9.9.9" })).rejects.toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
    });

    // Quem tem o convite, de outra origem, não é afetado.
    await register(code, { origin: "10.0.0.50" });
  });

  it("erros de cadastro que não são de convite não contam como tentativa", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });

    for (let index = 0; index < MAX_FAILED_ATTEMPTS + 2; index++) {
      await expect(
        register(code, { email: "ericky@test.dev" }),
      ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
    }
    await register(code, { email: "heit@test.dev" });
  });
});

describe("cadastro atômico", () => {
  // Faz uma etapa do cadastro falhar de verdade, com um gatilho criado só no
  // banco de teste e removido ao fim do teste.
  async function failing(
    event: string,
    table: string,
    run: () => Promise<void>,
  ) {
    await sql.unsafe(`
      create function test_forced_failure() returns trigger language plpgsql as
      $$ begin raise exception 'falha proposital do teste'; end $$;
      create trigger test_forced_failure before ${event} on ${table}
        for each row execute function test_forced_failure();`);
    try {
      await run();
    } finally {
      await sql.unsafe(`
        drop trigger if exists test_forced_failure on ${table};
        drop function if exists test_forced_failure();`);
    }
  }

  const steps = [
    ["a conta não pode ser gravada", "insert", "users"],
    ["a credencial (senha) não pode ser gravada", "insert", "accounts"],
    ["o convite não pode ser marcado como usado", "update", "account_invites"],
    ["a auditoria não pode ser gravada", "insert", "audit_log"],
  ] as const;

  for (const [name, event, table] of steps) {
    it(`se ${name}, nada persiste e o convite continua valendo`, async () => {
      const { code } = await generateInvite(admin, {
        playerId: heit,
        role: "player",
      });
      const before = await persisted();

      await failing(event, table, async () => {
        await expect(
          register(code, { email: "heit@test.dev" }),
        ).rejects.toThrow();

        expect(await persisted()).toEqual(before);
        const [{ count }] = await sql`
          select count(*)::int as count from users where player_id = ${heit}`;
        expect(count).toBe(0);
      });

      // Sem a falha, o mesmo convite cria a conta normalmente.
      await register(code, { email: "heit@test.dev" });
      expect((await persisted()).users).toBe(before.users + 1);
    });
  }

  it("falha interna não conta como tentativa de código inválido", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });

    await failing("insert", "accounts", async () => {
      for (let index = 0; index < MAX_FAILED_ATTEMPTS + 1; index++) {
        await register(code).catch(() => {});
      }
    });

    await register(code, { email: "heit@test.dev" });
  });
});

describe("administradores", () => {
  it("a conta de admin criada por convite conta como admin ativo", async () => {
    const { code } = await generateInvite(admin, {
      playerId: lucao,
      role: "admin",
    });
    await register(code, { email: "lucao@test.dev" });

    // Com dois admins, o primeiro pode ser rebaixado; o que restou, não.
    await setAccountRole(admin, { userId: admin.actor.userId, role: "player" });
    const lucaoContext = await sessionOf("lucao@test.dev");
    await expect(
      setAccountRole(lucaoContext, {
        userId: lucaoContext.actor.userId,
        role: "player",
      }),
    ).rejects.toMatchObject({ code: "LAST_ADMIN" });
  });

  it("o cadastro não permite escalar um convite de jogador para admin", async () => {
    const { code } = await generateInvite(admin, {
      playerId: heit,
      role: "player",
    });
    await actionsFor(null).registerWithInvite({
      code,
      email: "heit@test.dev",
      password: NEW_PASSWORD,
      passwordConfirmation: NEW_PASSWORD,
      role: "admin",
    });
    await register(code, { email: "heit@test.dev" });

    const admins = await sql`
      select email from users where role = 'admin' order by email`;
    expect(admins).toEqual([{ email: "ericky@test.dev" }]);
    expect((await listAdminEntryPlayers()).map((p) => p.slug)).toEqual([
      "ericky",
    ]);
  });
});
