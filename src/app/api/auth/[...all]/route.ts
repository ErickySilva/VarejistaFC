import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth";

// Rotas HTTP do Better Auth. As de administração e de cadastro estão
// desabilitadas na configuração (ver src/server/auth/auth.ts).
export const { GET, POST } = toNextJsHandler((request: Request) =>
  getAuth().handler(request),
);
