# INFINI 微信小程序签课系统 PRD

版本：v0.1
日期：2026-06-08
范围：微信小程序、Server、Coach 端、TV App 签到屏、后台配置

## 1. 背景

INFINI 现有系统已经覆盖课程编排、排课、Coach 控制 TV 开课、TV 多屏播放与课表展示。接下来需要补齐会员上课前后的闭环能力：

- 会员在微信小程序预约课程。
- 到现场后通过 TV 展示的小程序码扫码签到。
- 会员可看到同一节课有哪些人一起上课。
- 课后会员可输入 RPE、平均心率等主观和可穿戴设备读数。
- Coach 可看到预约、签到、未到和课后反馈概览。

本期不改变现有 Coach 开课和 TV 播放 session 逻辑。预约、签到、反馈作为新的会员运营链路，通过 `venueId`、`accountNamespace`、`scheduleId`、`courseId`、`coursePackageId` 与现有系统关联。

## 2. 产品目标

1. 建立从“预约课程”到“现场签到”再到“课后反馈”的会员闭环。
2. 通过 TV 新增签到二维码屏，让现场签到入口足够清晰，减少人工沟通。
3. 保持多场馆、多课程包隔离，避免不同场馆数据串联。
4. 为后续会员训练记录、课程满意度、强度管理和社交同行功能打基础。

## 3. 角色

- 会员：预约课程、扫码签到、查看同课会员、提交课后反馈。
- Coach：查看预约名单、签到名单、未到名单、课后 RPE 和心率。
- 场馆管理员：配置预约规则、容量、签到窗口、二维码刷新策略。
- 系统管理员：维护场馆、课程包、TV 设备、账号权限。
- TV 设备：展示签到二维码和签到状态，不负责会员身份判断。
- Server：唯一可信业务判断方，负责预约、签到、二维码、反馈校验。

## 4. 功能范围

### 4.1 微信小程序

核心页面：

- 今日课程
- 课程列表
- 课程详情
- 预约确认
- 我的预约
- 扫码签到
- 签到结果
- 同课会员
- 课后反馈
- 我的训练记录

核心能力：

- 微信登录与手机号绑定。
- 查看所属场馆可预约课程。
- 预约、取消预约。
- 扫 TV 小程序码签到。
- 查看同一节课的已预约/已签到会员。
- 课后填写 RPE、平均心率、最高心率、备注。

### 4.2 TV App

新增“签课屏幕”类型，用于显示微信小程序签到码。

核心状态：

- 签到未开放
- 签到中
- 签到成功反馈
- 签到关闭
- 网络异常

TV 只展示二维码、课程信息和签到统计，不保存会员隐私数据。

### 4.3 Server

核心能力：

- 微信身份与会员档案管理。
- 预约场次管理。
- 预约容量和取消规则校验。
- 动态二维码 token 生成、刷新和失效。
- 扫码签到校验。
- 课后反馈保存。
- Coach 端统计接口。
- TV 签到二维码接口。

### 4.4 Coach 端

核心能力：

- 查看今日课程预约人数、已签到人数、未到人数。
- 查看预约名单与签到名单。
- 手动补签、取消签到。
- 查看单节课 RPE、心率、反馈提交率。

### 4.5 Admin / Course 端

Course 端继续维护课程和排课。Admin 端建议新增：

- 预约规则配置。
- 签到规则配置。
- 课程容量配置。
- TV 签到屏绑定与显示配置。

## 5. 关键用户流程

### 5.1 预约流程

1. 会员打开小程序。
2. 系统根据会员所属场馆展示可预约课程。
3. 会员进入课程详情。
4. 会员点击预约。
5. Server 校验容量、预约开放时间、重复预约、会员状态。
6. 预约成功后生成预约记录。
7. 会员可在“我的预约”查看待签到课程。

### 5.2 现场扫码签到流程

1. TV 签课屏根据当前场馆和最近课程展示动态小程序码。
2. 会员使用微信小程序扫码。
3. 小程序携带二维码 token 进入签到页。
4. Server 校验 token、场馆、课程、预约、签到窗口。
5. 校验通过后创建签到记录。
6. 小程序显示签到成功。
7. TV 局部展示“签到成功”反馈并刷新签到人数。

### 5.3 课后反馈流程

1. 课程结束后，已签到会员进入课后反馈页。
2. 会员填写 RPE、平均心率、最高心率、备注。
3. Server 保存反馈。
4. Coach 端展示本节课反馈概览。

## 6. 业务规则

### 6.1 预约

- 会员必须微信登录并绑定手机号后才能预约。
- 预约必须归属具体场馆，禁止跨场馆预约。
- 同一会员同一场次只能有一条有效预约。
- 课程已满后不可继续预约，候补作为二期能力。
- 课程取消后，有效预约变更为已取消。
- 新预约能力需要明确 `startAt` / `endAt`。如果现有排课只按日期，需要新增预约场次时间。

### 6.2 签到

- 二维码由 Server 生成，TV 只展示。
- 二维码短有效期，建议 30-120 秒自动刷新。
- 签到窗口建议默认为开课前 30 分钟至开课后 15 分钟，可配置。
- 重复扫码返回“已签到”，不重复创建签到记录。
- 未预约扫码首期提示“未预约，请联系教练”，是否允许现场补约由场馆配置。
- Coach 手动补签必须记录操作人、时间和来源。

### 6.3 同课会员

- 默认只展示昵称、头像、签到状态，不展示手机号。
- 会员可选择隐藏自己，隐私配置作为二期。
- TV 公共屏不展示完整会员名单，只展示统计和最近签到反馈。

### 6.4 课后反馈

- 只有已签到会员可提交课后反馈。
- RPE 范围 1-10。
- 平均心率、最高心率为可选手动输入。
- 每位会员每场课只保留一条反馈，可在开放时间内修改。
- 反馈开放窗口建议为课程结束后 24 小时内。

## 7. 数据字段建议

### 7.1 Member

- `id`
- `wechatOpenId`
- `unionId`
- `phone`
- `nickname`
- `avatarUrl`
- `venueId`
- `accountNamespace`
- `status`
- `createdAt`
- `updatedAt`
- `lastLoginAt`

### 7.2 BookingSession

- `id`
- `venueId`
- `accountNamespace`
- `scheduleId`
- `courseId`
- `coursePackageId`
- `courseName`
- `coachUserId`
- `classDate`
- `startAt`
- `endAt`
- `capacity`
- `bookedCount`
- `checkedInCount`
- `status`
- `bookingOpenAt`
- `bookingCloseAt`
- `cancelCloseAt`
- `checkInOpenAt`
- `checkInCloseAt`

### 7.3 Booking

- `id`
- `bookingSessionId`
- `memberId`
- `venueId`
- `scheduleId`
- `courseId`
- `status`: `booked` / `cancelled` / `checked_in` / `no_show`
- `source`: `wechat_mini_program` / `coach_manual` / `admin`
- `bookedAt`
- `cancelledAt`
- `checkedInAt`

### 7.4 Attendance

- `id`
- `bookingId`
- `bookingSessionId`
- `memberId`
- `venueId`
- `scheduleId`
- `courseId`
- `checkInAt`
- `checkInMethod`
- `qrTokenId`
- `deviceId`
- `screenNumber`
- `status`

### 7.5 CheckInQrToken

- `id`
- `token`
- `venueId`
- `accountNamespace`
- `bookingSessionId`
- `scheduleId`
- `courseId`
- `deviceId`
- `screenNumber`
- `scene`
- `expiresAt`
- `createdAt`
- `usedCount`
- `status`

### 7.6 PostClassFeedback

- `id`
- `bookingId`
- `bookingSessionId`
- `memberId`
- `venueId`
- `courseId`
- `scheduleId`
- `rpe`
- `heartRateAvg`
- `heartRateMax`
- `heartRateSource`
- `calories`
- `comment`
- `submittedAt`
- `updatedAt`

## 8. 接口草案

### 小程序

- `GET /api/mini/courses?date=YYYY-MM-DD`
- `GET /api/mini/booking-sessions/:id`
- `POST /api/mini/bookings`
- `DELETE /api/mini/bookings/:id`
- `GET /api/mini/bookings/me`
- `POST /api/mini/check-in`
- `GET /api/mini/booking-sessions/:id/members`
- `POST /api/mini/feedback`
- `GET /api/mini/feedback/me`

### TV

- `GET /api/tv/check-in/current?accountNamespace=...`
- `GET /api/tv/check-in/qr?bookingSessionId=...`
- `GET /api/tv/check-in/stats?bookingSessionId=...`

### Coach

- `GET /api/coach/booking-sessions?date=YYYY-MM-DD`
- `GET /api/coach/booking-sessions/:id/bookings`
- `POST /api/coach/bookings/:id/manual-check-in`
- `POST /api/coach/attendance/:id/reverse`
- `GET /api/coach/booking-sessions/:id/feedback-summary`

## 9. 页面设计要求

### 9.1 小程序

- 首页直接展示课程，不做营销型首页。
- 课程卡片优先展示课程名、时间、教练、名额、预约状态。
- 详情页底部固定主操作按钮。
- 签到成功要明确展示课程、签到时间和场馆。
- 异常态必须清楚：二维码过期、未预约、签到未开放、签到已关闭。

### 9.2 TV 签课屏

- 画布以 16:9 为主，兼容竖屏待机屏。
- 深色背景，二维码区域高对比白底。
- 左侧展示课程和签到统计，右侧展示大二维码。
- 远距离可读，课程名和签到状态字体要大。
- 二维码刷新时不能让会员扫到旧码。

## 10. 分期建议

### P0：打通闭环

- 小程序登录、课程列表、预约、我的预约、扫码签到。
- TV 签到二维码屏。
- Server 预约、签到、二维码 token。
- Coach 查看预约/签到名单。

### P1：课后反馈

- RPE、平均心率、最高心率。
- Coach 反馈概览。
- 会员历史训练记录。

### P2：社交和运营

- 同课会员展示。
- 候补机制。
- 预约提醒和签到提醒。
- 会员训练趋势。

## 11. 风险

- 现有排课如果缺少具体时间，预约和签到窗口无法准确生效。
- TV 二维码有效期过长会产生截图代签风险。
- 多场馆必须继续用 Server 解析 `accountNamespace`，不能信任前端传值。
- 心率手动输入准确性有限。
- 课后反馈属于健康相关数据，需要控制可见范围。

## 12. 交付物

- PRD：`docs/wechat-checkin-system-prd.md`
- 思维导图：`docs/wechat-checkin-mindmap.mmd`
- 时序图：`docs/wechat-checkin-sequence.mmd`
- PDF：`docs/wechat-checkin-system-prd.pdf`
- Figma：INFINI 微信小程序签课系统 PRD 设计稿
