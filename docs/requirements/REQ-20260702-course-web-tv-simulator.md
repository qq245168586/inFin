# REQ-20260702-course-web-tv-simulator: Course Web TV Simulator

## Status

- Status: Ready for QA
- Owner: Course playback simulation
- Created: 2026-07-02
- Updated: 2026-07-03
- Related docs:
  - [COACH_TV_SCHEDULE_AND_START_SEQUENCE](../COACH_TV_SCHEDULE_AND_START_SEQUENCE.md)
  - [REQ-20260702-tv-horizontal-formal-training-time](REQ-20260702-tv-horizontal-formal-training-time.md)
  - [course-web-separation-requirements](../course-web-separation-requirements.md)
- Related code map sections: `apps/course-web`, `apps/coach-web`, `apps/tv-android`, `apps/server`

## Requirement Summary

编课者需要在课程编辑端直接模拟 TV 跑课效果，用于检查课程内容、屏幕编排、正式组计时和课程计划展示。为了不污染 Course Web 的路由和代码复杂度，新增独立前端子项目 `apps/websimulator`，部署在 Course 域名的 `/simulator/` 子路径。Course Web 只在课程列表 item 上增加一个播放入口，新页面通过 `courseId` 查询课程数据并在浏览器内本地模拟 TV 端 Preview / Start / Pause / Resume / Plan 行为，不使用 MQTT，不写真实 playback session。Simulator 进入页面后会先准备本课程所有视频资源：同源或允许 CORS 的资源缓存为浏览器 Blob URL；跨域且不允许 `fetch` 的 OSS 资源退到 `<video preload>` 可播放性预加载。资源准备完成前禁用预览、开始课程、暂停/继续、计划、结束和重置按钮。

## Feasibility Check

结论：可以做，没有架构性阻塞。

需要提前明确的约束：

- Course 列表入口只有 `courseId`，而现有 TV 完整资源接口 `/api/tv/schedule-bundle` 需要 `scheduleId`。因此 simulator 不应强依赖 TV schedule/session API，而应通过 `/api/courses/{courseId}` 或 `/api/meta?courseId=...` 读取课程与动作媒体，再在前端补齐 `mediaUrl`，对齐 server 里的 `resolveScriptMediaUrls()` 口径。
- 不能调用 `/api/tv/playback-sessions/*` 和 `/api/tv/control` 来模拟播放，否则会创建真实场馆 session 或发布 MQTT，影响现场 TV。
- Web 端可以做到行为和视觉约束 1:1 对齐，但不能完全复用 Android View 代码。需要把 TV 的播放时间线、正式训练时长、screen materialize、row layout 等逻辑用 TypeScript 复刻，并用测试对齐 Android 端样例。
- 浏览器视频自动播放策略和 Android TV 不完全一致，simulator 视频默认应 `muted`、`playsInline`、本地循环播放；页面加载阶段优先把课程视频下载成 session-scoped Blob URL，避免跑课中边播边拉资源导致卡住。若外部 OSS 没有 CORS，浏览器不允许 JS 读取 Blob，只能用 video preload 预热和验证可播放性。该缓存只在当前浏览器页面生命周期内有效，不做 TV 端那种持久化磁盘缓存。

## Background

当前相关现状：

- `apps/course-web` 已有课程列表和 `/api/courses/{id}` 详情读取能力，登录态存放在同域 localStorage key `infini-admin-auth`。
- `apps/coach-web` 已有 Preview / Start / Pause / Resume / Plan 控制流程，但这些流程会调用 server playback session 和 MQTT。
- `apps/tv-android` 已有 TV 端实际播放逻辑：
  - `TimelinePlanner` 负责编排课程 steps。
  - `TrainingProgressCalculator` 负责横屏 work timeline 与正式训练时间。
  - `MainActivityTrainingTimelineController` 负责正式组状态。
  - `MainActivityCoursePlanController` 负责课程计划面板。
- `apps/server` 已有课程详情、TV daily bundle、TV schedule bundle 和 playback session API。这个需求原则上不改 server 接口。

## Goals

- Course Web 课程列表每个课程 item 增加播放/模拟按钮。
- 点击后新开页面：`/simulator/?courseId={courseId}`。
- 新增独立 `apps/websimulator` 子项目，独立构建、独立 CSS、独立入口，不进入 Course Web 原路由。
- 同一页面同时展示 4 个物理屏幕：屏幕 1、2、3、5；屏幕 4 不展示、不占位。
- 按现有 TV 物理屏映射渲染：屏幕 1、3、5 是竖屏训练屏，分别映射课程脚本 `screenIndex` 1、2、3；屏幕 2 是横屏信息屏。
- 页面提供与 Coach 端一致的核心控制：预览、开始课程、暂停/继续、结束/重置、计划。
- 进入页面后先解析并准备课程内 warmup、training、cooldown 的所有视频资源；资源准备成功前所有播放控制按钮保持 disabled，失败时不进入播放器。
- 所有控制只修改 simulator 内部状态，不创建 server playback session，不发送 MQTT。
- 横屏屏幕显示正式组 elapsed / total，口径对齐 `REQ-20260702-tv-horizontal-formal-training-time`。

## Non-goals

- 不新增或修改 server API。
- 不改变真实 TV、Coach Web 的 MQTT / playback session 链路。
- 不做真实 TV 设备绑定、心跳、在线状态、持久化磁盘资源缓存或多设备网络延迟模拟。
- 不把 simulator 页面挂进 Course Web 的 React 页面状态或导航栈。
- 第一版不要求支持 screen 4。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `COACH_TV_SCHEDULE_AND_START_SEQUENCE` | 控制流参考 | Simulator 借鉴按钮语义，但不调用真实 session/MQTT。 |
| `REQ-20260702-tv-horizontal-formal-training-time` | 时间口径参考 | 当前启用的横屏 Screen 2 使用正式训练 elapsed / total。 |
| `REQ-20260624-explicit-three-screen-video-rows` | 训练视频布局参考 | Simulator 必须尊重 `rowLayouts`，不恢复旧的自动扩行逻辑。 |
| `course-web-separation-requirements` | 应用边界参考 | 保持 Course Web 与新增 simulator 子项目分离。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/websimulator` | New app | 独立 Vite React 子项目，负责模拟器完整页面。 |
| `apps/course-web` | Minimal UI | 仅课程列表增加“模拟播放”按钮和 `window.open()` 跳转。 |
| `apps/server` | None | 使用现有 `/api/courses/{id}` 或 `/api/meta`；不新增接口。 |
| `apps/coach-web` | None | 可参考 view model 和按钮文案，不复用真实控制 API。 |
| `apps/tv-android` | None | 作为行为基准；必要时补齐测试 fixtures 对照。 |
| `apps/mqtt-client` | None | Simulator 不使用 MQTT。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无。
- Backfill/default strategy: 无。
- Compatibility with old records:
  - 课程脚本缺少 `mediaUrl` 时，simulator 用 actionId 从 actions/media 映射补齐。
  - 缺少 plan 时显示空计划状态。
  - 缺少 ready duration 时按 TV 默认策略兜底。

### API

| Endpoint | Usage | Compatibility |
| --- | --- | --- |
| `GET /api/courses/{courseId}` | 读取课程完整 script | 只读，不改接口。 |
| `GET /api/meta?courseId={courseId}&includeSchedules=0&includeTemplates=0` | 可选：一次拿课程详情和 actions 媒体映射 | 只读，不改接口。 |
| `GET /api/tv/schedule-bundle?scheduleId=...` | 非默认路径：未来如果从课表入口进入可直接使用 | 现有接口；课程列表入口没有 scheduleId。 |

## Architecture

### Project Layout

```text
apps/websimulator/
  index.html
  package.json
  scripts/
    deploy.sh
  vite.config.ts
  src/
    simulator-main.tsx
    WebSimulatorApp.tsx
    api.ts
    mediaCache.ts
    playback.ts
    types.ts
    websimulator.css
```

### Deployment Shape

当前发布采用独立子项目构建、Course 静态根子目录承载的方式，避免改 nginx 配置，从发布层面降低影响编课主页面的风险：

```text
course.infintraining.work/             -> /var/www/infini-course
course.infintraining.work/simulator/   -> /var/www/infini-course/simulator
```

`apps/websimulator/vite.config.ts` 使用：

```ts
base: "/simulator/"
```

后续如果需要把 simulator 静态文件完全挪出 Course Web 根目录，可以再增加独立 nginx location：

```nginx
location ^~ /simulator/ {
  alias /var/www/infini-websimulator/;
  try_files $uri $uri/ /simulator/index.html;
}
```

第一版不依赖这段 nginx 改动，Course Web 原本的 React 路由也不新增 `/simulator` 页面。

## Simulator Data Flow

### Course Web Entry

```pseudo
CourseLibrary row:
  click simulator button:
    url = `/simulator/?courseId=${course.id}`
    window.open(url, "_blank", "noopener")
```

Course Web 仅新增按钮 props，例如：

```pseudo
CourseLibrary(onOpenCourseSimulator)
CoursesRoute:
  onOpenCourseSimulator(course):
    window.open(`/simulator/?courseId=${course.id}`, "_blank", "noopener")
```

### Simulator Load

```pseudo
on app mount:
  courseId = URLSearchParams(location.search).get("courseId")
  auth = read localStorage["infini-admin-auth"]
  if no auth:
    show "请先在课程端登录"

  payload = GET /api/meta?courseId=courseId&includeSchedules=0&includeTemplates=0
  course = payload.courses.find(id == courseId)
  actions = payload.actions

  resolvedCourse = resolveCourseMediaUrls(course, actions)
  resources = collectCourseMediaResources(resolvedCourse)
  disable controls
  show loading progress

  for resource in resources with concurrency=4:
    try:
      blob = fetch(resource.mediaUrl)
      blobUrl = URL.createObjectURL(blob)
      replace source mediaUrl with blobUrl
      log success(status, bytes, duration, speed)
    if resource is cross-origin:
      videoPreload(resource.mediaUrl)
      keep source mediaUrl
      log fallback(origin, duration)

  preparedCourse = resolvedCourse with cacheable mediaUrl replaced by blobUrl
  localSession = createIdleSession(preparedCourse)
  enable controls

on resource preparation failure:
  revoke any partial blobUrl
  show error
  show diagnostic log
  keep controls disabled

on unmount or course reload:
  revoke cached blobUrl
```

`resolveCourseMediaUrls()` 需要对齐 server `resolveScriptMediaUrls()`：

```pseudo
actionMediaMap = Map(action.id -> action.media.url)

for warmup/cooldown item:
  item.mediaUrl = actionMediaMap[item.actionId] || item.mediaUrl || ""

for training video card:
  card.mediaUrl = actionMediaMap[card.actionId] || card.mediaUrl || ""
```

`cacheCourseMedia()` 当前采用浏览器内存 Blob URL 缓存，而不是 IndexedDB 或持久化磁盘缓存。原因是 simulator 的目标是让一次预览/跑课过程稳定，不把额外缓存生命周期引入 Course Web；刷新页面会重新准备本课程视频。跨域资源默认不做 Blob fetch，避免 Chrome Network 出现 CORS 失败请求；当前用 hidden video preload 作为降级路径，并在 `window.__infiniSimulatorMediaLog` 和页面诊断日志里标记 `fallback | video-preload`。

## Local Playback State

Simulator 本地维护一个轻量 session，不写 server：

```ts
type SimulatorState =
  | "IDLE"
  | "PREVIEW"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "PLAN"
  | "ENDED";

interface LocalPlaybackSession {
  id: string;
  state: SimulatorState;
  courseId: number;
  courseName: string;
  serverStartAtMs: number;
  pausedAtMs: number;
  pausedAccumulatedMs: number;
  lastElapsedMs: number;
}
```

Controls:

```pseudo
controlsReady():
  return course != null && mediaCache.status == "ready"

preview():
  require controlsReady()
  state = PREVIEW
  elapsed = 0
  hide plan

start():
  require controlsReady()
  state = SCHEDULED
  serverStartAtMs = Date.now() + 5000
  tick until start time, then state = RUNNING

pause():
  require controlsReady()
  if RUNNING or SCHEDULED:
    state = PAUSED
    pausedAtMs = Date.now()
    lastElapsedMs = currentElapsed()

resume():
  require controlsReady()
  if PAUSED:
    pausedAccumulatedMs += Date.now() - pausedAtMs
    pausedAtMs = 0
    state = RUNNING

showPlan():
  require controlsReady()
  state = PLAN
  render course.script.plan

end():
  require controlsReady()
  state = ENDED
  elapsed = duration

reset():
  require controlsReady()
  state = IDLE
  elapsed = 0
```

Elapsed calculation:

```pseudo
if state == PAUSED:
  return lastElapsedMs
if state == SCHEDULED:
  return 0
if state == RUNNING:
  return max(0, Date.now() - serverStartAtMs - pausedAccumulatedMs)
```

## Screen Layout

### Screen Mapping

| Simulator Screen | TV Meaning | Orientation | Notes |
| --- | --- | --- | --- |
| Screen 1 | 竖屏训练屏 | 9:16 | 映射课程脚本 `screenIndex=1`。 |
| Screen 2 | 横屏信息屏 | 16:9 | 显示横屏训练状态、进度条、正式组时间；screen 4 未启用时使用这个横屏。 |
| Screen 3 | 竖屏训练屏 | 9:16 | 映射课程脚本 `screenIndex=2`。 |
| Screen 5 | 竖屏训练屏 | 9:16 | 映射课程脚本 `screenIndex=3`。 |

Screen 4 不展示，不保留空格。

### Page Layout Constraint

页面外层是可滚动 simulator stage：

```css
.sim-stage {
  min-width: var(--one-screen-min-width);
  min-height: var(--one-screen-min-height);
  overflow: auto;
}
```

屏幕内部使用固定 TV 设计坐标再整体缩放，而不是让内部组件随浏览器宽度自由流式变形：

```pseudo
TvScreenFrame:
  designSize = vertical ? 1080x1920 : 1920x1080
  scale = min(containerWidth / designWidth, containerHeight / designHeight)
  render inner surface at design size
  transform: scale(scale)
```

这样可以保证屏幕内部约束接近 TV App，同时允许浏览器页面滚动或缩放。

推荐默认布局：

```text
Desktop wide:
  [Screen 1 vertical] [Screen 3 vertical] [Screen 5 vertical]
  [              Screen 2 horizontal                  ]

Narrow:
  auto wrap, but each screen must not shrink below the single-screen min width/height
```

## TV Behavior Parity

### Timeline And Training State

需要用 TypeScript 复刻以下 TV 逻辑：

- `TimelinePlanner.build()`：
  - warmup waterfall
  - pod work/rest/switch
  - pod ending hydrate / move zone / finish
  - cooldown waterfall
- `materializeScreens()`：
  - 三屏 video group：脚本 screen 1/2/3 分别取自己的 pod rule 与 video group screen。
  - 单屏 video group：同一 source screen materialize 到三个竖屏训练屏。
- `buildStationPodRunningState()` 与 `buildSwitchPodRunningState()`：
  - work / rest / switch / move station 状态。
  - active card index、row layout、remaining seconds、stage label。
- `TrainingProgressCalculator`：
  - 横屏 work timeline。
  - formal training total seconds。
  - formal training elapsed seconds，hydrate/move zone 期间冻结。

### Rendering States

竖屏：

- `IDLE`：显示课程信息和等待状态。
- `PREVIEW`：显示当前课程预览，不启动计时。
- `SCHEDULED`：显示 Ready 倒计时。
- `RUNNING`：
  - warmup/cooldown 使用瀑布流。
  - training 使用 station cards 或 waterfall cards。
  - transition 显示 REST / SWITCH / MOVE STATION / HYDRATE。
- `PAUSED`：冻结画面并显示暂停标识。
- `PLAN`：显示课程计划面板。
- `ENDED`：显示结束状态。

横屏：

- 显示课程名、当前 stage、横屏 work progress。
- 显示正式组时间：`formalElapsed/formalTotal`，格式 `mm:ss/mm:ss`。
- 在 warmup/cooldown 或 hydrate/move zone 阶段，正式组时间按 TV 口径冻结或保持边界值。

## Implementation Sketch

### Websimulator

```pseudo
WebSimulatorApp:
  courseId = parseQuery()
  data = fetchSimulatorCourse(courseId)
  resolvedCourse = withResolvedMedia(data.course, data.actions)
  mediaCache = cacheCourseMedia(resolvedCourse)
  controlsReady = mediaCache.status == "ready"
  session = useLocalPlaybackSession(mediaCache.course)
  elapsedMs = useTicker(session)

  render toolbar
  render four TvScreenFrame:
    screenNumber in [1, 3, 5, 2]
    state = deriveScreenState(course, screenNumber, elapsedMs, session.state)
```

```pseudo
deriveScreenState(course, screenNumber, elapsedSeconds):
  if state == PLAN:
    return planState(course.plan)
  if state == PREVIEW:
    return previewState(course)
  if screenNumber == 2:
    return horizontalState(course, elapsedSeconds)
  return verticalState(course, screenNumber, elapsedSeconds)
```

### Course Web

```pseudo
CourseLibrary props:
  onOpenCourseSimulator?: (course: CourseRecord) => void

renderCourseRow:
  button "模拟"
    onClick={() => onOpenCourseSimulator(course)}
```

No route changes in `AppRoot`.

### Tests

Recommended unit tests when hardening `apps/websimulator`:

- `trainingProgress.test.ts`
  - `formalTotal` excludes hydrate/move zone。
  - `formalElapsed` freezes during hydrate/move zone。
- `timeline.test.ts`
  - normal pod duration matches TV fixture。
  - switch pod A/B timing matches TV fixture。
  - single-screen group materializes to screens 1/2/3。
- `mediaResolver.test.ts`
  - action media URL fills missing script `mediaUrl`。

Manual browser QA:

- Loading 状态显示视频缓存进度。
- 视频缓存完成前，预览/开始课程/暂停/继续/计划/结束/重置按钮全部 disabled。
- 视频缓存失败时显示错误，按钮保持 disabled，不进入本地 session。
- Chrome Console 输出 `[websimulator:media-cache]` 诊断日志；错误页/加载页可展开最近日志，包含资源名、origin、耗时、大小、速度、HTTP status 和 fallback 原因。
- Desktop wide viewport screenshot。
- Narrow viewport scroll layout。
- Video media renders and keeps aspect ratio。
- Pause/resume elapsed freezes/resumes。

## Risks

| Risk | Mitigation |
| --- | --- |
| Simulator 与 TV 播放算法分叉 | 把 TV Java fixtures 翻译成 TS fixtures，关键口径加单测；每次 TV 算法改动同步 simulator。 |
| Course detail 缺少 TV 已解析媒体 URL | 前端按 actionId 补齐 mediaUrl，对齐 server `resolveScriptMediaUrls()`；未来如果从 schedule 入口进入再优先用 `schedule-bundle`。 |
| 调用真实 playback API 影响现场 TV | Simulator service 层不暴露 `/api/tv/control` 和 `/api/tv/playback-sessions/*`；控制只走本地 reducer。 |
| `/simulator/` 被 Course Web SPA fallback 吃掉 | 当前部署为 Course 静态根目录下的真实 `/simulator/` 子目录，配合 Vite `base=/simulator/`；如未来迁出再加独立 nginx location。 |
| 浏览器自动播放限制导致视频黑屏 | 视频默认 muted/playsInline/preload；进入页面后先准备视频，再开始本地播放。 |
| 浏览器 Blob 缓存占用内存 | 缓存只在当前页面生命周期内存在；切换课程、重新加载或离开 simulator 时 revoke Object URL。大课程仍需要关注 Safari/移动浏览器内存上限。 |
| 视频源不允许浏览器 fetch | 同源或有 CORS 的资源走 Blob 缓存；无 CORS 的跨域 OSS 资源走 video preload 降级，并在诊断日志里记录 fallback。若未来需要真正全量 Blob 缓存，需要在 OSS 补 CORS 或提供同源代理。 |
| 串行下载导致进入页面慢 | 当前最多 4 个资源并发准备，保留进度和逐资源诊断，避免 25 个小视频逐个等待。 |
| 1:1 视觉范围过大 | 第一版优先保证时间线、屏幕映射、布局约束、计划/控制行为；视觉细节按 TV controller 分阶段补齐。 |

## Manual E2E Acceptance

### Happy Flow

1. 使用 Course Web 登录编课账号。
2. 进入课程列表，点击某课程的“模拟播放”按钮。
3. 浏览器新开 `/simulator/?courseId={id}`。
4. 页面显示课程资源准备状态和视频缓存进度。
5. 缓存完成前确认预览、开始课程、暂停/继续、计划、结束、重置按钮均 disabled。
6. 缓存完成后页面加载出屏幕 1、2、3、5，且不展示屏幕 4。
7. 点击“预览”。
8. 点击“开始课程”，等待 Ready 倒计时后进入 RUNNING。
9. 点击“暂停”，等待 5 秒，再点击“继续”。
10. 点击“计划”，看到该课程的 plan sections/items。
11. 观察屏幕 2 正式组时间显示为 `mm:ss/mm:ss`。

Expected:

- Course Web 原页面路由不变化。
- Simulator 页面不触发真实 TV、不创建真实 session、不发 MQTT。
- 预览和开始课程优先使用 Blob URL 缓存后的课程视频；跨域无 CORS 资源使用已预加载验证的原始视频 URL，并在诊断日志中显示 fallback。
- 三个竖屏按 TV 物理映射渲染内容：物理屏 1/3/5 对应脚本屏 1/2/3；单屏视频组会 materialize 到三个竖屏。
- 暂停期间倒计时和 elapsed 冻结，继续后恢复。
- 横屏正式组时间总时长与编课端 summary 的 trainingSeconds 口径一致。

### Bad Flow

1. 未登录状态直接打开 `/simulator/?courseId=1`。
2. 打开不存在或无权限的 `courseId`。
3. 打开缺少视频 URL 的课程。
4. 打开视频 URL 下载失败、返回空文件或跨域预加载失败的课程。
5. 浏览器宽度小于四屏总宽。

Expected:

- 未登录提示先回 Course Web 登录，不显示空白页。
- 无权限/不存在课程显示错误，不进入播放器。
- 缺少视频 URL 时对应卡片显示占位，其他计时逻辑仍可跑。
- 视频下载失败、返回空文件或跨域预加载失败时显示缓存失败，控制按钮保持 disabled，不进入播放器。
- 页面出现横向/纵向滚动或自动换行，但单个屏幕内部不被压坏。

## Deployment / Rollback

- Build order:
  1. `apps/websimulator npm run typecheck`
  2. `apps/websimulator npm run build`
  3. `apps/course-web npm run build` 仅在课程列表入口按钮改动时需要。
- Deploy order:
  1. 发布 simulator 静态产物到 `/var/www/infini-course/simulator`。
  2. 发布 Course Web 的播放入口按钮；后续 simulator-only 修复不需要重发 Course Web。
- Rollback:
  - 先回滚 Course Web 按钮，用户不再进入 simulator。
  - 保留或删除 `/simulator/` 静态目录均不影响 Course Web。

## Documentation Updates

- [x] Add this requirement draft.
- [x] Update [Requirements Index](INDEX.md).
- [x] Document simulator video preload/cache behavior.
- [ ] Update [Code Map](../CODEMAP.md) after implementation.
- [ ] Update coach/course user docs after implementation if needed.
