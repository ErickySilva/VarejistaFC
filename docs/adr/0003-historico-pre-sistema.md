# 0003 — Histórico pré-sistema separado das partidas

**Status:** aceita. Revisada pelo [ADR 0013](0013-tipos-de-partida-temporadas-e-nota-fifa.md):
o histórico passou a pertencer a uma temporada (FC 25) e entra nas estatísticas
dessa temporada, além do total desde a criação do clube.

## Contexto

Existem totais anotados antes do sistema (jogos, gols, assistências e, para o
Heit, clean sheets). Eles não têm partida, data, adversário nem posição.

## Decisão

O histórico fica em uma tabela própria, uma linha por jogador e temporada, e
nunca é convertido em partidas fictícias.

- Entra no total **desde a criação do clube** e no da **temporada histórica**
  a que pertence.
- Não entra em estatística mensal, por noite ou por posição, nem no Rush.
- Não tem Nota VFC: onde só há histórico, a média é mostrada como indisponível.
- A interface mostra as duas parcelas separadas quando exibir o total geral.
- Só `admin` altera, com registro em auditoria.

## Consequências

- Métricas que dependem de posição (taxa de clean sheet, jogos como goleiro)
  consideram somente dados do sistema.
- Valores iniciais, usados também como verificação do seed:

| Jogador   | Jogos | Gols | Assistências | G/A | Clean sheets |
| --------- | ----- | ---- | ------------ | --- | ------------ |
| Ericky #7 | 203   | 131  | 138          | 269 | não anotado  |
| Felp #11  | 207   | 104  | 88           | 192 | não anotado  |
| Heit #69  | 144   | 47   | 20           | 67  | 5            |
| Lucão #10 | 266   | 200  | 124          | 324 | não anotado  |
