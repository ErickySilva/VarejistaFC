"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "./icons";

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  // "row": rótulo à esquerda e controle à direita. "score": número grande em
  // cima e botões embaixo, para o placar.
  variant?: "row" | "score";
  hint?: string;
  // Por que não dá para passar do máximo (ex.: "O placar do time é 3").
  maxReason?: string;
}

const buttonClass =
  "bg-raised text-fg hover:bg-line flex h-11 w-11 items-center justify-center rounded-md " +
  "transition-[transform,background-color,opacity] duration-150 active:scale-90 " +
  "aria-disabled:opacity-35 aria-disabled:hover:bg-raised";

// Contador de toque: botões grandes de menos e mais, sem teclado. Cada toque
// tem resposta: o número rola na direção da mudança e, no limite, o controle
// treme e diz o motivo, em vez de aceitar um valor que seria recusado depois.
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  variant = "row",
  hint,
  maxReason,
}: NumberStepperProps) {
  // Direção da última mudança e quantas vezes o limite foi tocado: as chaves
  // refazem o elemento para a animação tocar de novo.
  const [direction, setDirection] = useState<"up" | "down" | null>(null);
  const [denied, setDenied] = useState(0);
  const [deniedAtMax, setDeniedAtMax] = useState(false);

  function change(delta: 1 | -1) {
    const next = value + delta;
    if (next < min || next > max) {
      setDenied((count) => count + 1);
      setDeniedAtMax(delta > 0);
      navigator.vibrate?.(18);
      return;
    }
    setDeniedAtMax(false);
    setDirection(delta > 0 ? "up" : "down");
    onChange(next);
  }

  const atMin = value <= min;
  const atMax = value >= max;
  const roll =
    direction === "up"
      ? "animate-roll-up"
      : direction === "down"
        ? "animate-roll-down"
        : "";
  const reason = deniedAtMax && atMax ? maxReason : undefined;

  const minus = (
    <button
      type="button"
      className={buttonClass}
      onClick={() => change(-1)}
      aria-disabled={atMin}
      aria-label={`Diminuir ${label}`}
    >
      <MinusIcon />
    </button>
  );
  const plus = (
    <button
      type="button"
      className={buttonClass}
      onClick={() => change(1)}
      aria-disabled={atMax}
      aria-label={`Aumentar ${label}`}
    >
      <PlusIcon />
    </button>
  );

  if (variant === "score") {
    return (
      <div className="flex min-w-0 flex-col items-center gap-3">
        <span className="w-full truncate text-center text-sm font-semibold">
          {label}
        </span>
        <span
          key={denied}
          className={`overflow-hidden ${denied > 0 ? "animate-shake" : ""}`}
        >
          <output
            key={value}
            aria-live="polite"
            className={`numeral block text-7xl ${roll}`}
          >
            {value}
          </output>
        </span>
        <div className="flex gap-2">
          {minus}
          {plus}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          {label}
          {hint && <span className="text-muted block text-xs">{hint}</span>}
        </span>
        <div
          key={denied}
          className={`flex items-center gap-1 ${denied > 0 ? "animate-shake" : ""}`}
        >
          {minus}
          <span className="w-10 overflow-hidden text-center">
            <output
              key={value}
              aria-live="polite"
              className={`numeral block text-2xl ${roll}`}
            >
              {value}
            </output>
          </span>
          {plus}
        </div>
      </div>
      {reason && (
        <p
          role="status"
          className="text-accent animate-fade text-right text-xs"
        >
          {reason}
        </p>
      )}
    </div>
  );
}
