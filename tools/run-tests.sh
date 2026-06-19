#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="test"
ALLURE=0

for arg in "$@"; do
  case "$arg" in
    --coverage)
      MODE="coverage"
      ;;
    --allure)
      ALLURE=1
      ;;
  esac
done

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

run_vitest_step() {
  local name="$1"
  local cwd="$2"
  local script="$3"

  if [[ "$ALLURE" -eq 1 ]]; then
    run_step "$name" "$cwd" env INFINI_ALLURE=1 INFINI_ALLURE_RESULTS_DIR="$REPORT_DIR/allure-results/$name" pnpm run "$script"
  else
    run_step "$name" "$cwd" pnpm run "$script"
  fi
}

overall=0

if [[ "$MODE" == "coverage" ]]; then
  run_vitest_step "server" "$ROOT_DIR/apps/server" test:coverage || overall=1
  run_vitest_step "course-web" "$ROOT_DIR/apps/course-web" test:coverage || overall=1
  run_vitest_step "coach-web" "$ROOT_DIR/apps/coach-web" test:coverage || overall=1
  run_step "tv-android" "$ROOT_DIR/apps/tv-android" ./gradlew testDebugUnitTest jacocoDebugUnitTestReport || overall=1
else
  run_vitest_step "server" "$ROOT_DIR/apps/server" test || overall=1
  run_vitest_step "course-web" "$ROOT_DIR/apps/course-web" test || overall=1
  run_vitest_step "coach-web" "$ROOT_DIR/apps/coach-web" test || overall=1
  run_step "tv-android" "$ROOT_DIR/apps/tv-android" ./gradlew testDebugUnitTest || overall=1
fi

if [[ "$ALLURE" -eq 1 ]]; then
  node "$ROOT_DIR/tools/junit-to-allure.mjs" \
    "$ROOT_DIR/apps/tv-android/app/build/test-results/testDebugUnitTest" \
    "$REPORT_DIR/allure-results/tv-android" \
    "tv-android"

  ALLURE_DIRS=()
  for dir in "$REPORT_DIR"/allure-results/*; do
    if [[ -d "$dir" ]]; then
      ALLURE_DIRS+=("$dir")
    fi
  done

  if [[ "${#ALLURE_DIRS[@]}" -gt 0 ]]; then
    run_step "allure-report" "$ROOT_DIR" pnpm exec allure generate "${ALLURE_DIRS[@]}" -o "$REPORT_DIR/allure-report" --clean || overall=1
  fi
fi

node "$ROOT_DIR/tools/generate-test-report.mjs" "$REPORT_DIR" "$MODE"

echo
echo "Test report: $REPORT_DIR/test-report.md"
if [[ "$ALLURE" -eq 1 ]]; then
  echo "Allure report: $REPORT_DIR/allure-report/index.html"
fi
exit "$overall"
