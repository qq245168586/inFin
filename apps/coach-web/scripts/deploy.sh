#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bash "$APP_DIR/../../tools/migration/workbench-deploy-web.sh" "$APP_DIR" "coach"
