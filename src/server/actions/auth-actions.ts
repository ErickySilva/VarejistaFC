"use server";

import { redirect } from "next/navigation";
import { changeOwnPassword, signIn, signOut } from "../auth/service";
import type { ActionResult } from "./action";
import { protectedAction, publicAction } from "./factory";
import { changePasswordSchema, noInputSchema, signInSchema } from "./schemas";

const signInAction = publicAction({
  schema: signInSchema,
  handler: (input, context) => signIn(context.headers, input),
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
  if (result.ok) redirect("/conta");
  return result;
}

export async function signOutAndRedirect(): Promise<void> {
  await signOutAction(undefined);
  redirect("/login");
}
