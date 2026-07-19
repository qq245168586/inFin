# REQ-20260719-switch-pod-ab-round-rotation: SWITCH Pod AB 轮转与换站

## Status

- Status: Ready for QA
- Owner: Product / Course / TV
- Created: 2026-07-19
- Updated: 2026-07-19
- Related docs: [Pod 独立补水与换区时长](REQ-20260719-pod-ending-duration.md)
- Related code map sections: `apps/course-web`, `apps/tv-android`

## Requirement Summary

SWITCH Pod 中的视频按相邻两个动作组成 AB 对，例如四个动作形成 AB1、AB2。屏幕规则的循环次数表示需要完成的 AB 轮次数，而不是把全部 AB 对重复多轮。每完成一轮 AB 且 Pod 仍有下一轮时，TV 必须显示 `MOVE STATION` 并轮转到下一 AB 对；Pod 最后一轮完成后进入 Pod 自身的补水、换区或结束流程。

## Background

- 当前行为：Course 摘要按 AB 轮次展示，但 Course 计时和 TV 时间线把 `AB 对数量 × 循环次数` 当成总轮数。
- 问题：四个动作、两个 AB 对时会出现 AB1、AB2、AB1、AB2 的整组重复，且轮次之间仍显示 SWITCH，无法明确提示会员换到下一站。
- 业务原因：A/B 是同一站内的两个动作；完成一轮 A/B 后必须换站，再进入下一个 AB 对。
- 已知约束：奇数个动作只使用完整 AB 对，最后一个无法配对的动作不参与 SWITCH 时间线。

## Goals

- `loopCount` 统一表示 AB 轮次数。
- 第 `r` 轮使用 `pairIndex = r % pairCount` 对应的 AB 对。
- A 到 B 的过渡显示 `SWITCH`。
- 同一 AB 内多组之间的 `restSeconds` 显示 `REST`。
- 一轮 AB 完成且仍有下一轮时显示 `MOVE STATION`，时长使用 `stationRestSeconds`。
- Course 总时长、TV 播放时间线、横屏进度和正式组时长保持一致。

## Non-goals

- 不新增或迁移数据库字段。
- 不修改 Server API、课程脚本结构或 MQTT 协议。
- 不改变 NORMAL Pod、瀑布流、Pod ending 的现有行为。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| [REQ-20260719-pod-ending-duration](REQ-20260719-pod-ending-duration.md) | 延续 | SWITCH 最后一轮完成后仍按 Pod 自己的 ending/endingSeconds 执行。 |
| [REQ-20260702-tv-horizontal-formal-training-time](REQ-20260702-tv-horizontal-formal-training-time.md) | 影响 | 横屏正式训练时长必须使用相同 AB 轮次口径。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `apps/course-web` | Course timing / editor summary | 修正 SWITCH 总时长与说明文案。 |
| `apps/tv-android` | Playback timeline / progress | 修正竖屏状态、横屏进度、正式训练时长及离线时间线。 |

## Data And API Impact

### Data Model

- New fields: 无。
- Changed fields: 无；仅统一 `PodScreen.loopCount` 在 SWITCH Pod 中的业务解释。
- Backfill/default strategy: 无需回填。
- Compatibility with old records: 历史课程直接按 AB 轮次新语义运行，不修改原始课程数据。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| 无 | 无 | 完全兼容现有课程脚本。 |

## Implementation Sketch

### Course

```pseudo
pairCount = floor(videoCards.length / 2)
roundCount = loopCount
perRound = sum(workA + switch + workB + betweenSetRest)
total = perRound * roundCount + moveStation * (roundCount - 1)
```

### TV

```pseudo
for roundIndex in 0..<roundCount:
  pairIndex = roundIndex % pairCount
  play A
  show SWITCH
  play B
  if next set: show REST
  if next round: show MOVE STATION
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 历史 SWITCH 课程实际依赖旧的乘法语义 | 编辑端摘要原本已经按 AB 轮次表达；增加单元测试并用“测试switch”课程手工核验。 |
| Course 与 TV 时长再次不一致 | 两端分别增加四动作/两 AB 对测试，覆盖总时长、工作段数量和过渡类型。 |
| 最后一轮多显示一次换站 | 仅 `roundIndex < roundCount - 1` 时添加 MOVE STATION。 |

## Manual E2E Acceptance

### Happy Flow

1. 使用“测试switch”课程，每屏四个动作 AB1、AB2，循环次数设为 4。
2. 在 Course 确认播放顺序显示 `AB1 → AB2 → AB1 → AB2`，总时长不再乘以 AB 对数量。
3. TV 预览/开课后观察：A 到 B 显示 SWITCH，B 完成后显示 MOVE STATION，再进入下一 AB 对。
4. 第四轮完成后不再显示 MOVE STATION，直接进入 Pod ending。

Expected:

- Course 与 TV 总时长一致。
- 正式 WORK 进度每完成一个 A 或 B 前进一步；REST、SWITCH、MOVE STATION 不推进 WORK 进度。

### Bad Flow

1. SWITCH 屏幕仅一个动作或没有动作。
2. SWITCH 屏幕有三个动作。
3. 循环次数大于 AB 对数量。

Expected:

- 少于两个动作不构建 SWITCH 时间线。
- 三个动作只使用第一个完整 AB 对。
- 超过 AB 对数量后从 AB1 循环，不越界、不重复整组乘算。

## Deployment / Rollback

- Build order: Course tests/build -> TV unit tests/build。
- Deploy order: Course Web -> TV APK。
- Version bump: TV 发布时按当前线上版本递增。
- Rollback: 回滚 Course/TV 代码即可；无数据库回滚。

## Documentation Updates

- [x] Update this requirement status.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md) if app ownership or data flow changed.
- [x] Update related product docs if behavior changed.
