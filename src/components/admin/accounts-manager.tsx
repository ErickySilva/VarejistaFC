"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deactivateAccount,
  reactivateAccount,
  setAccountPassword,
  setAccountPlayer,
  setAccountRole,
} from "@/server/actions/account-actions";
import { formatDateTime } from "@/lib/format";
import type { ActionResult } from "@/server/actions/action";
import { generateInvite } from "@/server/actions/invite-actions";
import type { GeneratedInvite, PendingInvite } from "@/server/invites/service";
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
  // Convites em aberto; no máximo um por jogador.
  invites: PendingInvite[];
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

// O que o admin envia ao jogador: o código e onde usar. O código não vai em
// um link, para não ficar no histórico do navegador nem em registros de acesso.
function inviteMessage(playerName: string, invite: GeneratedInvite): string {
  return [
    `Convite do Varejista FC para ${playerName}`,
    `Código: ${invite.code}`,
    `Abra ${window.location.origin}/criar-conta e informe o código.`,
    `Vale até ${formatDateTime(invite.expiresAt)}.`,
  ].join("\n");
}

function inviteSummary(invite: PendingInvite | undefined): string {
  if (!invite) return "Nenhum convite gerado.";
  const role = ROLE_LABEL[invite.role].toLowerCase();
  const when = formatDateTime(invite.expiresAt);
  if (invite.status === "pending") {
    return `Convite de ${role} aguardando uso. Vale até ${when}.`;
  }
  if (invite.status === "expired") {
    return `O convite de ${role} venceu em ${when}.`;
  }
  return "O convite deixou de valer: quem gerou não é mais administrador.";
}

// Jogador sem conta: o admin escolhe o papel e gera o convite. O código
// aparece uma vez, aqui, e não pode ser consultado depois.
function InviteCard({
  player,
  invite,
}: {
  player: PlayerOption;
  invite: PendingInvite | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<Role | "">(invite?.role ?? "");
  const [generated, setGenerated] = useState<GeneratedInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const [confirmingReplacement, setConfirmingReplacement] = useState(false);

  // Já existe um convite que ainda pode ser usado: gerar outro o invalida.
  const replacing = generated !== null || invite?.status === "pending";

  function generate() {
    if (role === "") return;
    setError(null);
    setCopied(null);
    startTransition(async () => {
      const result = await generateInvite({ playerId: player.id, role });
      if (!result.ok) {
        setError(errorMessage(result));
        return;
      }
      setGenerated(result.data);
      router.refresh();
    });
  }

  async function copy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(
        inviteMessage(player.name, generated),
      );
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <li className="bg-surface flex flex-col gap-4 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar
          name={player.name}
          shirtNumber={player.shirtNumber}
          photoUrl={player.photoUrl}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">{player.name}</p>
          <p className="text-soft text-sm">Camisa {player.shirtNumber}</p>
        </div>
        <Badge tone="outline">Sem conta</Badge>
      </div>

      {generated ? (
        <div className="bg-well animate-rise flex flex-col gap-3 rounded-md p-4">
          <p className="text-soft text-sm">
            Convite de {player.name} como{" "}
            {ROLE_LABEL[generated.role].toLowerCase()}. Copie agora: o código
            não será mostrado de novo.
          </p>
          <output className="text-fg font-mono text-lg font-semibold tracking-wider break-all select-all">
            {generated.code}
          </output>
          <Button variant="primary" onClick={copy}>
            {copied === "yes" ? "Convite copiado" : "Copiar convite"}
          </Button>
          <p className="text-muted text-xs" role="status">
            {copied === "failed"
              ? "Não deu para copiar automaticamente. Selecione o código acima e copie."
              : `Vale até ${formatDateTime(generated.expiresAt)}. Envie só para ${player.name}.`}
          </p>
        </div>
      ) : (
        <p className="text-soft text-sm">{inviteSummary(invite)}</p>
      )}

      <div className="flex items-end gap-2">
        <Field label="Papel da conta" className="flex-1">
          <Select
            value={role}
            onChange={(event) => setRole(event.target.value as Role | "")}
          >
            <option value="" disabled>
              Escolha o papel
            </option>
            <option value="player">{ROLE_LABEL.player}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </Select>
        </Field>
        <Button
          variant={generated ? "secondary" : "primary"}
          loading={pending}
          disabled={role === ""}
          onClick={() =>
            replacing ? setConfirmingReplacement(true) : generate()
          }
        >
          {invite || generated ? "Gerar novo convite" : "Gerar convite"}
        </Button>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <ConfirmDialog
        open={confirmingReplacement}
        title={`Gerar um novo convite para ${player.name}?`}
        confirmLabel="Gerar novo convite"
        onClose={() => setConfirmingReplacement(false)}
        onConfirm={() => {
          setConfirmingReplacement(false);
          generate();
        }}
      >
        O convite anterior deixa de valer na hora. Quem recebeu o código antigo
        não consegue mais usá-lo.
      </ConfirmDialog>
    </li>
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

// Gestão de contas e permissões, organizada por jogador: quem tem conta
// mostra a conta; quem não tem recebe um convite. Tudo aqui passa por Server
// Actions que conferem o papel de admin no servidor e registram auditoria.
export function AccountsManager({
  accounts,
  players,
  invites,
  currentUserId,
}: AccountsManagerProps) {
  const accountByPlayer = new Map(
    accounts.flatMap((account) =>
      account.playerId === null ? [] : [[account.playerId, account] as const],
    ),
  );
  const inviteByPlayer = new Map(
    invites.map((invite) => [invite.playerId, invite] as const),
  );
  const rosterIds = new Set(players.map((player) => player.id));
  // Contas sem jogador, ou de um jogador que saiu do elenco.
  const otherAccounts = accounts.filter(
    (account) => account.playerId === null || !rosterIds.has(account.playerId),
  );

  const accountCard = (account: Account) => (
    <AccountCard
      // A chave inclui o estado salvo: depois de uma alteração o cartão
      // volta a refletir o que está no servidor.
      key={`${account.id}:${account.role}:${account.playerId}:${account.active}`}
      account={account}
      players={players}
      accounts={accounts}
      isSelf={account.id === currentUserId}
    />
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-tight">
          Jogadores
          <span className="text-muted ml-2 text-sm font-normal">
            {players.length}
          </span>
        </h2>
        <ul className="flex flex-col gap-3">
          {players.map((player) => {
            const account = accountByPlayer.get(player.id);
            return account ? (
              accountCard(account)
            ) : (
              <InviteCard
                key={`convite:${player.id}`}
                player={player}
                invite={inviteByPlayer.get(player.id)}
              />
            );
          })}
        </ul>
      </section>

      {otherAccounts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold tracking-tight">
            Outras contas
            <span className="text-muted ml-2 text-sm font-normal">
              {otherAccounts.length}
            </span>
          </h2>
          <ul className="flex flex-col gap-3">
            {otherAccounts.map(accountCard)}
          </ul>
        </section>
      )}
    </div>
  );
}
