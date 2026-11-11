# REQ-20261108-simulator-diagnostics: 模拟器错误日志回传

## Status
- Status: Shipped
- Created: 2026-11-08
- Owner: Infini Platform

## Requirement Summary
模拟器准备课程、下载视频或请求接口失败后，自动上传脱敏诊断文件，运维无需再次复现即可查看课程、动作、请求、HTTP 状态、失败阶段及时间。复用 TV 的诊断存储、限流和 10 天保留策略，Ops 支持按来源区分 TV 与网页模拟器。

## Evidence And Related Requirements
- 生产 access log：2026-11-06 15:22–15:26，北京时间；课程 35/38/39/41 的页面及 meta 返回 200，`/simulator-media/oss-shanghai/*.mp4` 返回 404。
- 原 OSS 视频正常；本次历史故障不伪造补录客户端日志。
- 关联：REQ-20260702-course-web-tv-simulator、REQ-20260826-tv-diagnostic-log-upload。

## Impact And Boundaries
- `websimulator`：统一诊断模块负责脱敏、去重、有限本地补传；下载管理器记录最终错误，API 封装记录接口错误；捕获未处理 JS 错误。
- `server`：新增登录态认证的 `POST /api/websimulator/diagnostics`；身份由服务端生成，复用 JSONL 校验和文件存储；Ops 查询增加 `source`。
- `ops-web`：来源筛选及来源显示，现有 TV 查询兼容。
- 不修改业务数据库、课程脚本、TV、MQTT、Coach 或管理端。用户已授权发布，同时补齐导致下载失败的固定 OSS 代理；模拟器走 `/infini/simulator-media/oss-shanghai/`，旧路径仅同源重定向以兼容已打开页面。

## Data And API Impact
- 无 DB 字段及回填。诊断文件增加可选 source，旧文件默认为 tv；模拟器文件名明确包含 websimulator。
- 新接口沿用 64 KiB/50 条限制，需现有登录 token；不接受客户端自报身份。
- 查询继续仅限超级管理员；source 支持 tv/websimulator。

## Implementation Sketch
```pseudo
failure -> bounded sanitized event -> bounded local queue -> authenticated JSONL upload
server -> derive identity from authenticated user -> validate -> atomic file write
ops -> query source/date/type/code -> inspect course/action/endpoint/status/stage
```

## Risks
- 日志包含 token：客户端、服务端双重脱敏，移除 URL 查询参数；不记录请求头/请求体。
- 上报自身失败：不调用业务请求封装，不递归；有限队列和冷却重试，不阻塞课程。
- 频繁失败：一分钟同错误去重、有限待传条数，复用服务端额度。
- 页面脚本未加载或服务器完全离线：客户端上报无法保证即时可达，仍需 Nginx access/error 日志；有界补传不保证保留所有事件。

## Manual E2E Acceptance
1. 测试环境让一个视频返回 404，Ops 来源选网页模拟器，下载错误应含课程 ID、动作 ID/名称、代理请求地址、原视频地址及 HTTP_404。
2. 返回 HTML 200 冒充视频，记录 INVALID_VIDEO 和 contentType，不误判为下载成功。
3. 本地视频成功、不主动取消时不产错误；主动取消不记错误。
4. 上报 503/断网不引发递归或影响课程，恢复网络/登录后在队列上限内补传。
5. 旧 TV 日志仍可查，来源筛选互不混淆；10 天后清理仅诊断文件。

## Deployment / Rollback
- Server 先上线，再更新 Nginx 的固定 OSS 代理，最后上线 simulator 与 Ops。发布前备份运行代码、静态文件和 Nginx include；不重启 broker。
- 回滚客户端不影响旧 TV；无需数据回滚。

## Verification
- 2026-11-08：Server 引用检查及 76 项测试通过（新增 11 项），Server、Simulator、Ops 生产构建通过。
- Simulator / Ops 补齐 Vite 环境类型声明以支持完整 typecheck。
- 线上历史浏览器日志无法补录；发布后才开始采集。OSS 代理固定上游、HTTPS 验证证书、只读，并剥离 Authorization/Cookie，禁止任意目标代理。
- 本地补传最多 20 条，每次一个稳定事件 ID、最长 8 秒上传、至少 60 秒冷却，网络恢复触发补传；上报不自动刷新登录、不改变会话状态。
- 2026-11-08 21:46 北京时间：Server、Simulator、Ops 及固定 OSS 代理已发布。日志自检明确使用 `RELEASE_SMOKE_TEST`（不是用户故障），首次上传 201、重传 200，Ops 查询来源 websimulator/保留 10 天通过。
- 首次发布过早探测到 Nginx 旧 worker 的 404，已自动回滚；修正热加载等待后重发成功。回滚备份：`/var/lib/infini/deploy-backups/simulator-diagnostics-20261108-2147.tgz`。
- 未改业务数据；发布前后课程 47、动作 411、排课 191、用户 11、媒体 533。
