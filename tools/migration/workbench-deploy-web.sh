#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:?App directory is required}"
SITE="${2:?Web site is required}"
INSTANCE_ID="${INFINI_INSTANCE_ID:-i-bp1gy4to0n4dh5gk7tuw}"
case "$SITE" in admin|course|coach|ops|download|course/simulator) ;; *) echo "Unsupported Infini site: $SITE" >&2; exit 2 ;; esac
STAMP="$(date +%Y%m%d-%H%M%S)-$$"
ARCHIVE="$(mktemp "/tmp/infini-web-${STAMP}.XXXXXX.tgz")"
REMOTE_ARCHIVE="/var/tmp/infini-web-${STAMP}.tgz"
trap 'rm -f "$ARCHIVE"' EXIT

cd "$APP_DIR"
if [[ "$SITE" == download ]]; then
  COPYFILE_DISABLE=1 tar -czf "$ARCHIVE" index.html main.js styles.css
else
  if [[ -n "$(node -p 'Boolean(JSON.parse(require("fs").readFileSync("package.json","utf8")).scripts.test) ? "yes" : ""')" ]]; then
    pnpm test
  fi
  VITE_BASE_PATH="/infini/${SITE}/" VITE_API_BASE_PATH=/infini pnpm run build
  COPYFILE_DISABLE=1 tar -C dist -czf "$ARCHIVE" .
fi
workbench exec -i "$INSTANCE_ID" -c "test ! -e '$REMOTE_ARCHIVE'"
workbench upload "$ARCHIVE" "$REMOTE_ARCHIVE" -i "$INSTANCE_ID"
workbench exec -i "$INSTANCE_ID" -c "set -eu; install -d /var/lib/infini/deploy-backups; if [ -f '/var/www/infini/$SITE/index.html' ]; then tar -C '/var/www/infini/$SITE' -czf '/var/lib/infini/deploy-backups/web-${SITE//\//-}-${STAMP}.tgz' .; fi; install -d '/var/www/infini/$SITE'; tar -xzf '$REMOTE_ARCHIVE' -C '/var/www/infini/$SITE'; chown -R infini:nginx '/var/www/infini/$SITE'; chmod -R a+rX '/var/www/infini/$SITE'; nginx -t"
curl --fail --silent --show-error "https://114.215.185.184/infini/${SITE}/" >/dev/null
echo "Deployed $SITE to $INSTANCE_ID"
