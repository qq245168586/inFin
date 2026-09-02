#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="/tmp/infini-download-web-dist.tgz"
REMOTE_USER_HOST="REDACTED_CONFIGURE_LOCALLY@8.130.65.113"
REMOTE_ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-download-web-dist.tgz"
REMOTE_WEB_ROOT="/var/www/infini-download"

echo "[download-web] packaging..."
COPYFILE_DISABLE=1 tar -C "$APP_DIR" -czf "$ARCHIVE_PATH" .

echo "[download-web] uploading archive..."
scp "$ARCHIVE_PATH" "$REMOTE_USER_HOST:$REMOTE_ARCHIVE"

echo "[download-web] deploying on server..."
ssh -tt "$REMOTE_USER_HOST" "bash -lc '
  set -euo pipefail
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S mkdir -p \"$REMOTE_WEB_ROOT\"
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S chown -R REDACTED_CONFIGURE_LOCALLY:REDACTED_CONFIGURE_LOCALLY \"$REMOTE_WEB_ROOT\"
  tar -xzf \"$REMOTE_ARCHIVE\" -C \"$REMOTE_WEB_ROOT\"
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S nginx -t
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S systemctl reload nginx
'"

echo "[download-web] done."
