# 服务端需求文档：课程 Playback Session 权威状态

## 目标

服务端必须成为课程播放状态的唯一权威来源。Coach 端只发起控制意图，TV 端只根据服务端 session 渲染当前进度。

本方案目标：

- 三块 TV 屏幕使用同一条服务端时间轴，避免本机系统时间差导致热身/训练倒计时不同步。
- TV 盒子掉线、App 重启、网络恢复后，可以自动接回正在进行的课程进度。
- MQTT 只做低延迟通知，不承担状态持久化。
- TV 端未来尽量少改：协议一次设计稳定，后续主要扩展服务端和 Coach 端。

## 设计原则

- 服务端 DB 中的 `playback_session` 是唯一真相。
- 所有控制操作必须幂等，重复请求不能造成重复开课、重复暂停、重复累计暂停时间。
- 所有 session 更新必须带单调递增 `version`。
- TV 收到 MQTT 后可以立即应用，也必须能通过 HTTP 拉取完整 session 恢复。
- TV 上报的 heartbeat 只用于在线状态和排查，不作为权威播放进度。
- 服务端时间是权威时间。Coach 浏览器时间和 TV 本机系统时间都不能作为权威。

## 数据模型

新增或等价实现 `playback_sessions` 表/集合。

字段：

```json
{
  "id": "session-uuid",
  "accountNamespace": "venue-a",
  "scheduleId": "schedule-id",
  "courseId": 123,
  "bundleChecksum": "checksum",
  "state": "PREVIEW | SCHEDULED | RUNNING | PAUSED | ENDED | TERMINATED",
  "version": 1,
  "serverStartAtMs": 1770000000000,
  "pausedAccumulatedMs": 0,
  "pausedAtMs": 0,
  "endedAtMs": 0,
  "terminatedAtMs": 0,
  "createdBy": "coach-user",
  "createdAtMs": 1770000000000,
  "updatedAtMs": 1770000000000,
  "lastCommandId": "uuid",
  "metadata": {}
}
```

约束：

- 同一 `accountNamespace` 同一时间只能有一个 `PREVIEW | SCHEDULED | RUNNING | PAUSED` 的 active session。
- 新开 session 前，服务端必须明确结束或替换旧 active session。
- `version` 每次状态变化递增。
- `serverStartAtMs` 一旦进入 `RUNNING` 不可修改。
- `pausedAccumulatedMs` 只能在 resume 时增加。

## 时间计算

服务端返回 `serverNowMs`，TV 使用它校准本机时间。

RUNNING：

```text
elapsedMs = serverNowMs - serverStartAtMs - pausedAccumulatedMs
```

PAUSED：

```text
elapsedMs = pausedAtMs - serverStartAtMs - pausedAccumulatedMs
```

ENDED / TERMINATED：

```text
elapsedMs = endedAtMs - serverStartAtMs - pausedAccumulatedMs
```

服务端生成开始时间：

```text
serverStartAtMs = serverNowMs + startDelayMs
```

默认 `startDelayMs = 5000`，可配置，不能低于 `3000`。

## HTTP API

### 创建/进入预览

`POST /api/tv/playback-sessions/preview`

请求：

```json
{
  "scheduleId": "schedule-id",
  "courseId": 123,
  "scheduledStartAtMs": 1770000000000,
  "bundleChecksum": "checksum",
  "commandId": "uuid"
}
```

行为：

- 创建或复用 active preview session。
- 如果当前已有同 schedule/course/checksum 的 `PREVIEW` session，返回现有 session，不重复创建。
- 如果已有其它 active session，按产品策略返回冲突或先终止旧 session。建议第一阶段返回 `409`，由 Coach 明确确认替换。

返回：

```json
{
  "ok": true,
  "serverNowMs": 1770000000000,
  "session": {}
}
```

### 开始课程

`POST /api/tv/playback-sessions/:sessionId/start`

请求：

```json
{
  "commandId": "uuid",
  "startDelayMs": 5000
}
```

行为：

- 服务端生成 `serverStartAtMs = Date.now() + startDelayMs`。
- 状态变为 `SCHEDULED`，到达开始时间后逻辑视为 `RUNNING`。
- 为了 TV 端简单，响应和 MQTT 可直接返回 `state: RUNNING`，同时带未来的 `serverStartAtMs`。
- 重复 `commandId` 必须返回同一结果。
- 已经 `RUNNING` 的同 session 再 start，返回当前 session，不重置开始时间。

### 暂停

`POST /api/tv/playback-sessions/:sessionId/pause`

行为：

- 仅 `RUNNING | SCHEDULED` 可暂停。
- 如果还没到 `serverStartAtMs`，暂停时 `pausedAtMs = serverStartAtMs`。
- 已 `PAUSED` 重复暂停不改变 `pausedAtMs` 和 `pausedAccumulatedMs`。

### 继续

`POST /api/tv/playback-sessions/:sessionId/resume`

行为：

- 仅 `PAUSED` 可继续。
- `pausedAccumulatedMs += serverNowMs - pausedAtMs`。
- `pausedAtMs = 0`。
- 状态变为 `RUNNING`。

### 结束/终止

`POST /api/tv/playback-sessions/:sessionId/end`

`POST /api/tv/playback-sessions/:sessionId/terminate`

行为：

- `END` 表示自然结束，`TERMINATE` 表示教练手动结束。
- 状态固定后不可再 start/resume。
- MQTT 广播最终状态。

### TV 恢复当前 session

`GET /api/tv/playback-sessions/current?deviceId=xxx&screenNumber=1`

返回当前账号/场馆 active session：

```json
{
  "ok": true,
  "serverNowMs": 1770000000000,
  "session": {
    "id": "session-uuid",
    "state": "RUNNING",
    "version": 10,
    "scheduleId": "schedule-id",
    "courseId": 123,
    "bundleChecksum": "checksum",
    "serverStartAtMs": 1770000000000,
    "pausedAccumulatedMs": 0,
    "pausedAtMs": 0
  }
}
```

如果无 active session：

```json
{
  "ok": true,
  "serverNowMs": 1770000000000,
  "session": null
}
```

TV 使用场景：

- App 启动。
- MQTT reconnect。
- 网络恢复。
- heartbeat 发现本地 session 与服务端不一致。
- 收到 `session_updated` MQTT 通知后拉取完整 session。

Current session 选择规则：

- `PREVIEW | SCHEDULED | RUNNING | PAUSED` active session 永远优先返回。
- `ENDED | TERMINATED` terminal session 只在没有 active session 时，作为短 TTL fallback 返回给 TV，用于让慢屏幕收敛回课表。
- 如果教练刚结束旧预览又立刻创建新预览，TV current 必须返回新的 `PREVIEW`，不能被旧 `TERMINATED` 覆盖。

## MQTT 通知

服务端启动一个 MQTT client 负责发布 session 事件。

Topic：

```text
infini/tv/session/{accountNamespace}
```

消息：

```json
{
  "type": "session_updated",
  "accountNamespace": "venue-a",
  "sessionId": "session-uuid",
  "version": 10,
  "state": "RUNNING",
  "serverNowMs": 1770000000000,
  "updatedAtMs": 1770000000000
}
```

要求：

- QoS 建议 `1`。
- 不依赖 retained 作为权威状态。
- 可选 retain 最新事件，但 TV 仍必须 HTTP 拉完整 session 校验。
- TV 收到旧 `version` 必须忽略。
- 同一 session 每次状态变化只发布一次事件；发布失败不回滚 DB，但要记录错误并允许重试/由 heartbeat 补偿。

## Heartbeat 变更

现有 TV heartbeat 继续保留，新增/确认字段：

```json
{
  "playbackSessionId": "session-uuid",
  "sessionVersion": 10,
  "playbackState": "RUNNING",
  "playbackElapsedMs": 123456,
  "bundleChecksum": "checksum"
}
```

服务端行为：

- heartbeat 不更新权威 session elapsed。
- 如果 TV 上报 `sessionVersion` 落后，可在响应里提示 `sessionOutdated: true`。
- Coach 端用 heartbeat 显示屏幕在线、当前状态、与服务端 elapsed 的偏差。

## 风险控制

- 幂等：所有控制请求必须带 `commandId`，服务端保存最近命令结果。
- 单调版本：TV 和 Coach 都以 `version` 判断新旧。
- 服务端时间：所有响应带 `serverNowMs`。
- 冲突控制：active session 冲突时第一阶段返回 `409`，避免误停正在上课的课程。
- 资源校验：session 带 `bundleChecksum`，TV checksum 不匹配时先同步资源，同步完成后按当前 session 追进度。
- 掉线恢复：TV 不依赖 MQTT 历史，启动必拉 `current session`。
- 可观测性：记录每个 session command、MQTT outbound、TV heartbeat、版本差异。

## TV 端稳定协议建议

为了未来 TV 少改，服务端对 TV 暴露的 session snapshot 字段必须长期兼容：

```json
{
  "serverNowMs": 0,
  "session": {
    "id": "",
    "state": "",
    "version": 0,
    "scheduleId": "",
    "courseId": 0,
    "bundleChecksum": "",
    "serverStartAtMs": 0,
    "pausedAccumulatedMs": 0,
    "pausedAtMs": 0,
    "endedAtMs": 0,
    "terminatedAtMs": 0
  }
}
```

后续新增字段只能追加，不能改名或改变语义。

## 验收标准

- 三台 TV 同时开始课程，热身倒计时偏差稳定小于 500ms。
- 任意 TV 断网 30 秒后恢复，能自动进入当前课程进度。
- 任意 TV App 被杀后重新打开，能自动进入当前课程进度。
- Coach 暂停/继续后，三台 TV 仍保持一致。
- 重复点击开始/暂停/继续不会破坏 session 时间。
- 服务端重启后 active session 仍可恢复。
