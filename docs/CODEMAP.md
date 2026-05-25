# Infini Code Map

这个文档是 workspace 级别的代码地图，用来快速判断“某个需求应该改哪个仓库”。

## System Topology

```mermaid
flowchart LR
  Admin["admin-web\n场馆/账号/设备/版本管理"] --> Api["server\nREST API"]
  Course["course-web\n编课/动作/模板/排课"] --> Api
  Coach["coach-web\n教练课表/控制 TV"] --> Api
  Api --> Store["JSON DB / Files\ninfini-data"]
  Api --> MqttGateway["mqtt-client\nHTTP -> MQTT"]
  MqttGateway --> Emqx["EMQX MQTT"]
  TV["tv-android\n5 屏 TV 客户端"] --> Api
  TV <--> Emqx
  Download["download-web\nAPK 下载页"] --> Packages["app-packages"]
  Ops["ops-web\n调试日志"] --> Api
```

## Repository Boundaries

### `apps/server`

负责后端业务和数据安全：

- 登录、refresh token、用户权限。
- 场馆、账号、课程包、设备绑定。
- 动作、课程、课程模板、排课。
- TV 今日课表、checksum、bundle、播放 session。
- TV 版本包登记、下载、扫描。
- 对外提供 REST API，Web 端不直接改数据库。

### `apps/mqtt-client`

负责统一 MQTT 下发：

- Web 端不直接连接 MQTT。
- Coach/Admin 调用 HTTP，由 mqtt-client 统一发布 MQTT。
- MQTT 协议和 topic 保持简单，按场馆 namespace 隔离。
- 适合集中记录指令日志，排查“指令是否发出”。

### `apps/admin-web`

场馆管理端：

- 只有超级管理员可以登录。
- 管理场馆、场馆账号、编课账号、课程包。
- 查看场馆设备在线、版本、屏幕绑定。
- 给单台或批量 TV 下发更新指令。
- 不负责编辑课程内容。

### `apps/course-web`

编课端：

- 编课人员和超级管理员使用。
- 按课程包隔离动作、课程、模板、排课。
- 管理动作视频、动作分类、课程脚本、课程计划。
- 课程模板用于快速生成课程骨架。
- 排课后的课程会被 TV/Coach 按当前场馆课程包读取。

### `apps/coach-web`

教练端：

- 场馆账号登录。
- 查看当前场馆当前课程包的课表。
- 切换场馆已绑定课程包。
- 控制 TV：刷新课表、显示计划、预览、开始、暂停、结束。
- 查看现场屏幕在线状态和基础调试信息。

### `apps/tv-android`

Android TV 客户端：

- 通过扫码绑定到场馆和屏幕号。
- 按场馆 namespace 订阅 MQTT。
- 拉取今日课程、checksum 和课程资源。
- 播放竖屏/横屏不同 UI。
- 支持课程同步、暂停、结束、计划展示、静默更新。

### `apps/download-web`

TV APK 下载页：

- 面向人工下载或现场维护。
- 读取服务器 APK 版本列表。
- 不承载业务控制逻辑。

### `apps/ops-web`

运维调试页面：

- 用于查看 MQTT/TV 日志。
- 帮助排查同步、下发指令、设备在线等问题。
- 不面向普通教练和编课人员。

## Runtime Domains

| Domain | Service |
| --- | --- |
| `api.infintraining.work` | Server API |
| `admin.infintraining.work` | Admin Web |
| `course.infintraining.work` | Course Web |
| `coach.infintraining.work` | Coach Web |
| `download.infintraining.work` | Download Web |
| `ops.infintraining.work` | Ops Web |
| `git.infintraining.work` | Git service |

## MQTT Isolation

场馆隔离依赖 `accountNamespace` / venue namespace。

约定：

- TV 绑定后只订阅自己场馆的 topic。
- Coach/Admin 发控制指令时必须带场馆 namespace。
- 服务端/网关负责根据场馆发送到对应 topic。
- 不同场馆之间不共享控制消息。

## Deployment Notes

- Server 和 Web 端部署到 Aliyun。
- TV APK 包放在 `/home/REDACTED_CONFIGURE_LOCALLY/infini-data/app-packages`。
- `1.0.35` 之前的 TV 包已清理。
- 每个项目单独构建、单独提交、单独 push。
