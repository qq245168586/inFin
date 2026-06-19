# 三屏视频行布局配置

## 目标

三屏站点视频组支持按行配置视频大小：每一行可以选择展示 1 个视频或 2 个视频。单视频行保持 16:9 等比并占满整行，因此可见行数按 3 行计算；全双视频行按 5 行计算，最多约 10 个视频。单屏瀑布流不受影响。

## 数据结构

课程脚本在 `training.videoGroups[].screens[]` 上新增：

```json
{
  "rowLayouts": [1, 2, 1]
}
```

含义：

- `1`：这一行 1 个视频，视频更大。
- `2`：这一行 2 个视频，视频更小。
- 字段缺失时兼容旧课程，TV 端继续使用旧规则。
- 单屏瀑布流固定保存为空数组。

## 编辑端规则

- 新建三屏视频组默认每行单视频。
- 教练可以在每个屏幕里按行切换 `1 个 / 2 个`。
- 提供 `全部单列` 和 `全部双列` 快捷操作。
- 删除或新增动作后会重新规范化 `rowLayouts`，避免行配置和视频数量错位。
- 正式组模板保存时会保留 `rowLayouts`，不会被服务端裁剪。

## TV 端规则

- TV 解析课程时读取 `rowLayouts` 并挂到 `VideoGroupScreen`。
- 普通三屏训练、SWITCH 训练和 Pod 间预览都会使用同一套行布局。
- 存在任意单视频行时，视频高度按 3 行可见计算。
- 全部双视频行时，视频高度按 5 行可见计算。
- 瀑布流分支仍走原来的 `waterfallLayout`，不读取 `rowLayouts`。

## 验证

- `apps/course-web`: `pnpm run typecheck`
- `apps/server`: `pnpm run build`
- `apps/tv-android`: `./gradlew assembleDebug`
