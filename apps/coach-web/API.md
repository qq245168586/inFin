# Coach Web API 与 MQTT（通过 Server 转发）

本文件描述 `apps/coach-web` 使用到的 **HTTP API**（由 `apps/server` 提供）以及相关 **MQTT 指令**（由 Server 发布，TV 订阅）。

## 基础约定

- Base URL（同域部署）：`/api/...`
- 认证方式：
  - `POST /api/app/login` 获取 `access_token/refresh_token`
  - 后续请求携带 `Authorization: Bearer <access_token>`
  - `POST /api/app/refresh` 刷新 token（使用 legacy basic auth）

### Legacy Envelope

部分接口返回 legacy 包装：

```json
{
  "code": 200,
  "data": {},
  "message": "success",
  "msg": "success"
}
```

## 认证相关

### POST `/api/app/login`

请求：

```json
{
  "username": "<account>",
  "password": "<password>",
  "client": "coach-web"
}
```

响应：Legacy envelope + token payload

### POST `/api/app/refresh`

Header:

- `Authorization: Basic REDACTED_CONFIGURE_LOCALLY`

请求：

```json
{
  "refresh_token": "<refresh_token>",
  "client": "coach-web"
}
```

响应：Legacy envelope + token payload

### GET `/api/user/info`

Header:

- `Authorization: Bearer <access_token>`

响应：Legacy envelope + user profile

## 课表与课程数据

### GET `/api/meta`

用于获取排课集合（当前周/上周/历史）等基础信息（Coach Web 当前用它初始化列表）。

### GET `/api/tv/daily-bundle?date=YYYY-MM-DD&timeZone=Asia/Shanghai`

用途：

- 获取当前登录账号绑定场馆、当前启用课程包下的当天排课与资源列表
- Coach Web 用于展示课程列表/调试；TV 端也使用同一逻辑做缓存同步

### GET `/api/tv/daily-checksum?date=YYYY-MM-DD&timeZone=Asia/Shanghai`

用途：

- 获取当前启用课程包下当天排课内容的 checksum（TV 定期校验是否需要重新拉取资源）

### GET `/api/tv/schedule-bundle?scheduleId=<id>`

用途：

- 获取单节课的详细脚本与资源

## 课程包切换

### GET `/api/coach/course-packages`

用途：

- 获取当前 Coach 账号绑定场馆可用的课程包列表，以及当前启用课程包。
- Coach 只展示场馆已绑定的课程包。

### POST `/api/coach/active-course-package`

请求：

```json
{
  "coursePackageId": 1,
  "commandId": "uuid"
}
```

用途：

- 切换当前场馆启用课程包。
- Server 更新场馆 `activeCoursePackageId` 后发布 `refresh_checksum`，让 TV 用现有课表同步流程重新拉取当前课程包课表。
- 如果场馆正在 Preview/Running/Paused，本接口应拒绝切换，避免正在播放的课程被中途换包。

## 屏幕管理

### GET `/api/tv/screens`

用途：

- 获取当前账号命名空间下的 TV 屏幕快照（屏幕 1-5）

### POST `/api/tv/screens/pair-bind`

用途：

- 将扫码得到的 `deviceId/pairToken` 绑定到某个屏幕号
- Server 会发布 MQTT `assign_screen` 指令到 `__unbound__` topic

请求：

```json
{
  "deviceId": "TV-XXXXXXX",
  "pairToken": "ABCDEF12",
  "screenNumber": 1
}
```

### POST `/api/tv/screens/unbind`

用途：

- 解绑屏幕，Server 发布 MQTT `unbind_screen`

请求（deviceId 或 screenNumber 二选一）：

```json
{ "deviceId": "TV-XXXXXXX" }
```

或

```json
{ "screenNumber": 1 }
```

### POST `/api/tv/screens/clear-cache`

用途：

- 下发清缓存指令，Server 发布 MQTT `clear_cache`

请求：

```json
{ "deviceId": "TV-XXXXXXX" }
```

### POST `/api/tv/screens/install-package`

用途：

- 下发 TV 端安装包升级指令，Server 发布 MQTT `install_app_update`

请求：

```json
{
  "deviceId": "TV-XXXXXXX",
  "packageId": 12
}
```

## TV 控制（课程预览/开始/暂停等）

### POST `/api/tv/control`

用途：

- 统一入口下发 TV 控制指令（Server 发布到 MQTT 控制 topic）

请求字段（通用）：

- `type`: `refresh_checksum | preview_course | start_course | pause_course | resume_course | terminate_course`
- `scheduleId`
- `courseId`
- `scheduledStartAtMs`
- `playbackSessionId`
- `bundleChecksum`（preview/start 必填）
- `playbackStartAtMs`（start 必填）
- `pausedAtMs`（pause 必填）
- `resumedAtMs`（resume 必填）

示例（Preview）：

```json
{
  "type": "preview_course",
  "scheduleId": "123",
  "courseId": 1,
  "scheduledStartAtMs": 1770000000000,
  "playbackSessionId": "session-uuid",
  "bundleChecksum": "sha256-..."
}
```

## MQTT Topic（TV 订阅）

> Coach Web 不直连 MQTT，所有 MQTT 消息由 Server 发布。

### 控制 Topic

- `infini/tv/control/__unbound__`
- `infini/tv/control/<namespace>`

其中 `<namespace>` 当前实现沿用 `accountNamespace`（后续可演进为 `venueId`，但建议保持字段名简单且可读）。

### 配对存在性 Topic（TV 发布）

- TV 发布：`infini/tv/pairing`
  - `tv_pairing_presence`（TV 在二维码页面周期上报）
  - `tv_unbound`（TV 主动解绑/退回二维码页面上报）

Server 当前主要依赖 **HTTP 心跳** 维护在线状态；该 topic 用于扫码绑定“可见性”与解绑同步（具体实现以 `apps/server/src/data/store.js` 为准）。
