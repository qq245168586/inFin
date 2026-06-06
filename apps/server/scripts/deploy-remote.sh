#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/infini-platform-refactor/apps/server"
ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-server-app.tgz"
BACKUP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/deploy-backups/server-nest-$(date +%Y%m%d-%H%M%S)"
SERVER_ENTRY="node .*dist/main.js|node dist/main.js"
LOG_FILE="/home/REDACTED_CONFIGURE_LOCALLY/infini-server.log"

load_systemd_env_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return
  fi

  while IFS= read -r line; do
    case "$line" in
      Environment=*)
        export "${line#Environment=}"
        ;;
    esac
  done < "$file"
}

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
load_systemd_env_file "/home/REDACTED_CONFIGURE_LOCALLY/oss.conf"
load_systemd_env_file "/home/REDACTED_CONFIGURE_LOCALLY/infini-platform-mqtt-client.conf"
export PORT="${PORT:-3100}"
export INFINI_DATA_ROOT="${INFINI_DATA_ROOT:-/home/REDACTED_CONFIGURE_LOCALLY/infini-data}"
export MQTT_CLIENT_HTTP_URL="${MQTT_CLIENT_HTTP_URL:-http://127.0.0.1:3205}"
export MQTT_CLIENT_FALLBACK_DIRECT="${MQTT_CLIENT_FALLBACK_DIRECT:-1}"

nohup env PORT="$PORT" INFINI_DATA_ROOT="$INFINI_DATA_ROOT" node dist/main.js > "$LOG_FILE" 2>&1 &
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
