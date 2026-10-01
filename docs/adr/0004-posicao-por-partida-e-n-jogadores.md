# 0004 — Posição por partida e elenco de N jogadores

**Status:** aceita

## Decisão

- A posição é gravada **em cada participação**. É um fato daquela partida.
- O jogador tem uma posição padrão, usada só para pré-preencher formulários.
  Alterá-la não toca em nenhuma participação já registrada.
- Estatísticas de goleiro existem apenas para a participação cuja posição é
  goleiro, e há no máximo um goleiro do Varejista por partida.
- O elenco é uma tabela. Nada no código assume quatro jogadores nem nomes fixos.
- Jogadores não são apagados, apenas desativados.

## Consequências

- O Heit pode jogar na linha em uma partida sem afetar seu histórico de goleiro.
- Um quinto jogador ou convidado entra sem mudança de schema.
- Toda regra que depende de posição (nota, destaque do goleiro) lê a posição da
  participação, nunca a posição padrão.
