# 0008 — Prêmios da noite

**Status:** aceita. Revisada em 2026-10-01: a lista de prêmios passou a ser a
definitiva do produto. Saíram "Líder de G/A" e "Destaque do goleiro"; entrou
"Destaque do Rush".

## Decisão

Ao encerrar uma gameplay, o sistema calcula e grava os prêmios e o resumo.

Os prêmios são uma fotografia do fechamento. São sempre recalculáveis a partir
das participações e são recalculados quando a noite é reaberta e encerrada de
novo.

| Prêmio           | Partidas consideradas     | Critério                |
| ---------------- | ------------------------- | ----------------------- |
| Artilheiro       | principais (X1 e Partida) | mais gols               |
| Assistente       | principais (X1 e Partida) | mais assistências       |
| Craque da Noite  | principais (X1 e Partida) | maior média de Nota VFC |
| Destaque do Rush | Torneio de Rush           | maior média de Nota VFC |

O Rush fica completamente separado das estatísticas e premiações principais:
gols, assistências e notas de Rush só contam para o Destaque do Rush.

### Artilheiro e Assistente

- Consideram só as partidas principais (X1 e Partida).
- Vence quem tem o maior valor; empate gera co-vencedores.
- Se o maior valor for **zero**, o prêmio não tem vencedor.

### Craque da Noite

1. Considera só as partidas principais (X1 e Partida).
2. Só concorre quem jogou pelo menos **metade das partidas principais da
   gameplay, arredondando para cima** (5 partidas exigem 3).
3. Maior média de Nota VFC.
4. Desempate: maior G/A.
5. Desempate: mais gols.
6. Empate completo: co-vencedores.

Gameplay sem partida principal não tem Craque da Noite.

### Destaque do Rush

A mesma regra do Craque da Noite, considerando exclusivamente as partidas de
Rush: mínimo de metade das partidas de Rush, média de Nota VFC, G/A, gols,
co-vencedores. Gameplay sem Rush não tem o prêmio.

### Cálculo

- As médias são comparadas de forma exata (soma das notas em décimos), sem
  arredondar antes de comparar. O valor gravado é a média com duas casas.
- "Partidas da gameplay" são as partidas não excluídas.
- A Nota FIFA não participa de nenhum prêmio.

As regras estão implementadas em `src/domain/night/`.
