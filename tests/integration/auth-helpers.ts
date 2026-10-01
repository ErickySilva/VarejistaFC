import { getAuth } from "@/server/auth/auth";

export const PASSWORD = "senha-de-teste-123";

interface AccountInput {
  email: string;
  name?: string;
  role?: "admin" | "player";
  playerId?: number;
  password?: string;
}

// Cria uma conta pela API do plugin de administração, sem sessão, do mesmo
// jeito que o script do primeiro admin faz.
export async function createAccount(input: AccountInput) {
  const { user } = await getAuth().api.createUser({
    body: {
      email: input.email,
      name: input.name ?? input.email,
      password: input.password ?? PASSWORD,
      role: input.role ?? "player",
      data: input.playerId === undefined ? {} : { playerId: input.playerId },
    },
  });
  return user;
}

// Faz login de verdade e devolve os cabeçalhos com o cookie de sessão, como um
// navegador enviaria na requisição seguinte.
export async function signIn(
  email: string,
  password = PASSWORD,
): Promise<Headers> {
  const { headers } = await getAuth().api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}
