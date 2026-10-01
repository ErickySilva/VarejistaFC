import "server-only";
import { headers as nextHeaders } from "next/headers";
import { cache } from "react";
import type { UserRole } from "@/db/schema";
import { ServiceError } from "../errors";
import { getAuth } from "./auth";
import { can, type Actor, type Permission } from "./policy";

// Quem está fazendo a requisição e os cabeçalhos dela. Os cabeçalhos são
// repassados ao Better Auth, que confere a sessão de novo em cada operação.
export interface RequestContext {
  actor: Actor;
  headers: Headers;
}

// Resolve o ator a partir do cookie de sessão. A sessão e o usuário são lidos
// do banco a cada chamada: papel, vínculo e desativação valem na hora, sem
// depender de nada guardado no cliente.
export async function getActorFromHeaders(
  headers: Headers,
): Promise<Actor | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session || session.user.banned) return null;

  const { user } = session;
  return {
    userId: user.id,
    role: user.role as UserRole,
    playerId: user.playerId ?? null,
    name: user.name,
    email: user.email,
  };
}

// Uma leitura por requisição, mesmo que várias partes da página perguntem.
export const getActor = cache(async (): Promise<Actor | null> => {
  return getActorFromHeaders(await nextHeaders());
});

export function assertCan(
  actor: Actor | null,
  permission: Permission,
): asserts actor is Actor {
  if (!actor) throw new ServiceError("UNAUTHENTICATED");
  if (!can(actor, permission)) throw new ServiceError("FORBIDDEN");
}

// Contexto da requisição atual, exigindo login.
export async function requireContext(): Promise<RequestContext> {
  const headers = await nextHeaders();
  const actor = await getActorFromHeaders(headers);
  if (!actor) throw new ServiceError("UNAUTHENTICATED");
  return { actor, headers };
}
