#!/usr/bin/env bash
set -euo pipefail

MQTT_URL="${MQTT_URL:-wss://api.infintraining.work/mqtt}"
TCP_HOST="${TCP_HOST:-8.130.65.113}"
TCP_PORT="${TCP_PORT:-1883}"

if command -v npx >/dev/null 2>&1; then
  now="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
  npx --yes mqtt@5.14.1 pub -l "$MQTT_URL" -t "infini/ops/check" -m "{\"source\":\"check-mqtt-wss\",\"at\":\"$now\"}" >/dev/null
  printf 'MQTT_WSS_OK url=%s\n' "$MQTT_URL"
else
  printf 'SKIP_WSS_CHECK npx not found\n'
fi

if command -v nc >/dev/null 2>&1; then
  nc -z -w 3 "$TCP_HOST" "$TCP_PORT"
  printf 'MQTT_TCP_1883_OK host=%s port=%s\n' "$TCP_HOST" "$TCP_PORT"
else
  printf 'SKIP_TCP_CHECK nc not found\n'
fi
