# Coach Web 需求说明

本文件描述 `apps/coach-web`（教练端 Web）应实现的主要功能与交互，用于后续拆分仓库与迭代。

## 目标与定位

- 面向现场教练/运营人员，在手机或平板浏览器中控制同一场馆的 TV 端播放。
- 通过 **服务端转发 MQTT 指令** 控制 TV（网页本身不直连 MQTT）。
- 提供 **扫码绑定屏幕**、查看屏幕在线状态、下发更新包、清缓存等运维能力。

## 角色与权限

- 场馆账号（`role=venue`，`allowedClients` 包含 `coach-web`）：
  - 可查看当日课表、对 TV 下发预览/开始/暂停/继续/终止等控制指令
  - 可进入屏幕管理（绑定/解绑、升级、清缓存）
- 超级管理员（Super Admin）：
  - 可执行上述所有操作（通常用于调试）

## 关键页面与交互

### 1. 登录

- 默认预填账号密码（当前内置两个测试账号：`13689547720/REDACTED_CONFIGURE_LOCALLY`、`zhiyou/REDACTED_CONFIGURE_LOCALLY`）。
- 登录后保存会话（`access_token` + `refresh_token`）到 `localStorage`，并支持刷新 token 自动恢复登录。

### 2. 课程控制（当日课表）

- 拉取当日课表并展示为可滚动列表。
- 点击课程进入 **Preview**：
  - 对 TV 下发 `preview_course` 指令（携带 `scheduleId/courseId/scheduledStartAtMs/playbackSessionId/bundleChecksum`）。
  - TV 进入预览界面但不计时（等待后续开始指令）。
- 再次开始课程：
  - 对 TV 下发 `start_course` 指令（包含 `playbackStartAtMs`），TV 以该开始时间作为统一时间基准同步进度。
- 课程开始后支持：
  - `pause_course`（倒计时暂停，状态冻结）
  - `resume_course`
  - `terminate_course`（TV 返回课表）
- 切换课程时的约束：
  - 若当前课程已开始，切换到其它课程应弹窗确认“会终止当前课程”。

### 3. 屏幕管理（绑定/运维）

#### 3.1 扫码绑定

- TV 未绑定状态显示二维码（包含 `deviceId`、`pairToken` 等信息）。
- Coach Web 调起相机扫码（移动端 Safari/Chrome）读取二维码后：
  - 选择要绑定的屏幕编号（1-5）
  - 点击“绑定到屏幕”调用服务端接口完成绑定，并由服务端发布 MQTT `assign_screen` 指令给 TV。

#### 3.2 在线状态与设备信息

- 展示各屏幕的在线状态（由 TV 定时心跳上报到服务端）。
- 展示最小必要信息：
  - `deviceId`
  - 在线/离线
  - 是否已绑定（以及已绑定的屏幕号）

#### 3.3 解绑、清缓存、更新

- 解绑：调用服务端接口并发布 MQTT `unbind_screen`，TV 回到二维码页面，同时应触发 TV 上报解绑事件（用于 UI 同步）。
- 清缓存：下发 MQTT `clear_cache`，TV 删除本地缓存资源。
- 更新：选择目标 TV 安装包版本，对目标设备下发 MQTT `install_app_update`。

## 可靠性与约束

- TV 不可触控：课程流程以 MQTT 指令为主（Preview/Start/Pause/Resume/Terminate）。
- 时间同步：`playbackStartAtMs` 作为全屏统一基准；TV 按“当前时间 - playbackStartAtMs”计算播放进度。
- 网络抖动：TV 需具备 MQTT 自动重连与 HTTP 重试；Coach Web 对失败给出明确提示。

