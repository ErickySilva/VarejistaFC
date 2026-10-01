# 0002 — Fonte de verdade única, sem contadores derivados

**Status:** aceita

## Contexto

Estatísticas anotadas à mão divergem porque o mesmo número é mantido em mais de
um lugar. O sistema existe para acabar com isso.

## Decisão

A fonte de verdade é a cadeia **noite → partida → participação do jogador**.
Tudo o que pode ser calculado a partir dela não é armazenado:

- quantidade de jogos, gols e assistências totais;
- G/A (gols + assistências);
- resultado da partida (derivado do placar);
- clean sheet (jogou de goleiro e o adversário não marcou);
- rankings, médias, totais mensais, por temporada e gerais.

Esses valores vêm de views e consultas SQL.

## Consequências

- Corrigir uma partida corrige todos os totais automaticamente.
- Nenhuma tabela tem coluna de total acumulado por jogador.
- A quantidade de jogos de um jogador é a contagem das participações dele, nunca
  a contagem de partidas do time.
- A soma de gols dos jogadores em uma partida pode ser **menor** que o placar do
  Varejista (gols de bots), mas nunca maior. O mesmo vale para assistências.
- Exceções deliberadas, que são fotografias e não contadores: a nota da partida
  ([0010](0010-nota-versionada.md)) e os prêmios da noite
  ([0008](0008-premios-da-noite.md)).
