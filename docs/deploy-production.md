# Deploy de produção

Guia para subir e operar o Varejista FC em uma máquina própria (por exemplo,
uma VM na OCI) com Docker. A decisão por trás desta arquitetura está no
[ADR 0014](adr/0014-deploy-production.md).

```
Internet -> Nginx (porta 80/443) -> Next.js (3000, interna) -> PostgreSQL (5432, interna)
```

Só o Nginx tem porta aberta para fora. A aplicação e o banco ficam em redes
internas do Docker.

## Antes de receber contas reais

**O site precisa de HTTPS.** A configuração que acompanha o repositório atende
em HTTP, para a primeira subida e os testes. Em HTTP, senhas e cookies de
sessão trafegam sem proteção. Só crie as contas dos jogadores depois de
configurar o certificado (seção [HTTPS](#https)).

## Pré-requisitos

- Máquina Linux, x86-64 ou ARM64 (as imagens usadas existem nas duas
  arquiteturas; ver [ARM64](#arm64)).
- Docker Engine com o plugin Compose (`docker compose version`).
- Git.
- Memória: o build do Next.js consome bastante memória e o consumo não foi
  medido em uma máquina pequena. Em uma máquina com 1 GB, o build pode falhar;
  nesse caso, crie swap antes ou construa a imagem em outro lugar.
- Portas 80 e 443 liberadas na rede da máquina **e** no firewall do sistema
  operacional. A porta 5432 do banco nunca deve ser liberada.
- Um domínio apontando para a máquina, para o certificado HTTPS.

## Atalho usado neste guia

Todos os comandos usam o arquivo de variáveis de produção. Para não repetir:

```bash
DC="docker compose --env-file .env.production -f compose.production.yaml"
```

Rode os comandos na raiz do projeto.

## 1. Código

```bash
git clone https://github.com/ErickySilva/VarejistaFC.git varejista-fc
cd varejista-fc
```

## 2. Variáveis

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Preencha o `.env.production`:

| Variável             | O que é                                                       |
| -------------------- | ------------------------------------------------------------- |
| `POSTGRES_USER`      | Usuário do banco.                                             |
| `POSTGRES_DB`        | Nome do banco.                                                |
| `POSTGRES_PASSWORD`  | Senha do banco. Só letras e números (ela entra em uma URL).   |
| `BETTER_AUTH_SECRET` | Chave que assina os cookies de sessão. 32 caracteres ou mais. |
| `BETTER_AUTH_URL`    | Endereço público do site, como o visitante digita.            |
| `HTTP_PORT`          | Porta HTTP publicada pelo Nginx. Padrão: 80.                  |
| `APP_VERSION`        | Etiqueta da imagem. Use o hash curto do commit.               |

Gere os segredos na própria máquina:

```bash
openssl rand -hex 24                                   # POSTGRES_PASSWORD
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='     # BETTER_AUTH_SECRET
git rev-parse --short HEAD                             # APP_VERSION
```

Regras:

- O `.env.production` nunca é versionado (o `.gitignore` já o ignora) e não
  entra na imagem Docker.
- Não reaproveite nenhum valor do ambiente de desenvolvimento.
- Se faltar uma variável obrigatória, o Compose recusa subir e diz qual.
- Guarde uma cópia do `.env.production` fora da máquina, em lugar seguro. Sem
  o `BETTER_AUTH_SECRET` original, todas as sessões abertas são invalidadas.

## 3. Build das imagens

```bash
$DC build app tools
```

São duas imagens:

- `varejista-fc`: a aplicação (estágio `runner` do `Dockerfile`). Enxuta, roda
  como usuário sem privilégios.
- `varejista-fc-tools`: operação (estágio `tools`). Tem as ferramentas de
  migração e o código-fonte. Só roda sob demanda.

## 4. Primeira subida

A ordem importa: banco, migrações, seed, admin e só então a aplicação.

```bash
$DC up -d --wait db
$DC run --rm tools npm run db:migrate
$DC run --rm tools npm run db:seed
$DC run --rm tools npm run auth:create-admin
$DC up -d --wait
```

### Migrações

`db:migrate` aplica só o que ainda não foi aplicado; rodar de novo não faz
nada. As migrações **não** rodam sozinhas quando a aplicação reinicia: é
sempre um comando explícito.

### Seed

`db:seed` insere os dados iniciais (temporada, jogadores, histórico e
apelidos). É idempotente: não apaga nem sobrescreve o que já existe, então
pode ser repetido sem risco. Também nunca roda sozinho.

### Primeiro admin

`auth:create-admin` pergunta e-mail, nome, senha e o jogador a vincular. A
senha é digitada na hora e não aparece na tela. Ela não é lida de arquivo,
não vai para o Compose, para o `Dockerfile` nem para o Git, e não fica no
histórico do terminal.

O comando só cria um admin se ainda não existir nenhum. As outras contas são
criadas pelo admin, na tela `/admin/contas`.

## 5. Conferir a saúde

```bash
$DC ps                                    # os três serviços "healthy"
curl -s http://localhost/api/health       # {"status":"ok","database":"up"}
curl -s http://localhost/nginx-health     # ok
curl -sI http://localhost/entrar          # cabeçalhos de segurança
```

`/api/health` responde `200` quando a aplicação alcança o banco e `503`
quando não alcança. Se `HTTP_PORT` não for 80, acrescente a porta ao endereço.

Nos cabeçalhos devem aparecer `X-Content-Type-Options`, `X-Frame-Options`,
`Content-Security-Policy` e `Referrer-Policy`, e não deve aparecer
`X-Powered-By`.

## Logs

```bash
$DC logs -f app          # aplicação
$DC logs -f nginx        # acessos e erros do proxy
$DC logs --tail 100 db   # banco
```

Os logs são limitados a 5 arquivos de 10 MB por serviço, para não encher o
disco.

## Backup

```bash
sh deploy/scripts/backup.sh
```

Gera `backups/varejista-AAAAMMDD-HHMMSS.dump` com `pg_dump`. O script confere
se o arquivo é legível antes de aceitá-lo e não altera nada no banco. A pasta
`backups/` não é versionada.

- Faça backup **antes de toda atualização** e de toda migração.
- Agende um backup diário. Exemplo de `crontab -e` (todo dia às 4h):

  ```
  0 4 * * * cd /caminho/para/varejista-fc && sh deploy/scripts/backup.sh >> backups/backup.log 2>&1
  ```

- **Copie os backups para fora da máquina.** Um backup que só existe no mesmo
  disco do banco não protege contra a perda da máquina.
- O script não apaga backups antigos. Remova os que não precisa mais.

## Restauração

```bash
sh deploy/scripts/restore.sh backups/varejista-AAAAMMDD-HHMMSS.dump
```

**Substitui os dados atuais pelos do backup.** O que foi registrado depois do
backup é perdido. O script:

1. confere se o arquivo é um backup válido;
2. pede para digitar o nome do banco, como confirmação;
3. para a aplicação;
4. restaura em uma única transação (se algo falhar, o banco fica como estava);
5. religa a aplicação.

As senhas das contas voltam com o backup. As sessões abertas só continuam
válidas se o `BETTER_AUTH_SECRET` for o mesmo de quando foram criadas; caso
contrário, todos entram de novo.

Teste a restauração de tempos em tempos em uma máquina de teste. Backup que
nunca foi restaurado não é garantia.

## Atualização

```bash
sh deploy/scripts/backup.sh
git pull
# edite APP_VERSION no .env.production para o novo hash:
git rev-parse --short HEAD
$DC build app tools
$DC run --rm tools npm run db:migrate
$DC up -d --wait
$DC ps
curl -s http://localhost/api/health
```

Anote o `APP_VERSION` anterior antes de trocar: é ele que permite voltar. A
imagem antiga continua no disco até ser removida.

## Rollback

**Só da aplicação** (a versão nova não mudou o banco):

```bash
# volte APP_VERSION no .env.production para o valor anterior
$DC up -d --wait
```

**Da aplicação e do banco** (a versão nova aplicou migração): o projeto não
tem migrações de volta. O caminho é restaurar o backup feito antes da
atualização e voltar a imagem:

```bash
# volte APP_VERSION no .env.production para o valor anterior
sh deploy/scripts/restore.sh backups/varejista-<o de antes da atualização>.dump
$DC up -d --wait
```

O que foi registrado entre o backup e a restauração é perdido. Por isso o
backup vem sempre imediatamente antes de atualizar.

## Segurança

- **Banco**: sem porta publicada, em rede interna sem saída para a internet.
- **Aplicação**: usuário sem privilégios, sem capacidades extras do Linux, sem
  porta publicada.
- **Cabeçalhos**: definidos pela aplicação (`src/lib/security-headers.ts`). O
  HSTS é definido só no Nginx, e só no bloco HTTPS.
- **`X-Forwarded-For`**: o limite de tentativas de login identifica a origem
  por este cabeçalho. O Nginx o **sobrescreve** com o IP real do visitante
  (`deploy/nginx/snippets/proxy.conf`); o que o cliente mandar é descartado.
  Qualquer proxy colocado na frente da aplicação precisa fazer o mesmo, e a
  aplicação nunca deve ficar acessível sem passar por ele.
- **Limite no Nginx**: `/api/auth/sign-in/` aceita 8 requisições seguidas e
  depois 1 por minuto por IP; as demais rotas de `/api/auth/`, 30 por minuto.
  Isso se soma ao limite da própria aplicação (8 senhas erradas em 15 minutos
  por origem e conta).
- **Se houver outro proxy na frente do Nginx** (um balanceador, por exemplo),
  o IP visto pelo Nginx passa a ser o do proxy. Nesse caso é preciso
  configurar o módulo `realip` do Nginx; sem isso, todos os visitantes contam
  como uma origem só.

## HTTPS

O modelo está em `deploy/nginx/https.conf.example`. Nenhum certificado
acompanha o repositório. Com o domínio apontando para a máquina:

1. Obtenha o certificado (por exemplo, com o Certbot).
2. Copie o modelo para `deploy/nginx/conf.d/varejista.conf`, trocando
   `SEU_DOMINIO` pelo domínio real.
3. No serviço `nginx` do `compose.production.yaml`, publique a porta 443 e
   monte a pasta dos certificados (`/etc/letsencrypt`, somente leitura).
4. Mude `BETTER_AUTH_URL` no `.env.production` para `https://SEU_DOMINIO`.
5. `$DC up -d --wait` e confira `curl -sI https://SEU_DOMINIO/entrar`.

Depois da troca, o cookie de sessão passa a ser marcado como seguro e todos
entram de novo. O HSTS do modelo vale por um ano; comece com um prazo curto
(`max-age=300`) e aumente depois de confirmar que tudo responde por HTTPS.

Esta etapa ainda não foi executada: ela depende do domínio e será detalhada
quando ele existir.

## ARM64

A stack roda em ARM64 (por exemplo, as instâncias Ampere da OCI) sem
alteração: as imagens base e todas as dependências com binário nativo têm
versão para essa arquitetura. O build feito na própria máquina já sai na
arquitetura certa.

Para construir em uma máquina x86-64 uma imagem destinada a ARM64:

```bash
docker buildx build --platform linux/arm64 --target runner -t varejista-fc:<versão> --load .
```

Por emulação, esse build leva alguns minutos e a aplicação responde bem mais
devagar do que em um processador ARM de verdade.

## Limites conhecidos

- O limite de tentativas de login fica na memória da aplicação: zera a cada
  reinício e supõe uma única instância. Para o clube é suficiente.
- Não há Content-Security-Policy completa (só `frame-ancestors`).
- Não há deploy automático: o CI valida a stack, mas não publica nem implanta.
