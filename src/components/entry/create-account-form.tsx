"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/action";
import {
  checkInvite,
  registerWithInvite,
} from "@/server/actions/invite-actions";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/server/auth/constants";
import type { InvitedPlayer } from "@/server/invites/service";
import { Ribbon } from "../ui/badge";
import { Button, buttonClass } from "../ui/button";
import { Field, Input, Notice } from "../ui/field";
import { CheckIcon } from "../ui/icons";
import { PlayerAvatar } from "../ui/player-avatar";
import { FORWARD } from "../ui/transitions";

type ActionError = Extract<ActionResult<unknown>, { ok: false }>["error"];

type Step =
  | { name: "code" }
  | { name: "account"; player: InvitedPlayer }
  | { name: "done"; player: InvitedPlayer };

// Retrato do jogador do convite, como na tela de senha.
function InvitedPortrait({ player }: { player: InvitedPlayer }) {
  return (
    <div className="flex flex-col items-center">
      <PlayerAvatar
        name={player.name}
        shirtNumber={player.shirtNumber}
        photoUrl={player.photoUrl}
        size="xl"
        ring="crest"
        priority
      />
      <Ribbon className="relative -mt-4 h-7! px-4! text-sm!">
        <span className="sr-only">Camisa </span>
        {player.shirtNumber}
      </Ribbon>
      <p className="display mt-2 text-3xl">{player.name}</p>
    </div>
  );
}

// Cadastro por convite, em três passos: código → dados da conta → conta
// criada. A pessoa não escolhe jogador nem papel: os dois vêm do convite, no
// servidor. O papel nem aparece aqui.
export function CreateAccountForm() {
  const [step, setStep] = useState<Step>({ name: "code" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ActionError | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  // Erros conferidos aqui antes de enviar; o servidor confere tudo de novo.
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  // "E-mail já em uso" chega sem campo; aqui ele aparece junto do e-mail.
  const emailTaken = error?.code === "EMAIL_IN_USE" ? error.message : undefined;
  const fieldError = (field: string) =>
    localErrors[field] ??
    error?.fieldErrors?.[field]?.[0] ??
    (field === "email" ? emailTaken : undefined);
  // Erro que não é de um campo específico (ex.: convite que venceu).
  const generalError =
    error && !emailTaken && Object.keys(error.fieldErrors ?? {}).length === 0
      ? error.message
      : null;

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await checkInvite({ code });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep({ name: "account", player: result.data });
    });
  }

  function submitAccount(event: React.FormEvent, player: InvitedPlayer) {
    event.preventDefault();
    setError(null);

    const problems: Record<string, string> = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      problems.password = `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    } else if (password !== passwordConfirmation) {
      problems.passwordConfirmation = "As senhas não são iguais.";
    }
    setLocalErrors(problems);
    if (Object.keys(problems).length > 0) return;

    startTransition(async () => {
      const result = await registerWithInvite({
        code,
        email,
        password,
        passwordConfirmation,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPassword("");
      setPasswordConfirmation("");
      setStep({ name: "done", player });
    });
  }

  function startOver() {
    setError(null);
    setLocalErrors({});
    setCode("");
    setPassword("");
    setPasswordConfirmation("");
    setStep({ name: "code" });
  }

  if (step.name === "code") {
    return (
      <form onSubmit={submitCode} className="flex w-full flex-col gap-5">
        <div className="text-center">
          <h1 className="display text-4xl">Criar conta</h1>
          <p className="text-soft mt-2 text-sm">
            Informe o código de convite que um administrador enviou para você.
          </p>
        </div>

        <Field
          label="Código de convite"
          error={fieldError("code") ?? generalError ?? undefined}
        >
          <Input
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            required
            maxLength={64}
            aria-invalid={error ? true : undefined}
            className="min-h-13 font-mono tracking-wider uppercase placeholder:tracking-normal"
          />
        </Field>

        <Button type="submit" variant="primary" size="lg" loading={pending}>
          {pending ? "Conferindo" : "Continuar"}
        </Button>
      </form>
    );
  }

  if (step.name === "account") {
    const { player } = step;
    return (
      <form
        onSubmit={(event) => submitAccount(event, player)}
        className="animate-next flex w-full flex-col gap-5"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <h1 className="sr-only">Criar conta</h1>
          <InvitedPortrait player={player} />
          <p className="text-soft text-sm">
            Seu convite identifica você como {player.name}. Falta só definir
            como você vai entrar.
          </p>
        </div>

        <Field label="E-mail" error={fieldError("email")}>
          <Input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            autoFocus
            required
            aria-invalid={fieldError("email") ? true : undefined}
          />
        </Field>
        <Field
          label="Senha"
          hint={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
          error={fieldError("password")}
        >
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={MAX_PASSWORD_LENGTH}
            required
            aria-invalid={fieldError("password") ? true : undefined}
          />
        </Field>
        <Field
          label="Confirmar senha"
          error={fieldError("passwordConfirmation")}
        >
          <Input
            type="password"
            name="passwordConfirmation"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            autoComplete="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
            required
            aria-invalid={fieldError("passwordConfirmation") ? true : undefined}
          />
        </Field>

        {(generalError || fieldError("code")) && (
          <Notice tone="error">{fieldError("code") ?? generalError}</Notice>
        )}

        <div className="flex flex-col gap-1">
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            {pending ? "Criando conta" : "Criar conta"}
          </Button>
          <Button variant="ghost" onClick={startOver} disabled={pending}>
            Usar outro código
          </Button>
        </div>
      </form>
    );
  }

  const { player } = step;
  return (
    <div className="animate-next flex w-full flex-col items-center gap-6 text-center">
      <InvitedPortrait player={player} />
      <div>
        <h1 className="display flex items-center justify-center gap-2 text-3xl">
          <CheckIcon className="text-win h-7 w-7" />
          Conta criada
        </h1>
        <p className="text-soft mt-2 text-sm" role="status">
          Agora é só entrar pelo seu retrato, com a senha que você acabou de
          definir.
        </p>
      </div>
      <Link
        href={`/entrar/${player.slug}`}
        transitionTypes={FORWARD}
        className={buttonClass("primary", "lg", "w-full")}
      >
        Entrar como {player.name}
      </Link>
    </div>
  );
}
