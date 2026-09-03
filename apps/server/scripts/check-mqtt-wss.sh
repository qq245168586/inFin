#!/usr/bin/env bash
set -euo pipefail

MQTT_URL="${MQTT_URL:-wss://api.infintraining.work/mqtt}"

if command -v npx >/dev/null 2>&1; then
  now="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
  npx --yes mqtt@5.14.1 pub -l "$MQTT_URL" -t "infini/ops/check" -m "{\"source\":\"check-mqtt-wss\",\"at\":\"$now\"}" >/dev/null
  printf 'MQTT_WSS_OK url=%s\n' "$MQTT_URL"
else
  printf 'SKIP_WSS_CHECK npx not found\n'
fi
