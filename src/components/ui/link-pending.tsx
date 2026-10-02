"use client";

import { useLinkStatus } from "next/link";

// Marcador invisível para pôr dentro de um <Link>: enquanto o destino carrega,
// ele fica com `data-pending="true"`, e o link reage pelo CSS (por exemplo,
// `has-[[data-pending=true]]:bg-surface`). É o retorno imediato do toque nas
// telas que trocam sem esqueleto.
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span hidden data-pending={pending} />;
}
