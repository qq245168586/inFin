# REQ-20261111-coach-ios-mvp: SwiftUI Coach 学习版 MVP

## Status
- Status: Ready for QA (local simulator MVP complete; no production deployment)
- Created: 2026-11-11
- Related: REQ-20261111-browser-sessions; REQ-20260619-coach-course-package-switch-settings

## Requirement Summary
新增独立 iOS Coach，使用 Swift / SwiftUI，运行于本机 iPhone/iPad 模拟器。使用原生 TabView、NavigationStack push、sheet 和 confirmationDialog，动作详情为独立页面。提供可学习的分层代码、演示数据和原有 Coach API 接入。

## Scope And Boundaries
- 新增 `apps/coach-ios`；不修改网页端、Server、TV、MQTT 或数据库结构，不发布生产服务。
- 根 `tools/run-tests.sh` 在 macOS 提交测试流程增加 iOS 单元测试；不改变其他项目测试命令。
- MVP：登录/恢复/退出、按日期查课、课程详情和动作视频、预览/开始/暂停/继续/结束、课程计划投屏、设备只读状态、设置中的课程包切换。
- 演示模式不调用业务 API，不发送 TV 控制指令。真实登录和控制明确区分，所有控制及课程包切换先确认。
- 非目标：相机扫码绑定、设备更新/清缓存、课程编辑、App Store 发布、完整三语翻译。当前首版中文，可通过后续 String Catalog 扩展。
- `.xcworkspace` 包含原生 app 工程及本地 `CoachKit` Swift Package；Alamofire、Kingfisher 均由 SPM 拉取并锁版本，不手动复制第三方源码。

## API And Data
- 复用 `/api/browser-auth/coach-web/{login,refresh,logout}`：iOS 私有 Keychain 保存 Cookie，API 请求统一设置 client、Origin 和公开 session ID。不与浏览器共享 Cookie，不重新引入旧 Bearer 登录互踢问题。
- `/api/tv/daily-bundle` 按日期、Asia/Shanghai、账号 namespace 请求；不加载全量 meta。仅有明确场馆绑定的账号可进入真实控制，避免超级管理员无 scope 时读取全部场馆。
- `/api/tv/playback-sessions/current` 及 preview/start-from-schedule/:id/{start,pause,resume,terminate}、`/api/tv/course-plan/show` 沿用现有字段与 commandId。
- `/api/tv/screens`、`/api/coach/course-packages`、`/api/coach/active-course-package` 原样使用。
- 图片从现有缩略图端点加载，Kingfisher 限额磁盘缓存；视频仅点击播放才创建 AVPlayer，离开页面停止播放。绝不向外部媒体域携带 API 凭据。

## Implementation Sketch
```text
App -> CoachRootView -> TabView + per-tab NavigationStack
View -> @Observable CoachModel -> CoachService protocol
LiveCoachService -> APIClient(Alamofire) -> existing HTTPS API
DemoCoachService -> deterministic fixture + in-memory control state
APIClient -> Keychain credential; only ACCESS_EXPIRED refresh/retry once
ActionDetail -> play button -> AVPlayer / VideoPlayer
```

## Risks
- 真实控制影响场馆：演示入口、场馆名称、确认弹窗、全局 in-flight + 2 秒锁；测试不发送生产命令。
- 会话竞态：统一续期 Task、身份代次检查；503/网络错误不清登录，POST 不盲目重试。
- 日期/时差：课表日期与 scheduledStartAtMs 使用 Asia/Shanghai，不用模拟器当地时区推断。
- 旧数据缺字段：DTO 可选字段与解码测试；视频 URL 缺失显示不可播放，不偷偷请求其他资源。
- 异步旧数据覆盖：日期与身份 generation 检查；切课程包成功后清旧课表并重新加载。
- TLS：保持系统证书校验与 ATS，不放开任意 HTTP 或信任所有证书。

## Manual Acceptance
1. 演示登录，课表 push 课程详情，再 push 动作详情，返回手势正常，Tab 状态保留。
2. 日期选择 sheet 可取消；空日期显示空状态；设备页显示在线/离线；设置 push 课程包选择。
3. 真实场馆账号登录，加载该账号课表；启动重开恢复；网页版仍保持登录。
4. 点击真实 TV 控制先确认，取消不发请求；确认后按钮禁用至少 2 秒且请求完成前不可再发。
5. 503/断网显示可重试错误但不掉登录；明确 SESSION_EXPIRED 才回登录。
6. 动作列表不自动播放，点详情播放后可暂停，返回后不继续播放。

## Delivery
- 仅本地构建、测试和模拟器安装。单元测试验证 DTO、URL、日期、控制与错误策略；UI 测试使用演示模式覆盖原生导航。
- 学习导读与运行命令见 `apps/coach-ios/README.md`；工程可整体移除回滚，无线上迁移。

## Verification
- Workspace 构建通过；SPM 已实际拉取并锁定 Alamofire 5.10.2、Kingfisher 8.3.2。
- iPhone 17 / iOS 26.4：最终本地签名构建 21 项单元测试 + 2 项原生 UI 测试，23/23 通过。
- iPhone SE (3rd generation) / iOS 18.3.1：同一组 22/22 通过，覆盖小屏导航及滚动访问动作。
- 单元测试覆盖数字/字符串 ID、缺字段、视频 URL 兼容、北京时间、鉴权 header、ACCESS_EXPIRED 一次重试、503 不退出/不重发、Keychain 存储抽象、控制 payload、跨课程冲突和 2 秒锁。
- UI 测试覆盖演示登录、日期 sheet 取消、空日切回今天、课程/动作/设备详情 push 与返回、演示预览、课程包设置。
- Xcode 报告：最终签名构建 `apps/coach-ios/.derivedData/TestResults/20261111-221619.xcresult`，小屏回归 `20261111-215432.xcresult`，含页面截图。当前 xccov 默认汇总没有列出本地包业务源文件，不能把 App 入口的 100% 当成业务覆盖率。
- 正常启动检查发现禁用签名会导致 Keychain -34018；构建脚本保留 Xcode 本地签名，并增加独立 service 的真实 Keychain 存取/更新/清理测试。最终 App 已安装至当前 iPhone 17e，普通启动无该错误，不降级为明文凭据存储。
- 视频样例 Range 请求返回 206/video/mp4；AVPlayer 实际播放与正式账号操作留作手工验收。演示内仅主动点击该样例会读取线上媒体，其他演示操作不访问业务 API。
- 未登录生产账号、未发送真实控制、未修改 Server/Web/TV 或生产数据，未提交 Git 或发布生产。
