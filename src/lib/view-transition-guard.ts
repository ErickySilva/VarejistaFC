// Proteção das View Transitions.
//
// Quem chama `document.startViewTransition()` é o próprio React, ao aplicar
// uma navegação que tem um <ViewTransition>. A transição é só um
// aprimoramento: se o navegador a abortar, a tela tem de trocar do mesmo
// jeito e sem erro.
//
// O navegador aborta uma transição, por exemplo, quando a aba fica oculta, a
// janela muda de tamanho (teclado do celular, rotação) ou outra transição
// começa. Nesses casos ele rejeita a promessa `ready`. O React já ignora esses
// abortos, mas reconhece o erro comparando a mensagem inteira com uma lista
// fixa, e o Chromium passou a acrescentar o motivo ao final ("Transition was
// aborted because of invalid state. Document hidden"). A comparação falha e o
// React trata como erro: "Recoverable InvalidStateError".
//
// Esta proteção fica entre o React e o navegador e faz três coisas:
//   1. com o documento oculto, não inicia a transição: só aplica a mudança;
//   2. traduz os abortos esperados do navegador para a forma que o React
//      reconhece, seja qual for o motivo acrescentado à mensagem;
//   3. se o navegador recusar a chamada, aplica a mudança sem transição.
// Erros de verdade (os que não são aborto) passam sem alteração.

type UpdateCallback = () => unknown;
type StartArgument = UpdateCallback | { update?: UpdateCallback | null } | null;

// O que o React usa de uma transição.
export interface TransitionLike {
  ready: Promise<unknown>;
  finished: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
  skipTransition: () => void;
}

export interface DocumentLike {
  visibilityState: string;
  startViewTransition?: (argument?: StartArgument) => TransitionLike;
}

// Mensagem que o React reconhece como aborto esperado (e ignora).
export const EXPECTED_ABORT_MESSAGE =
  "Transition was aborted because of invalid state";

// Inícios das mensagens de aborto do Chromium, com ou sem o motivo no final.
const ABORT_MESSAGE_PREFIXES = [
  "Transition was aborted because of invalid state",
  "Skipping view transition because",
  "View transition was skipped because",
];

const GUARDED = Symbol.for("varejista.viewTransitionGuard");

function ignore() {}

// O navegador desistiu da transição por um motivo previsto? (A mudança de
// tela não é afetada; só a animação deixa de acontecer.)
export function isExpectedAbort(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  // Interrompida por outra transição ou por `skipTransition()`.
  if (name === "AbortError") return true;
  return (
    name === "InvalidStateError" &&
    typeof message === "string" &&
    ABORT_MESSAGE_PREFIXES.some((prefix) => message.startsWith(prefix))
  );
}

function expectedAbort(cause?: unknown): Error {
  const error = new DOMException(EXPECTED_ABORT_MESSAGE, "InvalidStateError");
  if (cause !== undefined) {
    Object.defineProperty(error, "cause", { value: cause });
  }
  return error;
}

// Aborto esperado vira o erro que o React reconhece; o resto passa igual.
export function normalizeTransitionError(error: unknown): unknown {
  return isExpectedAbort(error) ? expectedAbort(error) : error;
}

// A mesma promessa, com os abortos traduzidos. Uma rejeição aqui nunca é
// "não tratada": o navegador também marca estas promessas como tratadas.
function guardPromise(promise: Promise<unknown>): Promise<unknown> {
  const guarded = Promise.resolve(promise).then(undefined, (error) => {
    throw normalizeTransitionError(error);
  });
  guarded.catch(ignore);
  return guarded;
}

function updateCallbackOf(argument?: StartArgument): UpdateCallback | null {
  if (typeof argument === "function") return argument;
  return argument?.update ?? null;
}

// Transição que não acontece: a mudança é aplicada e `ready` rejeita com o
// aborto esperado, como o navegador faz ao pular uma transição.
function skippedTransition(argument?: StartArgument): TransitionLike {
  const update = updateCallbackOf(argument);
  const done = Promise.resolve().then(() => update?.());
  done.catch(ignore);
  const ready = Promise.reject(expectedAbort());
  ready.catch(ignore);
  return {
    ready,
    finished: done,
    updateCallbackDone: done,
    skipTransition: ignore,
  };
}

// A transição do navegador, com as três promessas protegidas. Todo o resto
// (tipos, `skipTransition`) continua sendo o da transição original.
function guardTransition(transition: TransitionLike): TransitionLike {
  const promises = {
    ready: guardPromise(transition.ready),
    finished: guardPromise(transition.finished),
    updateCallbackDone: guardPromise(transition.updateCallbackDone),
  };
  return new Proxy(transition, {
    get(target, property) {
      if (property in promises) {
        return promises[property as keyof typeof promises];
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// Instala a proteção em um documento. Sem suporte a View Transitions não há
// o que proteger; chamar de novo não instala duas vezes.
export function installViewTransitionGuard(doc: DocumentLike): void {
  const native = doc.startViewTransition;
  if (typeof native !== "function") return;
  if ((native as unknown as Record<symbol, unknown>)[GUARDED]) return;

  const guarded = (argument?: StartArgument): TransitionLike => {
    // Documento oculto: o navegador abortaria; nem começa.
    if (doc.visibilityState !== "visible") return skippedTransition(argument);

    // Uma transição anterior ainda em andamento é encerrada pelo próprio
    // navegador ao iniciar a nova; o aborto dela chega traduzido.
    try {
      return guardTransition(native.call(doc, argument));
    } catch {
      // O navegador recusou a chamada: a tela troca sem transição.
      return skippedTransition(argument);
    }
  };
  Object.defineProperty(guarded, GUARDED, { value: true });
  doc.startViewTransition = guarded;
}
