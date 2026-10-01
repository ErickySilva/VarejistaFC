# 0013 — Tipos de partida, recortes de estatística, temporadas e Nota FIFA

**Status:** aceita

## Contexto

O produto final tem três tipos de partida, um dos quais (Rush) não deve
entrar nas estatísticas principais. As temporadas passam a ser trocadas à mão,
e o histórico pré-sistema passa a pertencer a uma temporada. Além da Nota VFC,
cada participação pode guardar a nota mostrada pelo próprio jogo.

Este ADR altera pontos dos ADRs [0003](0003-historico-pre-sistema.md),
[0007](0007-noites.md) e [0008](0008-premios-da-noite.md); o que mudou está
indicado em cada um.

## Decisão

### Tipos de partida

Toda partida tem um tipo, obrigatório:

| Tipo    | Nome            | O que é                                                |
| ------- | --------------- | ------------------------------------------------------ |
| `x1`    | X1              | Partida combinada contra outro time. Não é 1 contra 1. |
| `match` | Partida         | Partida normal de Pro Clubs.                           |
| `rush`  | Torneio de Rush | Partida de Rush.                                       |

A lista vive em `src/domain/match-type.ts`; o enum do banco é criado a partir
dela. Os tipos antigos (`friendly`, `league`, `playoff`, `tournament`) deixaram
de existir.

### Recortes de estatística

- `main`: X1 e Partida. São as estatísticas principais.
- `rush`: Torneio de Rush. Tem estatísticas próprias.

O Rush é registrado **por inteiro**: jogador, posição, gols, assistências,
dados de goleiro, Nota FIFA e Nota VFC. Ele só não entra nas estatísticas
principais. Mudar essa regra no futuro é trocar o mapeamento tipo → recorte,
sem tocar em dados.

O mapeamento existe em dois lugares, que precisam concordar: a função
`statsScope` do domínio e a coluna `stats_scope` da view `v_player_match`. Um
teste de integração confere os dois para cada tipo.

### Agregações

Nada é contador armazenado ([ADR 0002](0002-fonte-de-verdade-sem-contadores.md)).

- `v_player_match`: uma linha por participação, com `stats_scope`.
- `v_player_period_totals`: totais por jogador, temporada e recorte. É a base
  de qualquer visão.
- `v_player_totals_system` e `v_player_totals_overall`: principais, em todas
  as temporadas, sem e com o histórico.
- `getPlayerStats(período, recorte)` em `src/server/stats`: período é uma
  temporada ou "desde a criação do clube".

### Temporadas

- Ligadas à edição do EA FC (FC 25, FC 26, FC 27).
- **A troca é manual**, feita por um admin. Nenhuma data ativa ou desativa uma
  temporada; as datas são só informativas e podem ficar em branco.
- **No máximo uma temporada ativa**, garantido por índice único parcial.
- A gameplay entra na temporada ativa no momento em que começa. Sem temporada
  ativa, a gameplay não começa.
- Uma gameplay aberta continua na temporada em que começou, mesmo que a ativa
  mude.
- A visão padrão das estatísticas é a temporada atual; a alternativa é "desde
  a criação do clube".

### Histórico pré-sistema por temporada

- `legacy_stats` passa a ter uma linha por jogador **e temporada**.
- O histórico existente foi ligado à temporada histórica **FC 25**.
- Continua valendo: não vira partida, não tem Nota VFC, só admin altera.
- O histórico pertence ao recorte principal.
- Estatísticas gerais somam histórico e partidas do sistema. **A média de Nota
  VFC considera só partidas avaliadas**, isto é, as registradas no sistema;
  onde não há nenhuma, a média é mostrada como indisponível.

### Nota FIFA

- `match_players.fifa_rating`: opcional, de 0,0 a 10,0, uma casa decimal.
- É a nota mostrada pelo EA FC, informada à mão. **Só informativa**: não entra
  na Nota VFC, nos rankings nem nos prêmios.
- A coluna `rating` continua sendo a Nota VFC
  ([ADR 0010](0010-nota-versionada.md)); as fórmulas v1 e v2 não mudaram.

### Goleiro

A posição é da partida; qualquer jogador pode ter atuado no gol. As
estatísticas de goleiro contam só as participações no gol: partidas, defesas,
defesas por partida, defesas de pênalti, gols sofridos (derivados do placar),
jogos sem sofrer gol e média de Nota VFC como goleiro. Elas aparecem em blocos
próprios, fora das tabelas dos jogadores de linha.

## Consequências

- Uma partida de Rush dá jogo, gols e nota ao jogador no recorte de Rush, e
  nada no principal.
- Corrigir o tipo de uma partida move as estatísticas dela de recorte.
- Defesas e médias de goleiro existem só desde o sistema; do histórico, só os
  jogos sem sofrer gol, quando anotados.
- Os apelidos iniciais passaram a ter a grafia definitiva (EL GARRO e
  PERNINHA).
