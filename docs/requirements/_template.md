# REQ-YYYYMMDD-short-slug: Title

## Status

- Status: Draft
- Owner:
- Created:
- Updated:
- Related docs:
- Related code map sections:

## Requirement Summary

用 3-5 句话描述这个需求要解决什么问题、用户是谁、完成后用户会看到什么变化。

## Background

- 当前行为：
- 问题：
- 业务原因：
- 已知约束：

## Goals

- 

## Non-goals

- 

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
|  |  |  |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | API / data / auth / schedule / TV bundle |  |
| `apps/course-web` | UI / editor / schedule / action library |  |
| `apps/coach-web` | UI / TV control / schedule |  |
| `apps/admin-web` | venue / account / device / app version |  |
| `apps/tv-android` | TV UI / playback / MQTT / update |  |
| `apps/mqtt-client` | command gateway / logs |  |
| `apps/ops-web` | logs / diagnostics |  |
| `apps/download-web` | APK download / maintenance |  |

## Data And API Impact

### Data Model

- New fields:
- Changed fields:
- Backfill/default strategy:
- Compatibility with old records:

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
|  |  |  |

## Implementation Sketch

### Server

```pseudo
on request:
  validate auth and course package scope
  normalize old records with defaults
  persist only safe fields
```

### Web

```pseudo
on edit:
  read current package scope
  render only scoped data
  submit payload with package id and changed fields
```

### TV

```pseudo
on daily bundle:
  read new optional fields
  fallback to old behavior when fields are missing
```

## Risks

| Risk | Mitigation |
| --- | --- |
| Production data migration corrupts JSON DB | Backup before migration; prefer read-time normalization |
| Old TV app does not understand new field | Keep additive fields optional |
| Cross-package data leakage | Filter at server API layer, not only frontend |

## Manual E2E Acceptance

### Happy Flow

1. 

Expected:

- 

### Bad Flow

1. 

Expected:

- 

## Deployment / Rollback

- Build order:
- Deploy order:
- Version bump:
- Rollback:

## Documentation Updates

- [ ] Update this requirement status.
- [ ] Update [Requirements Index](INDEX.md).
- [ ] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
