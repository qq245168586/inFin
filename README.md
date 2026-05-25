# Infini Workspace

这个仓库是 Infini 项目的顶层 workspace，只负责记录项目文档、代码地图和各端仓库的 submodule 指针。

业务代码仍然分别维护在各自独立仓库里，workspace 不直接管理各端源码内容。

## Clone

```bash
git clone --recurse-submodules https://git.infintraining.work/13689547720/workspace.git
```

如果已经 clone 了 workspace：

```bash
git submodule update --init --recursive
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

## Code Map

更详细的系统边界、接口关系和运维入口见 [docs/CODEMAP.md](docs/CODEMAP.md)。

## Workspace Rules

- workspace 只提交 `.gitmodules`、文档和 submodule 指针。
- 各项目代码改动要在对应子仓库内提交。
- 更新 workspace 指针前，先确认对应子仓库已经 commit。
- 不要把 `node_modules`、构建产物、运行数据或本地备份提交到 workspace。
