#!/usr/bin/env bash
set -euo pipefail

echo "== services =="
systemctl --no-pager --full status nginx barbearia-backend barbearia-bridge barbearia-dashboard barbearia-backup.timer --lines=3 || true

echo
echo "== ports =="
ss -ltnp | grep -E ':(80|443|4000|5000|2999|3001)\b' || true

echo
echo "== memory =="
free -h
ps -eo pid,comm,rss,pmem,pcpu,args --sort=-rss | head -12

echo
echo "== disk =="
df -h / /opt/barbearia || true
du -sh /opt/barbearia/data /opt/barbearia/backups /opt/barbearia/WhatsAppBridge/.wwebjs_auth* 2>/dev/null || true

echo
echo "== health =="
/opt/barbearia/deploy/scripts/healthcheck.sh || true
