#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTANCE_ID="${INFINI_INSTANCE_ID:-i-bp1gy4to0n4dh5gk7tuw}"
STAMP="$(date +%Y%m%d-%H%M%S)-$$"
ARCHIVE="$(mktemp "/tmp/infini-runtime-${STAMP}.XXXXXX.tgz")"
REMOTE_ARCHIVE="/var/tmp/infini-runtime-${STAMP}.tgz"
trap 'rm -f "$ARCHIVE"' EXIT
cd "$ROOT_DIR/apps/server"
pnpm test
pnpm run build
cd "$ROOT_DIR"
COPYFILE_DISABLE=1 tar --no-xattrs -czf "$ARCHIVE" \
  apps/server/package.json apps/server/pnpm-lock.yaml apps/server/src apps/server/dist \
  apps/mqtt-client/package.json apps/mqtt-client/pnpm-lock.yaml apps/mqtt-client/src \
  packages/shared
workbench exec -i "$INSTANCE_ID" -c "test ! -e '$REMOTE_ARCHIVE'"
workbench upload "$ARCHIVE" "$REMOTE_ARCHIVE" -i "$INSTANCE_ID"
workbench exec -i "$INSTANCE_ID" --timeout 120 -c "set -eu; test -s /var/lib/infini/db.json; install -d /var/lib/infini/deploy-backups; tar -C /srv/infini-platform -czf '/var/lib/infini/deploy-backups/runtime-${STAMP}.tgz' apps/server/package.json apps/server/pnpm-lock.yaml apps/server/src apps/server/dist apps/mqtt-client/src packages/shared; tar -xzf '$REMOTE_ARCHIVE' -C /srv/infini-platform; chown -R infini:infini /srv/infini-platform; cd /srv/infini-platform/apps/server; runuser -u infini -- pnpm install --prod --frozen-lockfile; cd /srv/infini-platform/apps/mqtt-client; runuser -u infini -- pnpm install --prod --frozen-lockfile; systemctl restart infini-platform infini-mqtt-client; for attempt in \$(seq 1 20); do if curl -fsS http://127.0.0.1:3100/api/health; then exit 0; fi; sleep 1; done; journalctl -u infini-platform -n 50 --no-pager; exit 1"
curl --fail --silent --show-error https://114.215.185.184/infini/api/health
