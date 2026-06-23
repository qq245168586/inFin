# REQ-20260621-course-schedule-i18n-today-button: Course 课表俄语文案与今天跳转

## Status

- Status: Shipped
- Owner: Codex
- Created: 2026-06-21
- Updated: 2026-06-21
- Related docs:
  - [Requirement Workflow](README.md)
  - [Code Map](../CODEMAP.md)
- Related code map sections:
  - `apps/course-web`

## Requirement Summary

Course 端在俄语模式下，课表页面仍有部分中文按钮和文案没有被翻译，影响编课者使用。排课页面的周切换区域需要新增“今天”按钮，点击后回到今天所在周，并选中今天这个日期。完成后不改变排课数据、接口或数据库，只修复前端展示和日期定位交互。

## Background

- 当前行为：课表页有“上一周 / 下一周 / 日期选择 / 编辑课程 / 删除”等硬编码中文，俄语词表也缺少部分新增文案。
- 问题：切换俄语时仍可见中文按钮；从任意周切回今天需要手动点日期选择。
- 业务原因：编课人员需要在多语言环境下稳定使用排课功能，并快速回到当天排课。
- 已知约束：不修改排课 API，不改变课程包过滤和排课保存逻辑。

## Goals

- 课表首页和日历卡片的新增/常用中文文案能在俄语和英语模式下正确显示。
- 在“上一周 / 下一周”按钮组中增加“今天”按钮。
- 点击“今天”后：
  - 切换到本周视图。
  - `scheduleAnchorDate` 回到今天。
  - `selectedScheduleDate` 选中今天。

## Non-goals

- 不重做 course 端整体 i18n 架构。
- 不调整服务端排课接口。
- 不改 coach / TV 的课表显示。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [REQ-20260618-copy-specific-week-schedules](REQ-20260618-copy-specific-week-schedules.md) | 相关 | 同属 course 端排课页交互增强。 |
| [REQ-20260618-schedule-card-edit-course-entry](REQ-20260618-schedule-card-edit-course-entry.md) | 相关 | 课表 item 中“编辑课程”按钮需要补齐 i18n。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | UI / i18n / schedule | 补翻译、接入 `useI18n`、新增今天跳转。 |

## Data And API Impact

### Data Model

- New fields: none
- Changed fields: none
- Backfill/default strategy: none
- Compatibility with old records: no data impact

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| none | none | no API change |

## Implementation Sketch

### Web

```pseudo
HomeRoute:
  pass vm.goToday to HomePage

useHomeScheduleVm:
  goToday():
    setHomeTab("currentWeek")
    setScheduleAnchorDateRaw(todayValue())
    setSelectedScheduleDate(todayValue())

HomePage:
  const { t } = useI18n()
  render Prev / Today / Next buttons with t()

CalendarBoard:
  const { t } = useI18n()
  translate delete/edit/empty/meta prefixes
```

## Risks

| Risk | Mitigation |
| --- | --- |
| DOM mutation translator and explicit `t()` duplicate work | `t()` returns source in Chinese mode and exact translated text in other locales; DOM translator only sees already-translated text and leaves it stable. |
| Today button not selecting today's date when currently in history/last week | `goToday` forces `currentWeek` and updates both anchor and selected date. |
| Missing phrase leaves Chinese in Russian UI | Add exact translations for all touched schedule texts in `en.ts` and `ru.ts`. |

## Manual E2E Acceptance

### Happy Flow

1. Course 端切换语言为俄语。
2. 进入首页课表。
3. 查看周切换按钮、日期选择、课表卡片操作按钮。
4. 点击“下一周”到未来周，再点击“今天”。

Expected:

- 页面不再显示本次触及的中文按钮。
- 点击“今天”后回到今天所在周，并选中今天日期。

### Bad Flow

1. 切换到历史排课。
2. 再回到本周或点击今天。

Expected:

- 不报错，不影响已加载排课。
- 过去日期仍按现有规则禁用删除。

## Deployment / Rollback

- Build order: `apps/course-web`
- Deploy order: course web static bundle
- Version bump: none
- Rollback: restore previous course web bundle

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [ ] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
