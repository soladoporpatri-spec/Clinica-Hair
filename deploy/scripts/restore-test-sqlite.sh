#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/barbearia}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RESTORE_TEST_BACKUP_PATH="${RESTORE_TEST_BACKUP_PATH:-}"

if [ -z "$RESTORE_TEST_BACKUP_PATH" ]; then
  RESTORE_TEST_BACKUP_PATH="$(find "$BACKUP_DIR" -name 'agendamentos_*.tar.gz' -type f -printf '%T@ %p\n' | sort -nr | awk 'NR==1 {print $2}')"
fi

if [ -z "$RESTORE_TEST_BACKUP_PATH" ] || [ ! -f "$RESTORE_TEST_BACKUP_PATH" ]; then
  echo "Backup para teste nao encontrado." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

tar -xzf "$RESTORE_TEST_BACKUP_PATH" -C "$tmp_dir"
test -f "$tmp_dir/agendamentos.db"
sqlite3 "$tmp_dir/agendamentos.db" "PRAGMA integrity_check;" | grep -qx "ok"
sqlite3 "$tmp_dir/agendamentos.db" "SELECT count(*) FROM sqlite_master;" >/dev/null

echo "Restore testado com sucesso: $RESTORE_TEST_BACKUP_PATH"
