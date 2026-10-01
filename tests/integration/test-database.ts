// Os testes de integração apagam dados. Por isso usam uma variável própria,
// nunca a DATABASE_URL, e só aceitam um banco cujo nome termine em "_test".
export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Defina TEST_DATABASE_URL apontando para um PostgreSQL descartável.",
    );
  }

  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL aponta para "${databaseName}". O nome do banco de teste precisa terminar em "_test".`,
    );
  }

  return url;
}
