"use client";

import { useSyncExternalStore } from "react";

// Relógio de um segundo, compartilhado por quem estiver na tela.
function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}
const currentSecond = () => Math.floor(Date.now() / 1000);
const noClock = () => null;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// Tempo decorrido desde o início da gameplay, contando ao vivo. No servidor
// (e até hidratar) mostra traços, para não divergir do relógio do aparelho.
export function Elapsed({
  since,
  className = "text-sm",
}: {
  since: string;
  className?: string;
}) {
  const now = useSyncExternalStore(subscribe, currentSecond, noClock);

  let text = "--:--:--";
  if (now !== null) {
    const seconds = Math.max(0, now - Math.floor(Date.parse(since) / 1000));
    text = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  }

  return (
    <time
      dateTime={since}
      aria-label="Tempo de gameplay"
      className={`numeral ${className}`}
    >
      {text}
    </time>
  );
}
