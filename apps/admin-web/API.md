# 课程编辑端（Admin Web）API 文档

本文件描述 `apps/admin-web` 使用到的服务端接口（由 `apps/server` 提供）。

## 基础约定

- Base URL（同域部署）：`/api/...`
- 认证：
  - `POST /api/app/login` 登录获取 token
  - `POST /api/app/refresh` 刷新 token（legacy basic auth）
  - 业务接口携带 `Authorization: Bearer <access_token>`
- 返回格式：
  - 部分接口使用 legacy envelope：`{ code, data, message, msg }`
  - 其余接口通常使用：`{ data: ... }` 或 `{ ok: true, data: ... }`

## 健康与启动数据

### GET `/api/health`

用于探活与查看服务状态（dbSafety、mediaStorage、tvControl 等）。

### GET `/api/meta` 或 `/api/editor/bootstrap`

用于 Admin Web 启动时加载：

- 动作列表、动作类型、课程列表、模板列表、排课列表等（以服务端 `getMetaPayload()` 为准）
- 多场馆排课：可选 `venueId` 参数，例如 `/api/meta?venueId=...`，用于只返回该场馆的排课列表。

## 认证相关

### POST `/api/app/login`

请求：

```json
{
  "username": "13689547720",
  "password": "REDACTED_CONFIGURE_LOCALLY",
  "client": "admin-web"
}
```

响应：Legacy envelope + token payload

### POST `/api/app/refresh`

Header:

- `Authorization: Basic REDACTED_CONFIGURE_LOCALLY`

请求：

```json
{
  "refresh_token": "<refresh_token>",
  "client": "admin-web"
}
```

### GET `/api/user/info`

Header:

- `Authorization: Bearer <access_token>`

响应：Legacy envelope + user profile

## 上传（视频/图片）

### POST `/api/upload/video`
### POST `/api/upload/image`

用途：

- 上传动作视频、封面、Logo 等资源。

说明：

- 存储模式可能为本地文件或 OSS（由 server `media-storage` 配置决定）
- 返回内容包含资源 URL、checksum、sizeBytes 等（以服务端实现为准）

## 动作库

### GET `/api/actions`

用途：动作列表（支持筛选参数以实现搜索/分类过滤，具体以服务端实现为准）

### POST `/api/actions`

用途：创建动作（名称、类型、视频 URL、版本号等）

### GET `/api/actions/:id`
### PUT `/api/actions/:id`
### DELETE `/api/actions/:id`

用途：动作详情、更新、删除

### GET `/api/action-types`
### POST `/api/action-types`

用途：动作分类（类型）列表与新增

### GET `/api/lesson-types`
### POST `/api/lesson-types`

用途：课程类型（若旧版存在此概念）

## 课程库

### GET `/api/courses`
### POST `/api/courses`
### GET `/api/courses/options`

用途：

- 课程列表/创建课程
- options 用于下拉选择（例如课程模板、可选动作等）

### GET `/api/courses/:id`
### PUT `/api/courses/:id`
### DELETE `/api/courses/:id`

用途：课程详情、更新、删除

## 模板

### GET `/api/templates`
### POST `/api/templates`
### GET `/api/templates/:id`
### PUT `/api/templates/:id`
### DELETE `/api/templates/:id`

用途：热身/冷身/正式训练模板增删改查

## 排课

### GET `/api/schedules`

用途：

- 获取排课（scope/时间范围等以服务端实现为准）
- 多场馆排课：可选 `venueId` 参数，例如 `/api/schedules?venueId=...&scope=CURRENTWEEK`

### POST `/api/schedules`

用途：创建/更新排课（多场馆时需要携带 `venueId` 字段）

### DELETE `/api/schedules/:id`

用途：删除排课

### POST `/api/schedules/copy-last-week`

用途：复制上周排课（多场馆时可通过 `venueId` 参数限定到某个场馆：`/api/schedules/copy-last-week?venueId=...`）

## 应用版本（TV 安装包）

### GET `/api/app-packages`

用途：

- 列出服务端可用的安装包版本（platform 可选：tv/coach）

### POST `/api/app-packages/scan`

用途：

- 重新扫描服务端安装包目录

### POST `/api/app-packages/upload?platform=tv&version=...&label=...&filename=...`

用途：

- 上传新的安装包到服务端指定目录，并登记 metadata（checksum/sizeBytes 等）

### GET/HEAD `/api/app-packages/files/:filename`

用途：

- 访问已上传的安装包文件（TV 下载更新包用）

## 场馆与账号管理（Super Admin）

> 仅超级管理员可访问。

### GET `/api/admin/venues`
### POST `/api/admin/venues`
### PATCH `/api/admin/venues/:venueId`
### DELETE `/api/admin/venues/:venueId`

用途：场馆管理

### GET `/api/admin/venues/:venueId/screens`

用途：查看某场馆下 TV 屏幕状态（服务端基于 `accountNamespace` 聚合）

### GET `/api/admin/users?q=...&role=venue&unbound=1`
### POST `/api/admin/users`
### PATCH `/api/admin/users/:userId`
### POST `/api/admin/users/:userId/unbind`

用途：账号管理（创建/搜索/更新/解绑场馆）

### POST `/api/admin/venues/:venueId/bind-user`

请求：

```json
{ "userId": 123 }
```

用途：将账号绑定到指定场馆（一个账号暂时只绑定一个场馆）
