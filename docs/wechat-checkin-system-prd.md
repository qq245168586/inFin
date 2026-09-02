# INFINI 微信小程序签课系统 PRD

版本：v0.2  
日期：2026-06-25  
范围：微信小程序、前台签课屏、Server、Coach 端、运营配置  
Figma：<https://www.figma.com/design/buZoWU2gD0cTjsR25gtZww>

## 1. 背景

INFINI 现有系统已经覆盖课程编排、排课、Coach 控制 TV 开课、TV 多屏播放与课表展示。签课系统补齐会员到店前后的闭环：

- 会员在微信小程序查看课程并预约。
- 到现场后扫描前台大屏展示的小程序码签到。
- 签到后可查看同一节课已签到会员。
- 课后提交 RPE、平均心率、最高心率和备注。
- Coach 与运营人员查看预约、签到、未到和反馈数据。

本期不改变现有 Coach 开课和 TV 播放 session 逻辑。预约、签到、反馈作为新的会员运营链路，通过 `venueId`、`accountNamespace`、`scheduleId`、`courseId`、`coursePackageId` 与现有系统关联。

## 2. 微信前置准备

上线前建议先完成这些事项，避免开发完成后卡在审核或能力申请：

1. 注册微信小程序账号：在微信公众平台选择“小程序”账号类型，完成邮箱、主体和管理员信息。
2. 主体选择：建议使用企业或个体工商户主体。个人主体不适合签课业务，手机号、支付、认证和运营能力会受限。
3. 微信认证：企业主体按需完成微信认证；手机号快速验证组件当前面向非个人且已认证小程序开放，并存在按次调用费用。
4. 服务类目：按真实业务选择教育、运动健身、生活服务等相关类目，提前准备资质材料。
5. 小程序备案：正式发布前准备主体证照、负责人信息、服务器/域名备案资料。
6. 获取 AppID：在小程序后台“设置 - 开发设置”获取 `AppID`，并绑定开发者、体验成员。
7. 配置服务器域名：配置 request、upload、download、socket 合法域名；生产环境必须 HTTPS。
8. 登录能力：小程序端使用 `wx.login()` 获取临时 `code`，服务端换取 OpenID/UnionID 并建立自定义登录态。
9. 手机号绑定：使用 `button open-type="getPhoneNumber"` 获取动态令牌 `code`，服务端消费 code 换取手机号；手机号能力必须经过用户同意。
10. 小程序码：前台屏建议使用服务端生成的小程序码，`scene` 只放短效 token，不放可信业务参数。
11. 订阅消息：如做预约提醒、签到提醒、课后反馈提醒，需要提前申请订阅消息模板。
12. 审核材料：准备测试账号、功能页面说明、隐私协议、用户协议、资质材料和核心路径录屏。

官方依据：

- 小程序接入指南：<https://developers.weixin.qq.com/miniprogram/introduction/>
- 服务类目：<https://developers.weixin.qq.com/miniprogram/product/material.html>
- 小程序备案：<https://developers.weixin.qq.com/miniprogram/product/record/>
- 小程序登录：<https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html>
- 手机号快速验证组件：<https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html>
- 小程序码接口列表：<https://developers.weixin.qq.com/miniprogram/dev/server/API/qrcode-link/>
- 订阅消息：<https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html>

## 3. 产品目标

1. 建立“预约课程 - 现场签到 - 同课名单 - 课后反馈 - Coach 复盘”的闭环。
2. 通过前台签课屏让签到入口足够清晰，减少前台和 Coach 的人工沟通。
3. 保持多场馆、多课程包隔离，避免跨场馆数据串联。
4. 为后续会员训练记录、课程满意度、强度管理和社交同行功能打基础。

## 4. 角色

- 会员：微信登录、绑定手机号、预约课程、扫码签到、查看同课会员、提交课后反馈。
- Coach：查看预约名单、签到名单、未到名单、课后反馈；必要时手动补签或撤销签到。
- 场馆管理员：配置容量、预约窗口、签到窗口、二维码刷新策略、同课名单可见范围。
- 系统管理员：维护场馆、课程包、屏幕设备、账号权限和服务类目合规材料。
- 前台签课屏：展示当前课程、小程序码、签到统计和最近签到反馈，不负责身份判断。
- Server：唯一可信业务判断方，负责预约、签到、二维码 token、反馈和权限校验。

## 5. MVP 功能范围

### 5.1 微信小程序

核心页面：

- 授权登录/手机号绑定
- 今日课程
- 课程详情
- 预约确认
- 我的预约
- 扫码签到确认
- 签到成功与同课会员
- 签到异常态
- 课后反馈
- 我的训练记录

核心能力：

- 微信登录并绑定会员档案。
- 展示所属场馆可预约课程。
- 预约、取消预约。
- 扫前台屏小程序码签到。
- 签到后查看同一节课已签到会员。
- 课后填写 RPE、平均心率、最高心率和备注。

### 5.2 前台签课屏

核心状态：

- 签到未开放
- 签到中
- 签到成功反馈
- 签到关闭
- 网络异常

展示内容：

- 当前课程名称、时间、教室、Coach。
- 已签到人数、预约人数、距开课时间。
- 动态小程序码和刷新倒计时。
- 最近签到反馈。
- 网络状态和异常提示。

约束：

- 以 16:9 大屏为主。
- 远距离可读，课程名、签到人数和二维码必须足够大。
- 公共屏不展示完整会员名单和手机号。

### 5.3 Coach/运营端

核心能力：

- 今日场次列表。
- 预约、已签到、未到、反馈率指标。
- 查看预约名单、签到名单、未到名单。
- 手动补签、撤销签到。
- 配置签到窗口、二维码有效期、未预约处理策略、同课名单可见范围。

### 5.4 Server

核心能力：

- 微信身份与会员档案管理。
- 预约场次管理。
- 预约容量、取消窗口、重复预约校验。
- 动态二维码 token 生成、刷新、失效。
- 扫码签到校验。
- 课后反馈保存。
- Coach 统计接口。
- 前台签课屏二维码和统计接口。

## 6. Figma 设计稿内容

设计文件：<https://www.figma.com/design/buZoWU2gD0cTjsR25gtZww>

页面结构：

1. `00 产品地图与前置事项`
   - 微信上线前置事项
   - MVP 业务闭环
   - Server 可信边界说明
2. `01 前台扫码屏与小程序端`
   - 前台 16:9 签课屏
   - 未开放、已关闭、签到成功状态
   - 小程序 8 个核心页面：今日课程、课程详情、我的预约、扫码签到、签到成功、异常态、课后反馈、训练记录
3. `02 Coach运营与组件规范`
   - 今日签课运营台
   - 签课屏配置
   - 本地颜色、按钮、状态标签、课程卡、会员行、二维码区组件规范

## 7. 关键流程

### 7.1 预约流程

1. 会员打开小程序。
2. Server 根据会员所属场馆展示可预约场次。
3. 会员进入课程详情。
4. 会员点击预约。
5. Server 校验容量、预约窗口、重复预约、会员状态。
6. 预约成功后生成预约记录。
7. 会员在“我的预约”查看待签到课程。

### 7.2 现场扫码签到流程

1. 前台签课屏根据当前场馆和最近课程展示动态小程序码。
2. 会员使用微信扫码进入小程序签到页。
3. 小程序携带二维码 token 调用签到接口。
4. Server 校验 token、场馆、课程、预约和签到窗口。
5. 校验通过后创建签到记录，并更新预约状态。
6. 小程序显示签到成功与同课已签到会员。
7. 前台屏刷新签到人数，并短暂显示签到成功反馈。

### 7.3 课后反馈流程

1. 课程结束后，已签到会员进入课后反馈页。
2. 会员填写 RPE、平均心率、最高心率、备注。
3. Server 校验已签到身份并保存反馈。
4. Coach 端展示反馈概览和提交率。

## 8. 业务规则

### 8.1 预约

- 会员必须微信登录并绑定手机号后才能预约。
- 预约必须归属具体场馆，禁止跨场馆预约。
- 同一会员同一场次只能有一条有效预约。
- 课程满员后不可继续预约；候补作为二期能力。
- 课程取消后，有效预约变更为已取消。
- 新预约能力需要明确 `startAt` / `endAt`。如果现有排课只按日期，需要新增预约场次时间。

### 8.2 签到

- 二维码由 Server 生成，前台屏只展示。
- 二维码建议 30-120 秒自动刷新，默认 60 秒。
- 签到窗口建议默认为开课前 30 分钟至开课后 15 分钟，可配置。
- 重复扫码返回“已签到”，不重复创建签到记录。
- 未预约扫码首期提示“未预约，请联系前台或 Coach”。
- 是否允许现场补约由场馆配置，MVP 默认不自动补约。
- Coach 手动补签必须记录操作人、时间、原因和来源。

### 8.3 同课会员与隐私

- 默认只展示昵称、头像、签到状态，不展示手机号。
- 前台公共屏不展示完整会员名单，只展示统计和最近签到反馈。
- 会员隐藏自己、匿名展示等能力作为二期。
- 心率、RPE 属于敏感训练数据，只对本人、Coach 和授权运营角色可见。

### 8.4 课后反馈

- 只有已签到会员可提交课后反馈。
- RPE 范围 1-10。
- 平均心率、最高心率为可选手动输入。
- 每位会员每场课只保留一条反馈，可在开放窗口内修改。
- 反馈开放窗口建议为课程结束后 24 小时内。

## 9. 数据字段建议

### 9.1 Member

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

### 9.2 BookingSession

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

### 9.3 Booking

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

### 9.4 Attendance

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

### 9.5 CheckInQrToken

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

### 9.6 PostClassFeedback

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

## 10. 接口草案

### 小程序

- `POST /api/mini/auth/wechat-login`
- `POST /api/mini/auth/bind-phone`
- `GET /api/mini/courses?date=YYYY-MM-DD`
- `GET /api/mini/booking-sessions/:id`
- `POST /api/mini/bookings`
- `DELETE /api/mini/bookings/:id`
- `GET /api/mini/bookings/me`
- `POST /api/mini/check-in`
- `GET /api/mini/booking-sessions/:id/members`
- `POST /api/mini/feedback`
- `GET /api/mini/feedback/me`

### 前台签课屏

- `GET /api/tv/check-in/current?accountNamespace=...`
- `GET /api/tv/check-in/qr?bookingSessionId=...`
- `GET /api/tv/check-in/stats?bookingSessionId=...`

### Coach / 运营

- `GET /api/coach/booking-sessions?date=YYYY-MM-DD`
- `GET /api/coach/booking-sessions/:id/bookings`
- `POST /api/coach/bookings/:id/manual-check-in`
- `POST /api/coach/attendance/:id/reverse`
- `GET /api/coach/booking-sessions/:id/feedback-summary`
- `GET /api/admin/check-in-rules`
- `PUT /api/admin/check-in-rules`

## 11. MVP 验收标准

- 会员可登录并绑定手机号。
- 会员可查看今日课程和余位。
- 会员可预约、取消预约。
- 前台屏可展示当前课程、动态小程序码、刷新倒计时、签到统计。
- 小程序扫码后可完成签到。
- 二维码过期、未预约、签到未开放、签到已关闭都有独立提示。
- 签到成功后可查看同课已签到会员。
- Coach 可查看预约、已签到、未到名单。
- Coach 可手动补签并记录操作来源。
- 已签到会员可提交课后反馈。
- 多场馆数据以 `venueId` 和 `accountNamespace` 隔离。

## 12. 分期建议

### P0：打通闭环

- 微信登录、手机号绑定、课程列表、预约、我的预约、扫码签到。
- 前台签课屏动态二维码。
- Server 预约、签到、二维码 token。
- Coach 查看预约/签到名单。

### P1：课后反馈

- RPE、平均心率、最高心率、备注。
- Coach 反馈概览。
- 会员历史训练记录。

### P2：社交和运营

- 同课会员隐私设置。
- 候补机制。
- 预约提醒、签到提醒、课后反馈提醒。
- 会员训练趋势。

## 13. 风险

- 现有排课如果缺少具体时间，预约和签到窗口无法准确生效。
- 二维码有效期过长会产生截图代签风险。
- 多场馆必须继续由 Server 解析 `accountNamespace`，不能信任前端传值。
- 手机号能力有主体、认证和费用要求。
- 心率手动输入准确性有限。
- 课后反馈和心率属于敏感训练数据，需要控制可见范围。

## 14. 交付物

- PRD：`docs/wechat-checkin-system-prd.md`
- Figma：<https://www.figma.com/design/buZoWU2gD0cTjsR25gtZww>
- 思维导图：`docs/wechat-checkin-mindmap.mmd`
- 时序图：`docs/wechat-checkin-sequence.mmd`
