#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:3100}"
PUBLIC_BASE="${PUBLIC_BASE:-https://api.infintraining.work}"
META_WARN_MS="${META_WARN_MS:-1200}"
COURSES_WARN_MS="${COURSES_WARN_MS:-1200}"
SENDQ_WARN="${SENDQ_WARN:-20}"
DISK_WARN_PCT="${DISK_WARN_PCT:-85}"
MEM_WARN_PCT="${MEM_WARN_PCT:-85}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

now="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
alerts=()

check_http_ms() {
  local name="$1"
  local url="$2"
  local warn_ms="$3"
  local tmp_file
  tmp_file="$(mktemp)"
  local output
  output="$(curl -sS -H 'Accept-Encoding: gzip' -o "$tmp_file" -w '%{http_code} %{time_total} %{size_download}' "$url" || true)"
  rm -f "$tmp_file"

  local code seconds bytes ms
  code="$(printf '%s' "$output" | awk '{print $1}')"
  seconds="$(printf '%s' "$output" | awk '{print $2}')"
  bytes="$(printf '%s' "$output" | awk '{print $3}')"
  ms="$(awk -v s="${seconds:-0}" 'BEGIN { printf "%d", s * 1000 }')"
  printf '%s http code=%s ms=%s bytes=%s url=%s\n' "$name" "${code:-000}" "$ms" "${bytes:-0}" "$url"

  if [ "${code:-000}" != "200" ]; then
    alerts+=("$name HTTP $code")
  elif [ "$ms" -gt "$warn_ms" ]; then
    alerts+=("$name slow ${ms}ms>${warn_ms}ms")
  fi
}

check_http_ms "health" "$API_BASE/api/health" 500
check_http_ms "meta" "$API_BASE/api/meta" "$META_WARN_MS"
check_http_ms "courses" "$API_BASE/api/courses" "$COURSES_WARN_MS"
check_http_ms "public-meta" "$PUBLIC_BASE/api/meta" "$META_WARN_MS"

sendq_count="$(ss -tan state established 2>/dev/null | awk 'NR > 1 && ($3 + 0) > 65536 { count++ } END { print count + 0 }')"
printf 'network high_sendq_connections=%s\n' "$sendq_count"
if [ "$sendq_count" -gt "$SENDQ_WARN" ]; then
  alerts+=("network Send-Q high connections $sendq_count>$SENDQ_WARN")
fi

disk_pct="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 + 0 }')"
printf 'disk root_used_pct=%s\n' "$disk_pct"
if [ "$disk_pct" -gt "$DISK_WARN_PCT" ]; then
  alerts+=("disk root ${disk_pct}%>${DISK_WARN_PCT}%")
fi

mem_pct="$(free | awk '/Mem:/ { printf "%d", ($3 / $2) * 100 }')"
printf 'memory used_pct=%s\n' "$mem_pct"
if [ "$mem_pct" -gt "$MEM_WARN_PCT" ]; then
  alerts+=("memory ${mem_pct}%>${MEM_WARN_PCT}%")
fi

if [ "${#alerts[@]}" -eq 0 ]; then
  printf 'status ok at=%s\n' "$now"
  exit 0
fi

message="Infini alert at $now: $(IFS='; '; printf '%s' "${alerts[*]}")"
printf 'status alert message=%s\n' "$message"

if [ -n "$ALERT_WEBHOOK_URL" ]; then
  curl -sS -X POST -H 'Content-Type: application/json' \
    --data "{\"text\":\"$message\"}" \
    "$ALERT_WEBHOOK_URL" >/dev/null || true
fi

exit 2
