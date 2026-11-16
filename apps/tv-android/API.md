# TV Android API 与 MQTT 文档

本文件描述 `apps/tv-android` 使用到的服务端 HTTP API 与 MQTT topic/message 约定。

## HTTP API（apps/server）

TV 端 Base URL：

- `ServerConfig.BASE_URL`（当前实现：`https://114.215.185.184/infini`）
- `ServerConfig.BACKUP_BASE_URL`（生产包只允许 `https://`；当前与主地址一致，避免回退到明文链路）
- API 前缀：`/api`

生产构建会拒绝任何 HTTP API 或非 WSS MQTT 配置，并在 Android manifest 中关闭明文流量。旧数据中如仍存在 `http://` 媒体地址，TV 会先升级为 HTTPS；旧公网 IP 和旧 API 域名会归一到 `https://114.215.185.184/infini`。

TV 端不携带登录 token；屏幕状态与绑定信息通过 body 字段上报（见下文）。

### 1. 获取当日课表与资源

#### GET `/api/tv/daily-bundle?date=YYYY-MM-DD&timeZone=Asia/Shanghai&accountNamespace=<namespace>`

用途：

- 返回 TV 当前绑定场馆“当前启用课程包”的当天排课与资源清单
- TV 端用于预下载资源并构建本地 `schedule -> mediaLocalPath` 映射
- TV 不需要知道课程包，也不需要额外传 `coursePackageId`；Server 会用 `accountNamespace` 找到场馆，再按场馆的 `activeCoursePackageId` 过滤排课

响应关键字段（以服务端实现为准）：

- `date`
- `checksum`（当天 bundle checksum）
- `schedules[]`
- `resources[]`（包含 `key/url/checksum/sizeBytes` 等）

#### GET `/api/tv/daily-checksum?date=YYYY-MM-DD&timeZone=Asia/Shanghai&accountNamespace=<namespace>`

用途：

- 轻量校验是否需要重新同步当日 bundle
- checksum 同样基于场馆当前启用课程包计算；Coach 切换课程包后会触发 `refresh_checksum`，TV 继续调用本接口即可发现变化

响应关键字段：

- `date`
- `checksum`
- `scheduleCount`

#### GET `/api/tv/schedule-bundle?scheduleId=<id>`

用途：

- 拉取某节课脚本 + 资源清单（用于进入课程时确保资源完整）

响应关键字段：

- `schedule`
- `resources[]`

### 2. TV 屏幕状态上报

#### POST `/api/tv/screens/bind`

用途：

- TV 初次启动/进入二维码页时注册设备信息（便于服务端识别设备存在）

请求字段（来自 `TvScriptRepository.buildScreenPayload()`）：

```json
{
  "accountNamespace": "",
  "deviceId": "TV-XXXXXXX",
  "screenNumber": 0,
  "pairToken": "ABCDEF12",
  "mqttClientId": "tv-....",
  "appVersion": "1.0.0",
  "playbackState": "IDLE",
  "activeScheduleId": "",
  "previewMode": false,
  "playbackSessionId": "",
  "bundleChecksum": "",
  "playbackElapsedMs": 0,
  "updateState": "IDLE",
  "updateTargetVersion": "",
  "updateProgressPercent": 0,
  "updateMessage": "",
  "cacheBytes": 0,
  "cacheFileCount": 0,
  "cacheUpdatedAt": "",
  "platform": "tv-android"
}
```

说明：

- 未绑定时 `accountNamespace=""`、`screenNumber=0`
- 绑定后 `accountNamespace=<venue/accountNamespace>`、`screenNumber=1..5`

响应：

```json
{ "ok": true, "data": { "accountNamespace": "...", "screenNumber": 1, "deviceId": "...", "online": true } }
```

#### POST `/api/tv/screens/heartbeat`

用途：

- 周期性心跳，用于更新在线状态、播放状态、更新状态、缓存占用等
- Coach/管理端通过该快照展示在线/离线、版本号、更新进度等

请求字段同 `/bind`。

## MQTT（EMQX / Mosquitto）

TV 端使用 Paho MQTT client 通过 WebSocket Secure 连接 MQTT。生产环境不再启用 TCP 1883；主地址和备用地址都必须是 WSS/443。

### 连接参数（当前实现）

见 `apps/tv-android/app/src/main/java/com/infini/tv/repository/ServerConfig.java`：

- URL: `wss://114.215.185.184/infini/mqtt`
- Backup URL: `wss://114.215.185.184/infini/mqtt`（当前与主地址一致，不产生明文回退）
- Username: 空
- Password: `e10adc...`

### Topic

#### 1) 控制指令 Topic（TV 订阅）

`infini/tv/control/<namespace>`

- 未绑定时订阅：`infini/tv/control/__unbound__`
- 绑定后订阅：`infini/tv/control/<accountNamespace>`

> Server 发布逻辑：`apps/server/src/services/tv-control.js`

#### 2) 配对存在性 Topic（TV 发布）

`infini/tv/pairing`

TV 在二维码页面发布：

- `tv_pairing_presence`：表示“我在二维码页面，且我的 deviceId/pairToken 是什么”
- `tv_unbound`：表示“我已解绑/退回二维码页面”

### Message Schema（控制指令）

> 由 Server 发布，TV 解析逻辑在 `TvMqttManager.handleMessage()`

#### `refresh_checksum`

```json
{ "type": "refresh_checksum", "venueId": "<namespace>", "requestedAt": 0 }
```

用途：触发 TV 立即调用 `/api/tv/daily-checksum` 校验更新。

#### `assign_screen`（绑定屏幕）

```json
{
  "type": "assign_screen",
  "deviceId": "TV-XXXXXXX",
  "screenNumber": 1,
  "venueId": "<namespace>",
  "requestedAt": 0
}
```

用途：TV 保存命名空间与屏幕号，并切换订阅到 `infini/tv/control/<namespace>`。

说明：

- 当前 TV 端兼容读取 `venueId` 或 `accountNamespace` 字段（建议后续统一为 `venueId` 或 `namespace`，但保持“字段直观可读”）。

#### `unbind_screen`

```json
{ "type": "unbind_screen", "deviceId": "TV-XXXXXXX", "requestedAt": 0 }
```

用途：TV 清空绑定并回到二维码页面，同时发布 `tv_unbound` 事件。

#### `venue_deleted`

```json
{ "type": "venue_deleted", "deviceId": "TV-XXXXXXX", "requestedAt": 0 }
```

用途：场馆被删除或设备被强制移除时，TV 立即回到二维码页面。

#### `clear_cache`

```json
{ "type": "clear_cache", "deviceId": "TV-XXXXXXX", "requestedAt": 0 }
```

用途：TV 清理本地媒体缓存（并在下一次心跳上报 cacheBytes/fileCount）。

#### `install_app_update`

```json
{
  "type": "install_app_update",
  "deviceId": "TV-XXXXXXX",
  "screenNumber": 1,
  "packageId": "12",
  "version": "1.0.1",
  "downloadUrl": "/api/app-packages/files/tv-12-1.0.1.apk",
  "checksum": "sha256-...",
  "requestedAt": 0
}
```

用途：TV 下载更新包并执行安装（静默/系统安装器策略以设备能力为准）。

#### `preview_course`

```json
{
  "type": "preview_course",
  "venueId": "<namespace>",
  "scheduleId": "123",
  "courseId": 1,
  "scheduledStartAtMs": 0,
  "playbackSessionId": "session-uuid",
  "bundleChecksum": "sha256-...",
  "requestedAt": 0
}
```

用途：TV 进入预览页面（不计时）。

#### `start_course`

```json
{
  "type": "start_course",
  "venueId": "<namespace>",
  "scheduleId": "123",
  "courseId": 1,
  "scheduledStartAtMs": 0,
  "playbackStartAtMs": 0,
  "playbackSessionId": "session-uuid",
  "bundleChecksum": "sha256-...",
  "requestedAt": 0
}
```

用途：TV 正式开始课程；以 `playbackStartAtMs` 为全屏统一时间基准。

#### `pause_course` / `resume_course`

```json
{ "type": "pause_course", "scheduleId": "123", "courseId": 1, "pausedAtMs": 0, "playbackSessionId": "..." }
```

```json
{ "type": "resume_course", "scheduleId": "123", "courseId": 1, "resumedAtMs": 0, "playbackSessionId": "..." }
```

用途：暂停/继续计时（TV 状态冻结/恢复）。

#### `terminate_course`

```json
{ "type": "terminate_course", "scheduleId": "123", "courseId": 1, "playbackSessionId": "..." }
```

用途：终止课程并回到课表。

### Message Schema（配对存在性）

#### `tv_pairing_presence`

```json
{ "type": "tv_pairing_presence", "deviceId": "TV-XXXXXXX", "pairToken": "ABCDEF12" }
```

#### `tv_unbound`

```json
{
  "type": "tv_unbound",
  "deviceId": "TV-XXXXXXX",
  "venueId": "<previous-namespace>",
  "screenNumber": 1,
  "pairToken": "ABCDEF12"
}
```
