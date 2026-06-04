# Infini MQTT Client Service

独立的 MQTT 网关服务。网页端和业务 server 不直接维护浏览器 MQTT 连接时，可以通过 HTTP 请求交给本服务统一发布 MQTT 消息。

## 设计边界

- 不改变 TV 端现有 MQTT topic 和 payload 协议。
- 只做 HTTP -> MQTT 的转发、连接复用和 JSONL 出站日志，默认复用 server 的 `mqtt-logs` 目录，方便现有调试页查看。
- 默认监听 `127.0.0.1:3205`，建议只在服务器内网或本机 nginx/upstream 使用。

## Endpoints

- `GET /health`：查看服务和 MQTT 连接状态。
- `POST /tv/control`：发布到 `infini/tv/control/{accountNamespace}`。
- `POST /tv/session`：发布到 `infini/tv/session/{accountNamespace}`。
- `POST /publish`：通用发布入口，显式传入 `topic`。
- `GET /events?limit=100`：查看最近的出站发布事件。

## Environment

- `PORT` / `MQTT_CLIENT_PORT`：HTTP 端口，默认 `3205`。
- `MQTT_URL`：MQTT broker URL，默认使用 `wss://api.infintraining.work/mqtt`。
- `MQTT_WSS_URL`：未设置 `MQTT_URL` 时使用的 WSS 地址。
- `MQTT_USERNAME` / `MQTT_PASSWORD`：MQTT 账号。
- `MQTT_CLIENT_HTTP_TOKEN`：可选 HTTP Bearer token。
- `INFINI_DATA_ROOT`：日志根目录，默认复用 `apps/server/storage`。
