# 0009 — PostgreSQL com Drizzle ORM

**Status:** aceita

## Contexto

As regras que protegem as estatísticas precisam valer mesmo que a aplicação
tenha um bug: `CHECK`, chaves compostas, índices únicos parciais, colunas
geradas e views.

## Decisão

- PostgreSQL como banco único.
- Drizzle ORM e drizzle-kit: schema em TypeScript, migrações SQL versionadas no
  repositório em `src/db/migrations`.
- Invariantes ficam no banco sempre que o banco consegue expressá-las. A
  validação com Zod é a primeira barreira, não a única.
- Migrações rodam como passo explícito (`npm run db:migrate`), nunca na
  inicialização da aplicação.

## Consequências

- Views e SQL que o drizzle-kit não gera sozinho entram como migrações escritas
  à mão e revisadas.
- Testes de regras que dependem do banco rodam contra um PostgreSQL real.
