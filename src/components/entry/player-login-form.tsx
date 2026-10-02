"use client";

import { useActionState } from "react";
import { signInAsPlayerWithForm } from "@/server/actions/auth-actions";
import { Button } from "../ui/button";
import { Field, Input } from "../ui/field";

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

      <Field
        label={`Senha de ${playerName}`}
        error={
          error
            ? (error.fieldErrors?.password?.[0] ?? error.message)
            : undefined
        }
      >
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={error ? true : undefined}
          className="min-h-13"
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {pending ? "Entrando" : "Entrar"}
      </Button>
    </form>
  );
}
