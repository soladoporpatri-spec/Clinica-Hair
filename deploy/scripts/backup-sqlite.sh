#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/barbearia}"
DB_PATH="${DB_PATH:-$APP_DIR/data/agendamentos.db}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "Banco nao encontrado: $DB_PATH" >&2
  exit 1
fi

stamp="$(date +%Y%m%d_%H%M%S)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
backup_file="$BACKUP_DIR/agendamentos_$stamp.tar.gz"

sqlite3 "$DB_PATH" ".backup '$tmp_dir/agendamentos.db'"
sqlite3 "$tmp_dir/agendamentos.db" "PRAGMA integrity_check;" | grep -qx "ok"
tar -C "$tmp_dir" -czf "$backup_file" agendamentos.db
find "$BACKUP_DIR" -name 'agendamentos_*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup criado: $backup_file"

if [ -n "${OFFSITE_BACKUP_TARGET:-}" ]; then
  SOURCE_BACKUP="$backup_file" "$APP_DIR/deploy/scripts/backup-offsite.sh"
fi
