# REQ-20260624-course-action-thumbnail-cache: Course 动作视频服务端缩略图与本地缓存

## Status

- Status: Ready for QA
- Owner: course-web / server
- Created: 2026-06-24
- Updated: 2026-06-24
- Related docs:
  - [Code Map](../CODEMAP.md)
- Related code map sections:
  - `apps/course-web`

## Requirement Summary

课程端所有动作视频展示窗口不再直接加载或自动播放视频，包含动作库列表、动作选择弹窗、课程三屏幕卡片、热身和冷身展示区域。页面先展示服务端生成的动作视频缩略图，并把图片持久化缓存到浏览器 IndexedDB，用户明确点击播放时才加载视频。缩略图不新增数据库字段，服务端按动作和视频版本派生文件名，浏览器按同样规则生成缓存 key，并在本地缓存达到 5GB 后按最早使用时间清理。

## Background

- 当前行为：部分动作展示区域使用 `<video>` 直接预加载视频首帧，三屏幕卡片和动作列表会在滚动浏览时消耗服务器流量；前端 canvas 抽帧对少数视频编码/seek 行为不稳定。
- 问题：服务器流量较小，动作视频越多，编课端浏览动作和模板时越容易产生无意义的视频请求。
- 业务原因：编课人员需要快速识别动作，但大多数情况下只需要缩略图；只有确认动作细节时才需要播放视频。
- 已知约束：不新增缩略图字段，不改 DB；服务端需要可调用 `ffmpeg` 从本地媒体或 OSS 视频 URL 生成 JPG。

## Goals

- 所有 course-web 的动作展示区域默认显示缩略图占位。
- 用户点击后才创建真实播放器并播放视频。
- 首次缺失缩略图时调用 server API 生成/读取服务端 JPG。
- 缩略图写入浏览器 IndexedDB，本地缓存容量上限 5GB，超过后删除最早使用记录。
- 缓存 key 由动作 id、视频地址、更新时间组合生成，动作换视频后自动失效。

## Non-goals

- 不给 server 数据库增加 thumbnail 字段。
- 不改 TV、coach、admin 的视频播放逻辑。
- 不把缩略图 URL 写入 action/media 数据结构。
- 不做视频转码，只抽取单帧 JPG。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| Course 动作库缩略图预览 | Extends | 保留点击动作列表缩略图弹窗播放的体验，但列表本身不再预加载视频。 |
| 三屏幕动作布局 | Extends | 三屏幕卡片继续显示动作画面，但改为缩略图缓存。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | UI / action media cache | IndexedDB 缩略图缓存继续保留，缓存源改为 server 生成的 JPG。 |
| `apps/server` | API / media thumbnail | 新增鉴权缩略图接口，按 action 派生服务端 JPG 缓存，不改 DB。 |
| `apps/coach-web` | None | 无影响。 |
| `apps/admin-web` | None | 无影响。 |
| `apps/tv-android` | None | 无影响。 |

## Data And API Impact

### Data Model

- New fields: none
- Changed fields: none
- Backfill/default strategy: 不需要回填；服务端首次请求时生成派生 JPG 文件。
- Compatibility with old records: 旧动作只要有 `media.url` 就能生成缩略图；没有视频时显示空状态。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET /api/actions/:id/thumbnail` | New | 需要登录；用户只能读取自己可见 action 的缩略图；失败返回 404/503，不影响播放。 |
| Existing action/course/template APIs | None | 继续读取已有 `media.url` 和 `updateTime`。 |

## Implementation Sketch

### Server

```pseudo
GET /api/actions/:id/thumbnail:
  user = require auth
  action = find visible action for user
  key = hash(action.id + action.updateTime + media.url + media.checksum + media.sizeBytes)
  if thumbnail file exists:
    return image/jpeg
  source = local media file or remote media url
  run ffmpeg to extract one jpg frame
  return image/jpeg
```

### Web

```pseudo
render action media:
  sourceUrl = action.media.url
  cacheKey = hash(action.id + action.updateTime + sourceUrl)
  if thumbnail exists in IndexedDB:
    render image
  else if thumbnail enters viewport:
    fetch /api/actions/:id/thumbnail
    save jpeg blob into IndexedDB
    prune cache to 5GB by oldest updatedAt

on user click:
  create video element with controls + autoplay
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 线上服务器没有 ffmpeg | 接口返回 503，前端保留占位并允许点击播放；部署前检查环境。 |
| 少数视频 ffmpeg 抽帧失败 | 保留占位，不阻塞编辑；用户点击后仍可播放视频。 |
| 浏览器 IndexedDB 空间不足或被禁用 | 缓存读写失败只影响性能，不影响功能。 |
| 三屏幕卡片点击被播放器抢走 | 卡片区域使用非交互缩略图，继续由卡片点击打开编辑弹窗。 |
| 首次生成缩略图仍产生服务端读取视频 | 服务端派生文件和浏览器缓存双层复用，后续不重复读取原视频。 |

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

- Build order: `apps/server`, `apps/course-web`
- Deploy order: server first, then course-web
- Version bump: web asset deploy only
- Rollback: 回滚 server 和 course-web commit 即可，无 DB 回滚；已生成的派生 JPG 可保留。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
