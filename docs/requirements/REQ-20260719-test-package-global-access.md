# REQ-20260719-test-package-global-access: 测试课程包全局读写

## Status

- Status: Ready for QA
- Owner: Codex
- Created: 2026-07-19
- Updated: 2026-07-19
- Related docs: [Coach 设置中切换场馆课程包](REQ-20260619-coach-course-package-switch-settings.md)
- Related code map sections: `apps/server`, `apps/course-web`

## Requirement Summary

现有“测试课程包”用于科技园场馆验证新课程和系统能力。该课程包需要跨越普通课程包的数据隔离，读取并直接编辑所有课程包的课程、动作、动作类型、课程类型和模板。全局访问只由课程包配置触发，不把正式资源批量迁移或重复挂载到测试课程包；测试包中新建的资源及排课仍归属测试课程包。

## Background

- 当前行为：Server 按当前课程包过滤动作、类型、课程、模板和排课，并拒绝跨包引用或写入。
- 问题：科技园启用测试课程包后，只能看到测试包自身内容，无法复用正式课程和动作验证系统。
- 业务原因：目前开发与测试由同一名开发人员完成，测试课程包需要直接操作所有正式数据。
- 已知约束：现有测试课程包 ID 为 `3`，但业务代码不能写死 ID 或名称；科技园 `venue-432a10d5` 已绑定并启用该课程包。

## Goals

- 为课程包增加显式访问策略：`PACKAGE_ONLY` 或 `GLOBAL`。
- 当前课程包为 `GLOBAL` 时，Server 查询接口返回所有课程包的动作、类型、课程和模板。
- `GLOBAL` 测试包允许直接编辑或删除其他课程包的资源，仍遵守现有引用、排课和删除保护。
- 编辑已有跨包资源时保持其原课程包归属；新建资源默认归属当前测试课程包。
- 测试课程包允许创建引用任意课程的排课，排课自身 `coursePackageId` 仍为测试课程包。
- 普通课程包隔离行为完全不变。

## Non-goals

- 不批量修改课程、动作、类型或模板的课程包归属。
- 不把全部资源 ID 写入测试课程包的 `courseIds` 等索引。
- 不为 TV 或 Coach 增加“全局课程包”协议。
- 不改变科技园以外场馆的当前课程包。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [Coach 设置中切换场馆课程包](REQ-20260619-coach-course-package-switch-settings.md) | Extends | 场馆仍只持久化 `activeCoursePackageId`；全局访问由目标课程包配置决定。 |
| 课程包隔离 | Exception | 普通课程包继续严格隔离，只有显式 `GLOBAL` 包放宽范围。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | Data / scope / validation / schedule | 保存访问策略，集中解析可见范围，允许 GLOBAL 跨包读写及排课引用。 |
| `apps/course-web` | Resource list / source labeling | 接收全量资源，不做客户端二次隔离；跨包资源显示来源课程包。 |
| `apps/coach-web` | None | 继续读取测试包排课。 |
| `apps/tv-android` | None | 继续读取 Server 组装的 schedule bundle。 |
| `apps/admin-web` | None in this iteration | 访问策略先通过 DB 配置，不新增管理 UI。 |

## Data And API Impact

### Data Model

- New field: `coursePackages[].accessScope`, enum `PACKAGE_ONLY | GLOBAL`。
- Backfill/default strategy: 缺失或非法值统一按 `PACKAGE_ONLY`。
- Existing production setting: 只给 `测试课程包(id=3)` 设置 `GLOBAL`。
- Compatibility: 字段为附加字段，不迁移现有课程、动作、类型、模板或排课。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET /api/meta` | 当前包为 GLOBAL 时按请求开关返回所有编辑资源。 | 普通包不变。 |
| `GET /api/actions` / `action-types` | GLOBAL 返回全部动作与动作类型。 | 普通包继续过滤。 |
| `GET /api/courses` / `courses/options` / `lesson-types` | GLOBAL 返回全部课程、课程选项和课程类型。 | 普通包继续过滤。 |
| Templates APIs | GLOBAL 返回全部模板。 | 普通包继续过滤。 |
| Save/Delete APIs | GLOBAL 可操作跨包已有资源；新增资源写入测试包。 | 原有删除保护继续生效。 |
| Schedule APIs | GLOBAL 可引用任意现存课程，schedule 归属测试包。 | TV/Coach payload 不变。 |

## Implementation Sketch

### Server

```pseudo
normalizeAccessScope(package):
  return package.accessScope == GLOBAL ? GLOBAL : PACKAGE_ONLY

resolvePackageScope(requestedPackageId):
  package = findPackage(requestedPackageId)
  if package.accessScope == GLOBAL:
    return ALL_PACKAGE_IDS
  return [requestedPackageId]

read(resource, requestedPackageId):
  visibleIds = resolvePackageScope(requestedPackageId)
  return resources belonging to visibleIds

write(existingResource, requestedPackageId, payload):
  if requested package is GLOBAL and existingResource exists:
    preserve existingResource package ownership
    allow update/delete
  else:
    apply normal package permission checks
  if new resource:
    assign requestedPackageId

createSchedule(courseId, requestedPackageId):
  if requested package GLOBAL:
    allow any existing courseId
  schedule.coursePackageId = requestedPackageId
```

### Course Web

```pseudo
load resources with current coursePackageId
trust server scope; do not filter GLOBAL results again
for each resource from another package:
  show source package label
on create:
  send current test package id
on edit:
  preserve returned resource package id
```

### TV / Coach

```pseudo
no protocol changes
read schedules whose coursePackageId is the active test package
server resolves referenced course and resources into the existing bundle
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 测试人员直接修改正式资源 | 这是本需求明确允许的行为；继续保留删除引用保护、审计字段和 DB 备份。 |
| GLOBAL 规则散落导致部分 API 仍过滤 | 由 Server 集中 scope helper 解析，相关列表和写入测试覆盖。 |
| 新建资源错误归属原资源包 | 新建时始终使用当前请求的测试课程包 ID。 |
| 测试排课因课程原归属不同被 TV 过滤 | schedule 归属测试包，Server bundle 按 courseId 解析，不让 TV 自行判断资源包。 |
| 同名资源难以区分 | Course 列表显示来源课程包并始终以 ID 操作。 |
| 缓存残留旧隔离结果 | 请求和缓存 key 必须包含当前课程包 ID；切换包后重新加载。 |

## Manual E2E Acceptance

### Happy Flow

1. 科技园启用测试课程包，进入 Course 动作库。
2. 能看到 Hybrid、12round 与测试包动作，并显示来源课程包。
3. 直接修改一个 Hybrid 动作并保存，资源仍属于 Hybrid。
4. 在测试包新建动作，资源归属测试包。
5. 在测试包排任意正式课程，排课归属测试包。
6. Coach/TV 在科技园看到并正常预览该排课。

Expected:

- 跨包资源可读写，新资源归属明确，TV/Coach 无需升级。

### Bad Flow

1. 切回 Hybrid 或 12round。

Expected:

- 只看到对应课程包资源，不获得 GLOBAL 能力。

2. 删除仍被未来排课引用的正式课程。

Expected:

- 继续被现有删除保护拒绝。

3. 请求不存在的课程包或不存在的跨包课程。

Expected:

- Server 返回明确 4xx，不产生孤立排课。

## Deployment / Rollback

- Build order: Server tests/build -> Course tests/typecheck/build。
- Deploy order: Server -> DB 设置测试包 `accessScope=GLOBAL` -> Course。
- Version bump: TV/Coach 不需要。
- Rollback: 将测试包 `accessScope` 改回 `PACKAGE_ONLY` 或删除字段；回滚 Server/Course，不需要回写业务资源。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md).
- [x] Mark Ready for QA after tests pass.
- [ ] Mark Shipped after production deployment and DB configuration.
