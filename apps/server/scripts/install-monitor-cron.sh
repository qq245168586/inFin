#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/infini-platform/apps/server}"
LOG_FILE="${LOG_FILE:-/var/lib/infini/monitor.log}"
CRON_LINE="*/1 * * * * cd $APP_DIR && bash scripts/monitor-server.sh >> $LOG_FILE 2>&1"

existing="$(mktemp)"
crontab -l > "$existing" 2>/dev/null || true

if grep -Fq "scripts/monitor-server.sh" "$existing"; then
  sed "s#.*scripts/monitor-server.sh.*#$CRON_LINE#" "$existing" | crontab -
else
  {
    cat "$existing"
    printf '%s\n' "$CRON_LINE"
  } | crontab -
fi

rm -f "$existing"
printf 'MONITOR_CRON_OK %s\n' "$CRON_LINE"
