import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "../src/server/auth/constants";
import { createFirstAdmin } from "../src/server/users/first-admin";

// Cria o primeiro admin. Uso: npm run auth:create-admin
//
// E-mail, nome e senha são perguntados na hora. Nada é lido de arquivo de
// configuração nem gravado em disco, e a senha não aparece enquanto é digitada.

const inputSchema = z.object({
  email: z.email("E-mail inválido.").trim().toLowerCase(),
  name: z.string().trim().min(1, "Informe o nome."),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    ),
  playerSlug: z
    .string()
    .trim()
    .transform((value) => value || null),
});

// Lê as respostas em sequência. Enquanto `muted` está ligado, o que é
// digitado não é ecoado no terminal.
function createPrompt() {
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const readline = createInterface({
    input: process.stdin,
    output,
    terminal: process.stdin.isTTY === true,
  });
  const lines = readline[Symbol.asyncIterator]();

  async function ask(question: string, hidden = false): Promise<string> {
    process.stdout.write(question);
    muted = hidden;
    const { value, done } = await lines.next();
    muted = false;
    if (hidden) process.stdout.write("\n");
    if (done) throw new Error("Entrada encerrada antes do fim das perguntas.");
    return value;
  }

  return { ask, close: () => readline.close() };
}

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const prompt = createPrompt();
  let answers;
  try {
    answers = {
      email: await prompt.ask("E-mail do admin: "),
      name: await prompt.ask("Nome: "),
      password: await prompt.ask("Senha: ", true),
      playerSlug: await prompt.ask(
        "Slug do jogador a vincular (ex.: ericky; vazio para nenhum): ",
      ),
    };
  } finally {
    prompt.close();
  }

  const parsed = inputSchema.safeParse(answers);
  if (!parsed.success) {
    console.error(z.prettifyError(parsed.error));
    process.exitCode = 1;
    return;
  }

  const result = await createFirstAdmin(parsed.data);
  if (result.created) {
    console.log(`Admin criado: ${parsed.data.email}`);
  } else {
    console.log(
      "Já existe um admin ativo. Nada foi alterado; novas contas são criadas por um admin logado.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  // O pool de conexões manteria o processo aberto.
  .finally(() => process.exit());
