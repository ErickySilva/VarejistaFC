import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

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
});
