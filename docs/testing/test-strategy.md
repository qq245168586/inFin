# Infini Test Strategy

## Goal

Protect the business logic that changes most often: course editing rules, schedule copying, package scoping, TV playback planning, MQTT/API fallback, and coach control state.

UI component rendering tests are intentionally excluded. Visual regressions should be checked by manual E2E flows or screenshot review.

## Required Suites

| App | Command | Scope |
| --- | --- | --- |
| server | `npm run test` | API/data helpers, schedule rules, package/author ownership, mock database boundaries |
| course-web | `npm run test` | course editor helpers, validation, package filters, video layout rules, schedule copy logic |
| coach-web | `npm run test` | schedule date helpers, playback state mapping, screen state utilities, request helpers |
| tv-android | `./gradlew testDebugUnitTest` | MVI reducer, timeline/progress calculations, time formatting, layout calculators |

## Coverage Reports

Run all suites with coverage:

```sh
npm run test:coverage
```

The unified report is written under:

```text
outputs/test-results/<timestamp>/test-report.md
```

## Commit Gate

Install hooks once per machine:

```sh
npm run hooks:install
```

After installation:

- Root repository commits run all four suites.
- `apps/server` commits run server tests.
- `apps/course-web` commits run course tests.
- `apps/coach-web` commits run coach tests.
- `apps/tv-android` commits run TV unit tests.

## Mock Data Rules

- Mock data should live in each app's `tests/fixtures` or platform equivalent.
- Fixtures should describe real production risks: missing course package, duplicate course names, empty TV screen, copied week schedules, stale playback session, and fallback network config.
- Fixtures must not use production database files or live venue data.

## Manual E2E Smoke Checks

After large changes, run at least these happy/bad flows manually:

- Course: create course, edit existing course, duplicate-name versions, package-scoped action/type lookup.
- Schedule: copy a past week to a future week, edit a scheduled course, block editing invalid past schedule actions.
- Coach: select today's schedule, preview TV, start course, stop/reset session.
- TV: preview course, start course, warm-up/work/rest/switch/cooldown transitions, empty-screen fallback, update prompt.
