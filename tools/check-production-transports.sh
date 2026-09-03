#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

targets=(
  "$ROOT_DIR/apps/tv-android/app/build.gradle"
  "$ROOT_DIR/apps/server/.env.example"
  "$ROOT_DIR/apps/server/openapi.json"
  "$ROOT_DIR/apps/server/scripts/check-mqtt-wss.sh"
  "$ROOT_DIR/apps/server/scripts/monitor-server.sh"
  "$ROOT_DIR/apps/download-web/main.js"
)

forbidden='http://8\.130\.65\.113|tcp://|mqtt://|ws://|MQTT_PORT=1883'
if rg -n "$forbidden" "${targets[@]}"; then
  echo "Production transport check failed: insecure endpoint found." >&2
  exit 1
fi

tv_production_block="$(sed -n '/^  production)/,/^    ;;/p' "$ROOT_DIR/apps/tv-android/tools/build-env-apk.sh")"
if printf '%s\n' "$tv_production_block" | rg -n "$forbidden"; then
  echo "Production transport check failed: insecure TV production endpoint found." >&2
  exit 1
fi

if ! rg -q 'wss://api\.infintraining\.work/mqtt' \
  "$ROOT_DIR/apps/tv-android/app/build.gradle" \
  "$ROOT_DIR/apps/server/.env.example"; then
  echo "Production transport check failed: WSS/443 endpoint is missing." >&2
  exit 1
fi

nginx_http_block="$(sed -n '1,25p' "$ROOT_DIR/apps/ops-web/scripts/infini-platform.nginx.conf")"
if printf '%s\n' "$nginx_http_block" | rg -q 'proxy_pass'; then
  echo "Production transport check failed: port 80 still proxies application traffic." >&2
  exit 1
fi
if ! printf '%s\n' "$nginx_http_block" | rg -q 'return 301 https://\$host\$request_uri'; then
  echo "Production transport check failed: HTTP to HTTPS redirect is missing." >&2
  exit 1
fi

emqx_config="$ROOT_DIR/apps/ops-web/scripts/infini-emqx-listeners.conf"
if ! rg -q -U 'listeners\.tcp\.default \{[\s\S]*?bind = 0[\s\S]*?enabled = false' "$emqx_config" || \
   ! rg -q -U 'listeners\.ws\.default \{[\s\S]*?bind = "127\.0\.0\.1:8083"' "$emqx_config"; then
  echo "Production transport check failed: EMQX must disable TCP and bind WS to loopback." >&2
  exit 1
fi

echo "Production transport check passed: HTTPS/WSS only."
