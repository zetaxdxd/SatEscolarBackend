#!/usr/bin/env bash
# Respaldo de la base de datos SAT Escolar (ISO 27001 A.8.13).
# Uso local:  ./scripts/backup.sh
# Uso nube:   DATABASE_URL="<external-url>" ./scripts/backup.sh
# Guarda en backups/ y conserva los últimos 7. NO se sube a git.
set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT_DIR/backups"
mkdir -p "$DEST"
FECHA=$(date +%Y%m%d-%H%M%S)

if [ -n "$DATABASE_URL" ]; then
  echo "Respaldando Postgres (DATABASE_URL)..."
  pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL" -f "$DEST/sat_escolar_$FECHA.dump"
else
  # shellcheck disable=SC1091
  set -a; [ -f "$ROOT_DIR/Sat Escolar Backend/.env" ] && . "$ROOT_DIR/Sat Escolar Backend/.env"; set +a
  echo "Respaldando Postgres local ${PGDATABASE:-sat_escolar}..."
  PGPASSWORD="${PGPASSWORD:-}" pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" \
    --no-owner --no-privileges -Fc "${PGDATABASE:-sat_escolar}" -f "$DEST/sat_escolar_$FECHA.dump"
fi

# Retención: conservar los 7 más recientes
ls -1t "$DEST"/sat_escolar_*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "OK: $DEST/sat_escolar_$FECHA.dump"
ls -la "$DEST" | tail -n 8
