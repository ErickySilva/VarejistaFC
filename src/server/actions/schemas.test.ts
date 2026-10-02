import { describe, expect, it } from "vitest";
import {
  checkInviteSchema,
  generateInviteSchema,
  registerWithInviteSchema,
} from "./schemas";

const valid = {
  code: "ABCDE-FGHJK-LMNPQ-RSTUV",
  email: "heit@test.dev",
  password: "senha-do-jogador-456",
  passwordConfirmation: "senha-do-jogador-456",
};

describe("entrada do cadastro por convite", () => {
  it("aceita só código, e-mail, senha e confirmação", () => {
    expect(registerWithInviteSchema.safeParse(valid).success).toBe(true);
    expect(Object.keys(registerWithInviteSchema.parse(valid)).sort()).toEqual([
      "code",
      "email",
      "password",
      "passwordConfirmation",
    ]);
  });

  // O jogador e o papel vêm do convite gravado no banco. Um campo a mais não é
  // ignorado em silêncio: a requisição inteira é recusada.
  it("recusa qualquer campo a mais, como playerId e role", () => {
    for (const extra of [
      { role: "admin" },
      { playerId: 1 },
      { name: "Outro" },
      { banned: false },
      { data: { role: "admin" } },
    ]) {
      expect(
        registerWithInviteSchema.safeParse({ ...valid, ...extra }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
  });

  it("exige senha de 8 a 128 caracteres e confirmação igual", () => {
    const parse = (password: string, passwordConfirmation = password) =>
      registerWithInviteSchema.safeParse({
        ...valid,
        password,
        passwordConfirmation,
      });

    expect(parse("1234567").success).toBe(false);
    expect(parse("12345678").success).toBe(true);
    expect(parse("x".repeat(128)).success).toBe(true);
    expect(parse("x".repeat(129)).success).toBe(false);

    const mismatch = parse("senha-do-jogador-456", "senha-do-jogador-457");
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0]).toMatchObject({
      path: ["passwordConfirmation"],
      message: "As senhas não são iguais.",
    });
  });

  it("normaliza o e-mail e recusa e-mail inválido", () => {
    expect(
      registerWithInviteSchema.parse({ ...valid, email: "Heit@Test.DEV" })
        .email,
    ).toBe("heit@test.dev");
    expect(
      registerWithInviteSchema.safeParse({ ...valid, email: "sem-arroba" })
        .success,
    ).toBe(false);
  });

  it("o código é texto curto e obrigatório", () => {
    expect(checkInviteSchema.safeParse({ code: "" }).success).toBe(false);
    expect(checkInviteSchema.safeParse({ code: "x".repeat(65) }).success).toBe(
      false,
    );
    expect(checkInviteSchema.safeParse({ code: 123 }).success).toBe(false);
    expect(
      checkInviteSchema.safeParse({ code: valid.code, playerId: 1 }).success,
    ).toBe(false);
  });
});

describe("entrada da geração de convite", () => {
  it("aceita jogador e papel conhecidos, e mais nada", () => {
    expect(
      generateInviteSchema.safeParse({ playerId: 3, role: "admin" }).success,
    ).toBe(true);
    for (const input of [
      { playerId: 3, role: "owner" },
      { playerId: 0, role: "player" },
      { playerId: "3", role: "player" },
      { playerId: 3 },
      { playerId: 3, role: "player", code: "ESCOLHIDO" },
      { playerId: 3, role: "player", expiresAt: "2099-01-01" },
    ]) {
      expect(
        generateInviteSchema.safeParse(input).success,
        JSON.stringify(input),
      ).toBe(false);
    }
  });
});
