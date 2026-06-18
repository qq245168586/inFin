# Infini Server API

本文档对应当前 `apps/server/src/server.js` 实际暴露的接口。Swagger / OpenAPI 文件在同目录的 [`openapi.json`](./openapi.json)。

## 如何查看 Swagger

1. 打开 <https://editor.swagger.io/>
2. 将 `apps/server/openapi.json` 内容粘贴进去
3. 或后续把该文件挂到 Swagger UI 服务中直接查看

## Base URL

| 环境 | 地址 | 说明 |
| --- | --- | --- |
| 生产域名 | `https://api.infintraining.work` | Web 端优先使用 |
| 生产 IP | `http://8.130.65.113` | TV 盒子兼容 HTTP 时使用 |
| 本地开发 | `http://127.0.0.1:3100` | 本地 server |

## 认证说明

| 类型 | 说明 |
| --- | --- |
| Legacy Basic Auth | 登录、刷新 token 需要请求头 `Authorization: Basic REDACTED_CONFIGURE_LOCALLY` |
| Bearer Token | 登录返回 `access_token` 后，大部分 Web 控制接口使用 `Authorization: Bearer <access_token>` |
| 超级管理员 | `13689547720`、`zhiyou` 当前拥有场馆管理、MQTT 调试等管理权限 |
| TV 设备接口 | TV 拉资源、心跳等设备接口主要通过 `accountNamespace`、`deviceId`、`screenNumber` 区分，不额外引入复杂认证 |

## 接口清单

### Health / Meta

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务健康检查，返回 DB 安全状态、媒体存储模式、TV 控制配置和服务器时间 |
| `GET` | `/api/meta` | 获取编辑端基础元数据，例如动作类型、课程类型等 |
| `GET` | `/api/editor/bootstrap` | 编辑端启动时获取基础数据，等价于 meta 的增强入口 |

### 登录与用户

| Method | Path | 用途 |
| --- | --- | --- |
| `POST` | `/app/login` | 旧版登录入口，返回 access token / refresh token |
| `POST` | `/api/app/login` | 新版登录入口，逻辑同 `/app/login` |
| `GET` | `/app/refresh` | 旧版刷新 token |
| `POST` | `/app/refresh` | 旧版刷新 token，refresh token 可放 body |
| `GET` | `/api/app/refresh` | 新版刷新 token |
| `POST` | `/api/app/refresh` | 新版刷新 token，refresh token 可放 body |
| `GET` | `/user/info` | 旧版获取当前用户信息 |
| `GET` | `/api/user/info` | 新版获取当前用户信息 |
| `GET` | `/user/list` | 旧版用户列表 |
| `GET` | `/api/user/list` | 新版用户列表 |
| `POST` | `/user/insert` | 旧版创建用户 |
| `POST` | `/api/user/insert` | 新版创建用户 |

### 场馆管理

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/venues` | 管理端获取全部场馆 |
| `POST` | `/api/admin/venues` | 新建场馆，命名空间由服务端根据场馆名称生成 |
| `PATCH` | `/api/admin/venues/{venueId}` | 修改场馆名称、备注等信息 |
| `DELETE` | `/api/admin/venues/{venueId}` | 删除场馆，并通知已绑定 TV 退回二维码页 |
| `GET` | `/api/admin/venues/{venueId}/users` | 查看场馆下绑定的账号 |
| `POST` | `/api/admin/venues/{venueId}/users` | 在指定场馆下创建账号 |
| `GET` | `/api/admin/venues/{venueId}/screens` | 查看指定场馆下的 TV 屏幕与设备状态 |
| `GET` | `/api/admin/users` | 管理端账号列表，支持搜索、只看未绑定、按角色筛选 |
| `POST` | `/api/admin/users` | 创建场馆账号，暂不直接绑定场馆 |
| `POST` | `/api/admin/venues/{venueId}/bind-user` | 将已有账号绑定到场馆，一个账号当前只能绑定一个场馆 |
| `POST` | `/api/admin/users/{userId}/unbind` | 将账号从场馆解绑 |
| `PATCH` | `/api/admin/users/{userId}` | 修改账号信息 |

### 课程包与场馆课程包

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/course-packages` | 管理端查看全部课程包 |
| `POST` | `/api/admin/course-packages` | 新建课程包，并选择可归属的课程 |
| `PATCH` | `/api/admin/course-packages/{packageId}` | 修改课程包名称、描述和课程集合 |
| `DELETE` | `/api/admin/course-packages/{packageId}` | 删除课程包（默认课程包不可删除） |
| `GET` | `/api/admin/venues/{venueId}/course-packages` | 查看场馆绑定的课程包和当前启用课程包 |
| `POST` | `/api/admin/venues/{venueId}/course-packages` | 给场馆绑定课程包 |
| `DELETE` | `/api/admin/venues/{venueId}/course-packages/{packageId}` | 从场馆解绑课程包 |
| `POST` | `/api/admin/venues/{venueId}/active-course-package` | 管理端切换场馆当前启用课程包 |
| `PUT` | `/api/admin/users/{userId}/course-packages` | 设置编课账号可编辑/排课的课程包范围 |
| `GET` | `/api/coach/course-packages` | Coach 查看当前场馆可切换的课程包 |
| `POST` | `/api/coach/active-course-package` | Coach 切换当前场馆启用课程包，并通知 TV 重新校验课表 |

### MQTT 调试

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/ops/mqtt/events` | 管理员查询 MQTT JSONL 历史日志 |
| `GET` | `/api/ops/mqtt/stream` | 管理员订阅 MQTT SSE 实时日志，方便排查同步和控制指令 |

### TV 课程资源

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/tv/daily-bundle` | TV 拉取某天课表及课程资源；服务端会按 TV 绑定场馆当前启用课程包过滤 |
| `GET` | `/api/tv/daily-checksum` | TV 定时检查当天课表/课程内容 checksum 是否变化；checksum 同样基于当前启用课程包，并包含课程简介、主题和换站模式 |
| `GET` | `/api/tv/schedule-bundle` | TV 根据单个排课 ID 拉取该课程完整播放资源 |

### Playback Session

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/tv/playback-sessions/current` | 获取当前场馆正在 preview / running / paused 的播放会话 |
| `POST` | `/api/tv/playback-sessions/preview` | Coach 端进入课程预览，创建 playback session 并通过 MQTT 通知 TV |
| `GET` | `/api/tv/playback-sessions/{sessionId}` | 获取指定 playback session |
| `POST` | `/api/tv/playback-sessions/{sessionId}/start` | 正式开始课程，server 生成统一开始时间并通知 TV |
| `POST` | `/api/tv/playback-sessions/{sessionId}/pause` | 暂停课程，所有 TV 保持当前状态 |
| `POST` | `/api/tv/playback-sessions/{sessionId}/resume` | 恢复课程，继续使用 server session 计算进度 |
| `POST` | `/api/tv/playback-sessions/{sessionId}/end` | 结束课程 |
| `POST` | `/api/tv/playback-sessions/{sessionId}/terminate` | 强制终止课程，TV 回到课表或待机页 |

### TV 屏幕与控制

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/tv/screens` | Coach / 管理端查看当前账号或场馆下的屏幕状态 |
| `POST` | `/api/tv/screens/bind` | 旧式绑定屏幕，直接提交设备 ID 和屏幕号 |
| `POST` | `/api/tv/screens/heartbeat` | TV 定时心跳，上报在线状态、屏幕编号、版本、播放状态、缓存信息 |
| `POST` | `/api/tv/screens/pair-bind` | Coach 扫二维码后绑定设备到屏幕，并通过未绑定 topic 通知 TV 切换场馆 |
| `POST` | `/api/tv/screens/unbind` | 解绑屏幕，并通过 MQTT 通知 TV 回到二维码页 |
| `POST` | `/api/tv/screens/reassign` | 调整设备绑定的屏幕编号 |
| `POST` | `/api/tv/screens/clear-cache` | 下发 TV 清理本地课程视频缓存命令 |
| `POST` | `/api/tv/screens/install-package` | 下发 TV 安装指定 APK 版本命令 |
| `POST` | `/api/tv/control` | 兼容控制入口，可下发刷新 checksum、preview、start、pause、resume、terminate 等控制指令 |

### App 安装包

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/app-packages` | 查看服务器安装包目录中的 App 版本列表 |
| `POST` | `/api/app-packages/scan` | 重新扫描安装包目录并写入版本索引 |
| `POST` | `/api/app-packages/upload` | 上传 APK 到服务器安装包目录 |
| `GET` | `/api/app-packages/files/{filename}` | 下载 APK 安装包 |
| `HEAD` | `/api/app-packages/files/{filename}` | 检查 APK 文件是否存在及大小 |

### 上传与媒体

| Method | Path | 用途 |
| --- | --- | --- |
| `POST` | `/api/upload/video` | 上传动作视频，按配置保存到 OSS 或服务器本地 |
| `POST` | `/api/upload/image` | 上传图片资源 |
| `GET` | `/api/media/{filename}` | 获取本地媒体文件 |
| `HEAD` | `/api/media/{filename}` | 检查本地媒体文件 |

### 动作库

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/action-types` | 获取动作分类 |
| `POST` | `/api/action-types` | 新增动作分类 |
| `GET` | `/api/actions` | 获取动作库列表 |
| `POST` | `/api/actions` | 新建动作 |
| `GET` | `/api/actions/{actionId}` | 获取单个动作 |
| `PUT` | `/api/actions/{actionId}` | 更新动作 |
| `DELETE` | `/api/actions/{actionId}` | 删除动作，若被课程引用会返回冲突 |

### 课程与模板

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/lesson-types` | 获取课程分类 |
| `POST` | `/api/lesson-types` | 新增课程分类 |
| `GET` | `/api/courses/options` | 获取课程编辑下拉选项 |
| `GET` | `/api/courses` | 获取课程列表 |
| `POST` | `/api/courses` | 新建课程 |
| `GET` | `/api/courses/{courseId}` | 获取课程详情 |
| `PUT` | `/api/courses/{courseId}` | 更新课程 |
| `DELETE` | `/api/courses/{courseId}` | 删除课程，若有排课引用会返回冲突 |
| `GET` | `/api/templates` | 获取课程模板列表 |
| `POST` | `/api/templates` | 新建课程模板 |
| `GET` | `/api/templates/{templateId}` | 获取模板详情 |
| `PUT` | `/api/templates/{templateId}` | 更新模板 |
| `DELETE` | `/api/templates/{templateId}` | 删除模板 |

### 排课

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/schedules` | 按 scope 和 venueId 获取排课 |
| `POST` | `/api/schedules` | 新增排课，把可复用课程排进指定场馆的课表；新 payload 可只传 `courseId`、`coursePackageId`、`version`、`date`，服务端按当天 00:00:00 保存，`duration` 默认 `0` |
| `POST` | `/api/schedules/copy-week` | 复制指定过去周到指定未来周；payload: `coursePackageId`、`sourceWeekStart`、`targetWeekStart`、`replaceExisting` |
| `POST` | `/api/schedules/copy-last-week` | 复制上周排课到本周 |
| `DELETE` | `/api/schedules/{scheduleId}` | 删除排课 |

## 关键业务约定

- 课程本身不绑定场馆，排课绑定场馆，这样同一课程可以复用到多个场馆。
- 课程包由 Admin 创建并绑定到场馆；新场馆默认绑定默认课程包。
- 一个场馆可以绑定多个课程包，但同一时间只有一个 `activeCoursePackageId` 生效。
- Coach 可以在场馆已绑定课程包之间切换当前启用课程包；切换后 Server 发布 `refresh_checksum`，TV 用原有 daily-bundle/daily-checksum 流程重新同步。
- TV 不直接理解课程包，不新增课程包 MQTT 协议；它只按 `accountNamespace` 拉取 Server 已过滤好的当前有效课表。
- 编课账号可被授权到一个或多个课程包；其课程列表、排课列表和可排课程都必须按授权课程包隔离。
- TV 通过扫码绑定到场馆和屏幕号；场馆删除或屏幕解绑时，server 会发 MQTT 让 TV 回二维码页。
- Playback session 是 TV 同步播放的唯一可信状态源；TV 收到控制命令后应拉取 server session，而不是用本机时间自行开始。
- TV 资源下载应优先用 checksum 判断是否需要更新，避免 OSS/公网流量浪费。
- MQTT topic 以场馆命名空间隔离，未绑定设备只监听未绑定 topic；绑定后切换到场馆 topic。
