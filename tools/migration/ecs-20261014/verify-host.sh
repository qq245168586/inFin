#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://114.215.185.184}"

check_url() {
  local path="$1"
  curl --fail --silent --show-error "${BASE_URL}${path}" >/dev/null
  printf 'OK  %s%s\n' "$BASE_URL" "$path"
}

check_url /infini/api/health
check_url /infini/admin/
check_url /infini/course/
check_url /infini/coach/
check_url /infini/download/
check_url /infini/ops/

echo "Infini path checks passed for ${BASE_URL}."
