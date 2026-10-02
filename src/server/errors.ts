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
  | "INVALID_PASSWORD"
  | "NO_OPEN_NIGHT"
  | "PREVIOUS_NIGHT_OPEN"
  | "NIGHT_CLOSED"
  | "NIGHT_WITHOUT_MATCHES"
  | "NIGHT_HAS_MATCHES"
  | "NO_ACTIVE_SEASON"
  | "INVALID_MATCH"
  | "SEASON_ALREADY_EXISTS"
  | "PLAYER_WITHOUT_ACCOUNT"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_INVITE"
  | "INVITE_CONFLICT";

const DEFAULT_MESSAGES: Record<ServiceErrorCode, string> = {
  UNAUTHENTICATED: "Entre para continuar.",
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
  NO_OPEN_NIGHT: "Não há gameplay em andamento. Dê início à gameplay primeiro.",
  PREVIOUS_NIGHT_OPEN:
    "Existe uma gameplay anterior aberta. Encerre-a antes de iniciar outra.",
  NIGHT_CLOSED:
    "Esta gameplay já foi encerrada. Reabra-a para alterar as partidas.",
  NIGHT_WITHOUT_MATCHES:
    "Registre pelo menos uma partida antes de encerrar a gameplay.",
  NIGHT_HAS_MATCHES:
    "A gameplay já tem partidas registradas e não pode ser cancelada. Encerre-a.",
  NO_ACTIVE_SEASON:
    "Não há temporada ativa. Um administrador precisa ativar uma temporada.",
  SEASON_ALREADY_EXISTS: "Já existe uma temporada com este nome.",
  PLAYER_WITHOUT_ACCOUNT:
    "Este jogador ainda não tem conta. Peça um convite a um administrador.",
  TOO_MANY_ATTEMPTS:
    "Muitas tentativas com senha errada. Tente de novo em alguns minutos.",
  INVALID_MATCH: "Os dados da partida são inválidos.",
  // Uma mensagem só para código inexistente, usado, substituído ou vencido:
  // a resposta não revela qual é o caso.
  INVALID_INVITE:
    "Convite inválido ou expirado. Confira o código ou peça um novo a um administrador.",
  INVITE_CONFLICT:
    "Outro convite acabou de ser gerado para este jogador. Atualize a página.",
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
  account_invites_one_pending_per_player_idx: "INVITE_CONFLICT",
  account_invites_player_id_players_id_fk: "NOT_FOUND",
  nights_single_open_idx: "PREVIOUS_NIGHT_OPEN",
  seasons_slug_unique: "SEASON_ALREADY_EXISTS",
  match_players_fifa_rating_range: "INVALID_MATCH",
  night_is_closed: "NIGHT_CLOSED",
  match_totals_goals: "INVALID_MATCH",
  match_totals_assists: "INVALID_MATCH",
  match_totals_contributions: "INVALID_MATCH",
  match_players_single_goalkeeper_idx: "INVALID_MATCH",
  match_players_saves_only_for_goalkeeper: "INVALID_MATCH",
  match_players_penalties_saved_valid: "INVALID_MATCH",
  matches_penalties_only_after_draw: "INVALID_MATCH",
  matches_penalty_scores_valid: "INVALID_MATCH",
  matches_penalty_scores_presence: "INVALID_MATCH",
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
