# TV Visual System Refresh Test Report

## Scope

- App: `apps/tv-android`
- Requirement: `REQ-20260902-tv-visual-system-refresh`
- Date: 2026-09-02
- Change type: visual resources, main layout and dynamic course plan/settings surfaces
- Excluded behavior: MVI, MQTT, current session, API, DB, playback, media cache and updater flow

## Automated Verification

| Check | Result | Notes |
| --- | --- | --- |
| Existing layout ID comparison | Pass | All 92 existing IDs remain present; no IDs added or removed. |
| `./gradlew testDebugUnitTest` | Pass | Existing tests plus stable `MM:SS` playback-header formatter tests passed for `1.0.75`. |
| `./gradlew lintDebug` | Pass | No blocking Android Lint errors for the structural correction. |
| `./gradlew assembleDebug` | Pass | Debug APK generated successfully. |
| `./gradlew assembleRelease` | Pass | Release APK generated successfully. |
| Gradient scan | Pass | No XML `<gradient>` remains in TV drawable resources. |
| Card radius scan | Pass | Ordinary rectangular surfaces use at most 8dp; circular progress/status shapes are exempt. |

## Artifact

- Debug APK: `apps/tv-android/app/build/outputs/apk/debug/app-debug.apk`
- Lint HTML: `apps/tv-android/app/build/reports/lint-results-debug.html`

## Physical Device Verification

- Device: `TV-9F839C95`, Android output `1920x1080`.
- Installed build: `1.0.75` debug.
- Verified: app launch, screen 1/2 switching, unified top bar, version/device metadata, schedule composition, no overlap or clipping.
- Restored device to screen 2 after verification.

## Manual Playback QA Still Required

Before force-installing the package to venues, verify:

1. `1080x1920`: pairing, vertical schedule, one/two-video training rows, long names, READY, transition, plan and finish.
2. `1920x1080`: horizontal schedule, preview/start progress, HYDRATE/MOVE, elapsed/total debug time and finish.
3. Both orientations: settings, version list, update progress, offline/loading/empty/media placeholder states.
4. Confirm remote/controller focus remains visible and every existing click action still works.

## Residual Risk

- APK resource compilation confirms XML correctness, but physical-panel overscan and vendor font metrics require device QA.
- Existing diagnostic upload changes are present in the same TV working tree and were not reverted or behaviorally modified by this visual task.

## Release History

- Version: `1.0.73` (`versionCode 73`)
- Server package ID: `90`
- SHA-256: `7470ced6c53e7ef85d60b9662f9c50002a35491d2fae9683666f3dab5eab5bbf`
- Push targets: 12 online, idle TVs across 3 venues
- Final result: 12/12 heartbeats reported `appVersion=1.0.73`, `playbackState=IDLE`, and `updateState=IDLE`

This history describes the earlier theme-only release. The corrected structure is TV `1.0.75`, package ID `92`, SHA-256 `a6e838f1abbd39a65ea9c3b24c1e27778e03106c16d31675780fd3e22310e753`; it is intentionally not force-pushed before user visual acceptance.
