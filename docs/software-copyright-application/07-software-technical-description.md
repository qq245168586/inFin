# 07. 软件技术说明

## 1. 软件名称

Infini 团课训练场馆运营系统软件 V1.0

## 2. 软件用途

本软件面向精品团课、功能训练、拳击、Hybrid/HYROX 类训练场馆，提供从课程内容生产、排课、教练现场控课到 TV 多屏训练播放的完整数字化支持。软件用于提升课程标准化、训练体验一致性、教练执行效率和多门店复制能力。

## 3. 系统架构

系统采用多端协同架构：

- Server API：统一处理权限、业务数据、课程包、排课、媒体、TV 设备和 playback session；
- Course Web：用于编课人员管理动作库、课程脚本、模板和排课；
- Admin Web：用于管理员管理场馆、账号、课程包、TV 设备和版本更新；
- Coach Web：用于教练查看课表、预览课程、控制 TV 播放和绑定屏幕；
- Android TV：用于训练现场多屏播放、视频缓存、心跳、MQTT 指令处理；
- MQTT Gateway：用于统一向场馆 namespace 下发控制消息；
- Ops Web：用于运维查看设备、MQTT 和运行日志。

## 4. 主要技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | Node.js、NestJS、TypeScript |
| Web 前端 | React、Vite、TypeScript |
| TV 客户端 | Android Java、OkHttp、Paho MQTT、ZXing |
| 实时通信 | MQTT / EMQX |
| 媒体交付 | HTTP、Nginx、checksum、ETag、本地缓存 |
| 测试 | Vitest、JUnit、JaCoCo |

## 5. 核心功能

1. 账号与权限管理；
2. 场馆和课程包管理；
3. 动作库和动作视频管理；
4. 课程脚本编排；
5. 训练模板管理；
6. 课程排课；
7. 教练现场控课；
8. Android TV 多屏播放；
9. TV 设备绑定、心跳和版本更新；
10. MQTT 控制消息；
11. 课程资源 checksum 与 daily bundle；
12. 运维日志和调试。

## 6. 核心创新点/复杂点

- 课程脚本不是普通视频列表，而是支持 warm up、training、cool down、Pod、站点、work/rest/switch 等结构化训练逻辑；
- TV 多屏播放需要根据屏幕号展示不同内容，并通过服务端权威 session 保持同步；
- MQTT 作为通知通道，Server 作为权威状态源，降低消息乱序、延迟和断网恢复风险；
- TV 端采用课程资源 checksum 和本地缓存，避免现场网络不稳定影响训练播放；
- 多场馆通过 namespace 隔离，防止课程和控制消息串场；
- 管理端、编课端、教练端、TV 端共享同一课程脚本和时序口径。

## 7. 代码规模

| 模块 | 约源码行数 |
| --- | ---: |
| Server | 12,137 |
| Web 端合计 | 35,131 |
| Android TV | 18,181 |
| 合计 | 65,000 行以上 |

后端 OpenAPI 规模：63 个 path，81 个 operation。

