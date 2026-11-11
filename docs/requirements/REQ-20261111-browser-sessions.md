# REQ-20261111-browser-sessions: 分端浏览器会话与可靠续期

## Status
- Status: Ready for QA (implemented locally, not deployed)
- Created: 2026-11-11
- Related: REQ-20261108-simulator-diagnostics; docs/CODEMAP.md

## Requirement Summary
管理、课程、教练、运维端使用独立 Cookie 和 Session。同端多个标签页共享会话，登录、续期不得踢掉其他端或其他浏览器。模拟器复用课程端身份。暂时性网络故障保留登录态，只有明确失效才要求重新登录。

## Background
线上 11 月 6 日管理端登录后课程请求及 refresh 返回 403，课程重新登录后管理接口返回 403。旧实现将所有非 coach client 归一化为 editor-web，每次登录/续期删除该账号同 client 的全部会话。页面恢复/续期还将网络失败视作过期。

## Impacted Apps
| App | Boundary |
| --- | --- |
| server | 新 browser-session store、HTTP Cookie/CSRF 适配；保留旧 Bearer 接口 |
| course-web / admin-web / coach-web / ops-web | 统一浏览器请求与恢复/退出/同步；不改业务操作 |
| websimulator | 共享 course Cookie，请求与诊断上传接入统一封装 |
| packages/shared | 无框架依赖的浏览器会话/请求工具 |
| TV / MQTT | 不修改协议、播放器、控制指令或安装包 |

## Data And API Impact
- 仅 authSessions 增加 kind=browser、browserClient、browserId、browserTokenHash；不回填历史业务数据，不迁移课程/动作/场馆。
- 凭据为服务端生成的随机 opaque token；Cookie HttpOnly、Secure（仅本地 HTTP 开发例外）、SameSite=Strict、host-only、Path=/，每端名称独立；DB 只保存 Cookie token SHA-256。
- 12 小时访问租约，15 天绝对会话上限；续期延长当前会话租约，不轮换 Cookie、不创建会话、不影响其他会话。无每标签页 12 小时空闲退出，避免后台标签页清掉活跃标签页会话。
- POST /api/browser-auth/{client}/login, refresh, logout。登录成功写 Cookie；refresh 不写 Cookie，防止退出后迟到续期响应恢复旧 Cookie。
- logout 在服务端撤销匹配会话，不发送可能迟到的 Cookie 删除响应，避免旧退出请求覆盖新登录 Cookie；残留 Cookie 已无效，后续登录覆盖它。
- 普通请求 X-Infini-Client 明确选择 Cookie；X-Infini-Session 非秘密身份标记阻止重试时跨账号执行。鉴权在业务处理前完成。
- Cookie 请求验证同源 Origin/Referer，拒绝跨站和无可信来源的 Cookie 调用；不启用凭据跨域 CORS。Ops SSE 仅该 GET 路径允许 browserClient 查询参数选择身份，不在 URL 携带令牌。
- localStorage 仅缓存展示身份和非秘密会话标记，不保存新登录的访问/刷新凭据。
- 新公开状态键为 `infini-{client}-session-v2`，与旧 auth 键隔离；旧版标签页清理旧 Token 不会清掉新版登录。启动恢复时删除该端旧 Token 缓存。
- 旧 Bearer 客户端继续工作，旧登录/续期不再删除新 browser 会话。新 Web 首次升级需重新登录一次，不通过旧权限身份推断新端权限。

## Implementation Sketch
```pseudo
request:
  choose explicit client cookie; verify same origin and server-side permissions
  reject expired/revoked session before any business side effects
  reject mismatched browser session identity before replay
refresh:
  validate same cookie session; extend lease within absolute deadline
  do not rotate credential or affect another session
web request:
  only on ACCESS_EXPIRED -> coalesce refresh -> retry original once
  network / 5xx / permission denied -> preserve state, no automatic write retry
  SESSION_EXPIRED -> clear only unchanged local session
  storage event -> synchronize same-client tabs
```

## Risks And Compatibility
- Cookie CSRF: explicit client header plus strict same-origin checks; client name does not confer roles.
- Concurrent refresh: stable cookie, idempotent lease extension; no token rotation race even without browser Web Locks.
- Logout/login races: local revision guards and public session identity; stale responses cannot clear/restore newer UI state or replay writes under another account.
- API build must precede all web builds. Never fall back to old token auth on temporary failures.
- Revert Web/API together if necessary; browser sessions remain additive inert records, no data rollback required. No production modification in this task.

## Manual E2E Acceptance
1. 同账号同时登录 admin/course/coach/ops，分别操作、刷新、退出一个端，其他端不掉线。
2. 打开两张课程编辑页和模拟器，续期后均正常；刷新一个页面不影响另一页面。
3. 同端两个浏览器独立登录，退出其中一个不影响另一个。
4. 访问租约过期后同时发多个请求，续期成功且请求最多重试一次。
5. 续期返回 503、断网、上传中断时保留登录和编辑内容；恢复网络后重试可用。
6. 无管理权限账号登录 admin/ops 被拒绝；跨站 Cookie 写请求拒绝；不清其他端会话。
7. 退出过程中延迟刷新响应返回，不得恢复旧登录；切换账号期间旧保存不得在新账号下执行。
8. 绝对 15 天到期或删除账号后需重新登录，其他独立端按各自会话判定。

## Verification
- Server full regression: 105/105; course-web: 33/33; coach-web: 25/25.
- Session-specific regression: 29/29 (included in server total); covers store, HTTP boundary, shared browser request module.
- Scoped coverage: lines/statements 95.39%, branches 87.62%, functions 100%. Scope is the three new session modules, not whole-project coverage and not UI components.
- HTML report: `outputs/test-results/browser-sessions-20261111/coverage/index.html`; command from server: `pnpm exec vitest run --config vitest.browser-sessions.config.mjs --coverage`.
- Real Chrome smoke: 11 checks passed. Actual course/admin/coach/ops UI login, two course tabs, HttpOnly visibility, independent renewals, 503 recovery, cross-tab logout, simulator content API, Ops SSE without URL token.
- Browser report/screenshots: `outputs/test-results/browser-sessions-20261111/`; local-only runner: `apps/server/tests/browser-session-smoke.ts` (`PLAYWRIGHT_MODULE` points at installed Playwright; defaults to installed Chrome channel).
- Server build plus all five Web builds/typechecks passed. All tests use isolated fixtures; no production DB writes, restart, publish, commit or push in this task.
