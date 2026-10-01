# Varejista FC

Aplicação web para registrar e acompanhar as estatísticas do Varejista FC no
EA FC Pro Clubs.

Já funcionam o login, a gestão de contas no servidor e o fluxo de gameplay
(iniciar, registrar partidas, corrigir, encerrar). A área pública e a
identidade visual ainda não foram feitas.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Drizzle ORM ·
Vitest · Docker

## Pré-requisitos

- Node.js 24 (ver `.nvmrc`)
- Docker Desktop, para o PostgreSQL de desenvolvimento

## Como rodar

```bash
npm install
cp .env.example .env   # e preencha BETTER_AUTH_SECRET
npm run db:up      # sobe o PostgreSQL no Docker
npm run db:migrate # aplica as migrações
npm run db:seed    # dados iniciais
npm run auth:create-admin  # primeiro admin
npm run dev        # http://localhost:3000
```

`GET /api/health` responde `200` quando a aplicação alcança o banco e `503`
quando não alcança.

Para rodar também a aplicação dentro do Docker:

```bash
docker compose --profile app up
```

## Scripts

| Script                      | O que faz                                         |
| --------------------------- | ------------------------------------------------- |
| `npm run dev`               | Servidor de desenvolvimento                       |
| `npm run build`             | Build de produção                                 |
| `npm run check`             | Formatação, lint, tipos e testes (o mesmo do CI)  |
| `npm run format`            | Formata o código com Prettier                     |
| `npm run lint`              | ESLint                                            |
| `npm run typecheck`         | Gera os tipos de rota do Next e roda o `tsc`      |
| `npm run test`              | Testes com Vitest                                 |
| `npm run test:integration`  | Regras do banco, contra um PostgreSQL descartável |
| `npm run db:up`             | Sobe o PostgreSQL de desenvolvimento              |
| `npm run db:down`           | Para os containers                                |
| `npm run db:generate`       | Gera migração a partir do schema                  |
| `npm run db:migrate`        | Aplica as migrações                               |
| `npm run db:seed`           | Insere os dados iniciais (idempotente)            |
| `npm run db:studio`         | Abre o Drizzle Studio                             |
| `npm run auth:create-admin` | Cria o primeiro admin (pergunta e-mail e senha)   |

## Estrutura

```
src/
  app/          rotas e páginas (App Router)
  components/   componentes de interface
  domain/       regras puras: posições, nota, prêmios e resumo da noite
  db/           cliente, schema, migrações e seed do PostgreSQL
  server/       autenticação, autorização, auditoria, serviços e Server Actions
  lib/          utilitários (ambiente, datas, validação)
docs/
  adr/          decisões de arquitetura
  nota-v2.md    fórmula da nota vigente (parte da v1)
```

## Documentação

- [Decisões de arquitetura](docs/adr/README.md)
- [Fórmula da nota v2 (vigente)](docs/nota-v2.md) e [v1](docs/nota-v1.md)

## CI

O workflow em `.github/workflows/ci.yml` roda em todo push na `main` e em pull
requests: formatação, lint, tipos, testes, build e build da imagem Docker de
produção.
