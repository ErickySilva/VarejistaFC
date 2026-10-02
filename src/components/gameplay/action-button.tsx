"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/action";
import { Button, type ButtonSize, type ButtonVariant } from "../ui/button";
import { ConfirmDialog } from "../ui/dialog";

interface ActionButtonProps {
  // Server Action sem argumentos (ou já com o argumento fixado por `bind`).
  action: (input?: undefined) => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel: string;
  // Se informado, pede confirmação antes de executar.
  confirm?: { title: string; message: string; confirmLabel: string };
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Para onde ir depois de dar certo; sem isso, a página atual é atualizada.
  redirectTo?: string;
  className?: string;
}

export function ActionButton({
  action,
  label,
  pendingLabel,
  confirm,
  variant = "primary",
  size = "lg",
  redirectTo,
  className = "",
}: ActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setAsking(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Button
        variant={variant}
        size={size}
        loading={pending && !confirm}
        onClick={() => (confirm ? setAsking(true) : run())}
      >
        {pending && !confirm ? pendingLabel : label}
      </Button>
      {error && !asking && (
        <p role="alert" className="text-loss text-sm">
          {error}
        </p>
      )}
      {confirm && (
        <ConfirmDialog
          open={asking}
          title={confirm.title}
          confirmLabel={pending ? pendingLabel : confirm.confirmLabel}
          tone={variant === "danger" ? "danger" : "primary"}
          pending={pending}
          error={error}
          onConfirm={run}
          onClose={() => {
            setAsking(false);
            setError(null);
          }}
        >
          {confirm.message}
        </ConfirmDialog>
      )}
    </div>
  );
}
