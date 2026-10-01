# Varejista FC

Aplicação web para registrar e acompanhar as estatísticas do Varejista FC no
EA FC Pro Clubs.

O projeto está na fundação: estrutura, ferramentas, Docker e CI. As
funcionalidades de negócio ainda não foram implementadas.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL · Drizzle ORM ·
Vitest · Docker

## Pré-requisitos

- Node.js 24 (ver `.nvmrc`)
- Docker Desktop, para o PostgreSQL de desenvolvimento

## Como rodar

```bash
npm install
cp .env.example .env
npm run db:up      # sobe o PostgreSQL no Docker
npm run dev        # http://localhost:3000
```

`GET /api/health` responde `200` quando a aplicação alcança o banco e `503`
quando não alcança.

Para rodar também a aplicação dentro do Docker:

```bash
docker compose --profile app up
```

## Scripts

| Script                | O que faz                                        |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Servidor de desenvolvimento                      |
| `npm run build`       | Build de produção                                |
| `npm run check`       | Formatação, lint, tipos e testes (o mesmo do CI) |
| `npm run format`      | Formata o código com Prettier                    |
| `npm run lint`        | ESLint                                           |
| `npm run typecheck`   | Gera os tipos de rota do Next e roda o `tsc`     |
| `npm run test`        | Testes com Vitest                                |
| `npm run db:up`       | Sobe o PostgreSQL de desenvolvimento             |
| `npm run db:down`     | Para os containers                               |
| `npm run db:generate` | Gera migração a partir do schema                 |
| `npm run db:migrate`  | Aplica as migrações                              |
| `npm run db:studio`   | Abre o Drizzle Studio                            |

## Estrutura

```
src/
  app/          rotas e páginas (App Router)
  components/   componentes de interface
  domain/       regras puras: nota, prêmios, agregações
  db/           cliente, schema e migrações do PostgreSQL
  server/       consultas, Server Actions e autorização
  lib/          utilitários (ambiente, datas, validação)
docs/
  adr/          decisões de arquitetura
  nota-v1.md    proposta da fórmula da nota
```

## Documentação

- [Decisões de arquitetura](docs/adr/README.md)
- [Fórmula da nota v1 (proposta)](docs/nota-v1.md)

## CI

O workflow em `.github/workflows/ci.yml` roda em todo push na `main` e em pull
requests: formatação, lint, tipos, testes, build e build da imagem Docker de
produção.
