# 0006 — Auditoria de alterações

**Status:** aceita

## Decisão

Toda criação, edição, exclusão lógica ou reabertura feita em dados de
estatística gera um registro de auditoria com: autor, data, entidade, ação e o
estado antes e depois.

O registro é gravado na **mesma transação** da alteração. Se a auditoria falhar,
a alteração não acontece.

## Implementação

- `recordAudit` (`src/server/audit.ts`) grava o registro na transação aberta
  por `withTransaction` e se recusa a rodar fora de uma.
- O autor é o usuário da sessão lida no servidor (`audit_log.actor_user_id`,
  com chave estrangeira para `users`). Nulo significa ação do sistema.
- As operações do Better Auth entram na mesma transação pelo banco sensível a
  contexto descrito no [ADR 0011](0011-autenticacao-e-autorizacao.md).

## Consequências

- Partidas e jogadores não são removidos fisicamente.
- Registros de auditoria não são editados nem apagados pela aplicação.
- Uma correção em noite finalizada sempre deixa rastro de quem mudou o quê.
