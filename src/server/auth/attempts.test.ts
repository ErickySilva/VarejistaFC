import { beforeEach, describe, expect, it } from "vitest";
import {
  attemptKey,
  clearFailures,
  isBlocked,
  MAX_FAILED_ATTEMPTS,
  recordFailure,
  resetAttempts,
} from "./attempts";

const MINUTE = 60 * 1000;
const NOW = 1_000_000_000;

function fail(key: string, times: number, at = NOW) {
  for (let index = 0; index < times; index++) recordFailure(key, at);
}

beforeEach(() => {
  resetAttempts();
});

describe("limite de tentativas de login", () => {
  it("bloqueia depois do número máximo de senhas erradas", () => {
    fail("ip|ericky", MAX_FAILED_ATTEMPTS - 1);
    expect(isBlocked("ip|ericky", NOW)).toBe(false);

    recordFailure("ip|ericky", NOW);
    expect(isBlocked("ip|ericky", NOW)).toBe(true);
  });

  it("o bloqueio vale por 15 minutos a partir das tentativas", () => {
    fail("ip|ericky", MAX_FAILED_ATTEMPTS);

    expect(isBlocked("ip|ericky", NOW + 14 * MINUTE)).toBe(true);
    expect(isBlocked("ip|ericky", NOW + 15 * MINUTE)).toBe(false);
  });

  it("tentativas antigas saem da conta", () => {
    fail("ip|ericky", MAX_FAILED_ATTEMPTS - 1, NOW);
    // 20 minutos depois, as anteriores já não contam.
    recordFailure("ip|ericky", NOW + 20 * MINUTE);
    expect(isBlocked("ip|ericky", NOW + 20 * MINUTE)).toBe(false);
  });

  it("login certo zera a contagem", () => {
    fail("ip|ericky", MAX_FAILED_ATTEMPTS - 1);
    clearFailures("ip|ericky");
    recordFailure("ip|ericky", NOW);
    expect(isBlocked("ip|ericky", NOW)).toBe(false);
  });

  it("é por origem e por conta: não trava outra conta nem outra origem", () => {
    fail("1.1.1.1|ericky", MAX_FAILED_ATTEMPTS);

    expect(isBlocked("1.1.1.1|lucao", NOW)).toBe(false);
    expect(isBlocked("2.2.2.2|ericky", NOW)).toBe(false);
  });
});

describe("chave da tentativa", () => {
  it("usa o primeiro endereço de x-forwarded-for e ignora maiúsculas na conta", () => {
    const headers = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(attemptKey(headers, "Ericky")).toBe("9.9.9.9|ericky");
  });

  it("sem cabeçalho de origem, usa uma chave local", () => {
    expect(attemptKey(new Headers(), "ericky")).toBe("local|ericky");
  });
});
