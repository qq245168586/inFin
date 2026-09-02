# REQ-20260715-tv-media-delivery-protection: TV 媒体传输卸载与重复下载保护

## Status

- Status: Implemented, not deployed
- Owner: Server / TV
- Created: 2026-07-15
- Updated: 2026-07-15
- Related docs:
  - [TV 本地视频播放与信息屏资源隔离](REQ-20260714-tv-local-video-only-playback.md)
  - [Infini Code Map](../CODEMAP.md)

## Requirement Summary

TV 视频仍通过原有 `/api/media/:filename` 地址下载，但 Node server 不再必须承担 MP4 字节流传输。Server 先校验媒体记录、文件路径和缓存条件，生产环境配置完成后使用 `X-Accel-Redirect` 把文件发送交给 Nginx `sendfile`；未配置时保留 Node 流式传输作为兼容回退。TV 下载请求携带设备、屏幕、checksum、版本和用途标识，并对 `429`、临时 `5xx` 和网络错误执行有限指数退避。Nginx 只按“设备 + 屏幕 + 资源 URI”限制同一资源的异常并发，不按公网 IP 限制，避免误伤同一场馆的多台 TV。

## Background

- 当前行为：`/api/media/*` 由 Node `fs.createReadStream()` 读取并写入响应，Nginx 只是普通反向代理。
- 问题：多个 TV 同步视频或异常重试时，Node 同时占用文件描述符、流对象、连接和事件循环；响应没有 immutable cache / ETag / Last-Modified，重复验证和传输缺少可观测性。
- 业务原因：服务器出口和进程资源有限，TV 已采用本地缓存，服务端应把大文件传输交给更适合静态文件发送的 Nginx，并能识别异常重复请求。
- 已知约束：场馆设备通常共享公网 IP；不能使用 IP 级媒体限流。旧 TV 不发送新增 header，必须仍能下载。当前媒体文件名按上传版本唯一生成，不会原地覆盖，适合 immutable 缓存。

## Goals

- Node 只负责媒体记录、路径安全和响应决策；配置开启后由 Nginx `sendfile` 发送文件。
- `/api/media/*` 支持 `Cache-Control: immutable`、`ETag`、`Last-Modified`、`If-None-Match`、`If-Modified-Since` 和 `304`。
- 保留 Range / HEAD 能力；Nginx 模式和 Node 回退模式都能继续下载 MP4。
- TV 下载请求携带稳定诊断 header，并对可恢复错误有限退避。
- 记录设备、屏幕、checksum、状态、Range、字节数和耗时，便于 Ops 排查重复下载。
- 同一 TV 屏幕对同一资源的并发下载返回 `429 + Retry-After`，不同屏幕、不同设备和同一 NAT 下的请求互不影响。

## Non-goals

- 不修改课程、动作、媒体记录或 JSON DB。
- 不改变媒体 API URL，不要求旧 TV 立即升级。
- 不引入 CDN、OSS 回源缓存或视频转码。
- 不把普通管理 API、缩略图或 APK 下载统一改成 X-Accel。
- 不在本次提交中部署 Nginx、Server 或 TV 包。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `REQ-20260714-tv-local-video-only-playback` | Extends | TV 仍只在缓存缺失/损坏/checksum 变化时下载，播放阶段只读本地文件。 |
| Course 动作缩略图缓存 | Independent | `/api/actions/:id/thumbnail` 保持现有发送方式，不进入 TV MP4 并发限制。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | Media HTTP / Nginx config / logs | 新增媒体发送服务、缓存协商和 Nginx 内部文件 location 示例。 |
| `apps/tv-android` | Media downloader | 增加诊断 header 与有限指数退避；不改播放器、课表和 session。 |
| `apps/ops-web` | None | 暂不新增 UI；日志可由现有服务器/Nginx 日志查看。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无。
- Backfill/default strategy: 无迁移、无回填。
- Compatibility with old records: 使用现有 media `checksum/type/filename`；checksum 缺失时用文件大小和 mtime 生成弱依赖 ETag。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `GET/HEAD /api/media/:filename` | 增加 immutable cache、ETag、Last-Modified、304；可选 `X-Accel-Redirect` | URL 和成功响应体不变；旧 TV 兼容。 |

### TV Request Headers

| Header | Value |
| --- | --- |
| `X-Infini-Media-Intent` | `cache` |
| `X-Infini-Device-Id` | 已绑定设备 ID，未绑定时省略 |
| `X-Infini-Screen-Number` | 物理屏幕号，未知时省略 |
| `X-Infini-Media-Checksum` | bundle resource checksum，缺失时省略 |
| `X-Infini-App-Version` | TV app version |

## Implementation Sketch

### Server

```pseudo
on GET/HEAD /api/media/:filename:
  decode and reject path separators / traversal
  find media record and local file
  compute immutable headers from checksum + file stat
  if conditional request matches:
    return 304
  log request identity and selected delivery mode
  if INFINI_MEDIA_X_ACCEL_PREFIX configured:
    return headers + X-Accel-Redirect to internal location
  else:
    stream file with existing Range / HEAD support
```

### Nginx

```pseudo
http context:
  key = only when media intent == cache
        deviceId + screenNumber + request URI
  define connection zone using key
  write JSON access log with identity/status/bytes/duration

server context internal media location:
  bind mount INFINI_DATA_ROOT/media at /srv/infini-media
  internal + alias media root
  sendfile on
  limit same key to one active transfer
  duplicate active transfer -> 429, Retry-After: 5
```

### TV

```pseudo
if cached file checksum/size is valid:
  reuse local file
else:
  request media with device/screen/checksum/version headers
  for each primary/fallback URL:
    retry recoverable error at most 3 attempts
    delay = Retry-After when valid, otherwise bounded exponential backoff
  verify downloaded size/checksum before rename
```

## Impact Boundary

- Server route boundary: only local-storage `/api/media/*`; OSS URLs remain direct OSS requests.
- Nginx boundary: only internal `/_infini_media/` location; external clients cannot access the alias directly. Every public virtual host that proxies `/api/media/*` must include this location because `X-Accel-Redirect` is resolved inside the original virtual host.
- TV boundary: only course media cache downloads; app package downloads and JSON API requests keep their current retry policy.
- Screen boundary: screen `2/4` remains `METADATA_ONLY` and should not issue MP4 requests; headers/reties apply to video screens `1/3/5` when a cache download is actually needed.
- Failure boundary: if Nginx internal location is not installed, do not set `INFINI_MEDIA_X_ACCEL_PREFIX`; Server continues Node streaming.
- Configuration boundary: future deployment reads `/home/REDACTED_CONFIGURE_LOCALLY/infini-media-delivery.conf`; the example remains disabled until `/srv/infini-media` is mounted and both Nginx snippets pass `nginx -t`.
- Data boundary: no DB writes and no media filename rewrite.

## Risks

| Risk | Mitigation |
| --- | --- |
| X-Accel prefix enabled before Nginx location or media mount exists | Prefix is opt-in and empty by default; mount `/srv/infini-media`, install/test Nginx, then enable the environment variable. |
| Path traversal exposes files outside media root | Reject slash/backslash/NUL and verify resolved path remains under media root before sending redirect. |
| Same venue NAT is incorrectly rate limited | Nginx key uses TV device + physical screen + URI, not client IP. |
| Old TV lacks identity headers | Empty key is not counted; old clients still download and remain visible in access logs without device identity. |
| Retry storm gets worse | TV retries are bounded and use `Retry-After`/exponential delay; checksum validation remains mandatory. |
| Immutable cache serves stale bytes | Media filenames are versioned/unique; changing media creates a new filename/checksum rather than overwriting. |

## Manual E2E Acceptance

### Happy Flow: Nginx Offload

1. Install the Nginx http snippet and include the server snippet in every virtual host that exposes `/api/media/*`, then enable `INFINI_MEDIA_X_ACCEL_PREFIX=/_infini_media/`.
2. Download one MP4 from a video screen.
3. Inspect Server and Nginx logs.

Expected:

- Public URL remains `/api/media/...`.
- Server log reports `deliveryMode=x-accel`; Nginx media access log reports response bytes and duration.
- Server process does not hold the MP4 response stream.

### Happy Flow: Cache Validation

1. Request a media URL and record ETag.
2. Request again with `If-None-Match`.

Expected:

- Second request returns `304` with no body.
- Cache-Control contains `public, max-age=31536000, immutable`.

### Happy Flow: Same NAT, Different Screens

1. Two TV screens behind one public IP download different media or use different device/screen IDs.

Expected:

- Both downloads proceed; no IP-level `429`.

### Bad Flow: Duplicate Same Resource

1. Start two concurrent cache downloads using the same device ID, screen number and media URL.

Expected:

- One transfer proceeds; the duplicate receives `429` and `Retry-After`.
- TV waits and retries a bounded number of times.

### Bad Flow: Unsafe Filename

1. Request an encoded path separator or traversal filename.

Expected:

- Server returns `404`; no internal filesystem path is exposed.

## Deployment / Rollback

- Build order: Server tests/build -> TV unit tests/build.
- Deploy order for a future release: bind mount `INFINI_DATA_ROOT/media` to `/srv/infini-media` and persist it in `fstab` -> install Nginx http map/zone -> install Nginx internal media location -> `nginx -t` and reload -> enable Server X-Accel systemd env -> deploy Server -> publish TV.
- Published TV package: `1.0.69`, package ID `87`; the package is available on the Server but no global MQTT update command was sent.
- Rollback: clear `INFINI_MEDIA_X_ACCEL_PREFIX` and restart Server to restore Node streaming; Nginx snippets can remain unused. TV headers are additive and harmless against old Server.
- Production status: Server, Nginx media delivery and TV package are published. Verified health, `200`/`206`/`304` media responses and duplicate-transfer `429` behavior.

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md).
- [x] Document impact boundary and rollback.
