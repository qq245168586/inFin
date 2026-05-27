#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/infini-platform-refactor/apps/server"
ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-server-app.tgz"
BACKUP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/deploy-backups/server-nest-$(date +%Y%m%d-%H%M%S)"
SERVER_ENTRY="node .*dist/main.js|node dist/main.js"
LOG_FILE="/home/REDACTED_CONFIGURE_LOCALLY/infini-server.log"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"
tar -czf "$BACKUP_DIR/apps-server-code.tgz" package.json package-lock.json tsconfig.json API.md openapi.json src dist
tar -xzf "$ARCHIVE" -C "$APP_DIR"

OLD_PID="$(pgrep -f "$SERVER_ENTRY" | head -1 || true)"
if [ -n "$OLD_PID" ]; then
  kill "$OLD_PID"
  sleep 2
fi

cd "$APP_DIR"
nohup env PORT=3100 INFINI_DATA_ROOT=/home/REDACTED_CONFIGURE_LOCALLY/infini-data node dist/main.js > "$LOG_FILE" 2>&1 &
sleep 2

NEW_PID="$(pgrep -f "$SERVER_ENTRY" | head -1 || true)"
if [ -z "$NEW_PID" ]; then
  echo "SERVER_DEPLOY_FAILED: process not running"
  tail -80 "$LOG_FILE" || true
  exit 1
fi

curl -fsS http://127.0.0.1:3100/api/health
echo
echo "SERVER_DEPLOY_OK pid=$NEW_PID backup=$BACKUP_DIR"
