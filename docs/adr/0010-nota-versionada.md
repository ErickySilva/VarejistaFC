# 0010 — Nota da partida com fórmula versionada

**Status:** aceita. A versão vigente é a `v2`, descrita em [../nota-v2.md](../nota-v2.md).
A `v1` ([../nota-v1.md](../nota-v1.md)) continua no código, sem alteração.

## Decisão

- A nota é calculada pelo sistema, por participação, por uma função pura em
  `src/domain`.
- A fórmula depende da **posição do jogador naquela partida**.
- Cada participação grava a nota e a **versão da fórmula** que a produziu.
- Uma nova versão da fórmula não reescreve notas antigas. Recalcular notas
  passadas é uma ação explícita de `admin`, auditada.
- Editar os dados de uma participação recalcula a nota dela com a versão
  vigente.

## Consequências

- A nota é o único valor calculado que fica gravado por participação. O motivo
  é preservar o histórico quando a fórmula mudar.
- Cada versão tem seus exemplos de referência transformados em testes.
