import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, withTransaction } from "@/db";
import { accountInvites, players, users, type UserRole } from "@/db/schema";
import { recordAudit } from "../audit";
import {
  attemptKey,
  clearFailures,
  isBlocked,
  recordFailure,
} from "../auth/attempts";
import { getAuth } from "../auth/auth";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../auth/constants";
import { assertCan, type RequestContext } from "../auth/session";
import { ServiceError, toServiceError } from "../errors";
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
} from "./code";

// Cadastro por convite (ADR 0015).
//
// Um admin gera o convite de um jogador, já com o papel da futura conta. Quem
// recebe o código cria a própria conta informando só e-mail e senha: jogador e
// papel são lidos do convite gravado no banco, nunca da requisição.

export const INVITE_TTL_DAYS = 7;
const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

// Convite ainda não usado nem substituído.
const isPending = and(
  isNull(accountInvites.usedAt),
  isNull(accountInvites.revokedAt),
);

// pending: pode ser usado; expired: passou da validade; void: quem gerou não
// é mais um administrador ativo.
export type PendingInviteStatus = "pending" | "expired" | "void";

export interface PendingInvite {
  playerId: number;
  role: UserRole;
  expiresAt: Date;
  status: PendingInviteStatus;
}

// Convites em aberto, um por jogador, para a tela de contas. Nunca devolve o
// código nem o hash.
export async function listPendingInvites(
  context: RequestContext,
): Promise<PendingInvite[]> {
  assertCan(context.actor, { action: "accounts.manage" });

  const rows = await getDb()
    .select({
      playerId: accountInvites.playerId,
      role: accountInvites.role,
      expiresAt: accountInvites.expiresAt,
      issuerRole: users.role,
      issuerBanned: users.banned,
    })
    .from(accountInvites)
    .innerJoin(users, eq(users.id, accountInvites.createdByUserId))
    .where(isPending);

  const now = new Date();
  return rows.map((row) => ({
    playerId: row.playerId,
    role: row.role,
    expiresAt: row.expiresAt,
    status:
      row.issuerRole !== "admin" || row.issuerBanned
        ? "void"
        : row.expiresAt <= now
          ? "expired"
          : "pending",
  }));
}

export interface GeneratedInvite {
  // Código em texto, formatado. Só existe nesta resposta: não é gravado e não
  // pode ser consultado depois.
  code: string;
  playerId: number;
  role: UserRole;
  expiresAt: Date;
}

// Gera o convite de um jogador sem conta. Se já havia um convite em aberto,
// ele deixa de valer na mesma transação: nunca há dois ao mesmo tempo (o banco
// garante com um índice único).
export async function generateInvite(
  context: RequestContext,
  input: { playerId: number; role: UserRole },
): Promise<GeneratedInvite> {
  assertCan(context.actor, { action: "accounts.manage" });

  try {
    return await withTransaction(async () => {
      const db = getDb();

      const [player] = await db
        .select({ id: players.id })
        .from(players)
        .where(and(eq(players.id, input.playerId), eq(players.isActive, true)));
      if (!player) throw new ServiceError("NOT_FOUND");

      const now = new Date();
      // Primeiro o convite anterior: a atualização espera um cadastro que
      // esteja usando aquele convite neste instante, e a conferência de conta
      // logo abaixo já enxerga o resultado dele.
      const revoked = await db
        .update(accountInvites)
        .set({ revokedAt: now })
        .where(and(eq(accountInvites.playerId, player.id), isPending))
        .returning({ id: accountInvites.id });

      const [account] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.playerId, player.id));
      if (account) {
        throw new ServiceError(
          "PLAYER_ALREADY_LINKED",
          "Este jogador já tem conta. Não é preciso convite.",
        );
      }

      const code = generateInviteCode();
      const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
      const [invite] = await db
        .insert(accountInvites)
        .values({
          playerId: player.id,
          role: input.role,
          codeHash: hashInviteCode(code),
          expiresAt,
          createdByUserId: context.actor.userId,
        })
        .returning({ id: accountInvites.id });

      // O código e o hash nunca entram na auditoria.
      for (const previous of revoked) {
        await recordAudit({
          actorUserId: context.actor.userId,
          action: "update",
          entity: "account_invites",
          entityId: previous.id,
          before: { status: "pending" },
          after: { status: "revoked", replacedBy: invite.id },
        });
      }
      await recordAudit({
        actorUserId: context.actor.userId,
        action: "create",
        entity: "account_invites",
        entityId: invite.id,
        after: {
          playerId: player.id,
          role: input.role,
          expiresAt: expiresAt.toISOString(),
          replaced: revoked.map((previous) => previous.id),
        },
      });

      return {
        code: formatInviteCode(code),
        playerId: player.id,
        role: input.role,
        expiresAt,
      };
    });
  } catch (error) {
    throw toServiceError(error);
  }
}

// Motivo real da recusa. Fica só no log do servidor: quem tenta um código
// recebe sempre a mesma resposta (INVALID_INVITE).
type Refusal =
  | "malformed"
  | "unknown"
  | "used"
  | "revoked"
  | "expired"
  | "issuer-not-admin"
  | "player-inactive"
  | "player-has-account"
  | "consumed-concurrently";

function refuse(reason: Refusal, inviteId?: number): never {
  // Nunca o código digitado, e-mail ou senha.
  console.warn("Convite recusado:", { reason, inviteId: inviteId ?? null });
  throw new ServiceError("INVALID_INVITE");
}

interface UsableInvite {
  id: number;
  role: UserRole;
  player: {
    id: number;
    slug: string;
    name: string;
    shirtNumber: number;
    photoUrl: string | null;
  };
}

// Encontra o convite pelo código e confere tudo o que o torna utilizável.
// Com `lock`, a linha do convite fica travada até o fim da transação: de dois
// cadastros simultâneos com o mesmo código, o segundo só lê depois que o
// primeiro terminou, e encontra o convite já usado.
async function findUsableInvite(
  rawCode: string,
  { lock }: { lock: boolean },
): Promise<UsableInvite> {
  const code = normalizeInviteCode(rawCode);
  if (!code) refuse("malformed");

  const db = getDb();
  const query = db
    .select({
      id: accountInvites.id,
      playerId: accountInvites.playerId,
      role: accountInvites.role,
      expiresAt: accountInvites.expiresAt,
      usedAt: accountInvites.usedAt,
      revokedAt: accountInvites.revokedAt,
      createdByUserId: accountInvites.createdByUserId,
    })
    .from(accountInvites)
    .where(eq(accountInvites.codeHash, hashInviteCode(code)));
  const [invite] = lock ? await query.for("update") : await query;

  if (!invite) refuse("unknown");
  if (invite.usedAt) refuse("used", invite.id);
  if (invite.revokedAt) refuse("revoked", invite.id);
  if (invite.expiresAt <= new Date()) refuse("expired", invite.id);

  // O convite vale enquanto quem o gerou continua sendo administrador ativo.
  const [issuer] = await db
    .select({ role: users.role, banned: users.banned })
    .from(users)
    .where(eq(users.id, invite.createdByUserId));
  if (!issuer || issuer.role !== "admin" || issuer.banned) {
    refuse("issuer-not-admin", invite.id);
  }

  const [player] = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      shirtNumber: players.shirtNumber,
      photoUrl: players.photoUrl,
      isActive: players.isActive,
    })
    .from(players)
    .where(eq(players.id, invite.playerId));
  if (!player || !player.isActive) refuse("player-inactive", invite.id);

  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.playerId, player.id));
  if (account) refuse("player-has-account", invite.id);

  return {
    id: invite.id,
    role: invite.role,
    player: {
      id: player.id,
      slug: player.slug,
      name: player.name,
      shirtNumber: player.shirtNumber,
      photoUrl: player.photoUrl,
    },
  };
}

// Limite de tentativas de código por origem, no mesmo contador do login. É uma
// barreira contra insistência; o que impede adivinhar um convite é a entropia
// do código.
const ATTEMPT_TARGET = "convite";

async function withAttemptLimit<T>(
  headers: Headers,
  fn: () => Promise<T>,
): Promise<{ result: T; key: string }> {
  const key = attemptKey(headers, ATTEMPT_TARGET);
  if (isBlocked(key)) {
    throw new ServiceError(
      "TOO_MANY_ATTEMPTS",
      "Muitas tentativas com código inválido. Tente de novo em alguns minutos.",
    );
  }

  try {
    return { result: await fn(), key };
  } catch (error) {
    const known = toServiceError(error);
    if (known instanceof ServiceError && known.code === "INVALID_INVITE") {
      recordFailure(key);
    }
    throw known;
  }
}

export interface InvitedPlayer {
  slug: string;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
}

// Primeiro passo do cadastro: diz a quem tem o código qual é o jogador do
// convite. Não devolve o papel, e não consome o convite.
export async function checkInvite(
  headers: Headers,
  input: { code: string },
): Promise<InvitedPlayer> {
  const { result } = await withAttemptLimit(headers, () =>
    findUsableInvite(input.code, { lock: false }),
  );
  const { slug, name, shirtNumber, photoUrl } = result.player;
  return { slug, name, shirtNumber, photoUrl };
}

export interface RegisterWithInviteInput {
  code: string;
  email: string;
  password: string;
}

// Cria a conta do jogador do convite. Tudo em uma transação: se qualquer
// passo falhar, não fica conta, credencial, vínculo, convite usado nem
// auditoria.
//
// A entrada não tem jogador nem papel. Os dois saem do convite lido do banco.
export async function registerWithInvite(
  headers: Headers,
  input: RegisterWithInviteInput,
): Promise<{ playerSlug: string; playerName: string }> {
  // A criação de usuário pelo plugin de administração não confere o tamanho
  // da senha; a regra é aplicada aqui, além da validação da action.
  if (
    input.password.length < MIN_PASSWORD_LENGTH ||
    input.password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new ServiceError("INVALID_PASSWORD");
  }

  const { result, key } = await withAttemptLimit(headers, async () => {
    try {
      return await withTransaction(async () => {
        const invite = await findUsableInvite(input.code, { lock: true });

        // Mesmo caminho do script do primeiro admin: chamada no servidor, sem
        // sessão. O Better Auth gera o hash da senha.
        const { user } = await getAuth().api.createUser({
          body: {
            email: input.email,
            name: invite.player.name,
            password: input.password,
            role: invite.role,
            data: { playerId: invite.player.id },
          },
        });

        const consumed = await getDb()
          .update(accountInvites)
          .set({ usedAt: new Date(), usedByUserId: user.id })
          .where(and(eq(accountInvites.id, invite.id), isPending))
          .returning({ id: accountInvites.id });
        if (consumed.length !== 1) refuse("consumed-concurrently", invite.id);

        // A senha, o código e o hash nunca entram na auditoria. O autor é a
        // própria conta recém-criada.
        await recordAudit({
          actorUserId: user.id,
          action: "create",
          entity: "users",
          entityId: user.id,
          after: {
            name: invite.player.name,
            email: user.email,
            role: invite.role,
            playerId: invite.player.id,
            source: "invite",
            inviteId: invite.id,
          },
        });
        await recordAudit({
          actorUserId: user.id,
          action: "update",
          entity: "account_invites",
          entityId: invite.id,
          before: { status: "pending" },
          after: { status: "used", usedByUserId: user.id },
        });

        return {
          playerSlug: invite.player.slug,
          playerName: invite.player.name,
        };
      });
    } catch (error) {
      const known = toServiceError(error);
      // O banco barrou uma segunda conta para o mesmo jogador (corrida com
      // outro cadastro). Para quem tenta, é um convite que não vale mais.
      if (
        known instanceof ServiceError &&
        known.code === "PLAYER_ALREADY_LINKED"
      ) {
        throw new ServiceError("INVALID_INVITE");
      }
      throw known;
    }
  });

  clearFailures(key);
  return result;
}
