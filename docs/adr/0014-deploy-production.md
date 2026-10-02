# 0014 — Deploy de produção com Docker Compose e Nginx

**Status:** aceita

## Contexto

O [ADR 0001](0001-monolito-nextjs.md) deixou a infraestrutura de produção para
um ADR próprio. Até aqui existia só a imagem Docker de produção, validada no
CI, e um `compose.yaml` de desenvolvimento.

O produto atende um clube de quatro jogadores e será hospedado em uma única
máquina (uma VM na OCI). Precisa de pouca operação, de um caminho de volta
claro e de não expor o banco.

## Decisão

### Topologia

```
Internet -> Nginx -> Next.js -> PostgreSQL
```

Tudo em uma máquina, com Docker Compose, descrito em `compose.production.yaml`
(separado do `compose.yaml` de desenvolvimento):

- **Nginx** é o único serviço com porta publicada.
- **Aplicação**: a imagem do estágio `runner` do `Dockerfile`, sem alteração.
  Usuário sem privilégios, sem porta publicada.
- **PostgreSQL 17**: volume persistente, sem porta publicada, em rede interna
  sem saída para a internet.

Credenciais e segredos vêm de um `.env.production` criado só na máquina. As
variáveis obrigatórias não têm valor padrão: se faltar uma, o Compose recusa
subir. Nada do ambiente de desenvolvimento é reaproveitado.

### Migrações, seed e primeiro admin

A imagem de produção não tem `drizzle-kit`, `tsx` nem o código-fonte, e deve
continuar assim. As três operações rodam em uma segunda imagem, do estágio
`tools` do `Dockerfile`, por um serviço que só existe sob demanda
(`profiles: ["tools"]`):

```bash
docker compose ... run --rm tools npm run db:migrate
docker compose ... run --rm tools npm run db:seed
docker compose ... run --rm tools npm run auth:create-admin
```

São os mesmos comandos do desenvolvimento e do CI. Nada disso roda sozinho
quando a aplicação reinicia: migrar o banco é sempre um ato explícito de quem
opera. A senha do primeiro admin é digitada na hora e não passa por arquivo.

### Proxy e segurança

- O Nginx **sobrescreve** `X-Forwarded-For` com o IP real. O limite de
  tentativas de login da aplicação confia nesse cabeçalho, então ele só pode
  ser definido pelo proxy.
- O Nginx limita as requisições às rotas HTTP de autenticação
  (`/api/auth/`). O login por HTTP continua existindo
  ([ADR 0011](0011-autenticacao-e-autorizacao.md)) e não passa pelo limite de
  tentativas das Server Actions; este limite cobre essa porta.
- A aplicação envia `X-Content-Type-Options`, `X-Frame-Options`,
  `Content-Security-Policy: frame-ancestors 'none'` e `Referrer-Policy`, e
  deixa de enviar `X-Powered-By`.
- O HSTS fica no Nginx, só no bloco HTTPS.
- A autenticação em si não foi alterada.

### Backup e volta

- Backup com `pg_dump` e restauração com `pg_restore`, por dois scripts em
  `deploy/scripts/`. A restauração roda em uma transação e exige confirmação.
- As imagens são etiquetadas por versão (`APP_VERSION`). Voltar a aplicação é
  trocar a etiqueta.
- O projeto não tem migrações de volta. Voltar o banco é restaurar o backup
  feito antes da atualização.

### Build e CI

A imagem é construída na própria máquina de produção, o que resolve a
arquitetura (x86-64 ou ARM64) sem registro de imagens. O CI valida o
`compose.production.yaml`, a configuração do Nginx, os scripts e o estágio
`tools`, mas **não publica nem implanta**. O deploy é manual.

O passo a passo está em [../deploy-production.md](../deploy-production.md).

## Alternativas descartadas

- **Rodar as migrações na inicialização da aplicação.** Um reinício não
  planejado alteraria o banco, e duas instâncias migrariam ao mesmo tempo.
- **Incluir as ferramentas na imagem de produção.** Aumenta a imagem e leva
  dependências de desenvolvimento para o que fica exposto.
- **Um migrador próprio na aplicação.** Código novo para manter, diferente do
  caminho já testado no CI.
- **Banco gerenciado.** Custo e complexidade desnecessários para o tamanho do
  clube.
- **Deploy automático pelo CI.** Exigiria guardar acesso à máquina em segredos
  do repositório; para poucos deploys, o ganho não compensa.

## Consequências

- Operar exige acesso por terminal à máquina.
- A imagem `tools` é grande (tem as dependências de desenvolvimento). Não fica
  rodando, mas ocupa disco.
- O limite de tentativas de login continua em memória: zera a cada reinício e
  supõe uma única instância da aplicação.
- Sem HTTPS, senhas e cookies trafegam sem proteção. O certificado é
  pré-requisito para criar as contas reais e depende de um domínio, ainda não
  definido.
- Atualizar com mudança de schema exige backup antes, porque não há migração
  de volta.
