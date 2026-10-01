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

type Role = Account["role"];

interface PlayerOption {
  id: number;
  name: string;
  shirtNumber: number;
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

const fieldClass =
  "border-foreground/20 w-full rounded border bg-transparent px-3 py-2 text-base";
const buttonClass =
  "border-foreground/20 min-h-11 rounded border px-3 py-2 text-sm font-medium disabled:opacity-50";

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
    <p
      role={feedback.ok ? "status" : "alert"}
      className={`text-sm ${feedback.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}
    >
      {feedback.message}
    </p>
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
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <select
        className={fieldClass}
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
              #{player.shirtNumber} {player.name}
              {owner !== undefined && ` (conta de ${owner})`}
            </option>
          );
        })}
      </select>
    </label>
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
      className="border-foreground/15 flex flex-col gap-3 rounded border p-4"
    >
      <h2 className="font-semibold">Nova conta</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nome
          <input
            className={fieldClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            className={fieldClass}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Senha (mínimo de 8 caracteres)
          <input
            className={fieldClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Papel
          <select
            className={fieldClass}
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="player">{ROLE_LABEL.player}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </select>
        </label>
        <PlayerSelect
          label="Jogador vinculado"
          value={playerId}
          onChange={setPlayerId}
          players={players}
          takenBy={takenBy}
        />
      </div>
      <p className="text-xs opacity-70">
        A conta entra pelo tile do jogador vinculado. O e-mail identifica a
        conta e não é exibido a visitantes.
      </p>
      <Feedback feedback={feedback} />
      <button
        type="submit"
        disabled={pending}
        className="bg-foreground text-background min-h-11 self-start rounded px-4 py-2 font-medium disabled:opacity-60"
      >
        {pending ? "Criando..." : "Criar conta"}
      </button>
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

  const takenBy = new Map(
    accounts.flatMap((other) =>
      other.playerId === null || other.id === account.id
        ? []
        : [[other.playerId, other.name]],
    ),
  );
  const linked = players.find((player) => player.id === account.playerId);

  return (
    <li className="border-foreground/15 flex flex-col gap-3 rounded border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {account.name}
            {isSelf && <span className="font-normal opacity-70"> (você)</span>}
          </p>
          <p className="text-sm break-all opacity-70">{account.email}</p>
          <p className="text-sm">
            {linked
              ? `Jogador: #${linked.shirtNumber} ${linked.name}`
              : "Sem jogador vinculado"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <span className="border-foreground/20 rounded border px-2 py-1">
            {ROLE_LABEL[account.role]}
          </span>
          <span
            className={`rounded px-2 py-1 ${
              account.active
                ? "bg-green-600/15 text-green-700 dark:text-green-400"
                : "bg-red-600/15 text-red-700 dark:text-red-400"
            }`}
          >
            {account.active ? "Ativa" : "Desativada"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Papel
            <select
              className={fieldClass}
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              <option value="player">{ROLE_LABEL.player}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
            </select>
          </label>
          <button
            type="button"
            className={buttonClass}
            disabled={pending || role === account.role}
            onClick={() =>
              run(
                () => setAccountRole({ userId: account.id, role }),
                "Papel atualizado.",
              )
            }
          >
            Salvar
          </button>
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
          <button
            type="button"
            className={buttonClass}
            disabled={pending || playerId === account.playerId}
            onClick={() =>
              run(
                () => setAccountPlayer({ userId: account.id, playerId }),
                "Vínculo atualizado.",
              )
            }
          >
            Salvar
          </button>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Nova senha
            <input
              className={fieldClass}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              placeholder="mínimo de 8 caracteres"
            />
          </label>
          <button
            type="button"
            className={buttonClass}
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
          </button>
        </div>

        <div className="flex items-end">
          {account.active ? (
            <button
              type="button"
              className={`${buttonClass} text-red-600`}
              disabled={pending || isSelf}
              title={isSelf ? "Você não pode desativar a própria conta" : ""}
              onClick={() => {
                if (
                  !window.confirm(
                    `Desativar a conta de ${account.name}? Ela perde o acesso na hora.`,
                  )
                ) {
                  return;
                }
                run(
                  () => deactivateAccount({ userId: account.id }),
                  "Conta desativada.",
                );
              }}
            >
              Desativar conta
            </button>
          ) : (
            <button
              type="button"
              className={buttonClass}
              disabled={pending}
              onClick={() =>
                run(
                  () => reactivateAccount({ userId: account.id }),
                  "Conta reativada.",
                )
              }
            >
              Reativar conta
            </button>
          )}
        </div>
      </div>

      <Feedback feedback={feedback} />
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
    <div className="flex flex-col gap-5">
      <NewAccountForm players={players} accounts={accounts} />

      <section>
        <h2 className="mb-2 font-semibold">Contas ({accounts.length})</h2>
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
