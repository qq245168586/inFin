#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="/tmp/infini-admin-web-dist.tgz"
REMOTE_USER_HOST="REDACTED_CONFIGURE_LOCALLY@8.130.65.113"
REMOTE_ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-admin-web-dist.tgz"
REMOTE_WEB_ROOT="/var/www/infini-admin"
REMOTE_NGINX_CONF="/etc/nginx/sites-enabled/infini-platform"

echo "[admin-web] building..."
cd "$APP_DIR"
if [ "${INFINI_ENV:-production}" != "production" ]; then
  echo "[admin-web] refusing deploy because INFINI_ENV=${INFINI_ENV:-} is not production" >&2
  exit 1
fi
npm run build:production

echo "[admin-web] packaging..."
COPYFILE_DISABLE=1 tar -C "$APP_DIR/dist" -czf "$ARCHIVE_PATH" .

echo "[admin-web] uploading archive..."
scp "$ARCHIVE_PATH" "$REMOTE_USER_HOST:$REMOTE_ARCHIVE"

echo "[admin-web] deploying on server..."
ssh -tt "$REMOTE_USER_HOST" "bash -lc '
  set -euo pipefail
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S mkdir -p \"$REMOTE_WEB_ROOT\"
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S chown -R REDACTED_CONFIGURE_LOCALLY:REDACTED_CONFIGURE_LOCALLY \"$REMOTE_WEB_ROOT\"
  tar -xzf \"$REMOTE_ARCHIVE\" -C \"$REMOTE_WEB_ROOT\"
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S nginx -t
  echo REDACTED_CONFIGURE_LOCALLY | sudo -S systemctl reload nginx
'"

echo "[admin-web] done."
