import type { UserRole } from "@/db/schema";

// Regras de autorização como funções puras (ADR 0011). Quem chama já resolveu
// o ator a partir da sessão no servidor; aqui só se decide o que ele pode.

export interface Actor {
  userId: string;
  role: UserRole;
  // Jogador do elenco ligado à conta, se houver.
  playerId: number | null;
  name: string;
  email: string;
}

export type Permission =
  // Criar conta, trocar papel, vincular jogador, redefinir senha, desativar.
  | { action: "accounts.manage" }
  // Noites, partidas, apelidos, histórico, temporadas e adversários.
  | { action: "stats.manage" }
  // Nome, número da camisa e posição padrão de qualquer jogador.
  | { action: "players.manage" }
  // Foto de um jogador específico.
  | { action: "players.edit-photo"; playerId: number }
  // Trocar a própria senha e encerrar a própria sessão.
  | { action: "account.self" };

export function can(actor: Actor | null, permission: Permission): boolean {
  if (!actor) return false;
  if (actor.role === "admin") return true;

  switch (permission.action) {
    case "account.self":
      return true;
    case "players.edit-photo":
      return actor.playerId !== null && actor.playerId === permission.playerId;
    case "accounts.manage":
    case "stats.manage":
    case "players.manage":
      return false;
  }
}
