# REQ-20261014-production-ecs-migration: 生产环境迁移到新 ECS

## Status

- Status: In Progress
- Owner: Infini Platform
- Created: 2026-10-14
- Updated: 2026-10-14
- Related docs: [生产通信统一使用 443](REQ-20260903-production-443-only-transport.md)
- Related code map sections: Runtime Domains, MQTT Isolation, Deployment Notes

## Requirement Summary

将 Infini Server、MQTT、Web 静态站和生产数据从旧 ECS `8.130.65.113` 迁移到实例 `i-bp1gy4to0n4dh5gk7tuw`（公网 IP `114.215.185.184`）。停止使用原 `infintraining.work` 生产域名，新的统一入口为 `https://114.215.185.184/infini`；MQTT 使用 `wss://114.215.185.184/infini/mqtt`。Topic、数据库结构和业务协议保持不变，Web 与 TV 必须随迁移发布新连接配置。部署和运维连接从 SSH 主机地址迁移为 Alibaba Cloud Workbench 实例 ID。

## Background

- 当前行为：Infini 独占旧 Ubuntu ECS，通过 Nginx/443 提供 Web、API 和 MQTT WSS，JSON DB 与安装包保存在本机目录。
- 问题：旧 ECS 需要退役，部署脚本仍硬编码旧公网 IP。
- 业务原因：生产运行环境与数据需要迁移到新的统一 ECS。
- 已知约束：新 ECS 同时承载 TMY API、MySQL 和私有 Git；不能覆盖现有端口、Nginx 配置、证书或数据。

## Goals

- 在新 ECS 上以独立用户、目录和 systemd unit 运行 Infini。
- 迁移 JSON DB、备份、APK、媒体、诊断日志和 MQTT 日志。
- 迁移 Admin、Course、Coach、Ops、Download Web 构建产物。
- 新 API Base 为 `https://114.215.185.184/infini`。
- 新 MQTT WSS 为 `wss://114.215.185.184/infini/mqtt`。
- Web 站点统一部署在 `/infini/admin`、`/infini/course`、`/infini/coach`、`/infini/ops` 与 `/infini/download`，不占用 TMY 的根路径。
- 发布新的 TV 安装包和 Web 构建产物，停止依赖旧域名与旧服务器 IP。
- 旧服务器停止写入但保留完整数据，作为短期回滚源。
- 把部署脚本从 `REDACTED_CONFIGURE_LOCALLY@8.130.65.113` 改为 Workbench 实例连接。

## Non-goals

- 不修改课程、动作、排课、场馆或账号的数据模型。
- 不把 JSON DB 改成 MySQL/MongoDB。
- 不改变 MQTT Topic、QoS、消息 payload 或 current session 语义。
- 不迁移 TMY 数据和业务；在现有 TLS server 中添加隔离路由 include。
- 不开放 TCP/1883、明文 WebSocket 或公网内部服务端口。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [REQ-20260903-production-443-only-transport](REQ-20260903-production-443-only-transport.md) | Must preserve | API/媒体继续只走 HTTPS/443，MQTT 继续只走 WSS/443。 |
| [REQ-20260826-tv-diagnostic-log-upload](REQ-20260826-tv-diagnostic-log-upload.md) | Data migration | 迁移 TV 诊断文件并保留原有清理周期。 |
| [REQ-20260730-oss-access-log-retention](REQ-20260730-oss-access-log-retention.md) | Configuration migration | OSS Bucket、访问凭证和日志策略不变，只迁移 Server 环境配置。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | deployment / runtime / resource serialization | 运行目录、systemd、公开 URL 和部署目标改为新 ECS；JSON 和 MQTT 输出统一转换资源链接，原始 DB 不变。 |
| `apps/course-web` | deployment / URL / auth cache | Vite base 改为 `/infini/course/`，API 与媒体请求加 `/infini` 前缀；登录缓存独立为 `infini-course-web-auth`。 |
| `apps/coach-web` | deployment / URL / MQTT verification | Vite base 改为 `/infini/coach/`，API 请求加 `/infini` 前缀。 |
| `apps/admin-web` | deployment / URL | Vite base 改为 `/infini/admin/`，API 与媒体请求加 `/infini` 前缀。 |
| `apps/tv-android` | production endpoint / release | API Base 改为 `https://114.215.185.184/infini`，MQTT 改为新 WSS，发布新版本。 |
| `apps/mqtt-client` | deployment / runtime | 迁移网关和日志，内部仍监听 `127.0.0.1:3205`。 |
| `apps/ops-web` | deployment / URL | 部署到 `/infini/ops/`，API 和 SSE 请求加 `/infini` 前缀。 |
| `apps/download-web` | deployment / URL | 部署到 `/infini/download/`，下载 API 加 `/infini` 前缀。 |
| `apps/websimulator` | deployment / URL | 部署到 `/infini/course/simulator/`，API 和媒体请求加 `/infini` 前缀。 |

## Infrastructure And Data Impact

### New Host Layout

| Path / Port | Owner | Purpose |
| --- | --- | --- |
| `/srv/infini-platform` | `infini` | Server、MQTT 网关和 shared runtime。 |
| `/var/lib/infini` | `infini` | JSON DB、备份、APK、媒体与日志。 |
| `/var/www/infini/*` | `infini:nginx` | Web 静态产物，对应 `/infini/*`。 |
| `127.0.0.1:3100` | Server | API upstream。 |
| `127.0.0.1:3205` | MQTT gateway | Server 发布命令的内部 HTTP 网关。 |
| `127.0.0.1:8083` | EMQX | Nginx WSS upstream。 |
| `80/443` | Nginx | 与 TMY 共用，通过 `/infini/*` 路径分流。 |

### Data Snapshot

- `db.json`: about 3.1 MB.
- Data root total: about 903 MB.
- Runtime: about 232 MB.
- Web builds: about 23 MB.
- Final copy must happen while old Server is stopped so no JSON write is lost. The old MQTT gateway may temporarily remain available only to deliver the TV migration package, then stop after verification.

### API And MQTT

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `https://114.215.185.184/infini/api/*` | Nginx 去除 `/infini` 后代理到 Server | API 业务 path、request/response 不变。 |
| `wss://114.215.185.184/infini/mqtt` | Nginx 代理到本机 EMQX `/mqtt` | auth、Topic 和 payload 不变。 |
| `/infini/admin/` 等 Web 路径 | 与 TMY 同 IP 隔离部署 | Vite asset base 与 API resolver 同步修改。 |

## Implementation Sketch

### Staging

```pseudo
create isolated infini user and directories on new ECS
install matching runtime and EMQX
deploy Server, MQTT gateway and Web files under isolated /infini paths
copy first data snapshot while old production remains writable
start new services and test all /infini paths on the IP certificate
```

### Cutover

```pseudo
stop old Server to freeze DB writes
create final timestamped snapshot
copy final db and changed files to new ECS
start new services
verify API, WSS, Web and data counts against new IP
publish Web and TV builds that use the new IP paths
deliver the migration APK through the old MQTT upgrade channel while online TVs are IDLE
stop old MQTT gateway and broker after TV migration
keep old services stopped and data intact for rollback
```

### Rollback

```pseudo
stop new Infini services
restore Web and TV builds that use the old endpoints
start old Server, MQTT gateway and EMQX
verify health and current session state
```

## Risks

| Risk | Mitigation |
| --- | --- |
| New ECS memory is only 1.6 GB | Keep 4 GB Swap; set Node heap limits; monitor RSS/load; recommend upgrading to at least 4 GB RAM. |
| Existing TMY Nginx/ports are overwritten | 在 HTTPS server 中 include `infini-routes.conf`，保留原有 location、证书与 TMY unit/目录/端口。 |
| JSON DB writes occur during final copy | Stop old API and MQTT gateway before final snapshot; use atomic archive/restore and checksums. |
| 旧 TV 仍连接旧 URL | 终切前准备原 MQTT 升级通道，IDLE 设备升级到 1.0.77；离线设备需手工更新。确认新连接后再停止旧 broker。 |
| 同 IP 的 TMY 路由被覆盖 | 只在现有 HTTPS server 中 include `/infini/*` location，不修改 `/api`、`/git`、`/h5` 和 `/`。 |
| IP 证书仅 7 天有效 | 保留并监控现有自动续期；每次续期后执行 Nginx 配置测试与 reload。 |
| Admin/Course 共用 IP 后登录互相覆盖 | 两端使用独立缓存 key，模拟器只共享 Course 会话。 |
| 历史资源 URL 或相对 `/api` 链接指向错误服务 | Server JSON/MQTT 输出边界转换为新的绝对链接；客户端统一 resolver，校验不重复添加前缀。 |
| Old deployment scripts target retired IP | Replace hardcoded SSH target with Workbench instance ID and add a transport guard. |
| Data archive approaches Workbench 1 GB limit | Split archives into bounded chunks and verify SHA-256 after transfer. |

## Manual E2E Acceptance

### Happy Flow

1. Open Admin, Course, Coach, Download and Ops under `https://114.215.185.184/infini/`.
2. Log in, query current-week schedule, open one course and one action video.
3. From Coach, send preview/start/terminate to a test venue.
4. Confirm TV receives commands through WSS and `/current` converges.
5. Download the latest TV APK and verify checksum.

Expected:

- 所有新路径使用覆盖 IP 的有效 TLS 证书，并返回原有 UI/API 合同。
- Course/action/schedule/user counts match the pre-cutover snapshot.
- 新 TV 版本只连接新 API/MQTT URL，旧域名不可作为生产 fallback。

### Bad Flow

1. Attempt direct access to ports 3100, 3205, 8083 and 1883 from the Internet.
2. Restart new Infini Server and EMQX.
3. Send a command while one TV is offline, then reconnect it.

Expected:

- Internal ports are not public; 1883 remains closed.
- Services recover from systemd and do not affect TMY.
- TV resolves state from current session and does not execute an obsolete command.

## Deployment / Rollback

- Build order: Server and Web tests/builds, then migration archives.
- Deploy order: runtime -> first data snapshot -> `/infini` Nginx routes -> Web/TV URL build -> final snapshot -> client cutover.
- Version bump: TV 必须升级版本；Web 必须重建并部署新的 base path。
- Rollback: 恢复旧 Web/TV 连接配置并启动旧服务；迁移观察期内不删除旧数据。

## Documentation Updates

- [x] Create this requirement.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) for the new runtime host and deployment transport.
- [x] Mark Ready for QA after pre-cutover verification.
- [ ] Mark Shipped after service cutover and observation window.

## Verification And Cutover State

2026-10-14:

- New ECS has Server, MQTT gateway, EMQX 5.8.9, FFmpeg and all Web builds staged. TMY API/MySQL/Nginx remain active.
- Complete data archive is 497.5 MB; SHA-256 `731436b4cd993b3eb104de8ac61dbdf3f13cb83597d8f4b0454c5c0c59980596` matched on the old host, local download and new ECS before import.
- Snapshot counts: 47 courses, 411 actions, 189 schedules, 3 course packages, 36 templates, 533 media records, 11 users and 20 TV screen records.
- Real API login/profile/course/week requests passed; HTTPS media Range returned 206; APK download checksum matched; authenticated WSS publish/subscribe passed.
- Server 65 tests, Course 33 tests, Coach 25 tests and TV 72 tests passed. All Web builds passed.
- TV 1.0.77 uses the same signing certificate as 1.0.76. Final APK SHA-256: `3071cce6e3ad1dd1def0b922e4a775955d074f989c01271090aaf2bdf0c25699`.
- Main production Nginx has not been reloaded for `/infini`; staging TLS validation uses a separate listener at `127.0.0.1:3443`.
- Old production API has not stopped: automatic approval rejected the requested write freeze until the user explicitly confirms this brief service interruption. Final DB delta, public activation and TV upgrade remain pending.
- Staging-only login sessions and package registrations must be discarded by the final DB copy, then register the final APK once through the running Server API. Never import a stale in-memory store from a second Node process into a running Server DB.
