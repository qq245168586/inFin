#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="test"

if [[ "${1:-}" == "--coverage" ]]; then
  MODE="coverage"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_DIR="${INFINI_TEST_REPORT_DIR:-$ROOT_DIR/outputs/test-results/$STAMP}"
mkdir -p "$REPORT_DIR"

STATUS_FILE="$REPORT_DIR/status.tsv"
: > "$STATUS_FILE"

run_step() {
  local name="$1"
  local cwd="$2"
  shift 2
  local log_file="$REPORT_DIR/$name.log"

  echo "==> [$name] $*" | tee "$log_file"
  (
    cd "$cwd" || exit 1
    "$@"
  ) 2>&1 | tee -a "$log_file"
  local status="${PIPESTATUS[0]}"

  if [[ "$status" -eq 0 ]]; then
    printf "%s\tPASS\t%s\n" "$name" "$log_file" >> "$STATUS_FILE"
  else
    printf "%s\tFAIL\t%s\n" "$name" "$log_file" >> "$STATUS_FILE"
  fi

  return "$status"
}

overall=0

if [[ "$MODE" == "coverage" ]]; then
  run_step "server" "$ROOT_DIR/apps/server" npm run test:coverage || overall=1
  run_step "course-web" "$ROOT_DIR/apps/course-web" npm run test:coverage || overall=1
  run_step "coach-web" "$ROOT_DIR/apps/coach-web" npm run test:coverage || overall=1
  run_step "tv-android" "$ROOT_DIR/apps/tv-android" ./gradlew testDebugUnitTest jacocoDebugUnitTestReport || overall=1
else
  run_step "server" "$ROOT_DIR/apps/server" npm run test || overall=1
  run_step "course-web" "$ROOT_DIR/apps/course-web" npm run test || overall=1
  run_step "coach-web" "$ROOT_DIR/apps/coach-web" npm run test || overall=1
  run_step "tv-android" "$ROOT_DIR/apps/tv-android" ./gradlew testDebugUnitTest || overall=1
fi

node "$ROOT_DIR/tools/generate-test-report.mjs" "$REPORT_DIR" "$MODE"

echo
echo "Test report: $REPORT_DIR/test-report.md"
exit "$overall"
