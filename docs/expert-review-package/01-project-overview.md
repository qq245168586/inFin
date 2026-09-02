# 01. 项目概览

## 1. 项目定位

Infini 是面向精品团课、功能训练、拳击/Hybrid/HYROX 类场馆的训练交付系统。它不是单纯的健身房 CRM，也不是普通课程表工具，而是把以下环节打通：

- 课程内容生产：动作库、视频、课程脚本、训练模板、课程包；
- 课程排课：按课程包排课，并可绑定给不同场馆；
- 现场教练控课：Coach Web 预览、开始、暂停、继续、结束课程；
- TV 多屏播放：Android TV 根据课程脚本和屏幕号展示不同内容；
- 设备和版本管理：TV 绑定、心跳、缓存、APK 更新、运维日志；
- 未来会员运营闭环：预约、签到、反馈、训练记录、运营复盘。

核心价值不在“有一个后台”，而在于把团课场馆的课程交付流程标准化、可复制、可培训、可运维。

## 2. 当前仓库组成

| 子项目 | 技术/形态 | 用途 |
| --- | --- | --- |
| `apps/server` | Node.js / NestJS / TypeScript | API、权限、课程包、排课、媒体、TV session、设备、MQTT 入口 |
| `apps/admin-web` | React / Vite / TypeScript | 场馆、账号、设备、课程包、TV 版本管理 |
| `apps/course-web` | React / Vite / TypeScript | 动作库、视频上传、课程编辑、模板、排课 |
| `apps/coach-web` | React / Vite / TypeScript | 教练现场课表、预览、开课、暂停、结束、TV 绑定 |
| `apps/tv-android` | Android Java | TV 多屏播放、缓存、MQTT、二维码绑定、APK 更新 |
| `apps/mqtt-client` | Node.js / MQTT | HTTP 到 MQTT 的统一下发网关 |
| `apps/ops-web` | React / Vite | 运维调试、MQTT/TV 日志查看 |
| `apps/download-web` | 静态 Web | TV APK 下载页 |
| `apps/websimulator` | React / Vite | 课程播放/时间线模拟与验证 |

## 3. 当前代码规模

统计口径：`src` 和 Android `main/java` 下的主要源码，不含 `node_modules`、构建产物、锁文件和文档。

| 模块 | 约源码行数 |
| --- | ---: |
| Server | 12,137 |
| Admin Web | 11,394 |
| Course Web | 16,198 |
| Coach Web | 4,298 |
| TV Android | 18,181 |
| Web Simulator | 2,499 |
| Ops Web | 742 |
| MQTT Client | 419 |
| **合计** | **约 65,868 行** |

其他规模指标：

- 后端 OpenAPI：63 个 path，81 个 operation；
- 源码文件：约 400+ 个；
- 自动化测试文件：约 20 个；
- 技术域覆盖：后端、Web 前端、Android 原生、MQTT、视频媒体、部署运维、现场设备。

## 4. 已知生产/商用信号

此前查看生产库聚合数据时，项目已经存在以下业务数据：

- 3 个场馆记录；
- 20 个 TV 屏记录；
- 27 门课程；
- 119 条排课；
- 264 个动作；
- 24 个模板；
- 342 次播放会话；
- 2 个课程包；
- 374 个媒体资源。

另有一个已投入商用的健身房，说明系统不是纯 demo，已经进入真实门店使用链路。

## 5. 给专家的核心判断点

专家评估时建议重点判断：

- 该系统是否已经超过“普通后台 + 简单视频播放”的复杂度；
- Android TV 多屏同步、缓存、断网、MQTT 与权威 session 设计是否有工程含金量；
- 课程编辑器和课程脚本模型是否具备业务壁垒；
- 现有代码质量是否适合继续维护、二开和规模化；
- 如果外包重做，专家如何估算同等功能、同等质量、同等现场稳定性的替代成本；
- 如果买断，IP、源码、部署、维护、新功能边界是否必须拆开评估。
