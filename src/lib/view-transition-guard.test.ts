import { describe, expect, it, vi } from "vitest";
import {
  EXPECTED_ABORT_MESSAGE,
  installViewTransitionGuard,
  isExpectedAbort,
  normalizeTransitionError,
  type DocumentLike,
  type TransitionLike,
} from "./view-transition-guard";

const invalidState = (message: string) =>
  new DOMException(message, "InvalidStateError");

// Documento de mentira: `native` é o que o navegador faria.
function fakeDocument(
  native: DocumentLike["startViewTransition"],
  visibilityState = "visible",
) {
  const doc: DocumentLike = { visibilityState, startViewTransition: native };
  installViewTransitionGuard(doc);
  return doc;
}

function nativeTransition(
  overrides: Partial<TransitionLike> = {},
): TransitionLike {
  return {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
    ...overrides,
  };
}

// Rejeição que o teste observa depois, sem virar "não tratada" antes disso.
function rejected(error: unknown): Promise<never> {
  const promise = Promise.reject(error);
  promise.catch(() => {});
  return promise;
}

describe("isExpectedAbort", () => {
  it.each([
    "Transition was aborted because of invalid state",
    "Transition was aborted because of invalid state. Document hidden",
    "Transition was aborted because of invalid state. Viewport size changed",
    "Skipping view transition because document visibility state has become hidden.",
    "Skipping view transition because viewport size changed.",
    "View transition was skipped because document visibility state is hidden.",
  ])("reconhece o aborto do navegador: %s", (message) => {
    expect(isExpectedAbort(invalidState(message))).toBe(true);
  });

  it("reconhece a interrupção por outra transição", () => {
    expect(isExpectedAbort(new DOMException("skipped", "AbortError"))).toBe(
      true,
    );
  });

  it("não confunde outros erros com aborto", () => {
    expect(isExpectedAbort(invalidState("Algo diferente"))).toBe(false);
    expect(isExpectedAbort(new Error("falha na atualização"))).toBe(false);
    expect(isExpectedAbort(new DOMException("x", "TimeoutError"))).toBe(false);
    expect(isExpectedAbort(null)).toBe(false);
    expect(isExpectedAbort("texto")).toBe(false);
  });
});

describe("normalizeTransitionError", () => {
  it("traduz o aborto para a mensagem que o React reconhece", () => {
    const original = invalidState(
      "Transition was aborted because of invalid state. Document hidden",
    );
    const normalized = normalizeTransitionError(original) as DOMException;

    expect(normalized.name).toBe("InvalidStateError");
    expect(normalized.message).toBe(EXPECTED_ABORT_MESSAGE);
    expect((normalized as { cause?: unknown }).cause).toBe(original);
  });

  it("deixa os outros erros como estão", () => {
    const error = new Error("falha na atualização");
    expect(normalizeTransitionError(error)).toBe(error);
  });
});

describe("installViewTransitionGuard", () => {
  it("com o documento visível, inicia a transição do navegador", async () => {
    const transition = nativeTransition();
    const native = vi.fn(() => transition);
    const doc = fakeDocument(native);
    const update = vi.fn();

    const result = doc.startViewTransition!({ update });

    expect(native).toHaveBeenCalledTimes(1);
    expect(native).toHaveBeenCalledWith({ update });
    await expect(result.ready).resolves.toBeUndefined();
    await expect(result.finished).resolves.toBeUndefined();
    result.skipTransition();
    expect(transition.skipTransition).toHaveBeenCalledTimes(1);
  });

  it("chama o navegador com o documento como `this`", () => {
    let receiver: unknown;
    const doc = fakeDocument(function (this: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      receiver = this;
      return nativeTransition();
    });

    doc.startViewTransition!(() => {});

    expect(receiver).toBe(doc);
  });

  it("com o documento oculto, não inicia transição e aplica a mudança", async () => {
    const native = vi.fn(() => nativeTransition());
    const doc = fakeDocument(native, "hidden");
    const update = vi.fn();

    const result = doc.startViewTransition!({ update });

    expect(native).not.toHaveBeenCalled();
    await expect(result.finished).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
    await expect(result.ready).rejects.toMatchObject({
      name: "InvalidStateError",
      message: EXPECTED_ABORT_MESSAGE,
    });
  });

  it("volta a iniciar transições quando o documento fica visível de novo", () => {
    const native = vi.fn(() => nativeTransition());
    const doc = fakeDocument(native, "hidden");

    doc.startViewTransition!(() => {});
    doc.visibilityState = "visible";
    doc.startViewTransition!(() => {});

    expect(native).toHaveBeenCalledTimes(1);
  });

  it("aceita a mudança passada direto como função", async () => {
    const doc = fakeDocument(vi.fn(), "hidden");
    const update = vi.fn();

    await doc.startViewTransition!(update).finished;

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("traduz o aborto 'Document hidden' no meio da transição", async () => {
    const doc = fakeDocument(() =>
      nativeTransition({
        ready: rejected(
          invalidState(
            "Transition was aborted because of invalid state. Document hidden",
          ),
        ),
      }),
    );

    const result = doc.startViewTransition!(() => {});

    await expect(result.ready).rejects.toMatchObject({
      name: "InvalidStateError",
      message: EXPECTED_ABORT_MESSAGE,
    });
    await expect(result.finished).resolves.toBeUndefined();
  });

  it("traduz a interrupção por uma transição mais nova", async () => {
    const doc = fakeDocument(() =>
      nativeTransition({
        ready: rejected(new DOMException("skipped", "AbortError")),
      }),
    );

    await expect(
      doc.startViewTransition!(() => {}).ready,
    ).rejects.toMatchObject({ message: EXPECTED_ABORT_MESSAGE });
  });

  it("não esconde erro que não é aborto", async () => {
    const failure = new Error("falha na atualização");
    const doc = fakeDocument(() =>
      nativeTransition({
        ready: rejected(failure),
        finished: rejected(failure),
        updateCallbackDone: rejected(failure),
      }),
    );

    const result = doc.startViewTransition!(() => {});

    await expect(result.ready).rejects.toBe(failure);
    await expect(result.finished).rejects.toBe(failure);
    await expect(result.updateCallbackDone).rejects.toBe(failure);
  });

  it("se o navegador recusar a chamada, aplica a mudança sem transição", async () => {
    const doc = fakeDocument(() => {
      throw invalidState("recusado");
    });
    const update = vi.fn();

    const result = doc.startViewTransition!({ update });

    await expect(result.finished).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
    await expect(result.ready).rejects.toMatchObject({
      message: EXPECTED_ABORT_MESSAGE,
    });
  });

  it("não gera rejeição não tratada quando ninguém observa as promessas", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const hidden = fakeDocument(vi.fn(), "hidden");
      hidden.startViewTransition!(() => {});

      const aborted = fakeDocument(() =>
        nativeTransition({
          ready: rejected(
            invalidState(
              "Transition was aborted because of invalid state. Document hidden",
            ),
          ),
        }),
      );
      aborted.startViewTransition!(() => {});

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("não instala duas vezes", () => {
    const native = vi.fn(() => nativeTransition());
    const doc = fakeDocument(native);
    const installed = doc.startViewTransition;

    installViewTransitionGuard(doc);

    expect(doc.startViewTransition).toBe(installed);
    doc.startViewTransition!(() => {});
    expect(native).toHaveBeenCalledTimes(1);
  });

  it("não faz nada em navegador sem View Transitions", () => {
    const doc: DocumentLike = { visibilityState: "visible" };

    installViewTransitionGuard(doc);

    expect(doc.startViewTransition).toBeUndefined();
  });
});
