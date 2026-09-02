# Requirements Index

这个索引用来追踪已经整理过的产品需求。每个需求使用一个独立 Markdown 文件，文件名建议：

`REQ-YYYYMMDD-short-slug.md`

## Active / Draft

| ID | Title | Status | Apps | Owner Notes |
| --- | --- | --- | --- | --- |
| [REQ-20260826-tv-diagnostic-log-upload](REQ-20260826-tv-diagnostic-log-upload.md) | TV 错误文件回传、分类查询与 10 天保留 | Ready for QA | `tv-android`, `server`, `ops-web` | 本地实现和回归通过；Ops 可按六类、日期、场馆、设备、屏幕和错误码只读查询；不改 DB 或课程控制。 |
| [REQ-20260719-switch-pod-ab-round-rotation](REQ-20260719-switch-pod-ab-round-rotation.md) | SWITCH Pod AB 轮转与换站 | Ready for QA | `course-web`, `tv-android` | loopCount 统一为 AB 轮次数；A→B 显示 SWITCH，轮次之间显示 MOVE STATION，Course/TV 时长与进度统一。 |
| [REQ-20260719-test-package-global-access](REQ-20260719-test-package-global-access.md) | 测试课程包全局读写 | Ready for QA | `server`, `course-web` | 测试课程包通过 accessScope=GLOBAL 直接读写全部课程包资源；不批量迁移归属，新建资源和测试排课仍归属测试包。 |
| [REQ-20260719-pod-ending-duration](REQ-20260719-pod-ending-duration.md) | Pod 独立补水与换区时长 | Ready for QA | `shared`, `server`, `course-web`, `tv-android` | 每个 Pod 独立保存 endingSeconds；旧课程回退全局默认值；Set/Work/Rest/Switch 仅用于展示。 |
| [REQ-20260715-tv-media-delivery-protection](REQ-20260715-tv-media-delivery-protection.md) | TV 媒体传输卸载与重复下载保护 | Implemented, not deployed | `server`, `tv-android` | `/api/media` 支持 immutable/304 与可选 X-Accel；TV 下载携带设备身份并有限退避，Nginx 按设备+屏幕+资源精准限制重复并发。 |
| [REQ-20260714-tv-local-video-only-playback](REQ-20260714-tv-local-video-only-playback.md) | TV 本地视频播放与信息屏资源隔离 | Ready for QA | `tv-android` | 屏幕 2/4 不下载 MP4；所有 VideoView 仅播放已校验存在的本地视频，startCourse 重渲染不重复下载。 |
| [REQ-20260619-coach-course-package-switch-settings](REQ-20260619-coach-course-package-switch-settings.md) | Coach 设置中切换场馆课程包 | Ready for QA | `coach-web`, `server`, `tv-android`, `mqtt-client` | 设置中显示场馆已绑定课程包，持久化当前启用课程包后通知 TV 刷新课表。 |
| [REQ-20260624-course-action-thumbnail-cache](REQ-20260624-course-action-thumbnail-cache.md) | Course 动作视频服务端缩略图与本地缓存 | Ready for QA | `server`, `course-web` | 动作展示窗口先显示服务端派生 JPG，并持久化到 IndexedDB，点击后才播放视频，缓存上限 5GB。 |
| [REQ-20260624-explicit-three-screen-video-rows](REQ-20260624-explicit-three-screen-video-rows.md) | 三屏视频行布局显式删加 | Ready for QA | `server`, `course-web`, `tv-android` | 移除 `[2,2,2]` 自动扩成五行的旧逻辑，行数完全由编课者添加/删除决定。 |
| [REQ-20260626-tv-current-session-sync](REQ-20260626-tv-current-session-sync.md) | TV Current Session 同步收敛 | Ready for QA | `tv-android`, `server`, `coach-web` | MQTT 只作为通知，TV 同步完成后按 `/current` 最新状态应用预览/开始/结束，避免慢屏幕补执行过期指令。 |
| [REQ-20260702-tv-horizontal-formal-training-time](REQ-20260702-tv-horizontal-formal-training-time.md) | TV 横屏正式训练总时长调试显示 | Ready for QA | `tv-android` | 仅科技园测试场馆显示横屏 elapsed/total，口径改为正式训练总时长，对齐编课端 trainingSeconds。 |
| [REQ-20260702-course-web-tv-simulator](REQ-20260702-course-web-tv-simulator.md) | Course Web TV Simulator | Ready for QA | `websimulator`, `course-web` | 新增独立 Web simulator 子项目，Course 课程列表打开 `/simulator/?courseId=...`；页面先缓存课程视频，再启用本地 TV 四屏跑课。 |
| [REQ-20260625-course-week-schedule-light-api](REQ-20260625-course-week-schedule-light-api.md) | Course 课表轻量周查询 | Ready for QA | `server`, `course-web` | Course 首页 meta 不再携带 full course 和 schedules，课表按周拉取，编辑课程时才按 id 拉详情。 |
| [REQ-20260618-schedule-card-edit-course-entry](REQ-20260618-schedule-card-edit-course-entry.md) | 课表卡片快速编辑课程入口 | Ready for QA | `course-web` | 在课表 item 右下角增加“编辑课程”按钮，快速打开课程编辑 tab。 |
| [REQ-20260618-copy-specific-week-schedules](REQ-20260618-copy-specific-week-schedules.md) | 复制指定周排课 | Ready for QA | `server`, `course-web` | 升级“一键复制上周排课”，支持选择过去周或本周复制到本周剩余日期或未来目标周。 |
| [REQ-20260621-server-request-compat-store-refactor](REQ-20260621-server-request-compat-store-refactor.md) | Server Request 兼容层与 Store 命名重构 | Ready for QA | `server` | 删除 `src/legacy`，把兼容协议集中到 request 适配层，我JSON store 按 TV / 课程 / Admin / 排课 / 媒体包拆分。 |

## Done / Shipped

| ID | Title | Status | Apps | Release Notes |
| --- | --- | --- | --- | --- |
| [REQ-20260902-tv-visual-system-refresh](REQ-20260902-tv-visual-system-refresh.md) | TV 全界面视觉系统升级 | Shipped | `tv-android` | TV `1.0.73` 已上传为 package `90` 并推送至 3 个场馆共 12 台在线设备；全部心跳确认升级完成。 |
| [REQ-20260730-oss-access-log-retention](REQ-20260730-oss-access-log-retention.md) | OSS 访问日志与 30 天保留 | Shipped | `ops`, `oss` | 生产 Bucket 开启访问日志，写入 `oss-access-logs/`，并仅对该前缀应用 30 天自动清理。 |
| [REQ-20260621-course-schedule-i18n-today-button](REQ-20260621-course-schedule-i18n-today-button.md) | Course 课表俄语文案与今天跳转 | Shipped | `course-web` | 修复课表页俄语下仍显示中文按钮的问题，并新增“今天”按钮回到当前周与当天。 |
