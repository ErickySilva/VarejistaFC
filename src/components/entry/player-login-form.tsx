"use client";

import { useActionState } from "react";
import { signInAsPlayerWithForm } from "@/server/actions/auth-actions";

interface PlayerLoginFormProps {
  playerSlug: string;
  playerName: string;
  destination?: "admin";
}

// Senha da conta do jogador escolhido. O e-mail da conta não aparece nem é
// enviado: o servidor encontra a conta pelo jogador.
export function PlayerLoginForm({
  playerSlug,
  playerName,
  destination,
}: PlayerLoginFormProps) {
  const [state, formAction, pending] = useActionState(
    signInAsPlayerWithForm,
    null,
  );
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="playerSlug" value={playerSlug} />
      {destination && (
        <input type="hidden" name="destino" value={destination} />
      )}
      {/* Ajuda o gerenciador de senhas a associar a senha ao jogador. */}
      <input
        type="text"
        name="username"
        value={playerSlug}
        autoComplete="username"
        readOnly
        hidden
      />

      <label className="flex flex-col gap-1 text-sm">
        Senha de {playerName}
        <input
          className="border-foreground/20 w-full rounded border bg-transparent px-3 py-3 text-base"
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error.fieldErrors?.password?.[0] ?? error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background min-h-12 rounded px-4 py-3 font-medium disabled:opacity-60"
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
