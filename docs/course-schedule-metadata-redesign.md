# 课程课表元数据与 TV 展示改造

## 背景

TV 课表页不再强调具体开课时间。课程端排课按日期安排课程，一天可显示 1-3 节课程。TV 在课前展示课程身份信息、课程简介和训练规则。

## 新增课程字段

字段放在 `CourseScript.metadata`，服务端序列化时同步到课程顶层，方便列表、课表和 TV 直接读取。

- `description`: 课程简介。旧课程默认空字符串。
- `topic`: 课程主题/主要目标。旧课程默认取课程类型第一个名称；没有课程类型时为空。
- `rotationType`: 换站/流转类型。

`rotationType` 枚举：

- `REGION`: 区域循环，旧课程默认值。
- `LANE`: 跑道换站。
- `SNAKE`: 蛇形换站。

## TV 课表字段来源

- 课程名：`course.name` / `course.script.metadata.name`
- 课程简介：`course.description` / `metadata.description`
- 课程主题：`course.topic` / `metadata.topic`
- 换站模式：`course.rotationType` / `metadata.rotationType`
- 站点信息：从课程正式训练的首个有效 Pod 绑定的视频组计算，优先统计有效站点卡片；区域循环可显示区域数量。
- WORK：从首个有效 Pod 的首个屏幕 setConfigs 中汇总，如 `90/45/30s`。
- REST：优先显示 set 间休息；没有 set 间休息时显示 `stationRestSeconds`。

TV 端字段长度不固定，卡片上的 WORK/REST/换站文本需要根据容器宽度做字体自适应。

## 排课规则

课程系统排课只选择日期，不再要求开始时间和课程时长。为兼容旧数据和现有 API：

- 服务端仍可保存 `beginTime`，但新排课统一写入当天 `00:00:00`。
- `duration` 兼容保留，默认 `0`。
- 旧排课继续按 `beginTime` 的日期归属展示。
- 复制上周排课时只平移日期，时间字段保持兼容。

## 兼容策略

- 不对现有 `db.json` 做破坏性迁移。
- 读取/保存/序列化时补齐默认值。
- 旧课程 `description` 为空。
- 旧课程 `topic` 由第一个课程类型名称推导。
- 旧课程 `rotationType` 为 `REGION`。

## 涉及模块

- `apps/server`: 课程字段 normalize/serialize，排课按天保存，TV daily bundle 输出新字段。
- `apps/course-web`: 课程编辑新增简介、主题、换站模式；首页课表改成按天列表；新增排课去掉时间/时长输入。
- `apps/tv-android`: 课表页使用三节课卡片样式，展示简介/主题/站点/WORK/REST/换站，去掉状态和时间。
