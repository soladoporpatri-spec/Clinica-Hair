#!/usr/bin/env bash
set -euo pipefail

journalctl -u barbearia-backend -u barbearia-bridge -u barbearia-dashboard -f --no-pager
