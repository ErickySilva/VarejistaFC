import {
  installViewTransitionGuard,
  type DocumentLike,
} from "@/lib/view-transition-guard";

// Roda no navegador antes de o app ficar interativo (e antes de o React
// iniciar qualquer transição). Uma falha aqui não pode impedir o app de abrir.
try {
  // A proteção só usa a visibilidade e `startViewTransition` do documento.
  installViewTransitionGuard(document as unknown as DocumentLike);
} catch {
  // Sem a proteção o app funciona igual; só perde o tratamento dos abortos.
}
