#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

repos=(
  "."
  "apps/server"
  "apps/course-web"
  "apps/coach-web"
  "apps/tv-android"
)

for repo in "${repos[@]}"; do
  git -C "$ROOT_DIR/$repo" config core.hooksPath .githooks
  echo "Configured $repo -> .githooks"
done
