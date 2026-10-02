import { describe, expect, it } from "vitest";
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
} from "./code";

describe("código de convite", () => {
  it("o alfabeto tem 32 símbolos distintos, sem os que se confundem", () => {
    expect(new Set(INVITE_CODE_ALPHABET).size).toBe(32);
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[01IO]/);
  });

  it("carrega pelo menos 100 bits de entropia", () => {
    const bits = INVITE_CODE_LENGTH * Math.log2(INVITE_CODE_ALPHABET.length);
    expect(bits).toBeGreaterThanOrEqual(100);
  });

  // Teste de sanidade do gerador. Não repetir em alguns milhares de sorteios
  // não prova segurança: ela vem da entropia acima e da unicidade do hash no
  // banco. Aqui só se detecta um gerador quebrado (constante, curto, viciado).
  it("sanidade: milhares de códigos no formato certo, usando todo o alfabeto", () => {
    const codes = Array.from({ length: 5000 }, generateInviteCode);

    for (const code of codes) {
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(normalizeInviteCode(code)).toBe(code);
    }
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(codes.join("")).size).toBe(INVITE_CODE_ALPHABET.length);
  });

  it("é mostrado em grupos de cinco", () => {
    expect(formatInviteCode("ABCDEFGHJKLMNPQRSTUV")).toBe(
      "ABCDE-FGHJK-LMNPQ-RSTUV",
    );
  });

  it("aceita minúsculas, espaços e hífens de quem digitou ou colou", () => {
    expect(normalizeInviteCode("  abcde-fghjk lmnpq-rstuv\n")).toBe(
      "ABCDEFGHJKLMNPQRSTUV",
    );
    const code = generateInviteCode();
    expect(normalizeInviteCode(formatInviteCode(code))).toBe(code);
  });

  it("recusa o que não tem o formato de um convite", () => {
    for (const input of [
      "",
      "ABCDE",
      "ABCDEFGHJKLMNPQRSTUVW",
      "ABCDEFGHJKLMNPQRSTU0",
      "ABCDEFGHJKLMNPQRSTUO",
      "ABCDEFGHJKLMNPQRSTU'",
    ]) {
      expect(normalizeInviteCode(input), input).toBeNull();
    }
  });

  it("o hash é SHA-256 em hexadecimal, estável e diferente do código", () => {
    const code = "ABCDEFGHJKLMNPQRSTUV";
    const hash = hashInviteCode(code);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashInviteCode(code));
    expect(hash).not.toContain(code.toLowerCase());
    expect(hashInviteCode("ABCDEFGHJKLMNPQRSTUW")).not.toBe(hash);
  });
});
