#!/usr/bin/env bash
set -euo pipefail

GITEA_USER="13689547720"
GITEA_PASS="REDACTED_CONFIGURE_LOCALLY"
GITEA_API="http://127.0.0.1:3001/api/v1"
GITEA_HTTP="http://${GITEA_USER}:${GITEA_PASS}@127.0.0.1:3001/${GITEA_USER}"
BUNDLE_ARCHIVE="/home/REDACTED_CONFIGURE_LOCALLY/infini-app-bundles.tgz"

repos=(admin-web coach-web server tv-android ops-web download-web)
base="/tmp/infini-gitea-import-$(date +%Y%m%d%H%M%S)"
mkdir -p "$base/bundles" "$base/work"
tar -xzf "$BUNDLE_ARCHIVE" -C "$base/bundles"

for repo in "${repos[@]}"; do
  echo "=== REPO: $repo ==="
  create_body="$base/create-$repo.json"
  curl -sS -u "$GITEA_USER:$GITEA_PASS" \
    -H "Content-Type: application/json" \
    -X POST "$GITEA_API/user/repos" \
    -d "{\"name\":\"$repo\",\"private\":true,\"auto_init\":false,\"description\":\"Infini $repo\"}" \
    > "$create_body" || true

  if grep -q '"id"' "$create_body"; then
    echo "created"
  elif grep -qi 'already' "$create_body"; then
    echo "exists"
  else
    cat "$create_body"
    echo
  fi

  git clone "$base/bundles/infini-$repo.bundle" "$base/work/$repo"
  cd "$base/work/$repo"
  git remote add gitea "$GITEA_HTTP/$repo.git"
  git push -u gitea main
  git ls-remote gitea refs/heads/main
  cd /home/REDACTED_CONFIGURE_LOCALLY
done

echo "=== ALL_DONE ==="
echo "$base"
