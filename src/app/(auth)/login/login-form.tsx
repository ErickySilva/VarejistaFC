"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";
import { signInWithForm } from "@/server/actions/auth-actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithForm, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="E-mail" error={error?.fieldErrors?.email?.[0]}>
        <Input type="email" name="email" autoComplete="username" required />
      </Field>

      <Field label="Senha" error={error?.fieldErrors?.password?.[0]}>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {error && !error.fieldErrors && (
        <Notice tone="error">{error.message}</Notice>
      )}

      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? "Entrando" : "Entrar"}
      </Button>
    </form>
  );
}
