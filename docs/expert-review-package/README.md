# Infini 项目专家评审包

整理日期：2026-07-23

本文件夹用于给资深技术/产品/投资/外包专家快速评估 Infini 项目的技术价值、功能边界、复杂度、工作量与交付范围。

## 文件目录

| 文件 | 内容 |
| --- | --- |
| [01-project-overview.md](01-project-overview.md) | 项目定位、业务目标、现有代码规模、核心结论 |
| [02-architecture-tech-stack.md](02-architecture-tech-stack.md) | 技术栈、系统架构、运行链路、交互方式 |
| [03-functional-modules.md](03-functional-modules.md) | 功能模块、需求点、核心能力与复杂度分级 |
| [04-complexity-workload-delivery.md](04-complexity-workload-delivery.md) | 难度、工作量、交付范围、买断/授权/维护边界 |
| [05-expert-review-checklist.md](05-expert-review-checklist.md) | 给专家评审时可逐项确认的问题清单 |
| [diagrams/](diagrams/) | Mermaid 架构图、时序图、ER 图、流程图、思维导图 |

## 快速结论

Infini 不是普通健身房后台或简单课程排课工具，而是一套围绕团课训练场景的“课程内容生产 + 教练控课 + 多屏 TV 播放 + 场馆设备运维”的现场交付平台。

当前项目已经包含：

- Node.js / NestJS / TypeScript 后端；
- React / Vite / TypeScript 多个 Web 端；
- Android TV 原生 Java 客户端；
- MQTT 实时控制链路；
- 视频媒体上传、缓存、checksum、TV bundle；
- 多场馆、多课程包、多账号角色；
- Coach 现场控课；
- 运维调试和 APK 分发能力。

从代码和需求规模看，若外包从 0 重做商用品质版本，不应按普通管理后台评估。结合当前 AI 辅助开发环境、已有系统由 1 人约 4 个月高强度开发完成的事实，建议专家分别评估：

- 从 0 重做同等功能的替代成本；
- 现有系统作为技术资产整体买断的合理折扣；
- 单店授权、多店授权、源码交付、完整 IP 买断的边界差异；
- 交接、部署、长期维护、新功能开发是否应单独计价。

本评审包不预设具体商业金额，请专家独立判断。

## 图表清单

| 图 | 文件 |
| --- | --- |
| 系统上下文图 | [diagrams/01-system-context.mmd](diagrams/01-system-context.mmd) |
| 核心业务 ER 图 | [diagrams/02-core-er.mmd](diagrams/02-core-er.mmd) |
| Coach 控课到 TV 播放时序图 | [diagrams/03-coach-tv-playback-sequence.mmd](diagrams/03-coach-tv-playback-sequence.mmd) |
| TV 绑定与设备管理时序图 | [diagrams/04-tv-binding-sequence.mmd](diagrams/04-tv-binding-sequence.mmd) |
| 课程生产到门店播放流程图 | [diagrams/05-course-production-flow.mmd](diagrams/05-course-production-flow.mmd) |
| 合作模式与交付边界决策图 | [diagrams/06-commercial-decision-flow.mmd](diagrams/06-commercial-decision-flow.mmd) |
| 项目能力思维导图 | [diagrams/07-capability-mindmap.mmd](diagrams/07-capability-mindmap.mmd) |
