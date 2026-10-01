// Erros esperados da camada de servidor. O envelope das Server Actions os
// converte em respostas com código e mensagem; qualquer outro erro é tratado
// como falha interna e não tem o conteúdo exposto ao cliente.

export type ServiceErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_DISABLED"
  | "EMAIL_IN_USE"
  | "PLAYER_ALREADY_LINKED"
  | "LAST_ADMIN"
  | "CANNOT_DEACTIVATE_SELF"
  | "INVALID_PASSWORD";

const DEFAULT_MESSAGES: Record<ServiceErrorCode, string> = {
  UNAUTHENTICATED: "Faça login para continuar.",
  FORBIDDEN: "Você não tem permissão para fazer isso.",
  INVALID_INPUT: "Dados inválidos.",
  NOT_FOUND: "Registro não encontrado.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  ACCOUNT_DISABLED: "Esta conta está desativada.",
  EMAIL_IN_USE: "Já existe uma conta com este e-mail.",
  PLAYER_ALREADY_LINKED: "Este jogador já está vinculado a outra conta.",
  LAST_ADMIN:
    "O sistema precisa de pelo menos um administrador ativo. Promova outro admin antes.",
  CANNOT_DEACTIVATE_SELF: "Você não pode desativar a própria conta.",
  INVALID_PASSWORD: "A senha não atende aos requisitos.",
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message = DEFAULT_MESSAGES[code]) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

// Nome da constraint do PostgreSQL que causou o erro, se houver. O Drizzle
// embrulha o erro do driver em `cause`.
export function violatedConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current === "object" && "constraint_name" in current) {
      const name = (current as { constraint_name?: unknown }).constraint_name;
      if (typeof name === "string") return name;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

// Código de erro devolvido pelo Better Auth (APIError), se houver.
export function authErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const body = (error as { body?: unknown }).body;
  if (typeof body !== "object" || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

const AUTH_ERROR_CODES: Record<string, ServiceErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: "INVALID_CREDENTIALS",
  INVALID_PASSWORD: "INVALID_CREDENTIALS",
  INVALID_EMAIL: "INVALID_INPUT",
  BANNED_USER: "ACCOUNT_DISABLED",
  USER_ALREADY_EXISTS: "EMAIL_IN_USE",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "EMAIL_IN_USE",
  USER_NOT_FOUND: "NOT_FOUND",
  YOU_CANNOT_BAN_YOURSELF: "CANNOT_DEACTIVATE_SELF",
  PASSWORD_TOO_SHORT: "INVALID_PASSWORD",
  PASSWORD_TOO_LONG: "INVALID_PASSWORD",
};

const CONSTRAINT_ERROR_CODES: Record<string, ServiceErrorCode> = {
  users_player_id_unique: "PLAYER_ALREADY_LINKED",
  users_email_unique: "EMAIL_IN_USE",
  users_at_least_one_admin: "LAST_ADMIN",
  users_player_id_players_id_fk: "NOT_FOUND",
};

// Traduz erros conhecidos do Better Auth e do banco para ServiceError. Erros
// desconhecidos são devolvidos como estão.
export function toServiceError(error: unknown): unknown {
  if (error instanceof ServiceError) return error;

  const constraint = violatedConstraint(error);
  if (constraint && CONSTRAINT_ERROR_CODES[constraint]) {
    return new ServiceError(CONSTRAINT_ERROR_CODES[constraint]);
  }

  const code = authErrorCode(error);
  if (code && AUTH_ERROR_CODES[code]) {
    return new ServiceError(AUTH_ERROR_CODES[code]);
  }

  return error;
}
