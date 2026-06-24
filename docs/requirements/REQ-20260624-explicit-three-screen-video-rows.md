# REQ-20260624-explicit-three-screen-video-rows: 三屏视频行布局显式删加

## Status

- Status: Ready for QA
- Owner: course-web / server
- Created: 2026-06-24
- Updated: 2026-06-24
- Related docs:
  - [Code Map](../CODEMAP.md)
- Related code map sections:
  - `apps/course-web`
  - `apps/server`
  - `apps/tv-android`

## Requirement Summary

三屏视频组的行数和每行视频数量必须完全由编课者显式操作决定。系统不再根据“三行都选择 2 个视频”自动补出第 4、5 行，也不再因为某行切回 1 个视频而自动删掉末尾行。编课者点击删除就删除，点击添加就添加，最多 5 行，每行可独立选择 1 个或 2 个视频。

## Background

- 当前行为：course 端和 server 端都有旧兼容逻辑，会把 `[2,2,2]` 自动归一成 `[2,2,2,2,2]`。
- 问题：用户删除第 5 行成功后，再删除第 4 行会重新触发 `[2,2,2] -> [2,2,2,2,2]`，导致第五行“变回来”。
- 业务原因：现在 TV 已经具备高度自适应能力，4/5 行单列和两列都可以由 TV 按可用空间缩放，不需要 course 端强制限制。
- 已知约束：旧数据没有 rowLayouts 时仍默认三行单视频；已有 rowLayouts 只截断到最多五行。

## Goals

- 三屏 rowLayouts 保存为用户当前看到的显式行数组。
- 删除第 4/5 行后不再被自动补回。
- 新增行仍然最多 5 行，默认新增 1 个视频槽。
- TV 端继续按 rowLayouts 和卡片数量渲染，不新增字段。

## Non-goals

- 不改变 TV 的自适应高度算法。
- 不修改单屏瀑布流布局。
- 不迁移数据库中已有 rowLayouts；只改变后续读写规范化行为。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| 三屏站点视频布局自定义 | Refines | 从“自动 3/5 行”改为“显式 1-5 行”。 |
| TV 视频区域自适应 | Depends on | TV 已能根据可用高度压缩 1 列/2 列布局。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | UI model normalization | `normalizeVideoRowLayouts` 不再把 `[2,2,2]` 扩成五行。 |
| `apps/server` | payload normalization | server 保存模板/course 脚本时不再自动扩行，避免保存后行数回弹。 |
| `apps/tv-android` | Compatibility check | 无代码改动；继续按收到的 rowLayouts 渲染，缺失 rowLayouts 时按卡片数兼容旧数据。 |

## Data And API Impact

### Data Model

- New fields: none
- Changed fields: `videoGroup.screens[].rowLayouts` 的规范化规则改变。
- Backfill/default strategy: 不做批量迁移；空 rowLayouts 继续按三行单视频默认。
- Compatibility with old records: TV 对旧数据仍可根据卡片数量补足布局；course/server 不再主动生成额外行。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| Course/template save endpoints | Normalization | 保存时最多保留 5 行，但不再自动扩成 5 行。 |
| TV daily bundle / schedule bundle | Output | 输出和 DB 中 rowLayouts 保持一致，不新增字段。 |

## Implementation Sketch

### Server

```pseudo
normalizeRowLayouts(rowLayouts):
  if screenCount == 1:
    return []
  if missing:
    return [1,1,1]
  return rowLayouts.map(to 1 or 2).slice(0, 5)
```

### Web

```pseudo
on delete row:
  remove selected row
  trim videoCards to remaining row capacity

on add row:
  if row count < 5:
    append row with 1 slot
```

### TV

```pseudo
on render station screen:
  rows = rowLayouts from course bundle
  if missing:
    infer only for old data by card count
  calculate row heights from explicit row count
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 旧课程依赖 `[2,2,2]` 自动显示 5 行 | 这是旧隐式行为；编课者可显式添加第 4/5 行，保存后稳定。 |
| server 和 course 规范化不一致 | 两边同时移除自动扩展，并补单元测试。 |
| TV 行数少于卡片数 | TV 兼容逻辑仍会根据卡片数量继续补行；course/server 保存时会按行容量裁剪空槽位。 |

## Manual E2E Acceptance

### Happy Flow

1. 新建三屏视频组。
2. 把前三行都切到 2 个视频。
3. 添加第 4、5 行。
4. 删除第 5 行，再删除第 4 行。
5. 保存课程并重新打开。

Expected:

- 界面保留 3 行 `[2,2,2]`，第 4/5 行不会重新出现。
- TV 预览只显示 3 行两列布局。

### Bad Flow

1. 三屏视频组已经有 5 行时继续点击添加行。

Expected:

- 不再新增第 6 行。
- 已有卡片、站点和目标信息不被重排或清空。

## Deployment / Rollback

- Build order: `apps/server`, `apps/course-web`
- Deploy order: server first, then course-web
- Version bump: none
- Rollback: 回滚 server/course-web commit；无 DB 回滚。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
