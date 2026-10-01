# 0007 — Noites: uma aberta por vez, data de referência e polling

**Status:** aceita

## Decisão

- Toda partida pertence a uma noite. O vínculo é explícito, nunca deduzido da
  data da partida.
- Existe **no máximo uma noite aberta**. A garantia fica no banco (índice único
  parcial), não só na aplicação.
- Partidas só são adicionadas a uma noite aberta. Corrigir uma noite finalizada
  exige reabertura por um `admin`, o que recalcula nota e prêmios e é auditado.
- Cada noite tem uma **data de referência**. É ela que define o mês e a
  temporada das partidas. Uma partida jogada à 0h30 de sábado pertence à sexta.
- Datas e horas são gravadas com fuso e interpretadas em `America/Sao_Paulo`.
- A temporada é ligada à edição do EA FC (ex.: FC 26).
- O acompanhamento ao vivo usa **polling** de poucos segundos. Sem WebSocket.

## Consequências

- A virada de mês ou de ano no meio de uma noite não divide as estatísticas.
- O polling pode ser trocado por outro mecanismo depois sem mexer no modelo.
