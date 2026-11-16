# Infini Coach iOS

原生 Swift / SwiftUI 学习版 MVP，iOS 17+，iPhone / iPad。接口复用 Coach Web，不包含 WebView。

## 运行
1. Xcode 打开 **InfiniCoach.xcworkspace**，等待 Swift Package Manager 解析依赖。
2. 选择 `InfiniCoach` scheme 和 iPhone 模拟器，Command-R。
3. 登录页点击「体验演示」，无需账号，不控制真实场馆。
4. 正式登录使用绑定场馆的 Coach 账号。TV 控制和切换课程包会影响生产，操作前有确认弹窗。

```sh
cd apps/coach-ios
xcodebuild -workspace InfiniCoach.xcworkspace -scheme InfiniCoach \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath .derivedData build
bash scripts/test.sh
```

环境集中于 `APIConfiguration`：`https://114.215.185.184/infini/api`。不关闭 ATS 或证书校验。SPM 下载慢时可为本次命令传本机代理的 `https_proxy` / `http_proxy`，不要改 Git 全局设置。依赖锁文件为 workspace 下的 `xcshareddata/swiftpm/Package.resolved`。

## 工程结构
```text
InfiniCoach.xcworkspace
  InfiniCoach.xcodeproj
    InfiniCoach/                   @main App 入口
    InfiniCoachTests/              XCTest，模型/网络/业务测试
    InfiniCoachUITests/            XCUITest，原生导航验收
  Packages/CoachKit/Package.swift  SPM 本地业务模块及第三方依赖
    Sources/CoachKit/
      Models/                     Codable、日期/URL/错误策略
      Networking/                 Alamofire、Keychain
      Services/                   真实接口与演示实现
      Features/                   SwiftUI View 与 @Observable Model
```

- [Alamofire 5.10.2](https://github.com/Alamofire/Alamofire)：SPM 拉取，统一 HTTP 超时/请求头/响应，不自动重试失败的业务 POST。
- [Kingfisher 8.3.2](https://github.com/onevcat/Kingfisher)：SPM 拉取，缩略图缓存 100 MB / 7 天；受保护图片先经统一 API 鉴权再交缓存，不给外部媒体域附带凭据。
- AVKit、Security、Observation、XCTest 是系统框架，无需第三方重复安装。

## 学习顺序
1. `InfiniCoachApp.swift`：`@main` 定义 App，`WindowGroup` 建立窗口。
2. `CoachRootView.swift`：`body` 根据状态描述界面。`@State` 持有状态，`@Environment` 向子页面传递同一个 Model。
3. `ScheduleListView.swift`：`List`、`NavigationLink(value:)` 与 `navigationDestination`；日期选择使用 `.sheet`，系统管理返回手势和模态关闭。
4. `CoachModel.swift`：`@Observable` 驱动 UI，`@MainActor` 管理主线程状态，`async/await` 不阻塞页面，请求代次防止旧日期覆盖新日期。
5. `CoachService.swift` / `DemoCoachService.swift`：`protocol` 定义能力，依赖注入切换真实和演示环境。View 不拼接口。
6. `APIClient.swift`：Alamofire、错误处理、共享 refresh Task；随机 Cookie 放 Keychain，公开 ID 仅用作并发身份校验。
7. `CourseModels.swift`：`struct` 是值类型，`Codable` 解 JSON，Optional 明确缺字段，`enum` 定义有限状态。
8. `ActionDetailView.swift`：点击后才创建 AVPlayer，返回停止；服务端生成缩略图，本地 Kingfisher 缓存。

## 导航与安全
- TabView：课表 / 设备 / 设置，每个 Tab 独立 NavigationStack。
- Push：课表 → 课程详情 → 动作详情；设备 → 详情；设置 → 课程包。
- Present：日期 `.sheet`；控制和退出 `.confirmationDialog`。没有自绘路由覆盖层。
- iOS 独立 Cookie，复用 coach-web 权限但不与浏览器共用凭据，不会踢掉 Web。
- 仅 401 ACCESS_EXPIRED 续期并重试一次；503/断网/权限403 不退出或自动重复提交。
- 全局控制锁至少 2 秒且直到请求完成；提交前重新读取 current session；不同课程冲突不自动终止另一节课。
- 前台 10 秒轮询 current session，不重复加载整个课表；场馆时区固定 Asia/Shanghai。
- 当前没有扫码配对、设备升级、清缓存、课程编辑或完整三语，这些未实现功能不展示假按钮。
- 演示数据不代表真实课程。真实动作视频来自 API 媒体字段，缺失时明确提示，不播放其他动作替代。
- 演示内的「动作视频样例」可手动播放一个现有线上视频；只有点击播放才产生媒体流量，其他演示操作完全本机执行。

## 测试
`bash scripts/test.sh` 使用模拟接口和演示数据执行 XCTest / XCUITest，不登录生产或发送控制。Xcode Test Navigator 可看结果与截图；`.xcresult` 在 `.derivedData/TestResults/`。

根仓库的提交测试钩子在 macOS 上也会执行此项目的单元测试；完整 UI 测试单独运行上述脚本。模拟器构建保留 Xcode 的本地签名，不要传 `CODE_SIGNING_ALLOWED=NO`，否则 Keychain 可能返回 -34018。

2026-11-11：最终本地签名构建在 iPhone 17 (iOS 26.4) 上 23/23 通过，包含 21 项单元测试（含真实 Keychain 读写）和 2 项 UI 测试；此前 iPhone SE (iOS 18.3.1) 小屏回归 22/22 通过。最终报告为 `.derivedData/TestResults/20261111-221619.xcresult`。Xcode 默认覆盖率未计入本地包业务文件，不将 App 入口的覆盖率当作业务覆盖率。真实账号联调和样例视频的实际播放仍需手工验收。

需求及手工验收：`docs/requirements/REQ-20261111-coach-ios-mvp.md`。
