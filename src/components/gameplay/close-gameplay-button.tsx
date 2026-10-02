"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { closeGameplay } from "@/server/actions/gameplay-actions";
import { Button, type ButtonSize } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";

// Encerra a gameplay e leva direto à premiação da noite. O servidor confere a
// permissão; aqui só fica a confirmação e o caminho depois de dar certo.
export function CloseGameplayButton({
  size = "lg",
  className = "",
}: {
  size?: ButtonSize;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Encerrada com sucesso: a tela escurece e a premiação começa no escuro.
  const [leaving, setLeaving] = useState(false);

  function close() {
    setError(null);
    startTransition(async () => {
      const result = await closeGameplay(undefined);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAsking(false);
      setLeaving(true);
      const destination = `/premiacao/${result.data.nightId}`;
      setTimeout(() => router.push(destination), 450);
    });
  }

  return (
    <>
      <Button
        variant="danger"
        size={size}
        className={className}
        onClick={() => setAsking(true)}
      >
        Encerrar gameplay
      </Button>
      <ConfirmDialog
        open={asking}
        title="Encerrar a gameplay?"
        confirmLabel={pending ? "Encerrando" : "Encerrar e ver a premiação"}
        tone="danger"
        pending={pending}
        error={error}
        onConfirm={close}
        onClose={() => {
          setAsking(false);
          setError(null);
        }}
      >
        Os prêmios e o resumo da noite são calculados agora, com as partidas
        registradas até aqui.
      </ConfirmDialog>
      {leaving && (
        <div
          aria-hidden="true"
          className="bg-ink-950 animate-fade fixed inset-0 z-50"
        />
      )}
    </>
  );
}
