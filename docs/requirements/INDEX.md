# Requirements Index

这个索引用来追踪已经整理过的产品需求。每个需求使用一个独立 Markdown 文件，文件名建议：

`REQ-YYYYMMDD-short-slug.md`

## Active / Draft

| ID | Title | Status | Apps | Owner Notes |
| --- | --- | --- | --- | --- |
| [REQ-20260619-coach-course-package-switch-settings](REQ-20260619-coach-course-package-switch-settings.md) | Coach 设置中切换场馆课程包 | Ready for QA | `coach-web`, `server`, `tv-android`, `mqtt-client` | 设置中显示场馆已绑定课程包，持久化当前启用课程包后通知 TV 刷新课表。 |
| [REQ-20260624-course-action-thumbnail-cache](REQ-20260624-course-action-thumbnail-cache.md) | Course 动作视频服务端缩略图与本地缓存 | Ready for QA | `server`, `course-web` | 动作展示窗口先显示服务端派生 JPG，并持久化到 IndexedDB，点击后才播放视频，缓存上限 5GB。 |
| [REQ-20260624-explicit-three-screen-video-rows](REQ-20260624-explicit-three-screen-video-rows.md) | 三屏视频行布局显式删加 | Ready for QA | `server`, `course-web`, `tv-android` | 移除 `[2,2,2]` 自动扩成五行的旧逻辑，行数完全由编课者添加/删除决定。 |
| [REQ-20260626-tv-current-session-sync](REQ-20260626-tv-current-session-sync.md) | TV Current Session 同步收敛 | Ready for QA | `tv-android`, `server`, `coach-web` | MQTT 只作为通知，TV 同步完成后按 `/current` 最新状态应用预览/开始/结束，避免慢屏幕补执行过期指令。 |
| [REQ-20260625-course-week-schedule-light-api](REQ-20260625-course-week-schedule-light-api.md) | Course 课表轻量周查询 | Ready for QA | `server`, `course-web` | Course 首页 meta 不再携带 full course 和 schedules，课表按周拉取，编辑课程时才按 id 拉详情。 |
| [REQ-20260618-schedule-card-edit-course-entry](REQ-20260618-schedule-card-edit-course-entry.md) | 课表卡片快速编辑课程入口 | Ready for QA | `course-web` | 在课表 item 右下角增加“编辑课程”按钮，快速打开课程编辑 tab。 |
| [REQ-20260618-copy-specific-week-schedules](REQ-20260618-copy-specific-week-schedules.md) | 复制指定周排课 | Ready for QA | `server`, `course-web` | 升级“一键复制上周排课”，支持选择过去周或本周复制到本周剩余日期或未来目标周。 |
| [REQ-20260621-server-request-compat-store-refactor](REQ-20260621-server-request-compat-store-refactor.md) | Server Request 兼容层与 Store 命名重构 | Ready for QA | `server` | 删除 `src/legacy`，把兼容协议集中到 request 适配层，JSON store 按 TV / 课程 / Admin / 排课 / 媒体包拆分。 |

## Done / Shipped

| ID | Title | Status | Apps | Release Notes |
| --- | --- | --- | --- | --- |
| [REQ-20260621-course-schedule-i18n-today-button](REQ-20260621-course-schedule-i18n-today-button.md) | Course 课表俄语文案与今天跳转 | Shipped | `course-web` | 修复课表页俄语下仍显示中文按钮的问题，并新增“今天”按钮回到当前周与当天。 |
