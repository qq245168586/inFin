# Coach 端需求文档：基于服务端 Session 的课程控制

## 目标

Coach 端不再直接决定课程播放时间。Coach 端只向服务端提交控制意图，由服务端创建和维护权威 playback session。

本方案目标：

- Coach 点击开始后，1/2/3 屏 TV 使用同一个服务端 session 和时间轴。
- 设备掉线、重启、App 重启后，Coach 端能看到状态变化，TV 能自动恢复。
- Coach 端操作幂等，避免误触导致课程重开、暂停累计错误。
- TV 端协议稳定，未来新增功能优先在服务端和 Coach 端扩展。

## 核心变化

当前 Coach 端直接发送：

```ts
playbackStartAtMs = Date.now() + 2000
```

需要改为：

```text
Coach 请求服务端 start
服务端生成 serverStartAtMs
服务端保存 session
服务端 MQTT 通知 TV
Coach 展示服务端返回的 session
```

Coach 端禁止使用浏览器 `Date.now()` 作为课程起跑权威时间。

## 页面状态模型

Coach 端维护当前选中 session：

```ts
type PlaybackSession = {
  id: string;
  state: "PREVIEW" | "SCHEDULED" | "RUNNING" | "PAUSED" | "ENDED" | "TERMINATED";
  version: number;
  scheduleId: string;
  courseId: number;
  bundleChecksum: string;
  serverStartAtMs: number;
  pausedAccumulatedMs: number;
  pausedAtMs: number;
  serverNowMs: number;
};
```

Coach 端本地可显示估算进度，但必须标明来自 session：

```text
displayElapsedMs = correctedServerNowMs - serverStartAtMs - pausedAccumulatedMs
```

`correctedServerNowMs` 可由最近 API 返回的 `serverNowMs` 和本机 `performance.now()` 推算，仅用于 UI 展示，不作为控制依据。

## 控制流程

### 进入预览

用户点击课程卡片：

1. 如果无 active session：
   - 调用 `POST /api/tv/playback-sessions/preview`。
   - 服务端返回 session。
   - Coach 保存 `selectedPlaybackSessionId`。
   - Coach 提示 TV 进入预览。

2. 如果已有同课程 `PREVIEW` session：
   - 复用 session。
   - 再次点击可进入“开始课程”确认或直接开始，按现有交互决定。

3. 如果已有其它 active session：
   - 第一阶段必须弹确认，不允许静默替换。
   - 确认文案需要说明会终止当前课程。

### 开始课程

用户点击开始：

1. Coach 生成 `commandId`。
2. 调用：

```http
POST /api/tv/playback-sessions/{sessionId}/start
```

请求：

```json
{
  "commandId": "uuid",
  "startDelayMs": 5000
}
```

3. 服务端返回 session，其中包含 `serverStartAtMs`。
4. Coach 进入 `SCHEDULED/RUNNING` 展示。
5. Coach 不再调用旧 `/api/tv/control` 直接发送 `playbackStartAtMs`。

### 暂停

调用：

```http
POST /api/tv/playback-sessions/{sessionId}/pause
```

要求：

- 按钮防重复点击。
- 已暂停时不再重复提交，或重复提交必须使用同一个 `commandId`。
- UI 以服务端返回状态为准。

### 继续

调用：

```http
POST /api/tv/playback-sessions/{sessionId}/resume
```

Coach 更新 session，并提示 TV 继续。

### 结束

自然结束或手动结束调用：

```http
POST /api/tv/playback-sessions/{sessionId}/end
POST /api/tv/playback-sessions/{sessionId}/terminate
```

手动结束必须二次确认。

## 屏幕状态展示

Coach 端需要展示每个 TV 屏幕：

```ts
type TvScreenStatus = {
  screenNumber: number;
  deviceId: string;
  online: boolean;
  playbackState: string;
  playbackSessionId: string;
  sessionVersion: number;
  playbackElapsedMs: number;
  lastSeenAt: string;
  bundleChecksum: string;
};
```

显示建议：

- 在线：最近 heartbeat 小于 20 秒。
- 离线：最近 heartbeat 大于 20 秒。
- 落后：TV `sessionVersion < serverSession.version`。
- 资源不一致：TV `bundleChecksum !== session.bundleChecksum`。
- 进度偏差：`abs(tvElapsedMs - serverElapsedMs) > 1500ms` 显示警告。

这些警告只影响 Coach 端显示，不改变权威 session。

## API 集成

Coach 端需要新增 API client：

- `createPreviewSession(schedule)`
- `startPlaybackSession(sessionId, commandId, startDelayMs)`
- `pausePlaybackSession(sessionId, commandId)`
- `resumePlaybackSession(sessionId, commandId)`
- `endPlaybackSession(sessionId, commandId)`
- `terminatePlaybackSession(sessionId, commandId)`
- `getCurrentPlaybackSession()`
- `getTvScreens()`

所有控制请求都必须带 `commandId`。

`commandId` 生成规则：

```ts
crypto.randomUUID()
```

如需兼容旧浏览器，使用本地 UUID fallback。

## 与 MQTT 的关系

Coach 端不直接依赖 MQTT。

状态更新来源：

- 控制 API 响应立即更新。
- 定时轮询 current session 和 TV screens。
- 可选 SSE/WebSocket 订阅服务端事件，但不是第一阶段必需。

轮询建议：

- session：2 秒一次。
- TV screens：5 秒一次。
- 页面不可见时降频到 15 秒。

## 风险控制

- 禁止前端生成 `playbackStartAtMs`。
- 所有按钮有 pending 状态，防止连点。
- 控制请求失败时不更新本地 session 为成功态。
- active session 冲突必须二次确认。
- 手动结束必须二次确认。
- Coach 显示服务端 `version`，便于排查。
- 操作日志展示最近 commandId、sessionId、state、version。

## 兼容策略

第一阶段可以保留旧 `/api/tv/control` 作为 fallback，但默认关闭。

建议增加配置：

```ts
USE_PLAYBACK_SESSION = true
```

当新 session API 可用时：

- 预览/开始/暂停/继续/结束全部走新 API。
- 旧 control API 只用于临时回滚。

回滚策略：

- 如果 session API 故障，Coach 显示“课程同步服务不可用”。
- 不自动降级到旧的 `Date.now() + 2000`，避免再次出现三屏不同步。
- 需要人工打开 fallback 配置才允许旧流程。

## UI 验收标准

- 点击课程进入预览，Coach 显示 sessionId 和 PREVIEW 状态。
- 点击开始后，Coach 显示统一倒计时起跑时间。
- 三台 TV 状态都显示同一 sessionId。
- 任一 TV 离线，Coach 能在 20 秒内显示离线。
- 离线 TV 恢复后，Coach 能显示它回到同一 session。
- 暂停/继续操作后，Coach 与 TV 状态一致。
- 重复点击开始/暂停/继续不会造成 session 时间错乱。

## 未来扩展预留

为了减少 TV 端未来改动，Coach 端和服务端可以在 session `metadata` 中追加能力：

- 指定屏幕临时跳过某段。
- 课程中途切换素材版本。
- 统一校时诊断。
- 单屏重载资源。
- 课程结束自动回列表时间配置。

这些能力都应通过 session snapshot 或 command metadata 追加字段实现，不修改已有字段语义。
