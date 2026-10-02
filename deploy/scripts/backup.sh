#!/usr/bin/env sh
# Backup do banco de produção com pg_dump.
#
# Uso, na raiz do projeto:
#   sh deploy/scripts/backup.sh
#
# Gera backups/varejista-AAAAMMDD-HHMMSS.dump (formato "custom" do
# PostgreSQL, compactado). Não apaga nem altera nada no banco. Backups antigos
# também não são apagados: a limpeza é decisão de quem opera.
#
# Variáveis opcionais:
#   ENV_FILE    arquivo de variáveis (padrão: .env.production)
#   BACKUP_DIR  pasta de destino (padrão: backups)
set -eu

ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
COMPOSE="docker compose --env-file $ENV_FILE -f compose.production.yaml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo de variáveis não encontrado: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

file="$BACKUP_DIR/varejista-$(date +%Y%m%d-%H%M%S).dump"
partial="$file.parcial"

# O dump é feito dentro do contêiner do banco e sai pela saída padrão. Só vira
# o arquivo final depois de completo, para nunca sobrar um backup pela metade
# com nome de backup bom.
if ! $COMPOSE exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  >"$partial"; then
  rm -f "$partial"
  echo "Falha ao gerar o backup." >&2
  exit 1
fi

if [ ! -s "$partial" ]; then
  rm -f "$partial"
  echo "O backup saiu vazio; nada foi salvo." >&2
  exit 1
fi

# Confere se o arquivo é um dump legível antes de aceitá-lo.
if ! $COMPOSE exec -T db pg_restore --list <"$partial" >/dev/null; then
  rm -f "$partial"
  echo "O backup gerado não pôde ser lido; nada foi salvo." >&2
  exit 1
fi

mv "$partial" "$file"
chmod 600 "$file" 2>/dev/null || true
echo "Backup salvo em $file ($(wc -c <"$file" | tr -d ' ') bytes)"
