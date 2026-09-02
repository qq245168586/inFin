# TV Diagnostic Upload Verification

Date: 2026-09-02. Status: local implementation verified; device E2E / deployment pending.

Requirement: [TV 错误文件回传](../requirements/REQ-20260826-tv-diagnostic-log-upload.md).

## Results

| Target | Run | Result |
| --- | --- | --- |
| Server | `pnpm test` (includes `check:refs`) | 62/62 tests passed, 14 diagnostic cases |
| Server | `pnpm run test:coverage` | HTML and JSON summary generated |
| Server | `pnpm run build` | Passed |
| Ops | `npm run typecheck` | Passed |
| Ops | `npm run build` | Passed; TV 错误分类、筛选、列表和详情已生成生产包 |
| TV | `./gradlew testDebugUnitTest` | 70/70 tests passed, 20 new diagnostic/transport cases |
| TV | `./gradlew jacocoDebugUnitTestReport assembleDebug` | HTML/XML coverage and debug APK generated; version unchanged |

## Coverage Scope

- Server diagnostic route line coverage: 100%; event/auth schema: 98.96%; file storage: above 93%. These numbers are for the new diagnostic modules, not whole-server coverage.
- Android `DiagnosticEvent`, `DiagnosticOutbox`, `DiagnosticUploadPump`, `DiagnosticCrashHandler`: 100% line coverage in this run. HTTP observer: 95.65%; shared `ApiClient`: 94.52%.
- Coverage is not an E2E pass rate. `TvDiagnostics` Application/SharedPreferences/background lifecycle and physical VideoView/decoder behavior are not fully exercised by JVM unit tests. Actual Android process termination, network restoration and backend reception still need a device test.

Reports:

- [Server HTML coverage](../../apps/server/coverage/index.html)
- [TV HTML unit results](../../apps/tv-android/app/build/reports/tests/testDebugUnitTest/index.html)
- [TV JaCoCo HTML coverage](../../apps/tv-android/app/build/reports/jacoco/jacocoDebugUnitTestReport/html/index.html)

## Cases Covered

1. Existing device binding and private pair token authenticate correctly; wrong token/venue/screen/path identity is rejected, credentials stay out of device-list responses, DB file remains unchanged.
2. Type/code/date/message schema validation, JSONL size/event count limits, signed URL/header/secret redaction and context whitelist.
3. Recognizable Beijing-time filenames and server receipt metadata, private file permissions, concurrent/next-day duplicate upload acknowledgement, conflicting log IDs rejected.
4. Ten-day receipt-age retention, server/client restart, abandoned temporary files, preserving unrelated DB/media files and refusing symlink traversal during cleanup.
5. Per-minute and persisted daily quotas, bounded server pending operations, oldest-first client eviction, corrupted files and changed venue bindings.
6. HTTP endpoint success, 400/403/413/415/429/503 handling, interrupted upload, `Retry-After`, queued file retention and exponential backoff capped at ten minutes.
7. Real request builder/file body tested through a mock OkHttp interceptor; headers and stable ACK ID verified; original JSON request behavior and two-failure fallback preserved.
8. Network/API/download error classification; cancellation excluded; reporter failure cannot throw into HTTP callbacks; log upload never recursively reports itself.
9. Java crash writes before delegating to the original crash handler, even if writing fails. Existing player error recovery callback still runs.
10. Ops 查询按日期、场馆、设备、屏幕、类型和错误码过滤；六类统计独立于当前类型筛选，返回记录不含文件路径和 batch checksum；非法查询被拒绝。

## Remaining Acceptance

- Use a bound test box to trigger local-video decoder failure, API 503, offline recovery and a deliberate Java crash in a test build. Confirm timestamp/device/screen/session/code/stack and restart upload in server files.
- Do not intentionally crash an actively teaching venue. No real production crash was triggered during this implementation.
- Verify production proxy forwards `/api/tv/diagnostics` and custom headers before wider TV rollout. Ship Server first, then TV. No release, installation, DB migration or production data changes performed in this task.
- Native crash, ANR, SIGKILL, sudden power loss and OOM without successful disk write are outside the reliable capture guarantee of this version.
