# Varejista FC

Aplicação web para registrar e acompanhar as estatísticas do Varejista FC no
EA FC Pro Clubs.

Já funcionam o login, a gestão de contas no servidor, o fluxo de gameplay e as
telas públicas de estatística. A identidade visual, derivada do escudo do
clube, está descrita em [docs/design-system.md](docs/design-system.md).

| Rota                      | O que mostra                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| `/`                       | Home: gameplay em andamento, ranking, últimos resultados, destaques |
| `/ranking`                | Ranking do Varejista, por aba e por período                         |
| `/jogadores/[slug]`       | Perfil do jogador: números, conquistas, histórico e evolução        |
| `/partidas`               | Histórico de partidas                                               |
| `/partidas/[id]`          | Página permanente de uma partida                                    |
| `/gameplay`               | Operação da gameplay (só admin)                                     |
| `/entrar`                 | Entrada do clube: jogadores (tile e senha), admin e visitante       |
| `/admin`, `/admin/contas` | Administração e gestão de contas (só admin)                         |
| `/login`, `/conta`        | Entrada com e-mail (alternativa) e conta                            |

As telas de estatística são abertas a visitantes, somente leitura.

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

## Produção

A stack de produção é `Nginx -> Next.js -> PostgreSQL`, com Docker Compose, em
`compose.production.yaml` (separado do `compose.yaml` de desenvolvimento). O
passo a passo de subida, migrações, seed, primeiro admin, backup, atualização
e rollback está em [docs/deploy-production.md](docs/deploy-production.md).

O arquivo de variáveis de produção (`.env.production`) nunca é versionado; o
modelo é o `.env.production.example`.

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
- [Deploy de produção](docs/deploy-production.md)
- [Identidade visual e design system](docs/design-system.md)
- [Fórmula da nota v2 (vigente)](docs/nota-v2.md) e [v1](docs/nota-v1.md)

## CI

O workflow em `.github/workflows/ci.yml` roda em todo push na `main` e em pull
requests: formatação, lint, tipos, testes, build, build da imagem Docker de
produção e validação da stack de produção (Compose, Nginx, scripts de backup
e imagem de operação). O CI só valida: não publica nem implanta nada.

## Fotos dos jogadores

Este repositório é público por decisão do projeto. As fotos reais dos
jogadores, em `public/players/`, estão versionadas aqui por decisão consciente
do projeto. Nenhum segredo, credencial ou dado de conta é
versionado.
