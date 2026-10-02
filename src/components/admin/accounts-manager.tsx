"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAccount,
  deactivateAccount,
  reactivateAccount,
  setAccountPassword,
  setAccountPlayer,
  setAccountRole,
} from "@/server/actions/account-actions";
import type { ActionResult } from "@/server/actions/action";
import type { Account } from "@/server/users/service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";
import { Field, Input, Notice, Select } from "../ui/field";
import { PlayerAvatar } from "../ui/player-avatar";

type Role = Account["role"];

interface PlayerOption {
  id: number;
  name: string;
  shirtNumber: number;
  photoUrl: string | null;
}

interface AccountsManagerProps {
  accounts: Account[];
  players: PlayerOption[];
  currentUserId: string;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  player: "Jogador",
};

// Mensagem do servidor: o erro geral ou o primeiro erro de campo.
function errorMessage(result: ActionResult<unknown>): string {
  if (result.ok) return "";
  const fieldError = Object.values(result.error.fieldErrors ?? {})[0]?.[0];
  return fieldError ?? result.error.message;
}

// Executa uma action de conta, mostra o retorno e recarrega a lista.
function useAccountAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  function run(
    action: () => Promise<ActionResult<unknown>>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setFeedback({ ok: false, message: errorMessage(result) });
        return;
      }
      setFeedback({ ok: true, message: successMessage });
      onSuccess?.();
      router.refresh();
    });
  }

  return { pending, feedback, run };
}

function Feedback({
  feedback,
}: {
  feedback: { ok: boolean; message: string } | null;
}) {
  if (!feedback) return null;
  return (
    <Notice tone={feedback.ok ? "success" : "error"}>{feedback.message}</Notice>
  );
}

function PlayerSelect({
  value,
  onChange,
  players,
  takenBy,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  players: PlayerOption[];
  // Jogadores já vinculados a outra conta: id do jogador → nome da conta.
  takenBy: Map<number, string>;
  label: string;
}) {
  return (
    <Field label={label}>
      <Select
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
      >
        <option value="">Nenhum</option>
        {players.map((player) => {
          const owner = takenBy.get(player.id);
          return (
            <option
              key={player.id}
              value={player.id}
              disabled={owner !== undefined}
            >
              {player.shirtNumber} {player.name}
              {owner !== undefined && ` (conta de ${owner})`}
            </option>
          );
        })}
      </Select>
    </Field>
  );
}

function RoleSelect({
  value,
  onChange,
}: {
  value: Role;
  onChange: (role: Role) => void;
}) {
  return (
    <Field label="Papel">
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value as Role)}
      >
        <option value="player">{ROLE_LABEL.player}</option>
        <option value="admin">{ROLE_LABEL.admin}</option>
      </Select>
    </Field>
  );
}

function NewAccountForm({
  players,
  accounts,
}: {
  players: PlayerOption[];
  accounts: Account[];
}) {
  const { pending, feedback, run } = useAccountAction();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [playerId, setPlayerId] = useState<number | null>(null);

  const takenBy = new Map(
    accounts.flatMap((account) =>
      account.playerId === null ? [] : [[account.playerId, account.name]],
    ),
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    run(
      () => createAccount({ name, email, password, role, playerId }),
      `Conta de ${name} criada.`,
      () => {
        setName("");
        setEmail("");
        setPassword("");
        setRole("player");
        setPlayerId(null);
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-surface flex flex-col gap-4 rounded-lg p-4 lg:sticky lg:top-20"
    >
      <h2 className="text-lg font-bold tracking-tight">Nova conta</h2>
      <Field label="Nome">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
        />
      </Field>
      <Field label="E-mail">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
          required
        />
      </Field>
      <Field label="Senha" hint="Mínimo de 8 caracteres">
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <RoleSelect value={role} onChange={setRole} />
      <PlayerSelect
        label="Jogador vinculado"
        value={playerId}
        onChange={setPlayerId}
        players={players}
        takenBy={takenBy}
      />
      <p className="text-muted text-xs">
        A conta entra pelo retrato do jogador vinculado. O e-mail identifica a
        conta e não é exibido a visitantes.
      </p>
      <Feedback feedback={feedback} />
      <Button type="submit" variant="primary" loading={pending}>
        {pending ? "Criando" : "Criar conta"}
      </Button>
    </form>
  );
}

function AccountCard({
  account,
  players,
  accounts,
  isSelf,
}: {
  account: Account;
  players: PlayerOption[];
  accounts: Account[];
  isSelf: boolean;
}) {
  const { pending, feedback, run } = useAccountAction();
  const [role, setRole] = useState<Role>(account.role);
  const [playerId, setPlayerId] = useState<number | null>(account.playerId);
  const [newPassword, setNewPassword] = useState("");
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);

  const takenBy = new Map(
    accounts.flatMap((other) =>
      other.playerId === null || other.id === account.id
        ? []
        : [[other.playerId, other.name]],
    ),
  );
  const linked = players.find((player) => player.id === account.playerId);

  return (
    <li className="bg-surface flex flex-col gap-4 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar
          name={account.name}
          shirtNumber={linked?.shirtNumber}
          photoUrl={linked?.photoUrl ?? null}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">
            {account.name}
            {isSelf && <span className="text-muted font-normal"> (você)</span>}
          </p>
          <p className="text-muted text-sm break-all">{account.email}</p>
          <p className="text-soft text-sm">
            {linked
              ? `Jogador: ${linked.name}, camisa ${linked.shirtNumber}`
              : "Sem jogador vinculado"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={account.role === "admin" ? "accent" : "neutral"}>
            {ROLE_LABEL[account.role]}
          </Badge>
          <Badge tone={account.active ? "win" : "loss"}>
            {account.active ? "Ativa" : "Desativada"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <RoleSelect value={role} onChange={setRole} />
          </div>
          <Button
            disabled={pending || role === account.role}
            onClick={() =>
              run(
                () => setAccountRole({ userId: account.id, role }),
                "Papel atualizado.",
              )
            }
          >
            Salvar
          </Button>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <PlayerSelect
              label="Jogador vinculado"
              value={playerId}
              onChange={setPlayerId}
              players={players}
              takenBy={takenBy}
            />
          </div>
          <Button
            disabled={pending || playerId === account.playerId}
            onClick={() =>
              run(
                () => setAccountPlayer({ userId: account.id, playerId }),
                "Vínculo atualizado.",
              )
            }
          >
            Salvar
          </Button>
        </div>

        <div className="flex items-end gap-2">
          <Field label="Nova senha (mínimo de 8)" className="flex-1">
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
            />
          </Field>
          <Button
            disabled={pending || newPassword.length < 8}
            onClick={() =>
              run(
                () => setAccountPassword({ userId: account.id, newPassword }),
                "Senha redefinida. As sessões desta conta foram encerradas.",
                () => setNewPassword(""),
              )
            }
          >
            Redefinir
          </Button>
        </div>

        <div className="flex flex-col justify-end gap-1">
          {account.active ? (
            <>
              <Button
                variant="danger"
                disabled={pending || isSelf}
                onClick={() => setConfirmingDeactivation(true)}
              >
                Desativar conta
              </Button>
              {isSelf && (
                <p className="text-muted text-xs">
                  Você não pode desativar a própria conta.
                </p>
              )}
            </>
          ) : (
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () => reactivateAccount({ userId: account.id }),
                  "Conta reativada.",
                )
              }
            >
              Reativar conta
            </Button>
          )}
        </div>
      </div>

      <Feedback feedback={feedback} />

      <ConfirmDialog
        open={confirmingDeactivation}
        title={`Desativar a conta de ${account.name}?`}
        confirmLabel="Desativar conta"
        tone="danger"
        onClose={() => setConfirmingDeactivation(false)}
        onConfirm={() => {
          setConfirmingDeactivation(false);
          run(
            () => deactivateAccount({ userId: account.id }),
            "Conta desativada.",
          );
        }}
      >
        Ela perde o acesso na hora. Dá para reativar depois.
      </ConfirmDialog>
    </li>
  );
}

// Gestão de contas e permissões. Tudo aqui passa por Server Actions que
// conferem o papel de admin no servidor e registram auditoria.
export function AccountsManager({
  accounts,
  players,
  currentUserId,
}: AccountsManagerProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[4fr_8fr] lg:items-start">
      <NewAccountForm players={players} accounts={accounts} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">
          Contas
          <span className="text-muted ml-2 text-sm font-normal">
            {accounts.length}
          </span>
        </h2>
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <AccountCard
              // A chave inclui o estado salvo: depois de uma alteração o cartão
              // volta a refletir o que está no servidor.
              key={`${account.id}:${account.role}:${account.playerId}:${account.active}`}
              account={account}
              players={players}
              accounts={accounts}
              isSelf={account.id === currentUserId}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
