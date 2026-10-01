"use server";

import { redirect } from "next/navigation";
import {
  changeOwnPassword,
  signIn,
  signInAsPlayer,
  signOut,
} from "../auth/service";
import type { ActionResult } from "./action";
import { protectedAction, publicAction } from "./factory";
import {
  changePasswordSchema,
  noInputSchema,
  playerSignInSchema,
  signInSchema,
} from "./schemas";

const signInAction = publicAction({
  schema: signInSchema,
  handler: (input, context) => signIn(context.headers, input),
});

const signInAsPlayerAction = publicAction({
  schema: playerSignInSchema,
  handler: (input, context) => signInAsPlayer(context.headers, input),
});

const signOutAction = protectedAction(
  { action: "account.self" },
  {
    schema: noInputSchema,
    handler: (_input, context) => signOut(context.headers),
  },
);

export const changePassword = protectedAction(
  { action: "account.self" },
  {
    schema: changePasswordSchema,
    handler: (input, context) => changeOwnPassword(context, input),
  },
);

// Forma usada pelo formulário de login (useActionState).
export async function signInWithForm(
  _previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  const result = await signInAction({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (result.ok) redirect("/");
  return result;
}

// Entrada pelo tile do jogador. `destino=admin` leva à área administrativa,
// que confere no servidor se a conta é mesmo de administrador.
export async function signInAsPlayerWithForm(
  _previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  const result = await signInAsPlayerAction({
    playerSlug: formData.get("playerSlug"),
    password: formData.get("password"),
  });
  if (result.ok) redirect(formData.get("destino") === "admin" ? "/admin" : "/");
  return result;
}

export async function signOutAndRedirect(): Promise<void> {
  await signOutAction(undefined);
  redirect("/entrar");
}
