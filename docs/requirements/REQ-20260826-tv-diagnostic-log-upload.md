# REQ-20260826-tv-diagnostic-log-upload: TV 错误文件回传

## Status

- Status: Ready for QA (implemented locally, not deployed)
- Created / Updated: 2026-09-02
- Related: [TV 本地播放](REQ-20260714-tv-local-video-only-playback.md)、[Current Session](REQ-20260626-tv-current-session-sync.md)、[代码地图](../CODEMAP.md)

## Requirement Summary

为远程场馆增加 TV 错误日志上传通道，便于区分播放失败、下载失败、API/网络错误与崩溃。日志采用 UTF-8 JSONL 文件，先落盒子私有目录，再通过 HTTPS 后台上传；Server 使用独立文件目录保存，最长保留 10 天。记录发生时间和服务端接收时间，文件名能识别日期、屏幕、设备与 APP 版本。

## Scope / Impact

| App | Change | Boundary |
| --- | --- | --- |
| TV | 统一 reporter/outbox/uploader、HTTP 公共客户端、播放器错误适配器、Application 未捕获异常处理器、MQTT 连接错误 | 不改变播放器恢复、课程时间线、视频缓存、session 和控制指令逻辑 |
| Server | `POST /api/tv/diagnostics`、校验与文件存储、定时清理 | 只读取现有设备绑定；不新增或改写 DB 字段，不上传 OSS |
| Ops | 新增只读错误日志页面、分类统计、筛选、列表与详情 | 仅超级管理员可访问；不提供日志文件路径，不改写或删除日志 |
| Course / Coach / Admin | 无 | 本期错误日志查看统一放在 Ops，不扩散到业务端 |

## Data And API

- 请求：`Content-Type: application/x-ndjson`，原始 JSONL 文件体，不使用无界 multipart 或完整 logcat。
- Headers：`X-Infini-Device-Id`、`X-Infini-Pair-Token`、`X-Infini-Namespace`、`X-Infini-Screen-Number`、`X-Infini-App-Version`、`X-Infini-Log-Id`（UUID）。
- 设备 ID、绑定 namespace/screen 与现有配对 token 必须匹配；token 仅用于认证，不落日志。复用现有设备身份，不宣称这是新的强认证体系。
- 事件：`id`、`occurredAt`（ISO UTC）、`type`、`code`、`message`、可选 `stackTrace`、`context`。
- 类型：`PLAYBACK_ERROR`、`NETWORK_ERROR`、`API_ERROR`、`DOWNLOAD_ERROR`、`CRASH`、`MQTT_ERROR`。
- Code 示例：`MEDIA_1_-1004`、`CACHE_MISSING`、`TIMEOUT`、`TLS`、`HTTP_503`、`INVALID_JSON`、`UNCAUGHT_JAVA_EXCEPTION`。
- Context 仅允许 course/schedule/session、播放状态、组件、HTTP method/endpoint/status、媒体文件标识、播放器错误码等白名单字段。不得记录请求/响应 body、认证 header、完整签名 URL、密码或 token。
- Server 加入 `receivedAt`、服务器验证过的设备信息、日志文件 ID；存放于 `INFINI_DATA_ROOT/tv-diagnostics/<北京时间日期>/<namespace>/<deviceId>/`，不暴露静态下载地址。
- 文件名：`<北京时间戳>_screen-<N>_<deviceId>_v<version>_<logId>.jsonl`，Server 自行生成，拒绝路径穿越与非法标识。
- 单次最大 64 KiB / 50 条；每设备 12 次/分钟、256 文件/日、2 MiB/日，全部设备合计 32 MiB/日；最多排队 32 个存储操作，超额返回 429，防止错误风暴拖慢业务请求。重复 logId 在保留期内幂等，内容冲突返回 409。
- 200/201：文件已经安全落盘；400/413/415：无效文件；403：设备认证/绑定不匹配；429：限流；503：写入失败。只有明确成功才删除待上传文件，永久无效/绑定已变化的文件丢弃，临时故障有限退避补传。
- Ops 查询：`GET /api/ops/tv-diagnostics`，仅 super admin bearer token 可访问。支持 `date`、`namespace`、`deviceId`、`screenNumber`、`type`、`code`、`limit`；返回脱敏事件、六类统计、设备数和扫描状态，不返回文件路径、batch checksum 或任何凭证。
- 查询默认由 Ops 传北京时间当天，服务端日期为空时最多读取保留期内数据；单次最多返回 1000 条、扫描 2048 个文件/64 MiB，达到上限返回 `truncated=true`，提示运维缩小范围，避免诊断查询抢占业务资源。

## Implementation Sketch

```pseudo
HTTP common client events -> sanitized network/status event
API JSON parse failure -> API_ERROR
player common error adapter -> PLAYBACK_ERROR
uncaught Java exception -> bounded synchronous local write -> original crash handler

report(event): enqueue bounded async disk write, deduplicate repeated errors
upload timer: send up to 4 pending small files; success -> delete; failure -> backoff
upload errors: never report through the same channel

server upload: authenticate existing device -> bounded read -> validate/redact
  -> serialized quota/idempotency check -> atomic file publish -> acknowledgement
server hourly/startup cleanup: only own log files older than 10 days by received time

ops query: super-admin auth -> bounded file scan -> fixed type classification
  -> filter/sort sanitized records -> list and selected-record detail
```

## Risks / Safety

- 网络不可用时无法即时回传；盒子本地队列限量、10 天过期，恢复网络/下次启动补传，不阻塞主线程或课程请求。
- Java 未捕获异常可在退出前尽力落盘；SIGKILL、突然断电、native crash、ANR、磁盘写满/OOM 不保证捕获。本期不承诺覆盖所有系统级退出。
- 崩溃处理不得联网、不得吞异常、必须交给原 Android handler；全局 reporter 自身不得抛出异常影响业务。
- 上传使用独立短超时客户端和独立退避，复用现有 HTTPS/HTTP 兼容策略，不降低证书校验，不改变业务 API 的 fallback 状态。
- 同一设备重复错误限频；文件及消息/堆栈长度均有上限，敏感信息在客户端与服务端两次脱敏。
- 保留期以 Server 接收时间为准，不受盒子时间偏差影响；每小时及启动清理，仅操作日志专属目录，不扫描/删除 DB、视频或 MQTT/OSS 日志。
- 排队日志保留发生时的绑定信息，设备换绑后不把旧场馆事件归给新场馆；服务端拒绝身份不匹配上传。
- 旧 TV 不调用新接口；新 TV 遇到旧 Server 404 时退避而不影响课程。
- 盒子本地最多 128 个文件 / 2 MiB；单条文件最多 48 KiB。相同类型/code/接口或媒体/session 的错误 60 秒内合并，待落盘任务最多 64 个；上传最多 4 个文件/轮，30 秒一轮，失败退避 30 秒至 10 分钟。
- 10 天以服务端接收时间计算，实际磁盘删除在下一轮每小时清理时执行；没有新请求也会清理。服务器中断写入遗留的专属临时文件也会清理。进程停止期间无法执行清理，重启后立即补清。
- 现有列表接口不返回 pair token；认证只在 store 内部读取绑定数据，不给设备列表增加凭证字段。当前为单 Server 进程文件存储，不宣称提供跨实例共享幂等或全局限流。
- Ops 分类使用固定六种 `type`，错误 `code` 只用于检索和详情，不动态生成分类，避免相似错误码造成分类膨胀。
- 查询损坏的单个 JSONL 文件时跳过该文件并继续读取其他日志；页面展示发生时间和服务端接收时间，盒子时钟异常时可对照判断。
- Ops 查询只读文件系统，不使用 MongoDB/JSON DB，不修改课程、设备绑定、session、MQTT 或媒体数据。

## Manual E2E Acceptance

### Happy Flow

1. 测试盒子播放一段不支持的本地视频，确认倒计时/其他屏幕不受日志上传影响；服务端出现含播放器 what/extra、设备、文件名、session 的日志。
2. 测试环境 API 返回 503 或响应非法 JSON，确认生成 API_ERROR 且无 body/token；断网出现 NETWORK_ERROR，恢复后补传。
3. 测试包触发 Java 未捕获异常，重新启动 APP 后确认 CRASH 文件及堆栈上传。
4. 重传同一个文件不产生多份记录；查看服务端日期、设备和版本文件名。
5. 使用超级管理员登录 Ops，按播放/下载/网络/API/MQTT/崩溃分类切换，筛选场馆、设备、屏幕、日期和错误码，并查看 message/context/stack trace。

### Bad Flow

1. 日志接口 503/断网/旧 Server 404：TV 保持正常上课，没有日志上传递归和无限紧密重试，队列有上限。
2. 错误 token/跨场馆/路径穿越/超大文件/未知类型：拒绝上传，DB 和其他目录不变。
3. 清理测试目录内 10 天前日志，保留新日志以及目录外的媒体/DB；没有新上传时定时器也会清理。
4. 日志消息含 Authorization、token、带 query 的 URL：落盘文件已脱敏。
5. 普通账号请求 Ops 查询接口返回无权限；非法日期、路径、未知类型和非法屏幕被拒绝，不读取专属目录之外的文件。
6. 查询达到文件或字节上限时页面提示缩小范围，Server 仍能正常处理业务 API。

## Deployment / Rollback

- 先部署 Server，再安装含该功能的 TV；本任务未要求发布，不修改生产环境或 APP 版本号。
- 回滚 TV 不影响已收日志；回滚 Server 仅暂停接收，新 TV 本地退避，课程协议保持兼容。
- DB 无迁移、无历史回填。

## Verification

- Server：诊断测试 14/14 通过，新增 Ops 分类/过滤/路径隔离用例；`check:refs` 与 `pnpm run build` 通过。完整回归以测试报告最新记录为准。
- TV：`testDebugUnitTest` 70/70 通过，新增诊断/上传测试 20 项；JaCoCo HTML 报告与 `assembleDebug` 通过，版本保持 1.0.72。
- Ops：`npm run typecheck`、`npm run build` 通过；默认进入 TV 错误日志视图，保留原 MQTT 与设备总览视图。
- 验证了请求文件及 headers、ACK logId、旧 JSON 请求行为、无网/403/404/429/503 退避、文件限额、重启与到期、Java crash 原处理器继续执行、日志请求不递归、私有配对凭证不外泄与 DB 不变。
- 测试仅使用临时数据和模拟响应，未连接生产 API、未改线上数据，未安装设备。真实 VideoView/Android crash、重启补传及生产反向代理链路仍需按上方 E2E 用例验收。
- [测试报告和覆盖率](../testing/tv-diagnostic-log-upload-20260826.md)。
