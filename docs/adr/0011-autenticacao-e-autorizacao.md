# 0011 — Autenticação e autorização com Better Auth

**Status:** aceita. A criação de contas de jogador mudou no
[ADR 0015](0015-cadastro-por-convite.md): passou a ser por convite.

## Contexto

O sistema precisa de login para a área administrativa e para o perfil dos
jogadores, com dois papéis, sem cadastro aberto e com auditoria de quem fez
cada alteração (ADRs 0005 e 0006).

## Decisão

### Biblioteca e tabelas

- **Better Auth** com o **plugin oficial de administração**, que fornece
  papel, desativação de conta, criação de usuário e redefinição de senha.
- Quatro tabelas, declaradas em `src/db/schema/auth.ts`: `users`, `sessions`,
  `accounts` e `verifications`. Um teste compara esse arquivo com o schema que
  a versão instalada do Better Auth espera.
- Login por **e-mail e senha**. O cadastro público está desligado.
- **Sessão no banco**, cookie HTTP-only, validade de 30 dias renovada com o uso.
- Não há envio de e-mail. Quem redefine a senha de uma conta é um admin.

### Papéis e vínculo com jogador

- `users.role` aceita exatamente `admin` ou `player` (`CHECK` no banco). O
  padrão é `player`.
- `users.player_id` é opcional e único: um jogador tem no máximo uma conta.
  Papel e vínculo são independentes; um admin pode estar ligado a um jogador.
- `role`, `banned` e `playerId` são campos do servidor (`input: false`): nenhuma
  entrada do cliente os define. Só um admin os altera, pelas funções de
  `src/server/users`.

### Autorização

| Ação                                              | Visitante | `player`            | `admin` |
| ------------------------------------------------- | --------- | ------------------- | ------- |
| Ver estatísticas públicas                         | sim       | sim                 | sim     |
| Trocar a própria senha, sair                      | —         | sim                 | sim     |
| Alterar a foto de um jogador                      | —         | só a do seu jogador | sim     |
| Nome, número e posição padrão de jogador          | —         | não                 | sim     |
| Noites, partidas, apelidos, histórico, temporadas | —         | não                 | sim     |
| Criar conta, papel, vínculo, senha, desativar     | —         | não                 | sim     |

- As regras são funções puras em `src/server/auth/policy.ts`.
- **A checagem fica junto do dado**: toda função de serviço confere a
  permissão do ator antes de ler ou gravar. O envelope das Server Actions
  confere de novo. Esconder página ou botão não é proteção.
- O ator vem sempre da sessão lida no servidor, e o papel é lido do banco a
  cada requisição. Nenhuma Server Action recebe o autor como parâmetro.
- `src/proxy.ts` só redireciona para a tela de entrada quem não tem cookie em
  `/conta`, `/admin` e `/gameplay`. É conveniência; o cookie não é validado ali.
- Páginas e componentes não importam o banco nem o Better Auth: só
  `src/server` (regra de lint).

### Auditoria na mesma transação

As operações do plugin gravam pela conexão que o Better Auth recebe na
configuração. Para que elas e a auditoria sejam confirmadas ou desfeitas
juntas, o adaptador recebe um banco **sensível a contexto** (`contextDb`, em
`src/db/index.ts`): cada consulta é encaminhada para a transação aberta por
`withTransaction` naquele fluxo assíncrono, ou para a conexão normal quando
não há transação.

- Usa só a superfície pública do adaptador Drizzle (o banco passado na
  configuração). Nenhuma API interna do Better Auth é usada.
- `recordAudit` exige uma transação aberta e lança erro fora de uma.
- A garantia é verificada por testes de integração que forçam a auditoria a
  falhar e conferem que a operação do plugin não persistiu
  (`tests/integration/auth-transaction.test.ts`).
- **Se uma atualização do Better Auth quebrar esses testes**, o plano de
  reserva é fazer as escritas de gestão de conta direto pelo Drizzle na camada
  de serviço, mantendo o hash de senha do Better Auth.

### Rotas HTTP desabilitadas

As rotas do plugin de administração (`/api/auth/admin/*`), o cadastro
(`/sign-up/email`) e a edição da própria conta (`/update-user`,
`/change-email`, `/delete-user`) respondem 404. A gestão de contas passa só
pelas nossas Server Actions, onde ficam a auditoria e a regra do último admin.
As chamadas feitas no servidor não são afetadas.

Personificação e remoção de usuário ficam bloqueadas também no servidor: o
papel `admin` não tem essas permissões.

### Último admin

Nenhuma transação que altere `users` pode terminar sem ao menos um admin ativo
(papel `admin` e conta não desativada).

- A garantia é um gatilho de constraint adiado no banco
  (`users_at_least_one_admin`), conferido no `COMMIT`. Ele permite promover um
  novo admin e rebaixar o anterior na mesma transação, em qualquer ordem, e usa
  um advisory lock para que duas transações simultâneas não rebaixem um admin
  cada.
- A camada de serviço faz a mesma checagem antes, só para devolver uma
  mensagem clara.
- Consequência: a primeira conta do sistema precisa ser um admin.

### Entrada do clube

A tela `/entrar` tem três entradas:

- **Jogadores**: um tile por jogador ativo, com foto, nome e número. Tocar no
  tile leva à senha da conta vinculada àquele jogador. O servidor encontra a
  conta pelo jogador; o e-mail nunca aparece nem é enviado pelo navegador.
  Depois do login a sessão já sabe qual é o jogador, pelo vínculo da conta.
- **Admin**: entrada separada, que lista só os jogadores cuja conta é de
  administrador e leva a `/admin`. Quem é admin é definido pelo papel da conta;
  a área confere o papel no servidor, então uma conta de jogador que tente essa
  entrada recebe "Acesso restrito".
- **Visitante**: leva direto à Home, sem login. As telas de estatística são
  públicas e somente leitura; não existe ação de alteração para quem não está
  logado, na tela nem no servidor.

A senha continua com o mínimo de 8 caracteres. A entrada com e-mail e senha
(`/login`) fica como alternativa para contas sem jogador vinculado.

**Limite de tentativas.** Como os tiles tornam público quem tem conta, senhas
erradas são contadas por origem e conta: depois de 8 erros em 15 minutos, novas
tentativas daquela origem para aquela conta são recusadas até o prazo passar.
A contagem fica em memória e zera com um login certo.

### Área de administração

`/admin` exige papel de administrador. `/admin/contas` lista as contas e
permite criar conta, definir o papel, vincular a um jogador, redefinir senha e
desativar ou reativar, sempre pelas Server Actions de conta, com auditoria.

### Primeiro admin

`npm run auth:create-admin` pergunta e-mail, nome, senha e o jogador a
vincular. Nada é lido de arquivo nem gravado no repositório. O script só cria
a conta enquanto não existe nenhum admin ativo; executá-lo de novo não altera
nada. As demais contas são criadas por um admin logado.

## Consequências

- Usuários não são apagados, só desativados; quem tem registro de auditoria
  não pode ser apagado (chave estrangeira em `audit_log.actor_user_id`).
- `actor_user_id` nulo significa ação do sistema (seed, script do primeiro
  admin).
- Desativar uma conta encerra as sessões dela na hora.
- A senha nunca entra na auditoria.
- A foto do jogador é guardada como endereço ou caminho. As fotos dos quatro
  jogadores e o escudo do clube ficam em `public/players/` e `public/brand/`.
  O envio de arquivos pela interface entra em fase posterior.
