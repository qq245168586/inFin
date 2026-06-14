#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_NAME="${1:-}"
BUILD_TASK="${2:-assembleDebug}"

usage() {
  cat <<'USAGE'
Usage:
  tools/build-env-apk.sh local [assembleDebug|assembleRelease]
  tools/build-env-apk.sh production [assembleDebug|assembleRelease]

Local environment variables:
  INFINI_LOCAL_IP        Required for local. Example: 192.168.1.23
  INFINI_LOCAL_API_PORT  Optional, default 3100
  INFINI_LOCAL_MQTT_PORT Optional, default 1883
USAGE
}

if [ -z "$ENV_NAME" ]; then
  usage
  exit 1
fi

cd "$APP_DIR"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$APP_DIR/.gradle-home}"

case "$ENV_NAME" in
  local)
    if [ -z "${INFINI_LOCAL_IP:-}" ]; then
      echo "INFINI_LOCAL_IP is required for local TV build." >&2
      echo "Example: INFINI_LOCAL_IP=192.168.1.23 tools/build-env-apk.sh local" >&2
      exit 1
    fi
    API_PORT="${INFINI_LOCAL_API_PORT:-3100}"
    MQTT_PORT="${INFINI_LOCAL_MQTT_PORT:-1883}"
    ./gradlew ":app:${BUILD_TASK}" \
      -PinfiniEnv=local \
      -PinfiniBaseUrl="http://${INFINI_LOCAL_IP}:${API_PORT}" \
      -PinfiniBackupBaseUrl="http://${INFINI_LOCAL_IP}:${API_PORT}" \
      -PinfiniMqttPrimaryUrl="tcp://${INFINI_LOCAL_IP}:${MQTT_PORT}" \
      -PinfiniMqttBackupUrl="tcp://${INFINI_LOCAL_IP}:${MQTT_PORT}"
    ;;
  production)
    ./gradlew ":app:${BUILD_TASK}" \
      -PinfiniEnv=production \
      -PinfiniBaseUrl="https://api.infintraining.work" \
      -PinfiniBackupBaseUrl="http://8.130.65.113" \
      -PinfiniMqttPrimaryUrl="wss://api.infintraining.work/mqtt" \
      -PinfiniMqttBackupUrl="tcp://8.130.65.113:1883"
    ;;
  *)
    usage
    exit 1
    ;;
esac
