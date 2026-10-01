import "server-only";
import { redirect } from "next/navigation";
import { can, type Actor, type Permission } from "./policy";
import { getActor } from "./session";

// Para páginas restritas: sem login, manda para /entrar; logado sem a
// permissão, devolve null para a página mostrar o aviso de acesso negado.
// Os serviços conferem a permissão de novo ao ler ou gravar.
export async function getActorWithPermission(
  permission: Permission,
): Promise<Actor | null> {
  const actor = await getActor();
  if (!actor) redirect("/entrar");
  return can(actor, permission) ? actor : null;
}
