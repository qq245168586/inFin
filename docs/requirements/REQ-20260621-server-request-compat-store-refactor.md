# REQ-20260621-server-request-compat-store-refactor: Server Request 兼容层与 Store 命名重构

## Status

- Status: Ready for QA
- Owner: Codex
- Created: 2026-06-21
- Updated: 2026-06-21
- Related docs:
  - [Requirement Workflow](README.md)
  - [Code Map](../CODEMAP.md)
- Related code map sections:
  - `apps/server`
  - Runtime Domains

## Requirement Summary

Server 之前把大段旧逻辑放在 `src/legacy`，并且文件/类名继续使用 `legacy`，导致后续开发不知道哪些是旧协议兼容、哪些是当前业务数据层。现在需要把旧的 HTTP 兼容协议集中到 request 适配层，把 JSON 文件存储命名为明确的数据层模块，并移除 `legacy` 目录。完成后业务行为不变，但代码边界更清楚。

## Background

- 当前行为：server 使用一个大 request handler 接管现有 REST API，并通过 JSON 文件 store 提供动作、课程、模板、排课、TV bundle、播放 session 等数据能力。
- 问题：`legacy` 命名太泛，容易把请求兼容、数据存储、运行时入口混成一个概念。
- 业务原因：后续需求会继续改课程包隔离、排课、TV 控制和运维日志，需要稳定的模块边界。
- 已知约束：本次只做结构和命名重构，不改接口行为、不改 DB 内容、不迁移生产数据。

## Goals

- 删除 `apps/server/src/legacy` 目录。
- 将旧客户端/旧接口兼容逻辑集中到 `apps/server/src/interfaces/http/compat-request-handler.ts`。
- 将 JSON 文件数据层命名为 `apps/server/src/data/json-file-store.ts` 和 `StoreGateway`。
- 将运行时入口放到 `apps/server/src/runtime`。
- 更新架构测试，防止重新出现 `legacy` 目录或 `.txt` chunks。

## Non-goals

- 不拆分具体业务 domain service。
- 不改变 REST API 路径、请求体、响应体。
- 不改变课程、动作、模板、排课、TV bundle 的数据库结构。
- 不发布线上。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [CODEMAP](../CODEMAP.md) | Defines server ownership | 本次补充 server 内部结构边界。 |
| Test workflow | Quality guard | 架构测试与 server/root test hook 保证重构不回退。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/server` | architecture / request compatibility / data naming | 只改内部结构和 import，不改 API 行为。 |
| `apps/course-web` | none | 通过现有 API 继续工作。 |
| `apps/coach-web` | none | 通过现有 API 继续工作。 |
| `apps/admin-web` | none | 通过现有 API 继续工作。 |
| `apps/tv-android` | none | TV API、bundle、MQTT 行为不变。 |
| `apps/mqtt-client` | none | 不改网关协议。 |
| `apps/ops-web` | none | 日志 API 行为不变。 |
| `apps/download-web` | none | APK 列表 API 行为不变。 |

## Data And API Impact

### Data Model

- New fields: none
- Changed fields: none
- Backfill/default strategy: none
- Compatibility with old records: unchanged

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| Existing server REST endpoints | Internal handler moved to `interfaces/http/compat-request-handler.ts` | Response shape unchanged |

## Implementation Sketch

### Server

```pseudo
main:
  compatRequestHandler = createCompatRequestHandler()
  app.use(handle mqtt auth first, otherwise compatRequestHandler)

runtime/http-request-runtime:
  startCompatRequestServices()
  return handleCompatRequest

data/store-gateway:
  store = createJsonFileStore()
  expose call/raw/functionNames/isWriteOperation

data/json-file-store:
  keep current JSON DB behavior
  rename default storage and seed helpers
```

## Risks

| Risk | Mitigation |
| --- | --- |
| Import path mistakes after moving files | Run TypeScript build and unit tests. |
| Accidentally changing API behavior | No logic rewrite; only file moves/imports/names. |
| Future code recreates `legacy` folder | Architecture test asserts `src/legacy` does not exist. |
| Compatibility protocol spreads into data layer again | Document that compat belongs under `interfaces/http`. |

## Manual E2E Acceptance

### Happy Flow

1. Course 端登录并打开课程列表。
2. Coach 端打开课表并点击刷新 TV。
3. TV 拉取今日课表或课程 bundle。

Expected:

- 三端接口响应和重构前一致。
- server 无 500。

### Bad Flow

1. 使用错误 token 调用需要登录的接口。
2. 使用旧 basic auth 兼容接口登录。

Expected:

- 未登录仍返回原来的 403/提示。
- 旧兼容登录仍返回原来的成功响应。

## Deployment / Rollback

- Build order: `apps/server`
- Deploy order: server only when QA confirms
- Version bump: none
- Rollback: 回退 server commit 即可，无 DB 回滚

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [ ] Update related product docs if behavior changed.
