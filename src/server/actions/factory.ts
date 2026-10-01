import "server-only";
import { headers } from "next/headers";
import { requireContext } from "../auth/session";
import { createActionFactory } from "./action";

// Envelope ligado à requisição real do Next. Os testes unitários criam o
// próprio com resolvedores simulados (ver action.test.ts).
export const { protectedAction, publicAction } = createActionFactory({
  requireContext,
  headers: async () => headers(),
});
