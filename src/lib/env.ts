import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

let cached: Env | undefined;

// Validação preguiçosa: o `next build` importa os módulos sem ter o ambiente
// de execução disponível, então só validamos no primeiro uso real.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
