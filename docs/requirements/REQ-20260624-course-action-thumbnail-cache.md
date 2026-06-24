# REQ-20260624-course-action-thumbnail-cache: Course 动作视频缩略图本地缓存

## Status

- Status: Ready for QA
- Owner: course-web
- Created: 2026-06-24
- Updated: 2026-06-24
- Related docs:
  - [Code Map](../CODEMAP.md)
- Related code map sections:
  - `apps/course-web`

## Requirement Summary

课程端所有动作视频展示窗口不再直接加载或自动播放视频，包含动作库列表、动作选择弹窗、课程三屏幕卡片、热身和冷身展示区域。页面先展示本地生成并缓存的缩略图，用户明确点击播放时才加载视频。缩略图不新增数据库字段，按动作唯一规则生成缓存 key，并在浏览器本地缓存达到 5GB 后按最早使用时间清理。

## Background

- 当前行为：部分动作展示区域使用 `<video>` 直接预加载视频首帧，三屏幕卡片和动作列表会在滚动浏览时消耗服务器流量。
- 问题：服务器流量较小，动作视频越多，编课端浏览动作和模板时越容易产生无意义的视频请求。
- 业务原因：编课人员需要快速识别动作，但大多数情况下只需要缩略图；只有确认动作细节时才需要播放视频。
- 已知约束：不新增缩略图字段，不改 DB；缩略图首次生成仍需要浏览器读取视频帧，后续命中本地缓存后不再请求视频。

## Goals

- 所有 course-web 的服务端动作展示区域默认显示缩略图占位。
- 用户点击后才创建真实播放器并播放视频。
- 缩略图写入 IndexedDB，本地缓存容量上限 5GB，超过后删除最早使用记录。
- 缓存 key 由动作 id、视频地址、更新时间组合生成，动作换视频后自动失效。

## Non-goals

- 不给 server 数据库增加 thumbnail 字段。
- 不改 TV、coach、admin 的视频播放逻辑。
- 不处理视频转码或服务端预生成缩略图。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| Course 动作库缩略图预览 | Extends | 保留点击动作列表缩略图弹窗播放的体验，但列表本身不再预加载视频。 |
| 三屏幕动作布局 | Extends | 三屏幕卡片继续显示动作画面，但改为缩略图缓存。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | UI / action media cache | 新增 IndexedDB 缩略图缓存工具，替换动作视频展示组件。 |
| `apps/server` | None | 不新增 API 和 DB 字段。 |
| `apps/coach-web` | None | 无影响。 |
| `apps/admin-web` | None | 无影响。 |
| `apps/tv-android` | None | 无影响。 |

## Data And API Impact

### Data Model

- New fields: none
- Changed fields: none
- Backfill/default strategy: 不需要回填；浏览器首次浏览动作时自行生成缓存。
- Compatibility with old records: 旧动作只要有 `media.url` 就能生成缩略图；没有视频时显示空状态。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| Existing action/course/template APIs | None | 继续读取已有 `media.url` 和 `updateTime`。 |

## Implementation Sketch

### Web

```pseudo
render action media:
  sourceUrl = action.media.url
  cacheKey = hash(action.id + action.updateTime + sourceUrl)
  if thumbnail exists in IndexedDB:
    render image
  else if thumbnail enters viewport:
    create detached video
    seek to early frame
    draw frame to canvas
    save jpeg blob into IndexedDB
    prune cache to 5GB by oldest updatedAt

on user click:
  create video element with controls + autoplay
```

## Risks

| Risk | Mitigation |
| --- | --- |
| OSS/CORS 不允许 canvas 抽帧 | 抽帧失败时保留占位，不阻塞编辑；用户点击后仍可播放视频。 |
| 浏览器 IndexedDB 空间不足或被禁用 | 缓存读写失败只影响性能，不影响功能。 |
| 三屏幕卡片点击被播放器抢走 | 卡片区域使用非交互缩略图，继续由卡片点击打开编辑弹窗。 |
| 首次生成缩略图仍产生视频请求 | 只在进入视口附近生成，且生成后本地复用。 |

## Manual E2E Acceptance

### Happy Flow

1. 打开 course-web 动作库。
2. 浏览动作列表，确认列表显示缩略图或缩略图生成占位。
3. 点击某个动作缩略图。

Expected:

- 列表不会直接播放视频。
- 点击后弹窗才加载并播放动作视频。
- 第二次回到同一动作时缩略图从本地缓存显示更快。

### Bad Flow

1. 打开一个没有视频的动作。
2. 打开一个视频抽帧失败的动作。

Expected:

- 没有视频时显示“无视频/暂无视频”。
- 抽帧失败不影响编辑和点击播放，页面不会白屏或报错。

## Deployment / Rollback

- Build order: `apps/course-web`
- Deploy order: course-web only
- Version bump: web asset deploy only
- Rollback: 回滚 course-web 前端 commit 即可，无 DB 回滚。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
