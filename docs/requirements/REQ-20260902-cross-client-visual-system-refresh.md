# REQ-20260902-cross-client-visual-system-refresh: 全客户端视觉系统升级

## Status

- Status: Shipped
- Owner: Course Web / Coach Web / Admin Web / TV Android
- Created: 2026-09-02
- Updated: 2026-09-02
- Related docs: `REQ-20260902-tv-visual-system-refresh.md`
- Related code map sections: `apps/course-web`, `apps/coach-web`, `apps/admin-web`, `apps/tv-android`

## Requirement Summary

将 Course、Coach、Admin 和 TV 的全部可见页面统一为同一套 Infini 视觉系统。新版使用炭黑工作台、浅色高对比文字、金色信息强调、蓝色主操作与状态色；去除紫色渐变、装饰光斑、过大圆角和低效的卡片嵌套。Course 与 Admin 保持桌面运营工具的信息密度，Coach 保持手机现场控制的触控效率，TV 保持远距离观看和横竖屏稳定性。

本需求只改变视觉资源和展示布局，不修改业务流程、接口、权限、MQTT、播放 session、课程数据或数据库。

## Background

- 当前行为：TV 已完成新版视觉升级，但 Course、Coach 和 Admin 仍使用各自旧主题，跨端体验不一致。
- 问题：旧 Web 页面存在紫色渐变、过大圆角、装饰性背景和信息层级不统一；此前发布范围表达不清，导致用户误以为 Course 已完成改版。
- 业务原因：编课、现场控制、运营管理和 TV 展示属于同一产品，需要一致但适合各自工作场景的视觉语言。
- 已知约束：必须保留现有 DOM 行为、i18n、API、权限、TV View ID、响应式布局和全部业务状态。

## Goals

- Course、Coach、Admin 和 TV 的所有可达页面、弹窗、加载、空、错误状态使用统一视觉令牌。
- 普通卡片圆角不超过 8px/8dp；圆形状态、头像和图标按钮除外。
- Course/Admin 在桌面宽度下保持高信息密度；Coach 在手机宽度下保持至少 44px 的主要触控区域。
- 中文、英文、俄文长文本不重叠、不溢出关键操作区域。
- 每个端独立测试、构建、部署和回滚，发布结果可以明确追踪。

## Non-goals

- 不修改 Server API、数据库字段、数据归属或权限模型。
- 不修改课程脚本、排课、TV 播放时间线、MQTT 或 current session。
- 不以视觉改版为由重构业务组件或改变现有用户操作路径。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `REQ-20260902-tv-visual-system-refresh` | Extended | 保留已发布 TV 视觉方向，本需求将其扩展到全部客户端。 |
| `REQ-20260621-course-schedule-i18n-today-button` | Must remain compatible | Course 课表和三语言行为保持不变。 |
| `REQ-20260619-coach-course-package-switch-settings` | Must remain compatible | Coach 设置中的语言和课程包切换保持不变。 |
| `REQ-20260826-tv-diagnostic-log-upload` | Must remain compatible | 视觉改动不得影响 TV 错误采集和上传。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | Complete UI theme/layout refresh | 登录、壳层、课表、课程编辑、动作、模板、账号/场馆/版本及全部弹窗和状态。 |
| `apps/coach-web` | Complete mobile UI theme/layout refresh | 登录、控制台、屏幕、设置、语言/课程包、控制状态及错误提示。 |
| `apps/admin-web` | Complete UI theme/layout refresh | 登录、壳层、场馆、账号、课程包、设备/版本和全部管理状态。 |
| `apps/tv-android` | Visual coverage audit | 审计已发布改版，只补视觉遗漏；保留全部 View ID 和业务行为。 |
| `apps/server` | None | 无 API、数据或部署逻辑修改。 |
| `apps/mqtt-client` | None | 无协议和消息修改。 |
| `apps/ops-web` | None | 本轮不改变运维页面。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无。
- Backfill/default strategy: 不需要。
- Compatibility with old records: 完全兼容。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| All existing endpoints | 无 | 请求、响应、鉴权和错误语义均不变。 |
| MQTT / playback session | 无 | topic、payload、状态与时序均不变。 |

## Implementation Sketch

### Web

```pseudo
define shared visual direction per app:
  charcoal workspace
  high-contrast text
  gold informational emphasis
  blue command/status emphasis

for each reachable page and state:
  preserve handlers, requests, permissions and i18n
  replace old theme tokens and layout styling
  keep dense desktop layout for Course/Admin
  keep touch-first responsive layout for Coach
```

### TV

```pseudo
audit static XML and runtime-created views
preserve every view id and state transition
only patch visual surfaces that still use the old theme
```

## Risks

| Risk | Mitigation |
| --- | --- |
| Broad CSS selectors change hidden or modal states | Audit every route and overlay; run typecheck/build and browser screenshots at target widths. |
| Dark theme reduces form/table readability | Use explicit surface, border, text and focus tokens with accessible contrast. |
| Long Russian text changes control height | Allow wrapping where safe and constrain command controls without clipping. |
| Visual JSX edit accidentally changes business behavior | Keep event handlers, service calls and state branches unchanged; review diffs for behavior changes. |
| TV layout regression on physical displays | Preserve View IDs and dimensions; run Android tests/lint/build and only release a new APK if needed. |

## Manual E2E Acceptance

### Happy Flow

1. Course：登录，切换课程包，浏览周课表，打开课程/动作/模板编辑器并保存一次未改变内容的记录。
2. Coach：手机登录，打开设置并切换语言，查看屏幕状态，执行一次预览、开始和结束。
3. Admin：登录，浏览场馆、账号、课程包和版本管理，并打开各主要弹窗。
4. TV：验证扫码、课表、预览、训练、补水/换站、完成、设置和更新状态。

Expected:

- 四端视觉语言一致，信息层级符合各自使用场景。
- 所有原有命令、保存、筛选、切换和播放行为不变。
- 中文、英文、俄文以及加载/空/错误状态均无重叠和裁切。

### Bad Flow

1. 在窄屏手机打开 Coach，并使用最长俄文文案。
2. 在 Course/Admin 制造空列表、接口错误和长名称记录。
3. TV 断网或缺失媒体时进入对应占位状态。

Expected:

- 页面保持可操作，关键按钮、错误信息和恢复入口可见。
- 视觉改版不触发退出登录、不改变请求参数，也不产生数据写入差异。

## Deployment / Rollback

- Build order: Course、Coach、Admin 并行；TV 审计和构建独立进行。
- Deploy order: Course -> Admin -> Coach；TV APK 最后上传到版本服务器。
- Version bump: Web 使用新构建产物；TV `1.0.73` -> `1.0.74` (`versionCode 74`)。
- Rollback: 各 Web 恢复上一版静态目录；TV 恢复上一 APK。无 DB 回滚。

Production release completed on 2026-09-02:

- Course assets: `admin-C756o4mt.css`, `admin-YpRTbV0U.js`
- Admin assets: `admin-DJk4TOot.css`, `admin-CGSE4e_1.js`
- Coach assets: `coach-DLjv9DKI.css`, `coach-CENFYI0A.js`
- TV: `1.0.74`, package ID `91`, SHA-256 `21bab6db550c8db2c28d7945c4e1ada5da015d03344a5c1ae9b58a21a314c1c1`
- TV package is available on the production version server; no forced venue installation was sent as part of this release.

## Documentation Updates

- [x] Create this requirement.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) with final visual ownership paths.
- [x] Record automated and manual verification results in `docs/testing/cross-client-visual-system-refresh-20260902.md`.
- [x] Mark deployment status after production verification.
