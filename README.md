# Infini Workspace

这个公开仓库汇总 Infini 各端源码、共享模块、需求文档和经过脱敏的 Git 提交历史。所有源码直接放在本仓库，不再依赖旧 Git 服务的 submodule。

这是脱敏公开副本，不包含生产数据库、登录会话、备份或有效密码。部署前必须配置自己的凭据；请先阅读 [公开迁移说明](docs/PUBLIC_EXPORT.md)。

## Clone

```bash
git clone https://github.com/qq245168586/inFin.git
```

查看历史项目分支：

```bash
git branch -r --list 'origin/codex/history/*'
```

## Projects

| Path | Repository | Purpose |
| --- | --- | --- |
| `apps/server` | `server` | Node.js API、数据存储、播放 session、课程包/场馆/账号、MQTT 指令入口 |
| `apps/mqtt-client` | `mqtt-client` | 服务端 MQTT 网关，Web 端通过 HTTP 调用它发 MQTT |
| `apps/admin-web` | `admin-web` | 场馆管理端，管理场馆、账号、课程包、TV 设备和版本更新 |
| `apps/course-web` | `course-web` | 编课端，管理动作库、课程、课程模板、排课 |
| `apps/coach-web` | `coach-web` | 教练端 Web，查看课表、预览课程、开始/暂停/结束课程、刷新 TV |
| `apps/tv-android` | `tv-android` | Android TV 原生 Java 客户端 |
| `apps/download-web` | `download-web` | TV APK 下载页面 |
| `apps/ops-web` | `ops-web` | 运维调试页面，查看 MQTT/TV 运行日志 |
| `apps/websimulator` | 本仓库 | 浏览器课程模拟器 |
| `apps/coach-ios` | 本仓库 | SwiftUI Coach MVP，Workspace + Swift Package Manager |
| `packages/shared` | 本仓库 | 共享课程脚本与浏览器会话逻辑 |

## Code Map

更详细的系统边界、接口关系和运维入口见 [docs/CODEMAP.md](docs/CODEMAP.md)。

## Requirement Workflow

新需求先按 [docs/requirements/README.md](docs/requirements/README.md) 的流程整理成需求文档，再进入代码改动。模板见 [docs/requirements/_template.md](docs/requirements/_template.md)。

## Workspace Rules

- `main` 包含完整源码；`codex/history/<项目>/<原分支>` 保存脱敏后的项目分支，标签采用 `<项目>/<原标签>`。
- 脱敏重写影响 commit ID；提交作者、说明和历史拓扑保留。不要将未脱敏的旧分支合并或推送到本公开仓库。
- 通过 `pnpm run hooks:install` 安装提交测试钩子；根测试入口为 `bash tools/run-tests.sh`。
- 不要把 `node_modules`、构建产物、运行数据或本地备份提交到 workspace。
