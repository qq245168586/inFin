# REQ-20260625-course-week-schedule-light-api: Course 课表轻量周查询

## Status

- Status: Ready for QA
- Owner: course-web / server
- Created: 2026-06-25
- Updated: 2026-06-25
- Related docs:
  - [Code Map](../CODEMAP.md)
- Related code map sections:
  - `apps/server`
  - `apps/course-web`

## Requirement Summary

Course 首页课表不再通过 `/api/meta?courseDetail=full` 一次性拉取所有课程脚本和全部课表。首页只拉轻量 meta、再按周读取当前课程包课表；切换日期时传入日期，server 返回该日期所在周，不传日期时返回服务器当前周。进入课程编辑器或从课程生成模板时，才按课程 id 拉取单个课程的完整脚本，避免小带宽服务器被大 payload 压垮。

## Background

- 当前行为：course-web 初始化时使用 `/api/meta?courseDetail=full`，会把课程列表、每个课程完整 `script`、课表数据一起返回。
- 问题：课程越来越多后，课表页只需要课程摘要和本周排课，却会下载所有课程内容。
- 业务原因：编课者高频使用首页排课，课程脚本只有进入编辑课程或从课程生成模板时才需要。
- 已知约束：不能破坏旧兜底接口；不能改 DB；TV/coach/admin 不在本次范围。

## Goals

- `course-web` 默认 meta 请求不带课程完整脚本，也不带 schedules。
- 新增按周课表 API：传 `date` 返回该日期所在周；不传则按 server 当前日期返回本周。
- 首页周切换、添加、删除、复制排课后只刷新目标周课表。
- 课程列表继续显示 summary 信息；点击“编辑”时只拉当前课程详情。
- 整课模板“从已有课程生成”也只在选择具体课程时拉该课程详情。
- 保留 `/api/meta?courseDetail=full` 作为兼容和排障兜底。

## Non-goals

- 不修改数据库结构和已有排课记录。
- 不修改 TV 今日课表、coach 控制、admin 管理接口。
- 不移除旧 `/api/schedules?scope=` 或 `/api/meta?courseDetail=full`。
- 不改变课程保存、删除、复制排课的业务规则。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [REQ-20260618-copy-specific-week-schedules](REQ-20260618-copy-specific-week-schedules.md) | Extends | 复制后只刷新目标周，而不是重拉整份 meta。 |
| [REQ-20260621-server-request-compat-store-refactor](REQ-20260621-server-request-compat-store-refactor.md) | Follows | 新读取逻辑落在 `schedule-store`，HTTP 层只做参数解析。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | API / schedule read / meta shaping | 新增周课表读接口；扩展 meta 参数；不写 DB。 |
| `apps/course-web` | UI / schedule data flow / course detail loading | 首页轻量加载，编辑课程和课程模板按 id 拉详情。 |
| `apps/coach-web` | None | 仍使用原有 meta/课表路径。 |
| `apps/admin-web` | None | 仍使用原有 meta 默认 summary。 |
| `apps/tv-android` | None | TV bundle 和 daily API 不变。 |

## Data And API Impact

### Data Model

- New fields: none
- Changed fields: none
- Backfill/default strategy: 不需要回填。
- Compatibility with old records: 继续通过 `attachCourseBasics` 给 schedule 附加课程摘要；课程被删时仍显示 `courseDeleted`。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET /api/schedules/week?date=YYYY-MM-DD&coursePackageId=ID` | New | 返回 `{ date, weekStart, weekEnd, weekEndExclusive, schedules }`；`date` 为空时使用服务器当前日期。 |
| `GET /api/meta?includeSchedules=0` | Extended | 返回稳定 schedules 空数组结构，不再把课表塞进 meta。 |
| `GET /api/meta?courseDetail=full&courseId=ID` | Extended | 只把指定课程替换为 full，其余课程保持 summary；`courseDetail=full` 无 `courseId` 时仍返回全部 full。 |
| `GET /api/courses/:id` | Existing reuse | course-web 编辑入口使用它获取单课程完整脚本。 |

## Implementation Sketch

### Server

```pseudo
GET /api/schedules/week:
  user = optional console auth
  targetDate = query.date || serverToday
  weekStart = mondayOf(targetDate)
  schedules = state.schedules
    .map(attachCourseBasics)
    .filter(user visible package)
    .filter(coursePackageId if provided)
    .filter(beginTime inside weekStart..weekEndExclusive)
  return sorted schedules

GET /api/meta:
  includeSchedules = query.includeSchedules not false
  includeFullCourses = query.courseDetail == full
  if includeFullCourses && query.courseId:
    courses = summaries with only selected course full
  else if includeFullCourses:
    courses = all full
  else:
    courses = summaries
```

### Course Web

```pseudo
MetaProvider.reload:
  fetch /api/meta?coursePackageId=current&includeSchedules=0

Home schedule VM:
  on selected week/package change:
    fetch /api/schedules/week?date=anchor&coursePackageId=current
    show local loading strip
  after save/delete/copy:
    refresh affected week only

CoursesRoute.openEditor(course):
  if course.script exists:
    open editor
  else:
    show busy "正在加载课程内容..."
    course = GET /api/courses/:id
    open editor

CourseTemplateEditor.applySourceCourse(course):
  load course detail by id before cloning script
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 列表 summary 缺少编辑器需要的 `script` | 所有打开编辑器路径先拉 `GET /api/courses/:id`。 |
| 周切换请求乱序导致显示旧周 | course schedule VM 使用 request sequence，只接受最后一次响应。 |
| 课表加载期间用户以为空白 | 首页显示局部 loading strip，不遮住整页。 |
| 旧客户端依赖 full meta | 保留 `courseDetail=full` 全量兜底。 |
| DB 被误改 | 本需求新增接口为只读；保存/删除/复制沿用现有函数。 |

## Manual E2E Acceptance

### Happy Flow

1. 打开 course-web 首页。
2. 在 Network 中确认 `/api/meta` 没有 `courseDetail=full`，并带 `includeSchedules=0`。
3. 切换下一周或日期选择器到任意日期。
4. 点击课表卡片右下角“编辑课程”。

Expected:

- 首页课表通过 `/api/schedules/week` 加载。
- 周切换期间只出现局部“正在加载课表...”提示。
- 点击编辑后才出现 `/api/courses/:id` 或单课程详情请求。
- 编辑器内容完整，可保存。

### Bad Flow

1. 打开一个已删除课程的历史排课。
2. 在课程列表中快速连续切换多周。
3. 断网后点击编辑课程。

Expected:

- 已删除课程不显示编辑入口。
- 最终显示最后一次选择的周。
- 详情请求失败时提示错误，不打开空白编辑器。

## Deployment / Rollback

- Build order: `apps/server`, `apps/course-web`
- Deploy order: server first, then course-web
- Version bump: web asset deploy only
- Rollback: 回滚 server/course-web commit 即可；无 DB 迁移。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
