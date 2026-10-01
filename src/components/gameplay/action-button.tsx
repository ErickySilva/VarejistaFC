"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/action";

const VARIANTS = {
  primary: "bg-foreground text-background",
  secondary: "border-foreground/20 border",
  danger: "border border-red-600/40 text-red-600",
};

interface ActionButtonProps {
  // Server Action sem argumentos (ou já com o argumento fixado por `bind`).
  action: (input?: undefined) => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel: string;
  // Se informado, pede confirmação antes de executar.
  confirmMessage?: string;
  variant?: keyof typeof VARIANTS;
  // Para onde ir depois de dar certo; sem isso, a página atual é atualizada.
  redirectTo?: string;
}

export function ActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
  variant = "primary",
  redirectTo,
}: ActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`min-h-12 rounded px-4 py-3 text-base font-medium disabled:opacity-60 ${VARIANTS[variant]}`}
      >
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
