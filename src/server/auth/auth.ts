import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";
import { contextDb } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { getAuthEnv } from "@/lib/env";
import { MIN_PASSWORD_LENGTH } from "./constants";

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const ONE_DAY = 60 * 60 * 24;

// Papéis da aplicação (ADR 0011). O admin não recebe as permissões de
// personificar nem de apagar usuários: as duas operações ficam bloqueadas
// também para chamadas feitas no servidor.
const accessControl = createAccessControl(defaultStatements);

const roles = {
  admin: accessControl.newRole({
    user: [
      "create",
      "list",
      "get",
      "update",
      "set-role",
      "set-password",
      "ban",
    ],
    session: ["list", "revoke", "delete"],
  }),
  player: accessControl.newRole({ user: [], session: [] }),
};

// Rotas do Better Auth que não podem ser chamadas por HTTP. A gestão de contas
// passa só pelas nossas Server Actions, que aplicam auditoria e a regra do
// último admin; as chamadas feitas no servidor (auth.api) não são afetadas.
const DISABLED_HTTP_PATHS = [
  "/sign-up/email",
  "/update-user",
  "/change-email",
  "/delete-user",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/set-role",
  "/admin/set-user-password",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/get-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/has-permission",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/remove-user",
];

function createAuth() {
  const env = getAuthEnv();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(contextDb, {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    emailAndPassword: {
      enabled: true,
      // Não existe cadastro público: contas são criadas por um admin.
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    session: {
      expiresIn: THIRTY_DAYS,
      // A cada dia de uso a validade é renovada por mais 30 dias.
      updateAge: ONE_DAY,
    },
    user: {
      additionalFields: {
        playerId: { type: "number", required: false, input: false },
      },
    },
    disabledPaths: DISABLED_HTTP_PATHS,
    plugins: [
      admin({
        ac: accessControl,
        roles,
        defaultRole: "player",
        adminRoles: ["admin"],
        bannedUserMessage: "Esta conta está desativada.",
      }),
      // Precisa ser o último plugin: grava os cookies em Server Actions.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { auth?: Auth };

// Criação preguiçosa pelo mesmo motivo de getEnv: o build importa este módulo
// sem as variáveis de ambiente de execução.
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
