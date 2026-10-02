# 0012 — Fluxo de gameplay

**Status:** aceita

## Contexto

As partidas são registradas durante uma sessão de jogo, pelo celular. O
usuário não deve ter que "criar uma noite": ele começa a jogar, registra as
partidas conforme terminam e encerra no fim. As regras de noite já estão no
[ADR 0007](0007-noites.md); este ADR define como o fluxo as usa.

## Decisão

### Dar início à Gameplay

- A data de referência é a data de agora em `America/Sao_Paulo`, fixada no
  início. A noite é uma **sessão**: se atravessar a meia-noite, continua com a
  data em que começou.
- A temporada é a que estiver ativa. Sem temporada ativa, a gameplay não
  começa ([ADR 0013](0013-tipos-de-partida-temporadas-e-nota-fifa.md)).
- Não existe noite nessa data: é criada, aberta.
- Existe e está fechada: **a mesma noite é reaberta**. Os prêmios gravados são
  removidos e serão recalculados no novo encerramento. Auditado como `reopen`.
- Já está aberta: nada muda.
- Existe gameplay aberta de **outra** data:
  - com partidas, a nova não começa; é preciso encerrar a anterior;
  - sem nenhuma partida, a anterior é descartada e a de hoje começa.

### Registrar partida

- Só com a gameplay aberta, e só depois que a partida terminou.
- Informa-se o tipo (X1, Partida ou Torneio de Rush), adversário e placar,
  depois quem jogou e, se quiser, a Nota FIFA de cada um. **Só os jogadores
  selecionados recebem uma participação**, e portanto um jogo; quem jogou sem
  gol nem assistência também recebe.
- O adversário é localizado pelo nome, sem diferenciar maiúsculas, e criado se
  não existir.
- `played_at` é o momento real do registro.
- A nota é calculada no servidor pela versão vigente da fórmula
  ([ADR 0010](0010-nota-versionada.md)). O cliente nunca envia nota.

### Corrigir e excluir

- Permitidos enquanto a gameplay está aberta.
- Corrigir regrava as participações e **recalcula a nota de todos**, porque o
  placar entra na nota de cada jogador.
- Excluir é lógico (`deleted_at`): a partida sai das estatísticas e a linha
  permanece.

### Encerrar Gameplay

- Calcula prêmios e resumo com as funções do domínio
  ([ADR 0008](0008-premios-da-noite.md)), grava os prêmios, o texto do resumo e
  fecha a noite.
- **Não encerra noite sem partida**; o usuário recebe a orientação de registrar
  ao menos uma.

### Noites vazias

Não ficam no histórico. Uma gameplay aberta sem nenhuma partida válida pode
ser **cancelada**, o que remove a noite. Se nela só restavam partidas já
excluídas, essas linhas são removidas junto; o conteúdo delas continua na
auditoria. É a única situação em que partidas são apagadas fisicamente.
O adversário que ficar sem nenhuma partida depois disso é removido junto.

Para tirar uma partida de uma gameplay já encerrada, o caminho é reabrir a
gameplay (só no mesmo dia), excluir a partida e encerrar de novo; se ela era
a única, cancelar a gameplay. A página da partida mostra esse caminho ao admin.

### Validação em três camadas

1. `src/domain/match-entry.ts`: a mesma função roda no formulário, para avisar
   na hora, e no servidor.
2. Zod no envelope da Server Action, para o formato dos dados.
3. Constraints e gatilhos do banco, que continuam sendo a última barreira.

### Permissão e auditoria

- Só `admin` (`stats.manage`) opera a gameplay. A permissão é conferida no
  envelope da action e de novo em cada serviço.
- Cada operação roda em uma transação com seu registro de auditoria: iniciar
  (`create` ou `reopen`), registrar (`create`), corrigir (`update`, com antes e
  depois), excluir (`delete`), encerrar (`close`) e cancelar (`delete`).

### Atualização da tela

A tela de quem opera é atualizada assim que a ação termina. Não há polling nem
WebSocket nesta fase; o polling para espectadores entra com a área pública.

## Consequências

- O mês e a temporada de uma partida jogada depois da meia-noite são os da
  data em que a gameplay começou.
- A numeração das partidas na tela segue a ordem atual; uma exclusão não deixa
  buraco visível.
- Os apelidos por partida ou por noite ainda não fazem parte do fluxo.
