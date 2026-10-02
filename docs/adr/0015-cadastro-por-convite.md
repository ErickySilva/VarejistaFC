# 0015 — Cadastro por convite

**Status:** aceita

Altera os ADRs [0005](0005-papeis-e-autenticacao.md) e
[0011](0011-autenticacao-e-autorizacao.md) em um ponto: a conta de um jogador
deixa de ser criada por um admin, que precisava escolher a senha de outra
pessoa, e passa a ser criada pelo próprio jogador, com um convite. O cadastro
continua fechado: sem convite válido, ninguém cria conta.

## Contexto

Para criar a conta de um colega, o admin digitava a senha dele. Ninguém além
do dono deve conhecer a senha de uma conta. Ao mesmo tempo, o clube não quer
cadastro aberto, e é o admin quem decide quem é administrador.

## Decisão

### Convite

- Um admin gera o convite em `/admin/contas`, para **um jogador sem conta** e
  com **um papel** (`admin` ou `player`).
- O convite fica em `account_invites`: jogador, papel, hash do código,
  validade, uso, revogação e quem gerou.
- **Código**: 20 símbolos de um alfabeto de 32 (sem `0`, `1`, `I`, `O`),
  sorteados com `crypto.randomBytes`: 100 bits de entropia. É mostrado em
  grupos de cinco (`XXXXX-XXXXX-XXXXX-XXXXX`).
- **Só o hash é gravado** (SHA-256). O código em texto existe apenas na
  resposta da geração, mostrada uma vez ao admin. Não há como consultá-lo
  depois; perdeu, gera outro. SHA-256 simples é suficiente porque o código tem
  entropia alta, ao contrário de uma senha.
- **Validade**: 7 dias.
- **Uso único**: criar a conta marca o convite como usado.
- **Um em aberto por jogador**: gerar de novo revoga o anterior na mesma
  transação. O banco garante com um índice único parcial
  (`account_invites_one_pending_per_player_idx`).
- O convite só vale enquanto **quem o gerou continua sendo admin ativo**.
- O código é enviado ao jogador pelo admin, por fora do sistema. Ele não vai em
  um link, para não ficar no histórico do navegador nem em registros de acesso.

### Cadastro

Tela `/criar-conta`, com link discreto em `/entrar`:
código → dados da conta → conta criada.

1. A pessoa informa o código. O servidor responde com o jogador do convite
   (nome, número e foto). O papel não aparece.
2. A pessoa informa e-mail, senha e confirmação.
3. O servidor cria a conta e a pessoa entra pelo retrato, como qualquer outra.
   Não há login automático.

**O jogador e o papel vêm só do convite gravado no banco.** A entrada da
action é um objeto estrito com `code`, `email`, `password` e
`passwordConfirmation`; um campo a mais (`role`, `playerId`…) faz a requisição
ser recusada. O nome da conta é o nome do jogador.

A criação é **uma transação**:

1. encontra o convite pelo hash e trava a linha (`FOR UPDATE`);
2. confere: existe, não usado, não revogado, não vencido, gerado por admin
   ativo, jogador ativo e ainda sem conta;
3. cria o usuário pelo Better Auth (`auth.api.createUser`, chamada de servidor,
   a mesma do script do primeiro admin), que gera o hash da senha;
4. marca o convite como usado;
5. grava a auditoria.

Qualquer falha desfaz tudo. A trava do passo 1 faz com que, de dois cadastros
simultâneos com o mesmo código, só um crie a conta. `users.player_id` único
continua sendo a garantia final de uma conta por jogador.

O Better Auth não mudou: o cadastro público (`/sign-up/email`) segue
desligado e nenhuma rota HTTP foi aberta.

### Recusas e tentativas

- Código inexistente, malformado, vencido, usado, revogado, de jogador que já
  tem conta ou gerado por quem não é mais admin: **a mesma resposta** em todos
  os casos. O motivo real vai só para o log do servidor, sem o código.
- Tentativas com código inválido são contadas por origem, no mesmo contador do
  login (8 em 15 minutos). O contador fica em memória; em ambiente serverless
  ele é fraco. O que impede adivinhar um convite é a entropia do código.
- O tamanho da senha (8 a 128) é conferido na action e de novo no serviço: a
  criação de usuário do plugin de administração não confere.

### Auditoria

Na mesma transação da alteração: convite gerado, convite substituído, conta
criada pelo convite e convite usado. Nunca entram senha, código, hash do
código nem hash da senha. Tentativas inválidas não vão para a auditoria, que
não pode ser apagada e poderia ser enchida por quem tenta códigos; ficam no
log do servidor.

### Tela de contas

`/admin/contas` é organizada por jogador: quem tem conta mostra a conta (papel,
vínculo, redefinir senha, desativar); quem não tem mostra a situação do
convite e o botão de gerar. O formulário em que o admin criava a conta
digitando a senha saiu da tela.

## Consequências

- Nenhum admin precisa conhecer a senha de outra pessoa para criar a conta. A
  redefinição de senha por admin continua existindo, por enquanto.
- Quem tem o código cria a conta daquele jogador: o código deve ser enviado só
  a ele. Enviou para a pessoa errada, gera outro; o anterior deixa de valer.
- A função de serviço `createAccount` (criação por admin) continua no servidor
  e nos testes, sem tela.
- Fora do escopo: envio do convite por e-mail, recuperação de senha pelo
  próprio jogador, 2FA e login social.
