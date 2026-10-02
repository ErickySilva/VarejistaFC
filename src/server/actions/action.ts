import type { z } from "zod";
import type { Permission } from "../auth/policy";
import { can } from "../auth/policy";
import type { RequestContext } from "../auth/session";
import { ServiceError, toServiceError, type ServiceErrorCode } from "../errors";

// Envelope comum das Server Actions (ADR 0011). Toda action passa por aqui,
// nesta ordem:
//   1. resolve quem está chamando, a partir da sessão lida no servidor;
//   2. confere a permissão;
//   3. valida a entrada com Zod;
//   4. executa e converte o resultado em um valor serializável.
// A entrada só é validada depois da permissão, para que um visitante sem
// acesso não receba detalhes de validação.

export type ActionErrorCode = ServiceErrorCode | "INTERNAL";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: ActionErrorCode;
        message: string;
        fieldErrors?: Record<string, string[]>;
      };
    };

// Contexto de quem não precisa estar logado (ex.: a action de login).
export interface PublicContext {
  actor: null;
  headers: Headers;
}

export interface ActionResolvers {
  // Lança ServiceError("UNAUTHENTICATED") quando não há sessão válida.
  requireContext: () => Promise<RequestContext>;
  headers: () => Promise<Headers>;
}

type Access<TInput> = "public" | Permission | ((input: TInput) => Permission);

interface ActionDefinition<TSchema extends z.ZodType, TResult, TContext> {
  schema: TSchema;
  handler: (input: z.output<TSchema>, context: TContext) => Promise<TResult>;
}

function failure<T>(
  code: ActionErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return { ok: false, error: { code, message, fieldErrors } };
}

function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_";
    (fieldErrors[field] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function createActionFactory(resolvers: ActionResolvers) {
  function handleError<T>(error: unknown): ActionResult<T> {
    const known = toServiceError(error);
    if (known instanceof ServiceError) {
      return failure(known.code, known.message);
    }
    // O detalhe fica no log do servidor; o cliente recebe só a mensagem geral.
    console.error("Falha inesperada em Server Action:", error);
    return failure("INTERNAL", "Algo deu errado. Tente novamente.");
  }

  // Action que exige login e uma permissão. A permissão pode depender da
  // entrada (ex.: editar a foto de um jogador específico); nesse caso ela é
  // calculada depois da validação e conferida antes do handler.
  function protectedAction<TSchema extends z.ZodType, TResult>(
    access: Exclude<Access<z.output<TSchema>>, "public">,
    definition: ActionDefinition<TSchema, TResult, RequestContext>,
  ) {
    return async (rawInput: unknown): Promise<ActionResult<TResult>> => {
      try {
        const context = await resolvers.requireContext();

        if (typeof access !== "function" && !can(context.actor, access)) {
          return failure("FORBIDDEN", new ServiceError("FORBIDDEN").message);
        }

        const parsed = definition.schema.safeParse(rawInput);
        if (!parsed.success) {
          return failure(
            "INVALID_INPUT",
            new ServiceError("INVALID_INPUT").message,
            fieldErrorsOf(parsed.error),
          );
        }

        if (
          typeof access === "function" &&
          !can(context.actor, access(parsed.data))
        ) {
          return failure("FORBIDDEN", new ServiceError("FORBIDDEN").message);
        }

        return {
          ok: true,
          data: await definition.handler(parsed.data, context),
        };
      } catch (error) {
        return handleError(error);
      }
    };
  }

  // Action aberta a visitantes. Só o login e o cadastro por convite precisam
  // disso.
  function publicAction<TSchema extends z.ZodType, TResult>(
    definition: ActionDefinition<TSchema, TResult, PublicContext>,
  ) {
    return async (rawInput: unknown): Promise<ActionResult<TResult>> => {
      try {
        const parsed = definition.schema.safeParse(rawInput);
        if (!parsed.success) {
          return failure(
            "INVALID_INPUT",
            new ServiceError("INVALID_INPUT").message,
            fieldErrorsOf(parsed.error),
          );
        }

        const headers = await resolvers.headers();
        return {
          ok: true,
          data: await definition.handler(parsed.data, { actor: null, headers }),
        };
      } catch (error) {
        return handleError(error);
      }
    };
  }

  return { protectedAction, publicAction };
}
