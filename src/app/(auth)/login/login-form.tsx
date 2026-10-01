"use client";

import { useActionState } from "react";
import { signInWithForm } from "@/server/actions/auth-actions";

const inputClass =
  "w-full rounded border border-foreground/20 bg-transparent px-3 py-2 text-base";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithForm, null);
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="username"
          required
        />
        {error?.fieldErrors?.email && (
          <span className="text-red-600">{error.fieldErrors.email[0]}</span>
        )}
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Senha
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
        {error?.fieldErrors?.password && (
          <span className="text-red-600">{error.fieldErrors.password[0]}</span>
        )}
      </label>

      {error && !error.fieldErrors && (
        <p role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background rounded px-4 py-2 font-medium disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
