"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Ao voltar para a aba, só busca de novo se a última busca tem mais que isto.
const MIN_INTERVAL_MS = 10_000;

// Renderizações do servidor que esta aba já mostrou. Ver uma delas de novo
// significa que a tela foi restaurada da memória (botão voltar), não buscada.
const shown = new Set<string>();

// Mantém em dia quem está acompanhando a gameplay, sem ficar perguntando ao
// servidor: os dados são buscados de novo só quando a pessoa volta para a aba
// do app ou reentra na tela. Não há consulta periódica.
//
// `renderId` identifica a renderização do servidor que chegou com a página.
export function LiveRefresh({ renderId }: { renderId: string }) {
  const router = useRouter();

  useEffect(() => {
    let lastFetch = performance.now();
    const refresh = () => {
      lastFetch = performance.now();
      router.refresh();
    };

    if (shown.has(renderId)) refresh();
    else shown.add(renderId);

    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (performance.now() - lastFetch < MIN_INTERVAL_MS) return;
      refresh();
    };
    document.addEventListener("visibilitychange", onReturn);
    return () => document.removeEventListener("visibilitychange", onReturn);
  }, [renderId, router]);

  return null;
}
