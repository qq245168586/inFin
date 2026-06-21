# REQ-20260618-copy-specific-week-schedules: 复制指定周排课

## Status

- Status: Ready for QA
- Owner: Course scheduling
- Created: 2026-06-18
- Updated: 2026-06-21
- Related docs:
  - [课程课表元数据与 TV 展示改造](../course-schedule-metadata-redesign.md)
  - [课程端/场馆管理端拆分需求](../course-web-separation-requirements.md)
- Related code map sections:
  - [course-web](../CODEMAP.md#appscourse-web)
  - [server](../CODEMAP.md#appsserver)

## Requirement Summary

当前首页课表只有“一键复制上周排课”，固定把上一周复制到当前周。新需求是把这个按钮升级为“复制指定周排课”：点击后弹出周选择弹窗，编课者可以选择一个过去周或本周作为来源周，再选择一个未来的目标周，把来源周的所有排课复制到目标周。

复制仍然按课程包隔离，只复制当前选中课程包下的排课。目标周必须是未来周，避免覆盖已经发生或正在发生的课程安排。

## Background

- 当前行为：
  - Course 首页有按钮“一键复制上周排课”。
  - 前端调用 `copyLastWeekSchedules(coursePackageId)`。
  - 服务端接口是 `POST /api/schedules/copy-last-week`。
  - 服务端固定取上周排课，复制到本周。
- 问题：
  - 编课者不能选择更早的历史周。
  - 编课者不能把历史周复制到指定未来周。
  - 如果课程结构按月或训练周期复用，固定“上周 -> 本周”不够用。
- 业务原因：
  - 排课越来越接近“课程包的发布机制”，需要支持更灵活的周计划复用。
  - 编课端现在已经支持查看历史和未来周，复制能力也要跟上。
- 已知约束：
  - 排课现在按日期保存，时间字段兼容保留为当天 `00:00`。
  - 过去日期不能新增/编辑排课。
  - 课程包是排课边界，不允许跨课程包复制。

## Goals

- 将“一键复制上周排课”改为“复制周排课”或“复制指定周”。
- 点击按钮后打开弹窗，选择：
  - 来源周：可以选择过去周或本周。
  - 目标周：只能选择未来周。
- 复制来源周内当前课程包的所有排课到目标周，保持星期几相对位置一致。
- 如果目标周已有排课，必须二次确认；确认后覆盖目标周当前课程包排课。
- 保持旧数据兼容，不做破坏性数据库迁移。

## Non-goals

- 不做单日复制。
- 不做跨课程包复制。
- 不改 TV / Coach 的课表展示样式。
- 不引入具体开课时间；仍保持按天排课。
- 不处理预约/签到场景的时间段能力。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `course-schedule-metadata-redesign.md` | Extends | 原文只描述“复制上周排课”，本需求升级为可选择过去周或本周复制到未来周。 |
| `course-web-separation-requirements.md` | Aligns | 其中提到“支持复制上周 / 复制某天排课”，本需求先实现周级复制。 |
| `HomePage` 当前复制按钮 | Replaces | 当前按钮文案和行为都需要更新。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | API / schedule copy logic | 新增或升级复制周接口；按课程包和用户权限过滤；目标周覆盖策略。 |
| `apps/course-web` | UI / schedule view model | 新增复制周弹窗；替换按钮文案；调用新接口；显示确认和错误提示。 |
| `apps/coach-web` | No direct change | Coach 读取复制后的排课结果。 |
| `apps/tv-android` | No direct change | TV daily bundle 读取复制后的排课结果。 |
| `apps/admin-web` | No direct change | 无需参与排课复制。 |
| `apps/mqtt-client` | No direct change | 不涉及 MQTT 指令。 |
| `apps/ops-web` | Optional | 后续可增加排课复制日志查看，但不是本需求范围。 |

## Data And API Impact

### Data Model

- New fields: none.
- Changed fields: none.
- Backfill/default strategy: none.
- Compatibility with old records:
  - 旧排课仍使用 `beginTime` 或 `date` 推导日期。
  - 复制时保留 `courseId`、`coursePackageId`、`courseName`、`version`、`duration`。
  - 目标日期按来源周内的 weekday 偏移计算。

### API

建议新增新接口，保留旧接口兼容：

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `POST /api/schedules/copy-week` | 新增。入参：`coursePackageId`, `sourceWeekStart`, `targetWeekStart`, `replaceExisting`。 | 新能力主接口。 |
| `POST /api/schedules/copy-last-week` | 保留。内部可转调 `copy-week`。 | 兼容旧前端/旧脚本。 |
| `GET /api/schedules` | 不变。 | 可继续按 scope/coursePackageId 拉取排课。 |

请求示例：

```json
{
  "coursePackageId": 1,
  "sourceWeekStart": "2026-06-01",
  "targetWeekStart": "2026-06-22",
  "replaceExisting": true
}
```

响应示例：

```json
{
  "data": [
    {
      "id": 123,
      "courseId": 18,
      "coursePackageId": 1,
      "date": "2026-06-22",
      "beginTime": "2026-06-22T00:00:00.000+08:00"
    }
  ]
}
```

## Implementation Sketch

### Server

新增通用周复制方法，旧 `copyLastWeekSchedules` 可复用它。

```pseudo
POST /api/schedules/copy-week:
  user = requireAuthorizedConsoleUser(request)
  payload = readJsonBody(request)

  coursePackageId = resolveWriteCoursePackageId(user, payload.coursePackageId)
  sourceWeekStart = startOfWeek(payload.sourceWeekStart)
  targetWeekStart = startOfWeek(payload.targetWeekStart)

  if sourceWeekStart > startOfWeek(today):
    return 400 "来源周必须是过去周或本周"

  if targetWeekStart <= startOfWeek(today):
    return 400 "目标周必须是未来周"

  sourceSchedules = schedules where:
    same coursePackageId
    begin/date in [sourceWeekStart, sourceWeekStart + 7 days)
    visible to user

  if sourceSchedules is empty:
    return 400 "来源周没有排课"

  targetSchedules = schedules where same coursePackageId and in target week
  if targetSchedules exists and !replaceExisting:
    return 409 "目标周已有排课"

  remove targetSchedules for that coursePackageId

  copied = sourceSchedules.map(schedule):
    offsetDays = date(schedule) - sourceWeekStart
    targetDate = targetWeekStart + offsetDays
    return new schedule with new id, targetDate beginTime, same course/coursePackage/version/duration

  persist()
  return copied
```

### Course Web

替换按钮行为：按钮不直接复制，先打开弹窗。

```pseudo
onClickCopySchedule:
  open CopyWeekScheduleDialog

dialog state:
  sourceWeekStart = currentWeekStart(today)
  targetWeekStart = nextWeekStart(today)
  replaceExisting = false

onConfirm:
  call copyWeekSchedules({
    coursePackageId: activeCoursePackageId,
    sourceWeekStart,
    targetWeekStart,
    replaceExisting
  })

if API returns 409:
  show confirm "目标周已有排课，是否覆盖？"
  retry with replaceExisting = true
```

UI 建议：

- 按钮文案：`复制指定周排课`。
- 弹窗字段：
  - 来源周：`input type="week"` 或日期选择器 + 自动转周一，可选过去周或本周。
  - 目标周：`input type="week"` 或日期选择器 + 自动转周一。
  - 辅助文案：显示 `2026/06/01 - 2026/06/07 -> 2026/06/22 - 2026/06/28`。
- 限制：
  - 来源周不能选择未来周。
  - 目标周不能选择本周/过去周。

### TV / Coach

```pseudo
no direct change:
  TV and Coach keep reading current schedule APIs
  copied schedules appear after course-web reloadMeta
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 覆盖目标周已有排课导致误删 | 默认不覆盖；目标周已有排课时弹确认，再传 `replaceExisting=true`。 |
| 跨课程包复制导致数据污染 | 服务端强制使用 `resolveWriteCoursePackageId` 和用户可见课程包过滤。 |
| 来源周空数据 | 服务端返回明确错误，前端 toast 提示。 |
| 周起始日不一致 | 统一使用周一作为 week start，与当前课表周视图保持一致。 |
| 时区导致日期偏移 | 保存仍走现有 `composeCnDateTime(date, "00:00")` / 服务端现有日期工具，按 Asia/Shanghai 处理。 |

## Manual E2E Acceptance

### Happy Flow 1: 复制过去一周到未来一周

1. 登录 course 端，选择一个课程包。
2. 确认 2026/06/01 周有排课。
3. 点击 `复制指定周排课`。
4. 来源周选择 2026/06/01，目标周选择 2026/06/22。
5. 点击确认。

Expected:

- 页面提示复制成功。
- 课表跳转/查看到目标周时，能看到与来源周同星期分布一致的课程。
- Coach/TV 刷新对应日期后能读取到复制后的排课。

### Happy Flow 2: 目标周已有排课并确认覆盖

1. 先在目标周添加一节课程。
2. 再执行复制指定周到该目标周。
3. 弹出“目标周已有排课，是否覆盖？”确认。
4. 点击确认覆盖。

Expected:

- 目标周原排课被当前课程包的新复制结果替换。
- 其它课程包的目标周排课不受影响。

### Bad Flow 1: 来源周没有排课

1. 选择一个没有排课的过去周作为来源周。
2. 选择合法未来周作为目标周。
3. 点击确认。

Expected:

- 不创建任何新排课。
- 显示错误：来源周没有排课。

### Bad Flow 2: 选择非法日期

1. 来源周选择未来周。
2. 或目标周选择过去周/本周。

Expected:

- 前端禁止确认，或服务端返回明确错误。
- 不创建任何新排课。

### Bad Flow 3: 课程包隔离

1. 在 Hybrid 课程包执行复制。
2. 切换到 12ROUNDS 课程包查看同一目标周。

Expected:

- 12ROUNDS 不出现 Hybrid 复制出来的课程。
- 反向同理。

## Deployment / Rollback

- Build order:
  1. `apps/server`
  2. `apps/course-web`
- Deploy order:
  1. 部署 server，保留旧 `copy-last-week` 接口。
  2. 部署 course-web 使用新接口。
- Version bump:
  - Web 不需要版本号。
- Rollback:
  - 前端可回滚到旧按钮。
  - 服务端新增接口为 additive change，保留不影响旧功能。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [ ] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs after shipped.
