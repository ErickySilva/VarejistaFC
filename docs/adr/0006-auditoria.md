# 0006 — Auditoria de alterações

**Status:** aceita

## Decisão

Toda criação, edição, exclusão lógica ou reabertura feita em dados de
estatística gera um registro de auditoria com: autor, data, entidade, ação e o
estado antes e depois.

O registro é gravado na **mesma transação** da alteração. Se a auditoria falhar,
a alteração não acontece.

## Consequências

- Partidas e jogadores não são removidos fisicamente.
- Registros de auditoria não são editados nem apagados pela aplicação.
- Uma correção em noite finalizada sempre deixa rastro de quem mudou o quê.
