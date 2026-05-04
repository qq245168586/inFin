# TV Android 需求说明

本文件描述 `apps/tv-android`（TV 端 Android App）的功能、播放流程、绑定机制与性能约束，用于后续拆分仓库与迭代。

## 目标与定位

- 运行在 TV 盒子/电视上，用于播放课程编辑端配置的课程脚本。
- 多屏协同：屏幕 1/3/5 竖屏动作播放；屏幕 2/4 横屏信息与进度显示（具体以场馆配置为准）。
- 通过 MQTT 与 Coach 指令同步：Preview/Start/Pause/Resume/Terminate。
- 通过 HTTP 拉取“当天课表/课程脚本/资源清单”，并在本地缓存媒体资源以节省流量、保证播放稳定。

## 核心状态机

1. 未绑定（二维码页面）
2. 已绑定待机（今日课表）
3. Preview（预览，展示第一个 Pod 的效果，不计时）
4. 准备热身（Get ready for warm up，倒计时）
5. 热身（瀑布流播放 + 计时）
6. 准备正式训练（Get ready for work out，倒计时）
7. 正式训练（Pod 流程：Work/Rest/Move station/Move zone/Hydrate）
8. 准备冷身（Ready for cool down，倒计时；课程可无冷身）
9. 冷身（瀑布流播放 + 计时）
10. 结束（Congratulation，15 秒后回到今日课表）

## 绑定与解绑

### 绑定（扫码）

- TV 未绑定时展示二维码，包含：
  - `deviceId`（设备唯一标识，持久不变）
  - `pairToken`（配对码，可用于防误扫；建议不设过期，以适配“TV 停留二维码页面很久”的场景）
- TV 在二维码页面周期上报“配对存在性”（MQTT `infini/tv/pairing`）并通过 HTTP 心跳上报状态。
- Coach 扫码后通过 Server 执行绑定：
  - Server 绑定 `deviceId -> venue/accountNamespace + screenNumber`
  - Server 发布 MQTT `assign_screen` 给 TV（topic `infini/tv/control/__unbound__`）
- TV 收到 `assign_screen` 后：
  - 切换订阅到 `infini/tv/control/<namespace>`
  - 保存屏幕号与命名空间
  - 进入“今日课表”

### 解绑

触发来源：

- Coach/管理端解绑：Server 发布 MQTT `unbind_screen`
- 场馆被删除：Server 发布 MQTT `venue_deleted`
- TV 端主动退回二维码（鼠标/遥控操作）

行为要求：

- TV 清空绑定信息并回到二维码页面
- TV 通过 MQTT `infini/tv/pairing` 发布 `tv_unbound` 事件，便于 Coach/管理端刷新 UI

## 播放与 UI 规则

### 今日课表

- 显示当天日期与“今日课表”标题
- 列表可滚动（竖屏/横屏分别对应不同布局稿）
- TV 不可触控：正式上线由 Coach MQTT 指令触发进入 Preview 与 Start

### 热身/冷身（瀑布流）

- 同步规则：三竖屏展示同一组动作列表
- 展示规则：每屏同时展示 3 个动作窗口
  - 当前动作高亮，其它动作灰度
  - 到下一个动作时滚动一格（最后一个动作不再滚动）
- 需要平滑滚动（使用 ScrollView + Video 组合实现）

### 正式训练（Pod）

Pod 分两类：

1. 单屏瀑布流 Pod（与热身/冷身同样的瀑布流视觉，但状态为 WORK/REST）
2. 三屏视频组 Pod（每屏显示不同动作，左侧显示序号栏；不显示动作名称/遮罩）

提示状态：

- WORK：显示 `WORK` + 小字 `SET 1`，并用实心/空心圆表示剩余组数
- REST：显示 `REST` + 组数提示（同样用圆点表示）
- MOVE STATION / MOVE ZONE / HYDRATE：
  - 允许出现“全屏提示 1/2 时间 + 回到训练页顶部仍显示当前状态”的混合策略
  - 横屏与竖屏均需适配对应设计稿

### 横屏信息屏（屏幕 2/4）

- 背景黑色，风格与竖屏一致
- 进度条只计算正式训练（热身不走进度；冷身时进度条保持走完）
- 进度条按 Move zone / Hydrate 分段，每个分段点用水滴标识（白色）
- 倒计时数字居中 + 圆环进度（参考设计稿）

## 资源同步与校验

- 启动后拉取当天课表与资源清单：
  - 已缓存且 checksum 未变化的资源不重复下载
  - 下载期间 TV 不进入课程（显示下载中与进度）
- 周期性校验：
  - 每 5 分钟调用 daily-checksum 判断是否变化；变化则重新同步
  - Coach 可通过 MQTT `refresh_checksum` 触发立即校验

## 声音

- 热身结束、正式组开始间隔：`1.mp3`
- 正式训练：每组结束或休息结束：`ding.mp3`
- 冷身：`2.mp3`
- 课程结束：`end.mp3`
- 结束页不重复播声音，15 秒后返回课表

## 性能与稳定性

- 盒子性能较弱：减少 UI 过度动画、避免频繁重排
- 视频播放优先使用本地缓存路径；必要时降级为直链播放
- 监听网络状态变化：断网时提示；恢复网络后自动重连 MQTT 并重试 HTTP 拉取

