import { createHash, randomBytes } from "node:crypto";

// Código de convite (ADR 0015).
//
// 20 símbolos de um alfabeto de 32, sorteados pelo gerador criptográfico do
// sistema: 100 bits de entropia. É isso, e não a ausência de colisões, que
// torna o código impossível de adivinhar. A unicidade é garantida pelo banco,
// no hash.
//
// O alfabeto não tem 0, 1, I nem O, que se confundem ao digitar.
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_CODE_LENGTH = 20;
const GROUP_SIZE = 5;

const VALID_CODE = new RegExp(
  `^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`,
);

// Código novo, sem separadores. 256 é múltiplo de 32, então aproveitar os 5
// bits baixos de cada byte não favorece nenhum símbolo.
export function generateInviteCode(): string {
  let code = "";
  for (const byte of randomBytes(INVITE_CODE_LENGTH)) {
    code += INVITE_CODE_ALPHABET[byte & 31];
  }
  return code;
}

// Como o código é mostrado e copiado: grupos de 5 separados por hífen.
export function formatInviteCode(code: string): string {
  return code.match(new RegExp(`.{1,${GROUP_SIZE}}`, "g"))?.join("-") ?? code;
}

// Aceita o que a pessoa digitou ou colou (minúsculas, espaços, hífens) e
// devolve o código canônico, ou null se não tem o formato de um convite.
export function normalizeInviteCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  return VALID_CODE.test(code) ? code : null;
}

// O que vai para o banco. SHA-256 simples basta porque o código tem entropia
// alta: não é uma senha escolhida por alguém.
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
