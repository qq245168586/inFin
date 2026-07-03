# REQ-20260626-tv-current-session-sync: TV Current Session 同步收敛

## Status

- Status: Ready for QA
- Owner: Codex
- Created: 2026-06-26
- Updated: 2026-07-03
- Related docs:
  - [REQ-20260619-coach-course-package-switch-settings](REQ-20260619-coach-course-package-switch-settings.md)
  - [CODEMAP](../CODEMAP.md)
- Related code map sections:
  - `apps/tv-android`
  - `apps/coach-web`
  - `apps/server`

## Requirement Summary

Coach 切换课程包或刷新课表后，TV 可能仍在同步资源，此时如果教练马上点预览、开始或结束，部分屏幕会先响应，部分屏幕会在资源同步完成后才响应。TV 必须允许资源加载慢，但不允许加载慢之后执行过期的 MQTT 指令。完成后，MQTT 只作为通知，TV 最终以 `/api/tv/playback-sessions/current` 的 current session 为唯一状态源，并通过服务端时间校准追进度。

## Background

- 当前行为：
  - `refresh_checksum` 会触发 TV 重新同步今日课表和资源。
  - `preview_course` / `start_course` / `terminate_course` 会通过 MQTT 到达 TV。
  - TV 已有 `/api/tv/playback-sessions/current` 和 `serverNowMs/serverStartAtMs` 的时间校准逻辑。
- 问题：
  - 同步中收到控制指令时，旧逻辑可能只拉一次 current，后续同步完成后存在不确定的补执行。
  - `terminate_course` 可以本地回课表，但没有统一取消待执行的 start/preview。
  - 心跳接口已返回 `sessionOutdated/session`，TV 仓库层没有完整解析与使用。
- 业务原因：
  - 现场切包后，教练可能立刻点预览或开始课程。
  - 如果部分屏幕没加载完，使用者可能点结束预览/结束课程重新收敛。
- 已知约束：
  - 不改 MQTT QoS。
  - 不新增 TV 控制 API。
  - 不改数据库。
  - 三屏课程脚本的逻辑屏幕 `1/2/3` 映射到物理屏幕 `1/3/5`，物理屏幕 4 当前不参与训练视频。

## Goals

- TV 同步中收到 preview/start 时，只记录需要同步完成后应用 current session，不直接执行 MQTT payload。
- TV 同步完成后必须重新拉 `/current`，按服务器最新 session 状态进入预览、训练或回课表。
- `TERMINATED` / `ENDED` 的优先级高于 pending preview/start。
- 心跳发现 `sessionOutdated` 后走同一套 current session 应用流程。
- RUNNING 时继续使用 `serverNowMs` + `serverStartAtMs` + RTT 半程修正追进度，减少 1/3/5 屏时间差。

## Non-goals

- 不调整 MQTT QoS、retain、topic 结构。
- 除 2 秒控制按钮冷却外，不改变 Coach 页面结构和主要操作路径。
- 不改变 Server session 数据模型。
- 不新增屏幕绑定模型，沿用物理屏幕 1/2/3/4/5 与 TV 本地映射。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [Coach 设置中切换场馆课程包](REQ-20260619-coach-course-package-switch-settings.md) | Extends | 切包后继续发 `refresh_checksum`，TV 需能在同步过程中收敛控制指令。 |
| TV playback session | Extends | `/current` 是唯一状态源，MQTT 是通知。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | Compatibility verification | 已有 heartbeat `sessionOutdated/session` 和 `/current`，本次不改。 |
| `apps/course-web` | None | 不涉及编课端。 |
| `apps/coach-web` | Compatibility verification | 控制入口不变。 |
| `apps/admin-web` | None | 不涉及。 |
| `apps/tv-android` | Playback / MQTT / sync | 增加 pending current-session apply、终止优先和 heartbeat outdated 应用。 |
| `apps/mqtt-client` | None | QoS 和转发逻辑不变。 |
| `apps/ops-web` | Optional | 后续可用来观测控制指令和心跳。 |

## Data And API Impact

### Data Model

- New fields: none.
- Changed fields: none.
- Backfill/default strategy: none.
- Compatibility with old records: unchanged.

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET /api/tv/playback-sessions/current` | TV 更频繁地在同步完成、心跳发现过期、控制指令到达时调用。 | 响应结构不变。 |
| `POST /api/tv/screens/heartbeat` | TV 开始读取已有的 `sessionOutdated/session/serverNowMs`。 | 旧字段兼容，缺失时按无过期处理。 |

## Implementation Sketch

### TV

```pseudo
on mqtt refresh_checksum:
  sync daily bundle and resources
  after sync complete:
    requestAndApplyCurrentSession("sync_complete")

on mqtt preview/start:
  bring app to front
  if syncInProgress:
    mark pendingSessionApply
  requestAndApplyCurrentSession("control_command")

on mqtt terminate:
  mark pendingTerminalSessionApply
  stop local playback and show schedule
  requestAndApplyCurrentSession("terminate")

applyCurrentSession(result):
  if no session:
    if pending apply exists:
      clear pending
      show schedule
    return

  if state in TERMINATED/ENDED:
    clear pending
    stop playback or show finish
    return

  if pendingTerminal matches this session:
    keep schedule
    do not restart old playback
    return

  if syncInProgress:
    mark pendingSessionApply
    return

  resolve schedule resources
  apply PREVIEW or RUNNING with server clock correction
```

### Server

```pseudo
no data model change
heartbeat continues returning sessionOutdated/session
current session endpoint remains the source of truth
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 同步中多次点击预览/开始造成旧指令补执行 | 同步完成后不执行 MQTT payload，只重新拉 `/current`。 |
| 点结束后慢屏幕稍后进入旧课程 | terminate 标记为 terminal pending，旧 session 的非终态 current 不会重新开始。 |
| 1/3/5 屏因为本机时间不同步而进度不同 | RUNNING 统一使用服务端 `serverNowMs/serverStartAtMs` 和请求 RTT 修正。 |
| heartbeat 返回字段缺失 | TV 按 `sessionOutdated=false` 兼容。 |
| 多屏同公网 IP 场馆高频拉取 `/current` 被限流 | TV 端合并 800ms 内重复 current 请求，请求失败后 2 秒退避；线上将 TV API 从普通 API 限流中拆分。 |
| Coach 连续点击预览/开始/结束形成多 session 风暴 | Coach 下发 preview/start/terminate 后控制按钮强制锁定 2 秒，网络请求未完成时继续保持 disabled。 |

## 2026-07-03 Production Incident Addendum

- WE CLUB 场馆 4 台 TV 共用同一公网 IP，高频 preview/start/terminate 后，`/api/tv/playback-sessions/current` 与 `/api/tv/screens/heartbeat` 在一分钟内接近 600 次请求。
- 线上 nginx 普通 API 限流为 `10r/s burst=60 nodelay`，导致 TV current/heartbeat 出现 503，部分屏幕无法及时拉到 authoritative session。
- 修正方向：
  - `coach-web`：preview/start/terminate 相关控制按钮发指令后至少 2 秒不可再次点击。
  - `tv-android`：`requestCurrentPlaybackSession` 增加 800ms 合并和失败 2 秒退避。
  - `server/nginx`：`/api/tv/*` 使用专用代理配置，避免与普通管理 API 共用过低 IP 限流。

## Manual E2E Acceptance

### Happy Flow

1. Coach 切换课程包，立刻点击预览。
2. 已同步屏幕先进入预览，未同步屏幕显示同步中。
3. 未同步屏幕同步完成后进入同一个 current session 预览。

Expected:

- 物理屏幕 1/3/5 对应课程脚本逻辑屏幕 1/2/3。
- 屏幕 4 不播放训练视频。
- 所有屏幕最终 session id 和版本一致。

### Bad Flow

1. Coach 切换课程包后立刻点击预览。
2. 部分屏幕还在同步时，Coach 点击结束预览。
3. 等待慢屏幕同步完成。

Expected:

- 慢屏幕不会在同步完成后进入旧预览。
- 慢屏幕最终停在课表页或最新 current session 指示的状态。

### Time Drift Flow

1. 人为让 1/3/5 屏系统时间有差异。
2. Coach 开始 RUNNING session。

Expected:

- TV 使用 server clock 追进度，三个训练屏不按本机系统时间分叉。

## Deployment / Rollback

- Build order: `tv-android` test/build.
- Deploy order: 本次不发布；后续发布 TV APK 即可。
- Version bump: 本次不要求。
- Rollback: 回退 `apps/tv-android` 中 pending current-session apply 相关提交。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
