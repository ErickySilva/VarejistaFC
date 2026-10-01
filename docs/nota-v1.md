# Nota da partida — fórmula v1

**Status:** aprovada em 2026-10-01 como versão `v1`. Implementada em
`src/domain/rating/v1.ts`; os exemplos deste documento são testes em
`src/domain/rating/v1.test.ts`.

A versão vigente hoje é a [v2](nota-v2.md), que mantém tudo o que está aqui e
acrescenta o bônus por pênalti defendido.

Esta versão não é definitiva. Mudanças de pesos ou de regras entram como uma
nova versão (`v2`, em arquivo próprio), e as notas já gravadas com a `v1` não
são alteradas em silêncio (ver [ADR 0010](adr/0010-nota-versionada.md)).

A nota vai de **3,0 a 10,0**, com uma casa decimal. Todo jogador começa em 6,0 e
ganha ou perde pontos conforme a posição que ocupou **naquela partida**.

## Entradas

Por participação: posição, gols, assistências e, para goleiro, defesas.
Da partida: gols do Varejista (GP) e gols do adversário (GC).

Tudo considera a partida inteira. O sistema não registra minutos jogados.

- **Disputa de pênaltis:** o resultado usado é o da partida já decidida. Empate
  com vitória nos pênaltis conta como vitória; com derrota, como derrota. Os
  gols das cobranças não são gols da partida e não entram em GP nem em GC.
- **Pênaltis defendidos** (`penalties_saved`) não entram na nota v1. Eles já
  estão contados dentro das defesas. Passam a valer um bônus na v2.

## Grupos de posição

| Grupo | Posições             | Descrição                                           |
| ----- | -------------------- | --------------------------------------------------- |
| GOL   | GOL                  | goleiro                                             |
| DEF   | ZAG, LD, LE          | zagueiro e laterais                                 |
| MEI   | VOL, MC, MD, ME, MEI | volante, meia central, meias abertos, meia ofensivo |
| ATA   | PD, PE, SA, ATA      | pontas, segundo atacante, centroavante              |

As posições MD e ME foram incluídas no grupo MEI em 2026-10-01, depois da
aprovação da fórmula; os pesos não mudaram.

## Parcelas comuns a todos

| Parcela   | Valor                                  |
| --------- | -------------------------------------- |
| Base      | 6,0                                    |
| Resultado | vitória +0,5 · empate 0 · derrota −0,5 |

## Jogadores de linha

| Parcela                               | ATA  | MEI  | DEF             |
| ------------------------------------- | ---- | ---- | --------------- |
| Gol (1º e 2º)                         | +1,0 | +1,1 | +1,3            |
| Assistência (1ª e 2ª)                 | +0,7 | +0,8 | +0,9            |
| Partida sem gol nem assistência       | −0,4 | −0,2 | 0               |
| Clean sheet do time (GC = 0)          | 0    | +0,2 | +0,8            |
| Gol sofrido pelo time, a partir do 2º | 0    | 0    | −0,2 (máx −1,0) |

- **Rendimento decrescente:** do 3º gol em diante, cada gol vale metade. O mesmo
  para assistências a partir da 3ª. Evita que uma goleada estoure a escala.
- **Participação nos gols do time:** `+0,5 × (gols + assistências) ÷ GP`, quando
  GP > 0. Quem participou de todos os gols do time ganha +0,5.

O contexto de posição aparece em três pontos: gol de defensor vale mais que gol
de atacante; atacante que passa em branco perde mais que meia; e só defensores
(e um pouco os meias) respondem pelos gols sofridos.

## Goleiro

| Parcela           | Valor                                                 |
| ----------------- | ----------------------------------------------------- |
| Defesas           | +0,25 cada até a 8ª; +0,10 cada depois; máximo +3,0   |
| Gols sofridos     | `−0,5 × GC × (1 − 0,5 × taxa de defesa)`; máximo −2,5 |
| Clean sheet       | +1,0                                                  |
| Gol / assistência | +1,0 / +0,7                                           |

`taxa de defesa = defesas ÷ (defesas + GC)`; vale 0 quando não houve chute.

As parcelas de jogador de linha não se aplicam ao goleiro: gol e assistência
dele têm valor fixo (sem rendimento decrescente), e ele não recebe o bônus de
participação nem a penalidade por passar em branco.

A taxa de defesa é o que protege o goleiro bombardeado: quanto mais ele
defendeu, menos cada gol sofrido pesa (até a metade). Com as defesas somando por
fora, um goleiro que sofre 4 gols com 10 defesas termina acima de 6,0, enquanto
o que sofre os mesmos 4 gols com 1 defesa termina em 4,0.

## Fechamento

1. Soma todas as parcelas.
2. Limita ao intervalo de 3,0 a 10,0.
3. Arredonda para uma casa decimal (meio para cima).

A implementação faz a conta inteira em milésimos, com números inteiros, e só
divide no arredondamento final. Assim um valor como 3,95 vira 4,0 de forma
exata, sem depender de ponto flutuante.

Com os pesos atuais, o pior caso possível é o do goleiro (derrota, nenhuma
defesa, penalidade máxima de gols sofridos), que soma exatamente 3,0. O piso é
uma proteção: nenhuma combinação da v1 chega a ficar abaixo dele.

## Exemplos hipotéticos

Placar sempre na ordem Varejista × adversário. "Soma" é o valor antes do limite
e do arredondamento.

### Linha

| #   | Grupo | Placar | G / A | Parcelas além da base                                    | Soma   | Nota     |
| --- | ----- | ------ | ----- | -------------------------------------------------------- | ------ | -------- |
| L1  | ATA   | 4 × 1  | 2 / 1 | gols +2,0 · assist +0,7 · particip +0,375 · vitória +0,5 | 9,575  | **9,6**  |
| L2  | ATA   | 0 × 2  | 0 / 0 | em branco −0,4 · derrota −0,5                            | 5,1    | **5,1**  |
| L3  | ATA   | 3 × 0  | 0 / 0 | em branco −0,4 · vitória +0,5                            | 6,1    | **6,1**  |
| L4  | ATA   | 2 × 3  | 2 / 0 | gols +2,0 · particip +0,5 · derrota −0,5                 | 8,0    | **8,0**  |
| L5  | ATA   | 6 × 0  | 4 / 1 | gols +3,0 · assist +0,7 · particip +0,417 · vitória +0,5 | 10,617 | **10,0** |
| L6  | MEI   | 3 × 1  | 1 / 0 | gol +1,1 · particip +0,167 · vitória +0,5                | 7,767  | **7,8**  |
| L7  | MEI   | 2 × 2  | 0 / 2 | assist +1,6 · particip +0,5                              | 8,1    | **8,1**  |
| L8  | MEI   | 5 × 2  | 3 / 2 | gols +2,75 · assist +1,6 · particip +0,5 · vitória +0,5  | 11,35  | **10,0** |
| L9  | DEF   | 1 × 0  | 0 / 0 | clean sheet +0,8 · vitória +0,5                          | 7,3    | **7,3**  |
| L10 | DEF   | 1 × 4  | 0 / 0 | gols sofridos −0,6 · derrota −0,5                        | 4,9    | **4,9**  |

### Goleiro

| #   | Placar | Defesas | Taxa  | Parcelas além da base                              | Soma  | Nota    |
| --- | ------ | ------- | ----- | -------------------------------------------------- | ----- | ------- |
| G1  | 2 × 0  | 6       | 1,000 | defesas +1,5 · clean sheet +1,0 · vitória +0,5     | 9,0   | **9,0** |
| G2  | 1 × 0  | 0       | —     | clean sheet +1,0 · vitória +0,5                    | 7,5   | **7,5** |
| G3  | 1 × 1  | 4       | 0,800 | defesas +1,0 · sofridos −0,3                       | 6,7   | **6,7** |
| G4  | 2 × 4  | 10      | 0,714 | defesas +2,2 · sofridos −1,286 · derrota −0,5      | 6,414 | **6,4** |
| G5  | 0 × 4  | 1       | 0,200 | defesas +0,25 · sofridos −1,8 · derrota −0,5       | 3,95  | **4,0** |
| G6  | 5 × 3  | 2       | 0,400 | defesas +0,5 · sofridos −1,2 · vitória +0,5        | 5,8   | **5,8** |
| G7  | 0 × 7  | 12      | 0,632 | defesas +2,4 · sofridos −2,395 · derrota −0,5      | 5,505 | **5,5** |
| G8  | 0 × 7  | 2       | 0,222 | defesas +0,5 · sofridos −2,5 (teto) · derrota −0,5 | 3,5   | **3,5** |

Os pares que mostram o comportamento pedido para o goleiro:

- **G4 × G5:** mesmos 4 gols sofridos em derrota. Com 10 defesas, 6,4; com 1
  defesa, 4,0.
- **G7 × G8:** mesma goleada de 7. Com 12 defesas, 5,5; com 2 defesas, 3,5.

## Comportamentos conhecidos da v1

Aceitos na aprovação. São os candidatos naturais a revisão em uma `v2`.

1. **"Participação"** significa participação nos gols do time.
2. **Limites de 3,0 e 10,0 são mantidos.** Atuações muito grandes empatam em
   10,0 (L5 e L8), o que achata a média usada no craque da noite.
3. **Atacante em branco na vitória fica com 6,1 (L3).** É a consequência da
   penalidade de −0,4.
4. **Clean sheet sem defesas vale 7,5 (G2).** O goleiro não foi exigido, mas o
   time não sofreu gol.
5. **Pesos por grupo.** Os valores de ATA, MEI e DEF são um ponto de partida e
   devem ser calibrados com as primeiras noites reais.
