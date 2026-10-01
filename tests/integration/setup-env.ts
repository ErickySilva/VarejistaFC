import { getTestDatabaseUrl } from "./test-database";

// O código da aplicação lê estas variáveis. Elas apontam para o banco de
// teste, nunca para o de desenvolvimento.
process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.BETTER_AUTH_SECRET =
  "segredo-apenas-para-testes-de-integracao-0123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
