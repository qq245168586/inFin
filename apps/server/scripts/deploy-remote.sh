#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/infini-platform-refactor/apps/server"
ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-server-app.tgz"
BACKUP_DIR="/home/REDACTED_CONFIGURE_LOCALLY/deploy-backups/server-nest-$(date +%Y%m%d-%H%M%S)"
SERVER_ENTRY="node .*dist/main.js|node dist/main.js"
LOG_FILE="/home/REDACTED_CONFIGURE_LOCALLY/infini-server.log"
SYSTEMD_SERVICE="infini-platform.service"

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
tar -czf "$BACKUP_DIR/apps-server-code.tgz" package.json pnpm-lock.yaml tsconfig.json API.md openapi.json src dist
tar -xzf "$ARCHIVE" -C "$APP_DIR"

cd "$APP_DIR"
load_systemd_env_file "/home/REDACTED_CONFIGURE_LOCALLY/oss.conf"
load_systemd_env_file "/home/REDACTED_CONFIGURE_LOCALLY/infini-platform-mqtt-client.conf"
load_systemd_env_file "/home/REDACTED_CONFIGURE_LOCALLY/infini-media-delivery.conf"
export PORT="${PORT:-3100}"
export INFINI_DATA_ROOT="${INFINI_DATA_ROOT:-/home/REDACTED_CONFIGURE_LOCALLY/infini-data}"
export MQTT_CLIENT_HTTP_URL="${MQTT_CLIENT_HTTP_URL:-http://127.0.0.1:3205}"
export MQTT_CLIENT_FALLBACK_DIRECT="${MQTT_CLIENT_FALLBACK_DIRECT:-1}"
export INFINI_MEDIA_X_ACCEL_PREFIX="${INFINI_MEDIA_X_ACCEL_PREFIX:-}"

if systemctl cat "$SYSTEMD_SERVICE" >/dev/null 2>&1; then
  sudo mkdir -p "/etc/systemd/system/${SYSTEMD_SERVICE}.d"
  printf '[Service]\nEnvironment=INFINI_MEDIA_X_ACCEL_PREFIX=%s\n' "$INFINI_MEDIA_X_ACCEL_PREFIX" \
    | sudo tee "/etc/systemd/system/${SYSTEMD_SERVICE}.d/media-delivery.conf" >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl restart "$SYSTEMD_SERVICE"
else
  OLD_PIDS="$(pgrep -f "$SERVER_ENTRY" || true)"
  if [ -n "$OLD_PIDS" ]; then
    kill $OLD_PIDS
    sleep 2
  fi
  nohup env \
    PORT="$PORT" \
    INFINI_DATA_ROOT="$INFINI_DATA_ROOT" \
    INFINI_MEDIA_X_ACCEL_PREFIX="$INFINI_MEDIA_X_ACCEL_PREFIX" \
    node dist/main.js > "$LOG_FILE" 2>&1 &
fi

for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3100/api/health; then
    echo
    if systemctl is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
      NEW_PID="$(systemctl show -p MainPID --value "$SYSTEMD_SERVICE")"
    else
      NEW_PID="$(pgrep -f "$SERVER_ENTRY" | head -1 || true)"
    fi
    echo "SERVER_DEPLOY_OK pid=$NEW_PID backup=$BACKUP_DIR"
    exit 0
  fi
  sleep 1
done

echo "SERVER_DEPLOY_FAILED: health check did not recover"
if systemctl is-active --quiet "$SYSTEMD_SERVICE" 2>/dev/null; then
  sudo journalctl -u "$SYSTEMD_SERVICE" -n 80 --no-pager || true
else
  tail -80 "$LOG_FILE" || true
fi
exit 1
