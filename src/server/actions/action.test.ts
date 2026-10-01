import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Actor } from "../auth/policy";
import { ServiceError } from "../errors";
import { createActionFactory } from "./action";

const headers = new Headers({ cookie: "sessao=abc" });

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    userId: "u1",
    role: "player",
    playerId: 7,
    name: "Teste",
    email: "teste@test.dev",
    ...overrides,
  };
}

// Envelope com a sessão simulada: `current` é quem está logado (ou ninguém).
function factoryFor(current: Actor | null) {
  return createActionFactory({
    requireContext: async () => {
      if (!current) throw new ServiceError("UNAUTHENTICATED");
      return { actor: current, headers };
    },
    headers: async () => headers,
  });
}

const schema = z.object({ name: z.string().min(2, "Nome curto demais.") });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("action protegida", () => {
  it("sem login: devolve UNAUTHENTICATED e não executa", async () => {
    const handler = vi.fn();
    const action = factoryFor(null).protectedAction(
      { action: "accounts.manage" },
      { schema, handler },
    );

    const result = await action({ name: "ok" });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("papel sem permissão: devolve FORBIDDEN e não executa", async () => {
    const handler = vi.fn();
    const action = factoryFor(actor()).protectedAction(
      { action: "accounts.manage" },
      { schema, handler },
    );

    const result = await action({ name: "ok" });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(handler).not.toHaveBeenCalled();
  });

  it("sem permissão, entrada inválida não revela erros de validação", async () => {
    const action = factoryFor(actor()).protectedAction(
      { action: "accounts.manage" },
      { schema, handler: vi.fn() },
    );

    const result = await action({ name: "" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Você não tem permissão para fazer isso.",
        fieldErrors: undefined,
      },
    });
  });

  it("entrada inválida: devolve os erros por campo e não executa", async () => {
    const handler = vi.fn();
    const action = factoryFor(actor({ role: "admin" })).protectedAction(
      { action: "accounts.manage" },
      { schema, handler },
    );

    const result = await action({ name: "a" });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        fieldErrors: { name: ["Nome curto demais."] },
      },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("sucesso: o handler recebe a entrada validada e o contexto da sessão", async () => {
    const admin = actor({ role: "admin" });
    const handler = vi.fn(async (input: { name: string }) => input.name.length);
    const action = factoryFor(admin).protectedAction(
      { action: "accounts.manage" },
      { schema, handler },
    );

    const result = await action({ name: "Ericky", actorUserId: "outro" });

    expect(result).toEqual({ ok: true, data: 6 });
    // Campos fora do schema são descartados, inclusive um "autor" forjado.
    expect(handler).toHaveBeenCalledWith(
      { name: "Ericky" },
      { actor: admin, headers },
    );
  });

  it("permissão dependente da entrada: player edita só o próprio jogador", async () => {
    const handler = vi.fn(async () => "feito");
    const action = factoryFor(actor({ playerId: 7 })).protectedAction(
      (input) => ({ action: "players.edit-photo", playerId: input.playerId }),
      { schema: z.object({ playerId: z.number() }), handler },
    );

    expect(await action({ playerId: 7 })).toEqual({ ok: true, data: "feito" });
    expect(await action({ playerId: 8 })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ServiceError do handler vira resposta com código e mensagem", async () => {
    const action = factoryFor(actor({ role: "admin" })).protectedAction(
      { action: "accounts.manage" },
      {
        schema,
        handler: async () => {
          throw new ServiceError("LAST_ADMIN");
        },
      },
    );

    expect(await action({ name: "ok" })).toMatchObject({
      ok: false,
      error: { code: "LAST_ADMIN" },
    });
  });

  it("erro inesperado vira INTERNAL sem expor o detalhe", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = factoryFor(actor({ role: "admin" })).protectedAction(
      { action: "accounts.manage" },
      {
        schema,
        handler: async () => {
          throw new Error("senha do banco: hunter2");
        },
      },
    );

    const result = await action({ name: "ok" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Algo deu errado. Tente novamente.",
        fieldErrors: undefined,
      },
    });
    expect(log).toHaveBeenCalled();
  });

  it("erros conhecidos do banco e do Better Auth são traduzidos", async () => {
    const admin = factoryFor(actor({ role: "admin" }));
    const failing = (error: unknown) =>
      admin.protectedAction(
        { action: "accounts.manage" },
        {
          schema,
          handler: async () => {
            throw error;
          },
        },
      )({ name: "ok" });

    const constraint = (name: string) =>
      Object.assign(new Error("query failed"), {
        cause: { constraint_name: name },
      });

    expect(await failing(constraint("users_player_id_unique"))).toMatchObject({
      error: { code: "PLAYER_ALREADY_LINKED" },
    });
    expect(await failing(constraint("users_at_least_one_admin"))).toMatchObject(
      { error: { code: "LAST_ADMIN" } },
    );
    expect(
      await failing({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } }),
    ).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
  });
});

describe("action pública", () => {
  it("executa sem sessão, com a entrada validada e os cabeçalhos", async () => {
    const handler = vi.fn(async () => "ok");
    const action = factoryFor(null).publicAction({ schema, handler });

    expect(await action({ name: "Ericky" })).toEqual({ ok: true, data: "ok" });
    expect(handler).toHaveBeenCalledWith(
      { name: "Ericky" },
      { actor: null, headers },
    );
  });

  it("valida a entrada", async () => {
    const handler = vi.fn();
    const action = factoryFor(null).publicAction({ schema, handler });

    expect(await action({})).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
