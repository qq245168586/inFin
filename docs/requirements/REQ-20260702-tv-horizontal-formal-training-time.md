# REQ-20260702-tv-horizontal-formal-training-time: TV 横屏正式训练总时长调试显示

- Status: Ready for QA
- Owner: TV playback
- Apps: `apps/tv-android`
- Date: 2026-07-02

## Context

TV 横屏训练页在进度条下方有一行小时间，当前仅对正式环境测试场馆 `venue-432a10d5` 显示。这个时间不是给普通会员看的功能，而是现场调试指标，用来确认 TV 端解析出的正式训练总时长是否和编课端课程 summary 对得上。

之前实现误用了纯 Work 时间口径，所以类似 `STRENGTH全身循环 / 20260701Q1#1` 会显示 `31:30`。但编课端该课程每个 pod 的正式训练时间是 `17:35`，3 个 pod 应为 `52:45`。横屏时间必须显示正式训练 elapsed / total，而不是纯 Work elapsed / total。

## Requirements

- 仅当 TV 绑定场馆 namespace 为 `venue-432a10d5` 时显示该调试时间；其它场馆不显示。
- 时间格式为 `mm:ss/mm:ss`。
- 总时长使用正式训练总时长：
  - 包含所有正式 pod 内部的 work、set rest、station switch/rest、循环等待。
  - 排除 warm up。
  - 排除 cool down。
  - 排除 pod 结束后的 hydrate / move zone 过渡等待。
- 已过时间使用同一正式训练口径：
  - pod 内部训练时间正常增长。
  - pod 结束后的 hydrate / move zone 过渡等待期间，显示时间冻结在当前正式训练 elapsed。
  - 课程继续到下一个 pod 后继续增长。
- 横屏进度条本身仍然保持“正式 work 格子”口径：只计算正式组 work，rest、switch、hydrate、warm up、cool down 不走格子。

## Non Goals

- 不改变普通场馆横屏 UI。
- 不改变竖屏 UI。
- 不改变课程脚本、数据库、server API 或 coach/course 端。
- 不改变播放 session 的真实时钟；这里只改变调试显示口径。

## Impact Boundary

| Area | Change | Notes |
| --- | --- | --- |
| `apps/tv-android` | Change | 新增 formal training duration calculator，并替换横屏小时间显示口径。 |
| `apps/server` | None | 不改 bundle/session 数据。 |
| `apps/course-web` | None | 编课端 summary 仍是对照来源。 |
| `apps/coach-web` | None | 控制链路不变。 |

## Implementation Notes

- `TrainingProgressCalculator.getTrainingTotalSeconds(course)` 保持真实播放时钟口径，仍包含 pod ending hydrate/move zone。
- 新增 `TrainingProgressCalculator.getFormalTrainingTotalSeconds(course)`，只累加 pod duration。
- 新增 `TrainingProgressCalculator.resolveFormalTrainingElapsedSeconds(course, elapsedSeconds)`，把真实 elapsed 映射到正式训练 elapsed，并在 ending hydrate/move zone 阶段冻结。
- 横屏时间 label 使用 formal training elapsed / total。

Pseudo:

```text
formalTotal = sum(podDuration for pod in course.pods)

formalElapsed = 0
realOffset = 0
for pod in pods:
  podDuration = calcPodDuration(pod)
  if elapsed < realOffset + podDuration:
    return formalElapsed + elapsed - realOffset
  formalElapsed += podDuration
  realOffset += podDuration

  endingDuration = hydrateOrMoveZoneSeconds(pod)
  if elapsed < realOffset + endingDuration:
    return formalElapsed
  realOffset += endingDuration
return formalElapsed
```

## Manual QA

Happy flow:

1. 使用 `venue-432a10d5` 场馆进入横屏课程。
2. 选择 `STRENGTH全身循环 / 20260701Q1#1` 或同类有多个 pod 的课程。
3. 横屏进度条下方时间总时长应显示 `52:45`，不应显示 `31:30`。
4. pod 间 hydrate / move zone 时，elapsed 不继续增加，进入下一个 pod 后继续增加。

Bad flow:

1. 使用非 `venue-432a10d5` 场馆进入横屏课程。
2. 进度条下方不应显示该调试时间。
3. 横屏正式 work 进度格子不应因为时间口径变更而改变数量或完成位置。

## Risk

| Risk | Mitigation |
| --- | --- |
| 把正式训练总时长和真实播放时钟混用 | 保留 `getTrainingTotalSeconds`，新增 formal training 方法，只替换调试 label。 |
| hydrate 阶段 elapsed 继续增长导致和编课端 summary 不一致 | `resolveFormalTrainingElapsedSeconds` 在 pod ending 阶段冻结。 |
| 影响普通场馆 UI | 保留 `venue-432a10d5` namespace gate。 |

