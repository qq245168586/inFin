#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="/tmp/infini-websimulator-dist.tgz"
REMOTE_USER_HOST="REDACTED_CONFIGURE_LOCALLY@8.130.65.113"
REMOTE_ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-websimulator-dist.tgz"
REMOTE_WEB_ROOT="/var/www/infini-course/simulator"

echo "[websimulator] building..."
cd "$APP_DIR"
if [[ -x "$APP_DIR/../../node_modules/.bin/vite" ]]; then
  "$APP_DIR/../../node_modules/.bin/vite" build
else
  pnpm run build
fi

echo "[websimulator] packaging..."
COPYFILE_DISABLE=1 tar -C "$APP_DIR/dist" -czf "$ARCHIVE_PATH" .

echo "[websimulator] uploading archive..."
scp "$ARCHIVE_PATH" "$REMOTE_USER_HOST:$REMOTE_ARCHIVE"

echo "[websimulator] deploying on server..."
ssh -tt "$REMOTE_USER_HOST" "bash -lc '
  set -euo pipefail
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S mkdir -p \"$REMOTE_WEB_ROOT\"
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S chown -R REDACTED_CONFIGURE_LOCALLY:REDACTED_CONFIGURE_LOCALLY \"$REMOTE_WEB_ROOT\"
  tar -xzf \"$REMOTE_ARCHIVE\" -C \"$REMOTE_WEB_ROOT\"
'"

echo "[websimulator] done."
