# REQ-20260618-schedule-card-edit-course-entry: 课表卡片快速编辑课程入口

## Status

- Status: Ready for QA
- Owner: Course scheduling
- Created: 2026-06-18
- Updated: 2026-06-18
- Related docs:
  - [复制指定周排课](REQ-20260618-copy-specific-week-schedules.md)
  - [课程课表元数据与 TV 展示改造](../course-schedule-metadata-redesign.md)
- Related code map sections:
  - [course-web](../CODEMAP.md#appscourse-web)

## Requirement Summary

课程端首页课表里的每一个排课 item，都需要在右下角显示一个紫色底、白色字的 `编辑课程` 按钮。按钮只在排课能找到原课程时显示；如果课程已删除或当前课程包数据里找不到课程，则不显示。

点击按钮后，从课表页切到课程页，并在课程页新开或激活一个课程编辑 tab，让编课人员可以快速定位并修改这节课。

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | UI / page coordination | 课表卡片和历史排课表格增加编辑按钮；从首页跳到课程编辑 tab。 |
| `apps/server` | No change | 现有 `/api/meta` 已返回 schedule.courseId 和课程详情。 |
| `apps/tv-android` | No change | TV 不参与编课入口。 |
| `apps/coach-web` | No change | Coach 不参与编课入口。 |

## Implementation Sketch

```pseudo
HomeRoute:
  enrich schedule with courseDeleted
  render edit button only when !courseDeleted && courseId

on click edit course:
  AppRoot.setCourseEditorOpenRequest({ courseId, requestId })
  AppRoot.setActivePage("courses")

CoursesRoute:
  useEffect when courseEditRequest changes:
    course = current package courses.find(id == request.courseId)
    if not found:
      show notice
      return
    tabsVm.openCourseEditor(course)
```

## Manual QA

Happy flow:

1. 在首页周课表里找到一节正常排课，点击右下角 `编辑课程`。
2. 页面切到 `课程`，出现 `编辑课程` tab，并加载对应课程内容。
3. 回到首页 `全部排课`，点击一节历史排课的 `编辑课程`，也能打开对应课程。
4. 同一个课程连续点击两次，只激活已有编辑 tab，不重复开多个同课 tab。

Bad flow:

1. 排课显示为 `课程已删除` 时，不显示 `编辑课程` 按钮。
2. 如果当前课程包数据里找不到该课程，不打开编辑 tab，并提示找不到课程。

