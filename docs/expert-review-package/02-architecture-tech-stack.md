# 02. 架构与技术栈

## 1. 总体架构

Infini 采用多端协同架构：

- Web 端分别面向管理员、编课者、教练和运维人员；
- Server 是唯一可信业务后端；
- MQTT 只作为控制消息通知通道；
- TV 端收到 MQTT 后仍需向 Server 拉取权威 session 和课程 bundle；
- 媒体资源通过 Server/Nginx 交付，TV 本地缓存后播放。

对应图表：

- [系统上下文图](diagrams/01-system-context.mmd)
- [Coach 控课时序图](diagrams/03-coach-tv-playback-sequence.mmd)
- [TV 绑定时序图](diagrams/04-tv-binding-sequence.mmd)

## 2. 技术栈

| 层级 | 技术 | 说明 |
| --- | --- | --- |
| 后端 | Node.js、NestJS、TypeScript | API、权限、业务逻辑、文件/JSON store、TV session |
| Web 前端 | React 18、Vite、TypeScript | Admin、Course、Coach、Ops、Web Simulator |
| TV 客户端 | Android Java、AppCompat、OkHttp、Paho MQTT、ZXing | 原生 TV 播放、二维码绑定、MQTT、缓存 |
| 实时通信 | MQTT / EMQX | Coach/Admin 控制消息下发、TV 按场馆 namespace 隔离 |
| 媒体交付 | HTTP Range、Nginx X-Accel、checksum、ETag | 视频上传、派生缩略图、TV 本地缓存 |
| 部署 | Aliyun、Nginx、systemd、脚本化部署 | 多域名、API、Web 静态站、APK 下载 |
| 测试 | Vitest、JUnit、JaCoCo | 后端业务逻辑、前端部分逻辑、TV 业务类测试 |

## 3. 核心设计点

### 3.1 Server 是权威状态源

TV 端不应只依赖 MQTT 消息本身。MQTT 只是提醒，真正要展示什么课程、是否开始、当前 session 状态，都由 Server 返回。

关键好处：

- 避免某台 TV 晚收到 MQTT 后状态漂移；
- 避免 MQTT 重发/乱序导致错误开课；
- 支持 TV 断网恢复后重新拉取权威状态；
- 支持多场馆隔离和运维排查。

### 3.2 多场馆 namespace 隔离

每个场馆有 `accountNamespace`。Coach/Admin 发指令时经 Server 校验，最终发布到：

```text
infini/tv/control/{accountNamespace}
infini/tv/session/{accountNamespace}
```

TV 绑定后只订阅自己的 namespace，并校验 payload/topic 是否匹配。

### 3.3 TV 缓存优先

竖屏训练屏幕播放本地缓存视频，不稳定时不直接远程串流。这对健身房现场很关键：

- 减少弱网络导致的卡顿；
- 课程开始前可预下载；
- 通过 checksum 判断资源是否变化；
- 失败时能显示占位和运维状态。

### 3.4 多屏同步

TV 使用服务端时间、`serverStartAtMs`、请求 RTT 修正等方式计算当前播放 offset。目标不是“每台设备收到 MQTT 后从 0 开始”，而是所有屏幕按同一个权威开课时间进入相同课程进度。

### 3.5 课程脚本模型

课程不是普通视频列表，而是由动作、视频组、Pod、站点、work/rest、switch、hydrate、move zone、warm up、cool down 组成的结构化脚本。该模型直接决定：

- Course Web 编辑体验；
- Server session 时长；
- TV 播放 timeline；
- Coach 预览和控制；
- Web Simulator 校验。

## 4. 主要交互方式

| 交互 | 端到端链路 |
| --- | --- |
| 编课 | Course Web -> Server -> Store/Media |
| 排课 | Course Web -> Server -> Schedules/CoursePackage |
| 场馆绑定课程包 | Admin Web -> Server -> Venue/CoursePackage |
| 教练查看课表 | Coach Web -> Server -> Active CoursePackage -> Schedules |
| 教练控课 | Coach Web -> Server -> PlaybackSession -> MQTT Gateway -> EMQX -> TV |
| TV 拉课程 | TV -> Server daily-checksum/daily-bundle -> Media cache |
| TV 绑定 | TV QR -> Coach scan -> Server bind -> MQTT assign_screen -> TV |
| 运维排查 | Ops Web -> Server MQTT events / TV heartbeat |

## 5. 复杂度来源

该项目复杂度主要不是框架本身，而是以下交叉点：

- 课程结构复杂，并且 Web、Server、TV 必须保持同一时序口径；
- TV 端是弱硬件、强现场场景，容错成本高；
- 多屏同步需要处理网络延迟、MQTT 乱序、设备时间差；
- 媒体资源要处理上传、缩略图、缓存、checksum、更新；
- 多场馆、多课程包、多账号权限会引入数据隔离问题；
- 线下门店开课容错要求高，线上 bug 会直接影响营业。

