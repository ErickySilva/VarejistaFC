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

Os demais prêmios também aceitam co-vencedores em caso de empate.

## Em aberto

- **Destaque do goleiro.** Proposta: maior média de nota entre as participações
  como goleiro na noite; sem goleiro humano, o prêmio fica vazio.
