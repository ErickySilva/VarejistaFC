#!/usr/bin/env sh
# Restaura um backup no banco de produção.
#
# ATENÇÃO: substitui os dados atuais do banco pelos do backup. O que foi
# registrado depois do backup é perdido. Faça um backup novo antes.
#
# Uso, na raiz do projeto:
#   sh deploy/scripts/restore.sh backups/varejista-AAAAMMDD-HHMMSS.dump
#
# O script pede para digitar o nome do banco como confirmação. Para uso sem
# teclado (automação), a confirmação vai na variável CONFIRM_RESTORE.
#
# A restauração roda em uma única transação: se algo falhar, o banco fica
# como estava. A aplicação é parada durante a operação e religada no final.
#
# Variáveis opcionais:
#   ENV_FILE         arquivo de variáveis (padrão: .env.production)
#   CONFIRM_RESTORE  nome do banco, para confirmar sem perguntar
set -eu

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose --env-file $ENV_FILE -f compose.production.yaml"

if [ "$#" -ne 1 ]; then
  echo "Uso: sh deploy/scripts/restore.sh <arquivo.dump>" >&2
  exit 1
fi
file="$1"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de variáveis não encontrado: $ENV_FILE" >&2
  exit 1
fi
if [ ! -s "$file" ]; then
  echo "Backup não encontrado ou vazio: $file" >&2
  exit 1
fi

database="$($COMPOSE exec -T db sh -c 'printf %s "$POSTGRES_DB"')"

# O arquivo precisa ser um dump legível antes de qualquer coisa ser tocada.
if ! $COMPOSE exec -T db pg_restore --list <"$file" >/dev/null; then
  echo "O arquivo não é um backup válido: $file" >&2
  exit 1
fi

echo "Restaurar $file no banco \"$database\"."
echo "Os dados atuais serão SUBSTITUÍDOS pelos do backup."
if [ -n "${CONFIRM_RESTORE:-}" ]; then
  answer="$CONFIRM_RESTORE"
else
  printf 'Digite o nome do banco para confirmar: '
  read -r answer
fi
if [ "$answer" != "$database" ]; then
  echo "Confirmação não confere. Nada foi alterado." >&2
  exit 1
fi

# Sem a aplicação escrevendo no banco durante a restauração.
$COMPOSE stop app >/dev/null

status=0
$COMPOSE exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error' \
  <"$file" || status=$?

$COMPOSE start app >/dev/null

if [ "$status" -ne 0 ]; then
  echo "A restauração falhou. O banco ficou como estava." >&2
  exit "$status"
fi
echo "Restauração concluída. Aplicação religada."
