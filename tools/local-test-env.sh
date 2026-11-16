#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_IP="${INFINI_LOCAL_IP:-}"

if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="$(ipconfig getifaddr en1 2>/dev/null || true)"
fi
if [ -z "$LOCAL_IP" ]; then
  echo "Could not detect local IP. Run with INFINI_LOCAL_IP=192.168.x.x." >&2
  exit 1
fi

API_PORT="${INFINI_LOCAL_API_PORT:-3100}"
MQTT_PORT="${INFINI_LOCAL_MQTT_PORT:-1883}"
ADMIN_PORT="${INFINI_LOCAL_ADMIN_PORT:-5173}"
COACH_PORT="${INFINI_LOCAL_COACH_PORT:-5174}"
COURSE_PORT="${INFINI_LOCAL_COURSE_PORT:-5175}"

cat <<INFO
Infini local test environment

LAN IP:
  ${LOCAL_IP}

Start server:
  cd "${ROOT_DIR}/apps/server"
  HOST=0.0.0.0 PORT=${API_PORT} MQTT_URL=tcp://127.0.0.1:${MQTT_PORT} MQTT_WSS_URL=tcp://127.0.0.1:${MQTT_PORT} pnpm run dev

Start web apps:
  cd "${ROOT_DIR}/apps/admin-web"  && VITE_DEV_HOST=0.0.0.0 VITE_DEV_API_PROXY=http://127.0.0.1:${API_PORT} pnpm run dev -- --port ${ADMIN_PORT}
  cd "${ROOT_DIR}/apps/coach-web"  && VITE_DEV_HOST=0.0.0.0 VITE_DEV_API_PROXY=http://127.0.0.1:${API_PORT} pnpm run dev -- --port ${COACH_PORT}
  cd "${ROOT_DIR}/apps/course-web" && VITE_DEV_HOST=0.0.0.0 VITE_DEV_API_PROXY=http://127.0.0.1:${API_PORT} pnpm run dev -- --port ${COURSE_PORT}

Open from phone:
  Admin:  http://${LOCAL_IP}:${ADMIN_PORT}
  Coach:  http://${LOCAL_IP}:${COACH_PORT}
  Course: http://${LOCAL_IP}:${COURSE_PORT}

Build local TV APK:
  cd "${ROOT_DIR}/apps/tv-android"
  INFINI_LOCAL_IP=${LOCAL_IP} INFINI_LOCAL_API_PORT=${API_PORT} INFINI_LOCAL_MQTT_PORT=${MQTT_PORT} tools/build-env-apk.sh local

TV local endpoints:
  API:  http://${LOCAL_IP}:${API_PORT}/api
  MQTT: tcp://${LOCAL_IP}:${MQTT_PORT}

Production builds stay explicit:
  web deploy scripts refuse non-production INFINI_ENV
  TV production build: tools/build-env-apk.sh production assembleRelease
INFO
