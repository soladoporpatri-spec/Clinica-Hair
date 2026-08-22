#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/barbearia}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
SOURCE_BACKUP="${SOURCE_BACKUP:-}"
OFFSITE_BACKUP_TARGET="${OFFSITE_BACKUP_TARGET:-}"
OFFSITE_BACKUP_METHOD="${OFFSITE_BACKUP_METHOD:-rsync}"

if [ -z "$OFFSITE_BACKUP_TARGET" ]; then
  echo "OFFSITE_BACKUP_TARGET nao configurado; backup externo ignorado."
  exit 0
fi

if [ -z "$SOURCE_BACKUP" ]; then
  SOURCE_BACKUP="$(find "$BACKUP_DIR" -name 'agendamentos_*.tar.gz' -type f -printf '%T@ %p\n' | sort -nr | awk 'NR==1 {print $2}')"
fi

if [ -z "$SOURCE_BACKUP" ] || [ ! -f "$SOURCE_BACKUP" ]; then
  echo "Nenhum backup local encontrado para envio externo." >&2
  exit 1
fi

case "$OFFSITE_BACKUP_METHOD" in
  rsync)
    command -v rsync >/dev/null 2>&1 || { echo "rsync nao instalado." >&2; exit 1; }
    rsync -av --chmod=F600 "$SOURCE_BACKUP" "$OFFSITE_BACKUP_TARGET/"
    ;;
  rclone)
    command -v rclone >/dev/null 2>&1 || { echo "rclone nao instalado." >&2; exit 1; }
    rclone copyto "$SOURCE_BACKUP" "$OFFSITE_BACKUP_TARGET/$(basename "$SOURCE_BACKUP")"
    ;;
  *)
    echo "OFFSITE_BACKUP_METHOD invalido: $OFFSITE_BACKUP_METHOD. Use rsync ou rclone." >&2
    exit 1
    ;;
esac

echo "Backup externo enviado: $(basename "$SOURCE_BACKUP") -> $OFFSITE_BACKUP_TARGET"
