# REQ-20260719-pod-ending-duration: Pod 独立补水与换区时长

## Status

- Status: Ready for QA
- Owner: Course / Server / TV
- Created: 2026-07-19
- Updated: 2026-07-19
- Related docs: `REQ-20260702-tv-horizontal-formal-training-time.md`
- Related code map sections: Course Script / TV Timeline

## Requirement Summary

课程编辑器中每个 Pod 的补水或换区时长必须独立保存，修改一个 Pod 不得联动其他 Pod。课程顶部的 `Set / Work / Rest / Switch` 是展示字段，只用于 Course、Coach、TV 的课程信息展示，不参与正式训练时序、总时长或播放器状态计算。历史课程继续兼容课程级默认补水时长，不做数据库批量迁移。

## Background

- 当前行为：每个 Pod 卡片都显示“补水时长”，但输入实际绑定 `script.metadata.defaultHydrateSeconds`。
- 问题：修改任意 Pod 会同时改变全部 Pod，Server 汇总和 TV 播放也只能使用一个全局时长。
- 业务原因：不同 Pod 的训练强度不同，需要配置不同补水或换区时间。
- 已知约束：旧课程只有课程级 `defaultHydrateSeconds`；生产课程数据不得破坏。

## Goals

- 非 `FINISH` Pod 使用自己的 `endingSeconds`。
- 课程总时长、hydrate 汇总和 TV 时间轴使用相同的 Pod 级时长。
- 历史 Pod 没有 `endingSeconds` 时回退到 `metadata.defaultHydrateSeconds`。
- `stationRules.set/work/rest/switch` 保持纯展示语义。

## Non-goals

- 不删除历史 `defaultHydrateSeconds` 字段。
- 不迁移或批量重写 MongoDB 课程数据。
- 不改变 Pod 内 work、rest、循环、换站的现有计算公式。
- 不改变 Coach/Admin 功能。

## Related Existing Requirements

| Document / Feature | Relationship | Notes |
| --- | --- | --- |
| `REQ-20260702-tv-horizontal-formal-training-time` | 计算口径 | 正式训练时长不包含 Pod ending；总课程时长包含各 Pod ending。 |
| Course station rules | 展示口径 | Set / Work / Rest / Switch 不得驱动播放。 |

## Impacted Apps

| App | Change Type | Notes |
| --- | --- | --- |
| `packages/shared` | course script / summary / validation | 规范化、汇总和校验 Pod 独立时长。 |
| `apps/server` | compatibility / summary | 保存新增字段并对旧数据回退，不改数据库结构。 |
| `apps/course-web` | editor / local normalization | 每个 Pod 输入只更新自身字段。 |
| `apps/tv-android` | parser / timeline | 解析并播放 Pod 独立时长，旧脚本回退全局默认值。 |

## Data And API Impact

### Data Model

- New fields: `script.training.pods[].endingSeconds: number`。
- Changed fields: 无。
- Backfill/default strategy: 读取时使用 `pod.endingSeconds ?? script.metadata.defaultHydrateSeconds`；`FINISH` 忽略该时长。
- Compatibility with old records: 完全兼容；旧 TV 仍会忽略新字段并使用全局默认值，因此 TV 必须随本功能升级后才能正确播放不同时长。

### API

| Endpoint | Change | Compatibility |
| --- | --- | --- |
| Course create/update/detail | course script 增加可选 Pod 字段 | Additive，旧客户端可继续读取。 |
| TV daily bundle | 原样携带 Pod 字段 | Additive，旧包可继续解析。 |

## Implementation Sketch

### Shared / Server

```pseudo
normalizePod(pod, metadataDefault):
  pod.endingSeconds = pod.ending == FINISH
    ? 0
    : nonNegative(pod.endingSeconds, metadataDefault)

summary.hydrateSeconds = sum(non-finish pod.endingSeconds)
```

### Course Web

```pseudo
onPodEndingSecondsChange(podId, value):
  update only training.pods[podId].endingSeconds

stationRules change:
  update display metadata only
```

### TV

```pseudo
duration = pod.endingSeconds >= 0
  ? pod.endingSeconds
  : course.metadata.defaultHydrateSeconds
```

## Risks

| Risk | Mitigation |
| --- | --- |
| 新 Course 保存后旧 TV 仍按全局时长播放 | TV 与 Course/Server 同批发布，版本说明标记脚本能力变化。 |
| 老课程没有 Pod 字段 | 读取时回退，不做数据库迁移。 |
| 汇总和播放器口径不一致 | Shared、Course、TV 分别增加同一场景测试。 |
| 展示字段误参与播放 | 增加 stationRules 改动不影响 summary 的回归测试。 |

## Manual E2E Acceptance

### Happy Flow

1. 创建三个 Pod，前两个结束方式为补水，分别填写 `30` 和 `90` 秒。
2. 保存后重新进入编辑页。
3. 在 TV 运行课程。

Expected:

- 两个输入分别保持 `30` 和 `90`。
- 第一个 Pod 补水 30 秒，第二个 Pod 补水 90 秒。
- 课程汇总 hydrate 时间为 120 秒。

### Display-only Flow

1. 不修改 Pod 规则，仅修改顶部 Set / Work / Rest 的文案。
2. 保存并重新打开课程。

Expected:

- 课表展示更新。
- 课程正式训练时长、总时长和 TV 播放节奏不变。

### Legacy Flow

1. 打开没有 `pods[].endingSeconds` 的旧课程。
2. 查看多个 Pod 的补水时间并保存。

Expected:

- 每个旧 Pod 初始显示原 `defaultHydrateSeconds`。
- 保存后各 Pod 获得独立值，课程结构其余部分不变。

## Deployment / Rollback

- Build order: Shared/Server -> Course -> TV。
- Deploy order: Server -> Course -> TV package。
- Version bump: TV `1.0.70`。
- Rollback: Server/Course 可回滚；若课程已保存不同 Pod 时长，回滚后的旧 TV 会暂时按全局默认值播放，但数据字段不会丢失。

## Documentation Updates

- [x] Add this requirement.
- [x] Update [Requirements Index](INDEX.md).
- [x] Update [Code Map](../CODEMAP.md).
- [ ] Mark Shipped after production verification.
