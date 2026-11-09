#!/usr/bin/env bash
# Copia la base de datos de la NUBE a tu PostgreSQL LOCAL.
# La nube solo se lee; lo local se reemplaza por una copia exacta.
#
# Requisitos:
#   - Sat Escolar Backend/.env.cloud  con DATABASE_URL (nube)
#   - Sat Escolar Backend/.env         con PG* (local)
#
# Uso: ./scripts/db-sync-cloud-to-local.sh   (o: npm run db:sync)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/Sat Escolar Backend"
CLOUD_ENV="$BACKEND_DIR/.env.cloud"
LOCAL_ENV="$BACKEND_DIR/.env"
BACKUP_DIR="$ROOT_DIR/backups"
FECHA="$(date +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/cloud_$FECHA.dump"

[ -f "$CLOUD_ENV" ] || { echo "ERROR: falta $CLOUD_ENV (DATABASE_URL de la nube)."; exit 1; }
[ -f "$LOCAL_ENV" ] || { echo "ERROR: falta $LOCAL_ENV (credenciales locales)."; exit 1; }

mkdir -p "$BACKUP_DIR"

# 1) Cargar credenciales de la nube
set -a; . "$CLOUD_ENV"; set +a
CLOUD_URL="${DATABASE_URL:?Define DATABASE_URL en .env.cloud}"
unset DATABASE_URL

# 2) Cargar credenciales locales
set -a; . "$LOCAL_ENV"; set +a
export PGPASSWORD="${PGPASSWORD:-}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-sat_escolar}"

echo "1/4 Descargando respaldo de la nube..."
pg_dump "$CLOUD_URL" --no-owner --no-privileges -Fc -f "$DUMP"
echo "    OK: $DUMP"

echo "2/4 Respaldando la base local actual (por si acaso)..."
LOCAL_SAFE="$BACKUP_DIR/local_$FECHA.dump"
if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --no-owner --no-privileges -Fc "$PGDATABASE" -f "$LOCAL_SAFE" 2>/dev/null; then
  echo "    OK: $LOCAL_SAFE"
else
  echo "    (no se pudo respaldar la base local; se continua)"
  rm -f "$LOCAL_SAFE"
fi

echo "3/4 Recreando la base local '$PGDATABASE'..."
dropdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" --if-exists "$PGDATABASE"
createdb -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -T template0 "$PGDATABASE"

echo "4/4 Restaurando la copia de la nube en local..."
pg_restore -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-privileges "$DUMP"

echo ""
echo "Listo. La base local '$PGDATABASE' ahora es una copia de la nube."
echo "Arranca el sistema con: ./scripts/dev.sh"
