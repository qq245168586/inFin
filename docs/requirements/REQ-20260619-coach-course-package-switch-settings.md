# REQ-20260619-coach-course-package-switch-settings: Coach 设置中切换场馆课程包

## Status

- Status: Ready for QA
- Owner: Coach / TV control
- Created: 2026-06-19
- Updated: 2026-06-20
- Related docs:
  - [Infini Code Map](../CODEMAP.md)
  - [课程端/场馆管理端拆分需求](../course-web-separation-requirements.md)
- Related code map sections:
  - [coach-web](../CODEMAP.md#appscoach-web)
  - [server](../CODEMAP.md#appsserver)
  - [tv-android](../CODEMAP.md#appstv-android)
  - [mqtt-client](../CODEMAP.md#appsmqtt-client)

## Requirement Summary

场馆已经可以绑定多个课程包，Coach 端需要允许教练在现场切换当前使用的课程包。入口放在 Coach 端的设置功能里，点开后显示当前场馆绑定的课程包列表，即使只有一个课程包也要显示。教练选中某个课程包后，系统必须先把当前启用课程包持久化到场馆 DB 字段，再通知 TV 端刷新课表。TV 端不新增“切换课程包”接口，也不参与课程包判断；它只沿用现有课表拉取 API，服务端根据场馆当前启用课程包过滤/处理返回数据。

现有代码已经有一部分链路：`coach-web` 里已有课程包状态和切换方法，`server` 的 Coach 切包接口也会发 `refresh_checksum` MQTT 指令。当前需求主要是把入口从 Coach 控制页顶部工具栏迁入设置面板，并补齐交互、状态展示、输出过滤语义、风险处理和验收标准。

## Background

- 当前行为：
  - `apps/admin-web` 可给场馆绑定课程包。
  - `apps/coach-web/src/components/console/ConsoleToolbar.tsx` 当前在课程控制页顶部直接显示课程包 `select`。
  - `apps/coach-web/src/viewModels/useCoachConsoleViewModel.ts` 已有 `loadCoursePackages`、`activeCoursePackageId`、`changeActiveCoursePackage`。
  - `apps/coach-web/src/services/consoleService.ts` 已有 `GET /api/coach/course-packages` 和 `POST /api/coach/active-course-package` 调用。
  - `apps/server/src/legacy/server-chunks/server.003.txt` 的 `/api/coach/active-course-package` 会发布 `refresh_checksum`，让 TV 重新拉取课表。
  - `apps/tv-android` 已有 `refresh_checksum` / daily bundle 拉取逻辑；课程包过滤应发生在服务端 daily bundle API 内部，TV 只消费过滤后的结果。
- 问题：
  - 课程包选择现在暴露在 Coach 控制页顶部，不符合“设置里管理场馆配置”的产品预期。
  - 设置面板当前只有“课程控制”和“屏幕管理”，没有课程包切换入口。
  - 当前需求需要持久化场馆当前启用课程包，但不是迁移业务数据归属：课程、排课、动作、模板等 DB 记录不迁移、不重写；只是更新 `venues[].activeCoursePackageId`，并让课表 API 按这个字段过滤。
  - 如果 MQTT 发布失败，可能出现 Coach 已看到新课程包结果，但 TV 仍显示旧课表的状态不一致。
- 业务原因：
  - 一个场馆可能绑定多个课程包，例如 Hybrid、12round 等，教练需要现场切换当天使用的课程体系。
  - 切换后 TV 必须通过原有课表 API 同步到新课程包课表，否则 Coach 和 TV 看到的课程不一致。
- 已知约束：
  - 场馆正在上课时不能切换课程包，避免 Coach 和 TV 在同一 session 内看到不同课表。
  - 课程包只能在场馆已绑定范围内选择，不能选择未绑定课程包。
  - TV 不应直接知道 Coach UI 的设置结构，也不应直接实现课程包切换判断，只响应已有刷新指令并重新拉课表。

## Goals

- 在 Coach 端设置面板增加课程包切换入口。
- 点击入口后显示当前场馆绑定的所有课程包。
- 只有一个课程包时也显示列表，并标记当前选中状态，但不需要允许切换到同一个包。
- 选中课程包后调用服务端持久化场馆当前启用课程包。
- 服务端 DB 保存成功后通知 TV 刷新课表校验，让 TV 调用原有课表 API；该 API 在服务端按当前课程包过滤输出数据。
- Coach 端切换成功后刷新本地 daily bundle，并清理已选中的旧 schedule / preview。
- 保留现有权限和运行中课程保护。

## Non-goals

- 不在本需求里新增课程包绑定能力，绑定仍由 Admin 端管理。
- 不改变课程、动作、模板的数据模型。
- 不迁移、不改写、不重绑任何课程、排课、动作、模板 DB 记录的课程包归属。
- 不改变 TV daily bundle 的数据结构或接口路径。
- 不新增新的 MQTT topic 或新 TV 协议类型，优先复用现有 `refresh_checksum`。
- 不在 TV 端新增课程包选择、课程包切换或课程包过滤逻辑。
- 不允许 Coach 端创建、删除或编辑课程包。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [Infini Code Map](../CODEMAP.md) | Aligns | 已定义 Coach 端可以切换场馆已绑定课程包，TV 通过 server/MQTT 同步。 |
| Admin 场馆课程包绑定 | Depends on | Coach 端只显示已经绑定到场馆的课程包。 |
| TV daily bundle course package filtering | Depends on | TV 调用原有课表 API，服务端依赖场馆当前启用课程包过滤排课。 |
| Coach 现有顶部课程包 select | Replaces / Moves | 现有顶部入口需要迁到设置里，避免控制页过多配置项。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/coach-web` | UI / view model | 将课程包选择从 `ConsoleToolbar` 移入设置面板；设置中展示列表、选中态、切换动作和错误提示。 |
| `apps/server` | API / output filtering / MQTT | 复核并可能加固 `/api/coach/active-course-package`：持久化场馆当前启用课程包、权限校验、课表输出过滤、MQTT 失败处理。 |
| `apps/tv-android` | Compatibility verification | 原则上不改代码，只验证收到 `refresh_checksum` 后会重新调用现有课表 API。 |
| `apps/mqtt-client` | Compatibility verification | 原则上不改代码，只确认 `refresh_checksum` 能到达场馆 namespace。 |
| `apps/admin-web` | No direct change | Admin 仍负责绑定课程包。 |
| `apps/course-web` | No direct change | 排课仍按课程包发布，Coach 只切场馆当前启用课程包。 |
| `apps/ops-web` | Optional | 可用于后续观察 `refresh_checksum` 指令日志，不是本需求必做。 |
| `apps/download-web` | No change | 无关。 |

## Existing Logic Check

### 是否已有“系统内当前启用课程包”逻辑？

部分已有，但需要按本需求重新确认语义。

- Coach 端已有 `activeCoursePackageId` 状态和切换调用，可以作为当前场馆启用课程包的显示状态。
- Server 端已有切换接口和校验能力，但实现时必须明确：本需求不是把 DB 中的课程/排课/动作切换到另一个课程包，也不是迁移数据归属；服务端只持久化场馆 `activeCoursePackageId`，输出课表时根据该字段过滤。
- Server 端仍需要校验：
  - 场馆存在。
  - 场馆不在 active playback。
  - 目标课程包已绑定到该场馆。
- `getTvDailyBundle(date, timeZone, accountNamespace, tvScope)`：
  - 通过 TV 绑定的 `accountNamespace` 找场馆。
  - 获取当前场馆持久化的启用课程包。
  - 在服务端只返回该课程包下的排课和资源。

### 是否已有 Coach 切换逻辑？

有，但入口位置不符合新需求。

- `fetchVenueCoursePackages(authSession)` 拉取场馆绑定课程包和当前选中 id。
- `switchActiveCoursePackage(authSession, coursePackageId, commandId)` 调用切换接口。
- `changeActiveCoursePackage(coursePackageId)` 已有忙碌态、运行中阻止、刷新 bundle、清空选中 schedule/preview。
- 当前 UI 位于 `ConsoleToolbar` 顶部，不在设置内。

### 是否已有切换后通知 TV？

有。

- `/api/coach/active-course-package` 当前会发布 MQTT 控制消息：
  - `type: "refresh_checksum"`
  - `reason: "course_package_changed"`
  - `coursePackageId: <target course package id>`
  - topic namespace 使用场馆 `accountNamespace`

## Data And API Impact

### Data Model

- New fields: none for course/schedule/action/template records.
- Changed fields: none for course/schedule/action/template records.
- Existing fields:
  - `venues[].coursePackageIds`: 场馆绑定课程包列表。
  - `venues[].activeCoursePackageId`: 当前场馆启用课程包，Coach 切换时持久化该字段；不能理解为切换课程/排课 DB 归属。
- Backfill/default strategy:
  - 没有当前选择时，服务端输出默认使用场馆绑定列表里的第一个课程包。
- Compatibility with old records:
  - TV 和 Coach 继续通过原有课表接口读取课表，不需要新增 TV 字段或 TV 参数。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET /api/coach/course-packages` | 继续使用，返回当前场馆绑定课程包和当前选中 id。 | 兼容现有 Coach。 |
| `POST /api/coach/active-course-package` | 继续使用；建议加固 MQTT 失败时的响应语义。 | 兼容现有 Coach。 |
| `GET /api/tv/daily-bundle` | 不变，继续在服务端根据场馆当前启用课程包过滤输出。 | TV 无需改协议，也无需传课程包参数。 |
| `POST /api/tv/control` / MQTT `refresh_checksum` | 不变，切包后继续复用刷新指令。 | TV 无需新增指令类型。 |

## Implementation Sketch

### Coach Web

将课程包选择从顶部 toolbar 移到设置面板。建议把设置弹层拆成可扩展配置项。

```pseudo
CoachConsolePage:
  pass coursePackages, activeCoursePackageId, pendingAction, changeActiveCoursePackage
  to CoachSettingsMenu or a nested CoursePackageSettingsPanel

ConsoleToolbar:
  remove course package select
  keep refresh bundle and refresh TV buttons

CoachSettingsMenu:
  show group "课程包"
  for each package in coursePackages:
    render button/card:
      title = package.name
      selected = package.id == activeCoursePackageId
      disabled = pendingAction || isVenueBusy || selected
      onClick = changeActiveCoursePackage(package.id)

if coursePackages.length == 1:
  render single selected item
  helper text: 当前场馆只绑定了一个课程包
```

### Server

现有核心逻辑可复用，但要把语义收敛为“切换场馆当前启用课程包”，不要改写课程/排课/动作/模板 DB 归属。

```pseudo
POST /api/coach/active-course-package:
  user = requireAuthorizedConsoleUser()
  venueId = user.venueId or payload.venueId
  assert venue exists
  assert venue is not in active playback
  assert payload.coursePackageId is bound to venue

  currentCoursePackageId = persistVenueActiveCoursePackageId(
    venueId,
    payload.coursePackageId
  )

  try publish refresh_checksum:
    type = refresh_checksum
    reason = course_package_changed
    coursePackageId = currentCoursePackageId
    accountNamespace = venue.accountNamespace
  catch mqttError:
    return response that tells Coach "course package persisted but TV refresh failed"

  return current venue course package state
```

建议明确处理 MQTT 发布失败：

```pseudo
if DB changed and mqtt failed:
  return 207-like body or 200 with warning:
    data: current venue course package state
    warning: "课程包已保存，但 TV 刷新指令发送失败，请点击刷新 TV"
```

这样避免 Coach 端误以为切换完全失败，实际上服务端场馆当前启用课程包已经变化。再次强调：这里不迁移、不修改课程/排课/动作/模板这些业务数据。

### TV Android

不改协议、不加接口、不加课程包判断，只做验证。TV 端收到刷新消息后仍调用原有课表 API；服务端负责按场馆当前启用课程包返回正确课表。

```pseudo
on MQTT refresh_checksum:
  request /api/tv/daily-checksum?accountNamespace=currentVenue
  if checksum changed:
    request /api/tv/daily-bundle?accountNamespace=currentVenue
    render schedule list returned by server
```

### MQTT Client / Ops

```pseudo
no required code change
verify outbound mqtt log contains:
  type=refresh_checksum
  reason=course_package_changed
  coursePackageId=<target>
  accountNamespace=<venue namespace>
```

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| MQTT 发布失败但服务端已保存场馆当前启用课程包 | Coach 看到新课表，TV 仍显示旧课表。 | 响应里返回已保存后的 data 和明确错误；Coach 保持服务端状态，并提示手动点“刷新 TV”。 |
| 正在上课时切换课程包 | TV 和 Coach session 可能引用旧 schedule，造成现场混乱。 | 继续保留 `isVenuePlaybackActive` 阻止切换；Coach 前端也禁用切换。 |
| 多课程包但 Coach 设置里没刷新到最新绑定 | Admin 刚绑定课程包后 Coach 端仍显示旧列表。 | 设置面板打开时可重新调用 `fetchVenueCoursePackages`，或提供刷新按钮。 |
| 只有一个课程包时隐藏入口 | 教练不知道当前场馆属于哪个课程包。 | 只有一个也显示，标记已选中和“当前场馆只绑定一个课程包”。 |
| SuperAdmin / venue account 作用域不同 | 超管可能需要按 venueId 切换；普通场馆账号只能切自己的场馆。 | 保持现有 server 规则，普通账号使用 `user.venueId`，不要信任客户端传入其它 venueId。 |
| 切换后 Coach daily bundle 与 TV daily bundle 不一致 | Coach 拉了新包，TV 没拉或拉失败。 | 切换成功后 Coach 立即拉 bundle；TV 通过 MQTT 刷新；失败时提示手动刷新 TV。 |
| TV 旧版本不支持 `refresh_checksum` | 部分旧设备不会更新课表。 | 验收覆盖当前线上最低 TV 版本；必要时 Coach 保留“刷新 TV”按钮兜底。 |
| 误把“切换课程包”实现成业务记录归属变更 | 课程、排课、动作、模板数据被错误改包，影响其它端。 | 实现和 code review 明确禁止修改业务记录归属；只改 `venues[].activeCoursePackageId` 和后续输出过滤。 |

## Manual E2E Acceptance

### Happy Flow

1. Admin 给某个场馆绑定两个课程包，例如 `Hybrid` 和 `12round`，并分别排不同课程。
2. Coach 端登录该场馆账号。
3. 打开设置。
4. 在课程包区域看到两个课程包，当前选中的课程包有明显选中态。
5. 点击另一个课程包。

Expected:

- Coach 显示切换中 loading。
- 切换成功后设置里选中态更新。
- Coach 课表列表刷新为目标课程包当天排课。
- TV 收到刷新指令后，课表变为目标课程包当天排课。
- Ops/MQTT 日志能看到 `refresh_checksum`，`reason=course_package_changed`。

### Single Package Flow

1. 场馆只绑定一个课程包。
2. Coach 打开设置。

Expected:

- 设置中仍显示这个课程包。
- 该课程包处于选中态。
- 不允许重复切换或点击后无副作用。

### Bad Flow

1. 场馆正在预览或上课。
2. Coach 打开设置并尝试切换课程包。

Expected:

- 切换按钮禁用，或点击后提示 `课程正在运行，结束后才能切换课程包。`
- 服务端不改变 `venues[].activeCoursePackageId`。
- TV 不刷新到其它课程包。

### MQTT Failure Flow

1. 临时让 MQTT gateway 不可用。
2. Coach 切换课程包。

Expected:

- 服务端不出现数据损坏。
- 如果服务端当前启用课程包已经保存，Coach 应明确提示 `课程包已保存，但 TV 刷新失败，请手动刷新 TV`。
- Coach 自身课表应与服务端当前启用课程包一致。
- 恢复 MQTT 后点击 `刷新 TV`，TV 能同步到当前课程包。

### Unauthorized Package Flow

1. 构造请求切换到未绑定该场馆的课程包。

Expected:

- Server 返回错误 `该课程包未绑定到当前场馆。`
- Coach 不改变选中态。
- TV 不刷新。

## Deployment / Rollback

- Build order:
  1. `apps/server` 如果需要加固 MQTT 失败响应，先部署 server。
  2. `apps/coach-web` 再部署 UI 入口迁移。
- Deploy order:
  1. Server
  2. Coach Web
- Version bump:
  - TV 不需要版本更新，除非验证发现当前 TV 版本无法响应 `refresh_checksum`。
- Rollback:
  - Coach UI 可回滚到顶部 toolbar select。
  - Server 回滚前需确认没有误改课程、排课、动作、模板等业务记录归属；本需求不新增字段，回滚风险低。

## Documentation Updates

- [x] Create this requirement document.
- [x] Update [Requirements Index](INDEX.md).
- [ ] Update [Code Map](../CODEMAP.md) only if implementation changes app ownership or introduces new service boundaries.
- [x] Mark status `Ready for QA` after implementation and test pass.

## Implementation Notes

- Server persists Coach course package switching to `venues[].activeCoursePackageId` and does not rewrite course, schedule, action, or template package ownership.
- TV still uses the existing daily bundle/checksum flow. It receives `refresh_checksum`, then calls the existing schedule API and receives server-filtered results.
- Coach Settings now owns the visible course package switcher. The console toolbar no longer exposes the package select.
- Added regression tests for persisted venue active package filtering and coach-web response normalization.
