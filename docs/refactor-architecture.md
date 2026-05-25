# 重构架构说明

## 目标

这次重构不是简单把旧代码换语言，而是把课程脚本抽象成一套新的跨端协议：

- TV 端播放什么
- 教练端预习什么
- 课程编辑端如何编排
- 服务端如何校验与下发

都围绕同一份 `CourseScript` 工作。

## 旧项目的问题

- 课程结构是热身 + 正式训练两层，缺少冷身
- 正式训练只按 `screenNum + serialNum` 存动作，无法表达视频组与 Pod
- 编辑端是逐节点规则编辑，和你给的新设计稿不一致
- TV 同步逻辑和播放逻辑在 Flutter 里耦合较深
- 服务端是拆散的 Java 微服务，迁移新流程成本高

## 新课程脚本模型

`packages/shared/src/course-script.js` 定义了新的通用模型：

- `metadata`
  - 课程名称、版本、创建者、默认补水时长
- `sections.warmup`
  - 固定瀑布流
  - 三个竖屏展示同样的视频瀑布
- `training.videoGroups`
  - 支持 `screenCount = 1 | 3`
  - 每个屏幕可配置视频卡片和站点号
- `training.pods`
  - Pod 只引用视频组，不重复定义视频资源
  - Pod 内每个屏幕可独立配置多个 `segment`
  - 每个 `segment` 可设 `workSeconds`、`restSeconds`、`stationNumber`
  - Pod 必须以 `HYDRATE` 或 `FINISH` 收尾
  - 同一个 Pod 内所有屏幕总时长必须一致
- `sections.cooldown`
  - 与热身一致，也是瀑布流

## 服务端设计

目录：`apps/server`

这版先落了一个无第三方依赖的 Node.js 原型服务，方便先把协议跑通：

- `GET /api/health`
- `GET /api/editor/bootstrap`
- `GET /api/actions`
- `GET /api/courses`
- `GET /api/courses/:id`
- `POST /api/courses/validate`
- `POST /api/courses`
- `PUT /api/courses/:id`
- `GET /api/schedules?date=YYYY-MM-DD`

后续建议按这个方向继续补齐：

- 接入 MySQL 或 PostgreSQL
- 视频资源改为对象存储 + 媒体表
- 多屏同步从 MQTT 迁移为 `WebSocket + 时间基准 + 心跳校准`
- TV 端启动后先拉取今日排课，再订阅单课会话同步

## React 编辑端设计

目录：`apps/admin-web`

当前原型已经体现了新的编辑方式：

- 基础信息
- 热身编辑
- 视频组编辑
- Pod 编排
- 冷身编辑
- JSON 预览

重点是编辑器现在按“视频组 + Pod”组织，而不是按旧版训练规则表逐条堆叠。

## Android TV 端设计

目录：`apps/tv-android`

当前原型包括：

- `CourseScript` Java 模型
- `TimelinePlanner`
  - 把热身、Pod、补水/结束、冷身编排成播放时间线
- `TvScriptRepository`
  - 提供样例课程
- `MainActivity`
  - 展示时间线预览
- `ServerConfig`
  - 统一维护 API 与 MQTT 地址，后续切域名时只改一处

后续建议继续补：

- ExoPlayer 播放器层
- 多设备角色发现
- WebSocket 同步层
- 三竖屏 + 横屏站点屏 + 进度屏的多 Activity / 多进程分工

## Android 教练端设计

目录：`apps/coach-android`

当前原型聚焦两件事：

- 今日课表
- 课程动作预习列表
- `ServerConfig`
  - 统一维护 API 与 MQTT 地址

后续接服务端时可以拆成：

- `GET /api/schedules?date=today`
- `GET /api/courses/:id`
- 点击动作后进入视频预览页

## 部署方式

Nginx 配置在 `deploy/nginx.conf`，建议部署方式：

1. React 编辑端构建后输出到 `/srv/infini/admin-web/dist`
2. Node 服务端跑在 `127.0.0.1:3100`
3. 视频媒体资源挂到 `/srv/infini/media`
4. Nginx 负责：
   - 托管前端静态资源
   - 代理 `/api`
   - 暴露 `/media`

### 数据安全约束

运行时数据不能再放在代码目录里。

- 通过 `INFINI_DATA_ROOT` 指定独立数据目录，例如 `/srv/infini-data`
- `db.json`、`media/`、`backups/` 都存放在这个目录下
- 服务端持久化使用“临时文件 + rename”的原子写入，避免写一半损坏数据库
- 每次覆盖写入前会自动保存上一份 `db.json` 到 `backups/`
- 启动时如果主库损坏，会自动尝试用最新备份恢复
- 部署代码时必须排除运行时数据目录，不能再把本地 `apps/server/storage` 打包上服务器

建议上线后把 `/api/health` 纳入巡检，至少检查：

- `dbSafety.usingExternalDataRoot === true`
- `dbSafety.backupCount > 0`
- `dbSafety.dbSizeBytes > 0`

## 迁移建议

建议按下面顺序推进，风险最低：

1. 先让旧课程数据导出成新 `CourseScript`
2. React 编辑端上线给内容团队试编排
3. Node 服务端替换旧课程/排课接口
4. TV 原生版接入新脚本与新同步协议
5. 教练端切到新服务端
