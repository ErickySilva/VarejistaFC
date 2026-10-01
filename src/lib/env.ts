import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

const authEnvSchema = z.object({
  // Chave que assina os cookies de sessão. Nunca vai para o repositório.
  BETTER_AUTH_SECRET: z.string().min(32),
  // Endereço público da aplicação, ex.: http://localhost:3000
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
});

export type Env = z.infer<typeof envSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;

type EnvSource = Record<string, string | undefined>;

function parse<T>(schema: z.ZodType<T>, source: EnvSource): T {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente inválidas:\n${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

export function parseEnv(source: EnvSource): Env {
  return parse(envSchema, source);
}

export function parseAuthEnv(source: EnvSource): AuthEnv {
  return parse(authEnvSchema, source);
}

let cached: Env | undefined;
let cachedAuth: AuthEnv | undefined;

// Validação preguiçosa: o `next build` importa os módulos sem ter o ambiente
// de execução disponível, então só validamos no primeiro uso real.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

// Separado de getEnv para que scripts que só usam o banco (migrations, seed)
// não exijam as variáveis de autenticação.
export function getAuthEnv(): AuthEnv {
  cachedAuth ??= parseAuthEnv(process.env);
  return cachedAuth;
}
