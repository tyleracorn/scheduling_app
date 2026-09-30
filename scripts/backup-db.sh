#!/usr/bin/env sh
# Daily Postgres dump into the backups dataset (same tree Cloud Sync pushes off-box).
#
# Usage (from the compose project directory on the NAS):
#   BACKUP_DIR=/mnt/tank/apps/cabin-scheduling/backups \
#     COMPOSE_FILE=docker-compose.nas.yml \
#     ./scripts/backup-db.sh
#
# Env (all optional):
#   BACKUP_DIR     Parent backups folder (default: ./data/exports)
#   COMPOSE_FILE   Compose file (default: docker-compose.nas.yml)
#   POSTGRES_USER  DB user (default: cabin)
#   POSTGRES_DB    DB name (default: cabin_scheduling)
#   KEEP_DAYS      How many dated dumps to keep (default: 14)

set -e

BACKUP_DIR="${BACKUP_DIR:-./data/exports}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.nas.yml}"
POSTGRES_USER="${POSTGRES_USER:-cabin}"
POSTGRES_DB="${POSTGRES_DB:-cabin_scheduling}"
KEEP_DAYS="${KEEP_DAYS:-14}"

DB_DIR="${BACKUP_DIR}/db"
mkdir -p "${DB_DIR}"

STAMP="$(date -u +%Y-%m-%d)"
DATED="${DB_DIR}/cabin_${STAMP}.sql"
LATEST="${DB_DIR}/cabin_latest.sql"

echo "Writing ${DATED}"
docker compose -f "${COMPOSE_FILE}" exec -T db \
  pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${DATED}"

cp "${DATED}" "${LATEST}"
echo "Updated ${LATEST}"

# Prune dated dumps older than KEEP_DAYS (never delete cabin_latest.sql).
# Prefer find -mtime; fall back to leaving files if find is unavailable.
if command -v find >/dev/null 2>&1; then
  find "${DB_DIR}" -maxdepth 1 -type f -name 'cabin_????-??-??.sql' -mtime "+${KEEP_DAYS}" -delete
fi

echo "Backup complete."
