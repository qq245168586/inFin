# REQ-20260902-tv-visual-system-refresh: TV 全界面视觉系统升级

## Status

- Status: Shipped
- Owner: TV Android
- Created: 2026-09-02
- Updated: 2026-09-02
- Related docs: `REQ-20260626-tv-current-session-sync.md`, `REQ-20260714-tv-local-video-only-playback.md`, `REQ-20260826-tv-diagnostic-log-upload.md`
- Related code map sections: `apps/tv-android`

## Requirement Summary

TV 端所有可见状态统一升级为深色、高对比、适合远距离观看的视觉系统。覆盖扫码绑定、竖/横课表、竖/横训练、准备、补水/换站、课程计划、完成、设置、版本列表、应用更新和网络异常。改造只调整资源、布局和动态 View 的视觉表达，必须保留现有 MVI、MQTT、session、课程同步、播放器、屏幕映射和更新行为。

## Background

- 当前行为：静态 XML、drawable 和 Java 动态 View 使用多套紫色渐变、大圆角和不一致的信息层级。
- 问题：不同状态视觉不统一，部分卡片在电视比例和长文本下占用过多空间，运行时动态控件会覆盖 XML 主题。
- 业务原因：现场需要快速识别课程、训练状态和系统异常，同时保证竖屏训练屏与横屏信息屏稳定显示。
- 已知约束：物理屏幕 1/3/5 为竖屏训练屏，2/4 为横屏信息屏；现有 View ID 和事件绑定不能变化。

## Goals

- 建立统一的炭黑背景、浅色文字、金色信息强调、蓝色训练状态视觉层级。
- 所有普通卡片圆角不超过 8dp，取消装饰性渐变和大面积紫色底。
- 同时覆盖 XML 静态界面与 Java 动态生成的课表、训练卡、课程计划、设置项。
- 在 `1080x1920` 竖屏和 `1920x1080` 横屏上保持无重叠、无裁切和稳定布局。
- 保留加载、无数据、离线、更新和媒体占位状态的可读性。

## Non-goals

- 不修改课程脚本、时间线、视频缓存、播放策略或媒体请求。
- 不修改 MQTT topic、指令处理、current session 或心跳行为。
- 不修改 Server API、DB、Coach/Course/Admin 页面。
- 不在本需求中新增设置或运维功能。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `REQ-20260626-tv-current-session-sync` | Must remain compatible | 页面切换仍由 MVI/current session 驱动。 |
| `REQ-20260714-tv-local-video-only-playback` | Must remain compatible | 视频仍只播放已校验的本地文件。 |
| `REQ-20260826-tv-diagnostic-log-upload` | Must remain compatible | 错误采集和上传链路不随视觉改造变化。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/tv-android` | UI resources / layout / dynamic views | 全部可见状态统一视觉；不改业务状态和数据流。 |
| `apps/server` | None | API 与资源返回不变。 |
| `apps/course-web` | None | 编课和 TV simulator 不在本次范围。 |
| `apps/coach-web` | None | 控制指令和状态显示不变。 |
| `apps/admin-web` | None | 无改动。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无。
- Backfill/default strategy: 不需要。
- Compatibility with old records: 完全兼容，继续读取原课程、排课和 session。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| 全部 TV API | 无 | 请求参数、响应和错误处理均不变。 |
| MQTT | 无 | topic、payload 和触发时序均不变。 |

## Implementation Sketch

### TV

```pseudo
define shared TV palette and flat drawable surfaces

keep every existing view id and event binding
restyle static states in activity_main.xml

for each dynamic schedule/training/plan/settings view:
  use the same palette, spacing and <= 8dp card radius
  preserve data binding, click behavior and visibility rules

on viewport/orientation change:
  retain current responsive clamps
  keep portrait training and landscape information layouts independent
```

## Risks

| Risk | Mitigation |
| --- | --- |
| XML ID or visibility change breaks controller binding | Preserve and mechanically compare all existing IDs; compile and lint resources. |
| Dynamic Java background restores old theme | Search all runtime `setBackground*`, `setTextColor` and drawable references and route them through shared resources. |
| Long course/action name overlaps timer or status | Keep max lines/ellipsis/auto-size and validate both target resolutions. |
| Update/settings overlay sits behind playback | Preserve existing z-order and `bringToFront` behavior. |
| Existing diagnostic work is overwritten | Keep changes scoped and review nested repository diff before completion. |

## Manual E2E Acceptance

### Happy Flow

1. On a clean device, open pairing, bind the TV, and enter the schedule.
2. On physical screens 1/3/5, open preview and start a course containing one- and two-video rows.
3. On physical screens 2/4, verify schedule, READY, WORK, HYDRATE/MOVE and finish states.
4. Open course plan, settings, version list and update progress.

Expected:

- Every state uses the same dark visual system and remains readable from TV distance.
- Video, timing, progress, controls, sync and session transitions behave exactly as before.
- No text overlaps or cards exceed the viewport at `1080x1920` and `1920x1080`.

### Bad Flow

1. Disconnect the network while the schedule is visible and while an update is in progress.
2. Use unusually long Chinese, English and Russian course/action names.
3. Load an empty schedule and a course with missing local media.

Expected:

- Offline/loading/empty/media placeholder messages remain visible and do not block recovery.
- Long text is wrapped, ellipsized or auto-sized without covering adjacent content.
- No crash, remote stream fallback or change to cached-course behavior occurs.

## Deployment / Rollback

- Build order: TV only.
- Deploy order: upload APK after device QA; no server/web deployment required.
- Version bump: `1.0.72` -> `1.0.73` (`versionCode 73`).
- Rollback: reinstall the previous TV APK; no data rollback required.

Production release completed on 2026-09-02. Package ID `90` was uploaded to the Server package registry and pushed to all 12 online, idle TVs across 科技园综合体能、12round科技园 and WE CLUB. Final heartbeats reported `appVersion=1.0.73` and `updateState=IDLE` for all 12 devices.

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md).
- [x] Record build, lint and test results in `docs/testing/tv-visual-system-refresh-20260902.md`.
