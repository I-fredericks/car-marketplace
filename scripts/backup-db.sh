#!/usr/bin/env bash
# Daily MySQL backup with rotation. Intended to run from cron:
#   0 2 * * *  /path/to/car-marketplace/scripts/backup-db.sh >> /var/log/carmarket-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
CONTAINER="${DB_CONTAINER:-carmarket-mysql}"   # docker container name, or empty for local mysql

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/carmarket_${STAMP}.sql.gz"

if [ -n "$CONTAINER" ] && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
  docker exec "$CONTAINER" sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers carmarketplace' | gzip > "$FILE"
elif command -v mysqldump >/dev/null 2>&1; then
  mysqldump --single-transaction --routines --triggers "${DB_NAME:-carmarketplace}" | gzip > "$FILE"
else
  echo "[$(date)] no mysqldump available and container '$CONTAINER' not running" >&2
  exit 1
fi

echo "[$(date)] wrote $FILE ($(du -h "$FILE" | cut -f1))"

# Rotate old backups
find "$BACKUP_DIR" -name 'carmarket_*.sql.gz' -mtime "+$RETAIN_DAYS" -delete
echo "[$(date)] rotated backups older than $RETAIN_DAYS days"
