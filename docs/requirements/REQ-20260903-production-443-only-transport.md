# REQ-20260903-production-443-only-transport: 生产通信统一使用 443

## Status

- Status: Ready for QA
- Owner: Infini Platform
- Created: 2026-09-03
- Updated: 2026-09-03
- Related docs: `apps/server/API.md`, `apps/tv-android/API.md`
- Related code map sections: Runtime Domains, MQTT Isolation, Deployment Notes

## Requirement Summary

所有生产客户端访问 API、媒体和安装包时统一使用 HTTPS/443，MQTT 统一使用 WSS/443。删除 TV 的公网 HTTP IP 与 TCP/1883 回退，避免证书错误时静默降级到明文传输。Web 页面、监控和配置样例也不得再把生产 IP/80 当成兼容入口。

## Background

- 当前行为：TV 主链路已是 HTTPS/WSS，但仍保留 HTTP IP 和 TCP/1883 备用地址；下载页和监控脚本也保留生产 HTTP 地址。
- 问题：主链路失败后可能降级到明文入口，实际行为与生产安全约束不一致，也增加排障分支。
- 业务原因：所有公网传输统一到证书域名和 443，减少端口、证书与网络策略差异。
- 已知约束：服务器内部 upstream 与本地开发不属于公网传输；ACME HTTP-01 和 80 到 443 跳转仍需保留。

## Goals

- 生产 API 和媒体仅使用 `https://api.infintraining.work`。
- 生产 MQTT 仅使用 `wss://api.infintraining.work/mqtt`。
- TV 生产构建在配置阶段拒绝 HTTP、TCP MQTT 和明文 WebSocket。
- 80 端口不再直接代理 API、MQTT 或媒体，只做 HTTPS 跳转和证书续期。

## Non-goals

- 不把同机的 `127.0.0.1:3100/3205/8083` upstream 改成公网 443。
- 不取消局域网本地调试构建的显式 HTTP/MQTT TCP 能力。
- 不启动当前已停用的 MQTT 服务。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `REQ-20260626-tv-current-session-sync` | MQTT/session 基础链路 | Topic 和消息结构不变，只改变生产传输协议。 |
| `REQ-20260715-tv-media-delivery-protection` | TV 媒体下载 | 下载缓存、校验和重试策略不变。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/tv-android` | API / MQTT / manifest / release | 删除明文回退，生产包关闭 cleartext，版本升级到 1.0.76。 |
| `apps/server` | 配置 / 监控 / API 文档 | 默认 MQTT 使用 WSS；生产健康检查使用 HTTPS。 |
| `apps/mqtt-client` | 配置确认 | 默认值已经是 WSS/443，无业务代码变化。 |
| `apps/download-web` | API origin | file 模式改为 HTTPS API 域名。 |
| `apps/ops-web` | Nginx / EMQX / 运维脚本 | 80 仅跳转；EMQX 只监听本机 8083，关闭 1883；移除已退役 Git 服务的明文部署脚本。 |
| `apps/course-web`, `apps/coach-web`, `apps/admin-web`, `apps/websimulator` | 边界确认 | 正式环境同源 HTTPS；本地 Vite 代理保持回环 HTTP。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无。
- Backfill/default strategy: 不改 DB；TV 读取旧 HTTP 媒体 URL 时在传输边界升级为 HTTPS。
- Compatibility with old records: 公网 IP URL 归一到 API HTTPS 域名，其他 HTTP URL升级 scheme。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| `https://api.infintraining.work/api/*` | 成为唯一生产 API 入口 | 路径、请求和响应不变。 |
| `wss://api.infintraining.work/mqtt` | 成为唯一生产 MQTT 入口 | Topic、QoS 和 payload 不变。 |

## Implementation Sketch

```pseudo
production build:
  require apiUrl startsWith https://
  require mqttUrl startsWith wss://
  disable Android cleartext traffic

legacy media url:
  if production and host is legacy server IP:
    replace origin with https://api.infintraining.work
  else if production and scheme is http:
    upgrade scheme to https

nginx port 80:
  allow ACME challenge
  redirect every other request to same host over https

emqx:
  disable tcp.default on 1883
  bind ws.default to 127.0.0.1:8083
  expose that upstream only through Nginx WSS/443
```

## Risks

| Risk | Mitigation |
| --- | --- |
| HTTPS/WSS 证书或 Nginx 故障时不再有明文兜底 | 先验证 443 证书、API 健康检查和 WSS 配置；失败应明确暴露而不是降级。 |
| 旧媒体 URL 指向只支持 HTTP 的第三方 | 生产要求 HTTPS；失败记录到 TV diagnostics，不能回退明文。 |
| 误把本地 upstream 改成 443 形成反向代理循环 | 明确保留回环端口，仅关闭公网明文入口。 |
| MQTT 当前停用导致 WSS 验证失败 | 本次不擅自启动 MQTT；代码和 Nginx 静态验证后等待启用时做联调。 |

## Manual E2E Acceptance

### Happy Flow

1. 安装 TV 1.0.76，绑定场馆并拉取课表和媒体。
2. 启用 MQTT 后由 Coach 下发预览、开始和结束。
3. 用浏览器打开 Course、Coach、Admin、Ops 和下载页。

Expected:

- TV 日志中的 API 地址只有 HTTPS，MQTT broker 只有 WSS。
- 所有页面和 API 通过 443 正常工作；HTTP 页面请求只收到 301 跳转。
- 控制消息的 topic 与业务行为不变。

### Bad Flow

1. 用生产构建参数传入 HTTP API、`tcp://` 或 `ws://` MQTT 地址。
2. 暂停 443 服务后观察 TV。

Expected:

- Gradle 在构建阶段拒绝不安全的生产配置。
- TV 报告网络/MQTT 错误，不尝试公网 80 或 1883。

## Deployment / Rollback

- Build order: Server/ops 配置检查，随后 TV 1.0.76。
- Deploy order: Nginx 与静态下载页，Server 配置，最后登记 TV 安装包。
- Version bump: TV `1.0.76` / `76`。
- Deployment result: 2026-09-03 已部署 Nginx/EMQX 安全配置和下载页；TV 1.0.76 已登记为 package `93`，未强推设备。
- Certificate result: API 单域名和 Web 六域名均使用新 RSA 2048 证书，有效期到 2026-12-02；root cron 分别每日检查续签，续签成功后自动安装并 reload Nginx。
- Rollback: 回滚应用与 Nginx版本；不恢复公网明文回退。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update Requirements Index.
- [x] Update Code Map.
- [x] Update Server and TV API docs.
