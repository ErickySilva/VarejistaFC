import { describe, expect, it } from "vitest";
import { parseAuthEnv, parseEnv } from "./env";

describe("parseEnv", () => {
  it("aceita uma URL de Postgres válida", () => {
    const url = "postgres://varejista:varejista@localhost:5432/varejista";
    expect(parseEnv({ DATABASE_URL: url })).toEqual({ DATABASE_URL: url });
  });

  it("rejeita DATABASE_URL ausente", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejeita URL que não é de Postgres", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://localhost/x" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("não exige as variáveis de autenticação", () => {
    const url = "postgres://localhost/varejista";
    expect(() => parseEnv({ DATABASE_URL: url })).not.toThrow();
  });
});

describe("parseAuthEnv", () => {
  const valid = {
    BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
    BETTER_AUTH_URL: "http://localhost:3000",
  };

  it("aceita segredo de 32 caracteres e URL http(s)", () => {
    expect(parseAuthEnv(valid)).toEqual(valid);
  });

  it("rejeita segredo ausente ou curto", () => {
    expect(() => parseAuthEnv({ ...valid, BETTER_AUTH_SECRET: "" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() =>
      parseAuthEnv({ ...valid, BETTER_AUTH_SECRET: "curto" }),
    ).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      parseAuthEnv({ BETTER_AUTH_URL: valid.BETTER_AUTH_URL }),
    ).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("rejeita URL ausente ou que não é http(s)", () => {
    expect(() =>
      parseAuthEnv({ BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET }),
    ).toThrow(/BETTER_AUTH_URL/);
    expect(() =>
      parseAuthEnv({ ...valid, BETTER_AUTH_URL: "ftp://exemplo.com" }),
    ).toThrow(/BETTER_AUTH_URL/);
  });
});
