# Nota da partida — fórmula v2

**Status:** aprovada em 2026-10-01. É a versão vigente. Implementada em
`src/domain/rating/v2.ts`, com testes em `src/domain/rating/v2.test.ts`.

A v2 é a [v1](nota-v1.md) sem nenhuma alteração, mais uma parcela nova para o
goleiro. Tudo o que está descrito na v1 continua valendo: base 6,0, resultado,
parcelas por grupo de posição, defesas, gols sofridos, limites de 3,0 e 10,0 e
arredondamento.

## O que muda

| Parcela (goleiro) | Valor                      |
| ----------------- | -------------------------- |
| Pênalti defendido | +0,5 por pênalti defendido |

- Vale para pênaltis defendidos **durante a partida**. Defesas na disputa de
  pênaltis não entram.
- O pênalti defendido **já está contado no total de defesas** e recebe ali o
  valor normal de uma defesa. O bônus de 0,5 soma por fora; a defesa não é
  contada duas vezes.
- Não há teto próprio para o bônus. O limite final de 10,0 continua valendo.
- Jogadores de linha não têm essa parcela.

## Garantia de compatibilidade

Sem pênalti defendido, a v2 dá exatamente o mesmo resultado da v1. Os testes
conferem isso com os 18 exemplos do documento da v1 e com mais de 5 mil
combinações de posição, placar, gols, assistências e defesas.

## Exemplos

Placar na ordem Varejista × adversário.

| Situação                                        | v1  | v2       |
| ----------------------------------------------- | --- | -------- |
| 1 × 1, 4 defesas, nenhuma de pênalti (G3 da v1) | 6,7 | **6,7**  |
| 1 × 1, 4 defesas, 1 de pênalti                  | 6,7 | **7,2**  |
| 1 × 1, 4 defesas, 2 de pênalti                  | 6,7 | **7,7**  |
| 2 × 0, 6 defesas, 3 de pênalti (soma 10,5)      | 9,0 | **10,0** |
| 0 × 10, 2 defesas, as 2 de pênalti              | 3,5 | **4,5**  |

## Versões

A v1 continua no código, sem alteração, e pode ser usada para recalcular notas
gravadas com ela. Nenhuma nota havia sido gravada antes da v2 entrar em vigor,
então todas as notas do sistema começam na v2. Uma mudança futura de pesos ou
de regras entra como v3 (ver [ADR 0010](adr/0010-nota-versionada.md)).
