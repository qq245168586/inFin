# REQ-20260714-tv-local-video-only-playback: TV 本地视频播放与信息屏资源隔离

## Status

- Status: Shipped
- Owner: TV playback
- Created: 2026-07-14
- Updated: 2026-07-14
- Related docs:
  - [TV Current Session 同步收敛](REQ-20260626-tv-current-session-sync.md)
  - [Infini Code Map](../CODEMAP.md)
- Related code map sections: `apps/tv-android`

## Requirement Summary

TV 的物理屏幕 `2/4` 是横屏信息与进度屏，不展示动作视频，因此同步课表和按 schedule 兜底加载时都不能下载 MP4。物理屏幕 `1/3/5` 继续在课程资源同步阶段把视频缓存到本地，进入预览或正式课程时 `VideoView` 只能播放已校验存在的本地文件。`startCourse` 可以重新渲染页面和重建播放器，但同一 checksum 的有效缓存不得重复下载，也不允许缓存失败后直接串流远程 MP4。

## Background

- 当前行为：日课表同步已经允许横屏跳过资源缓存，但按 `scheduleId` 兜底加载仍无条件调用视频缓存。
- 当前行为：课程解析在本地映射缺失时保留远程 URL，训练卡片 `VideoView` 会直接使用该 URL，播放失败后还会重复绑定。
- 问题：信息屏可能通过兜底路径下载不需要的 MP4；视频屏缓存失败后可能直接消耗服务器流量播放远程视频。
- 业务原因：服务器出口流量有限，TV 视频应在课程同步阶段一次性缓存，播放阶段只读本地文件。
- 已知约束：屏幕 `1/3/5` 是视频屏，屏幕 `2/4` 是信息屏；课程脚本和进度计算逻辑保持不变。

## Goals

- 屏幕 `2/4` 的 daily bundle 与 schedule bundle 处理链路均不下载 MP4。
- 屏幕 `1/3/5` 只在本地资源缺失、损坏或 checksum 变化时下载视频。
- 所有 Android `VideoView` 入口拒绝 `http://` 和 `https://` 媒体地址。
- 缓存失败或本地文件不可读时显示现有占位状态，不远程串流、不无限重试。
- `startCourse` 继续按页面状态重新渲染，但不把重新渲染等同于重新下载。

## Non-goals

- 不修改课程、排课或媒体数据库。
- 不修改 Server API 路径、请求参数或响应结构。
- 不改变 Coach/MQTT/current session 控制协议。
- 不调整 TV 视频布局、计时、进度和屏幕映射。
- 本次不增加 Server 端 `includeMediaResources=0` 参数；信息屏仍可能接收资源元数据，但不会请求 MP4 文件内容。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [REQ-20260626-tv-current-session-sync](REQ-20260626-tv-current-session-sync.md) | Preserves | Current session 仍是预览/开课最终状态源，仅给 schedule resolve 增加媒体资源策略。 |
| TV 今日课程资源缓存 | Refines | 从布尔值升级为 `CACHE_REQUIRED` / `METADATA_ONLY` 明确策略。 |
| TV 训练与瀑布流播放器 | Hardens | 两个 `VideoView` 入口都只能接收可读本地文件。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/tv-android` | Repository / cache / playback | 新增媒体资源策略、本地播放守卫与测试。 |
| `apps/server` | None | API 和响应不变。 |
| `apps/course-web` | None | 编课与资源字段不变。 |
| `apps/coach-web` | None | 控制流程不变。 |
| `apps/admin-web` | None | 无影响。 |
| `apps/mqtt-client` | None | 无影响。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无。
- Backfill/default strategy: 无需迁移。
- Compatibility with old records: 旧课程媒体 URL 仍由 bundle 的 resource checksum 映射到本地缓存；映射失败时不播放远程视频。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET /api/tv/daily-bundle` | 无协议变化；TV 按屏幕资源策略决定是否缓存响应中的 resources。 | 完全兼容。 |
| `GET /api/tv/schedule-bundle` | 无协议变化；TV 按屏幕资源策略决定是否缓存 resources。 | 完全兼容。 |

## Implementation Sketch

### TV Repository

```pseudo
policyForScreen(screen):
  if screen in [2, 4]: return METADATA_ONLY
  return CACHE_REQUIRED

syncOrLoadSchedule(policy):
  response = request bundle
  localMap = policy.cacheRequired ? ensureResourcesCached(response.resources) : empty
  parse course media using localMap
  unresolved remote video URL -> empty media path
```

### TV Playback

```pseudo
bindVideo(mediaPath):
  reject http/https
  require local file exists, readable and non-empty
  if invalid: show placeholder
  else: VideoView.setVideoPath(localAbsolutePath)

on playback error:
  hide failed local player
  do not retry remote URL
```

### `startCourse`

```pseudo
resolve schedule with screen policy
startCourse(schedule):
  stop old playback
  reset UI state
  rerender current page
  VideoView reads already cached local file
```

## Impact Boundary

- `startCourse` itself不执行网络下载；下载只可能发生在同步或 `resolveRemoteSchedule -> loadScheduleById`。
- 有效缓存通过资源 checksum、size 和文件可读性复用，重新渲染不会删除缓存。
- 屏幕 `2/4` 仍解析课程脚本，以支持横屏课程名称、状态、进度和正式训练时间显示；只是视频媒体路径被清空。
- 屏幕 `1/3/5` 如果缓存未完成或校验失败，暂时无视频，不使用服务器 URL 兜底。
- Logo/ImageLoader 不属于 `VideoView` MP4 播放边界，本次不改变课程图标加载方式。

## Risks

| Risk | Mitigation |
| --- | --- |
| 视频缓存失败后画面为空 | 保留现有占位，并由 checksum/网络恢复同步重新准备资源；禁止以服务器流量换取临时播放。 |
| 旧课程资源列表缺少某个视频映射 | 该视频不播放远程 URL，日志保留本地资源缺失线索。 |
| 横屏脚本媒体路径清空影响进度 | 进度计算依赖 pod/work/rest 数据，不依赖 MP4 路径；单元测试和现场预览验证。 |
| 本地播放器解码失败 | 停止该本地播放器，不进行无限重试；后续可结合 `what/extra` 单独治理编码兼容。 |

## Manual E2E Acceptance

### Happy Flow: 信息屏不下载视频

1. 清空一台绑定为屏幕 2 的盒子网络日志并刷新课表。
2. 进入预览、开始课程、退出后再次预览。

Expected:

- 课程名称和横屏进度正常。
- 网络日志没有 `/api/media/*.mp4` 请求。
- `schedule-bundle` 兜底加载也不会触发 MP4 下载。

### Happy Flow: 视频屏复用缓存

1. 在屏幕 1/3/5 首次同步课程，等待视频缓存完成。
2. 连续进入预览、退出、重新预览并正式开课。

Expected:

- 首次缺失资源只下载一次。
- 后续 `startCourse` 重新渲染时直接播放本地文件，不重复请求同一 MP4。

### Bad Flow: 本地文件缺失或损坏

1. 删除或损坏一个已缓存视频后进入课程。
2. 观察播放器和网络请求。

Expected:

- `VideoView` 不直接打开远程 URL。
- 当前卡片显示占位或无视频，不出现无限播放重试。
- 后续资源同步重新下载并校验该文件后可恢复本地播放。

### Bad Flow: Bundle 映射缺失

1. 使用包含视频 URL、但 resources 中没有对应映射的测试课程。

Expected:

- 课程其他数据可显示。
- 缺失映射的视频不会向远程 MP4 发起请求。

## Deployment / Rollback

- Build order: TV unit tests -> Debug compile -> release build（发布时）。
- Deploy order: 仅发布 TV APK。
- Version bump: TV `1.0.69`。
- Rollback: 回滚 TV APK 即可；无 DB/API 回滚。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md).
- [x] Record impact boundary and manual E2E cases.
