# 0008 — Prêmios da noite e critério do craque

**Status:** aceita

## Decisão

Ao finalizar uma noite, o sistema calcula e grava: artilheiro, líder de
assistências, líder de G/A, craque da noite, destaque do goleiro e o resumo.

Os prêmios são uma fotografia do fechamento. São sempre recalculáveis a partir
das participações e são recalculados quando a noite é reaberta e finalizada de
novo.

### Craque da noite

1. Só concorre quem jogou pelo menos **metade das partidas da noite,
   arredondando para cima** (5 partidas na noite exigem 3).
2. Maior média de nota.
3. Desempate: maior G/A na noite.
4. Desempate: mais gols na noite.
5. Empate completo: todos os empatados são craques (co-vencedores).

### Artilheiro, líder de assistências e líder de G/A

- Vence quem tem o maior valor na noite; empate gera co-vencedores.
- Se o maior valor for **zero**, o prêmio não tem vencedor.

### Destaque do goleiro

- Maior média de nota considerando só as participações **como goleiro** na
  noite. Partidas do mesmo jogador na linha não entram nessa média.
- Não há mínimo de partidas.
- Empate gera co-vencedores.
- Noite sem participação de goleiro humano não tem o prêmio.

### Cálculo

- As médias são comparadas de forma exata (soma das notas em décimos), sem
  arredondar antes de comparar. O valor gravado no prêmio é a média com duas
  casas decimais.
- "Partidas da noite" são as partidas não excluídas.
- Noite sem partidas não tem prêmios.

As regras estão implementadas em `src/domain/night/`.
