# 0001 — Monólito Next.js em três camadas

**Status:** aceita

## Contexto

O sistema atende um time pequeno, com uma área pública, uma área do jogador e uma
área administrativa. Não há necessidade de serviços separados.

## Decisão

Uma única aplicação Next.js (App Router, TypeScript estrito), dividida em camadas:

- `src/domain`: regras puras (nota, prêmios, agregações). Sem banco, sem
  framework, coberta por testes unitários.
- `src/db`: schema, migrações e views do PostgreSQL.
- `src/server`: consultas, Server Actions e autorização. É a única camada que
  conversa com o banco.
- `src/app` e `src/components`: rotas e interface. Leitura com Server
  Components, escrita com Server Actions, validação com Zod na entrada.

## Consequências

- Regra de estatística nunca é escrita dentro de componente ou de rota.
- `src/domain` não importa nada de `src/db`, `src/server` ou do Next.js.
- A infraestrutura de produção (VM, proxy, HTTPS, CD) será decidida em ADR
  próprio. O que já existe é apenas a imagem Docker de produção, validada no CI.
