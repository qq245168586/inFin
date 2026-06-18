# Requirement Workflow

这个目录是 Infini 的轻量 PRD / Confluence 工作区。以后每次提出一个新需求，先在这里沉淀需求，再进入代码修改。

## Goal

- 把聊天里的需求变成可以追踪、可以验收、可以回看的文档。
- 让每次改动前都先确认会影响哪些端：`server`、`course-web`、`coach-web`、`admin-web`、`tv-android`、`mqtt-client`、`ops-web`、`download-web`。
- 持续维护项目需求文档和 [代码地图](../CODEMAP.md)，避免后续需求忘记历史约束。
- 每个需求都给出核心改法、关键伪代码和手工 E2E 验收用例。

## Workflow

1. **Capture**
   - 把用户原始描述整理成需求标题、背景、目标和非目标。
   - 标记未确认问题，但优先基于现有代码和历史文档做合理假设。

2. **Context Discovery**
   - 查阅 [代码地图](../CODEMAP.md)。
   - 搜索相关历史需求文档、已有功能、接口和数据结构。
   - 如果发现现有需求文档过期，同步更新对应文档。

3. **Impact Map**
   - 列出涉及端和职责边界。
   - 写清楚数据流：前端输入、API、持久化字段、TV/Coach/Admin 读取方式。
   - 标出兼容旧数据、发布顺序、回滚风险。

4. **Implementation Sketch**
   - 用简短伪代码说明关键改法。
   - 不写完整代码，但要说明要改的文件/模块和核心判断。
   - 对数据库或生产数据改动必须写安全策略。

5. **Acceptance Cases**
   - 至少包含 happy flow 和 bad flow。
   - 用手工 E2E 的语言写，让现场或产品可以照着点。
   - 不追求覆盖所有单元测试，只覆盖最容易出错的业务路径。

6. **Implementation**
   - 用户确认后再进入代码改动，或者用户明确要求“直接改”时把文档作为第一步快速落地。
   - 改动后更新需求状态、相关文档和代码地图。

## Status

- `Draft`: 正在整理，需求还没确认。
- `Ready`: 可以开发。
- `In Progress`: 已开始开发。
- `Shipped`: 已发布。
- `Blocked`: 被外部条件阻塞。
- `Superseded`: 被后续需求替代。

## Required Output For New Requests

每次新需求至少输出这几个部分：

- 需求摘要
- 关联历史/现有需求
- 涉及端和改动范围
- 数据/接口影响
- 关键伪代码
- 风险和兼容策略
- 手工验收用例

使用模板：[_template.md](_template.md)。
