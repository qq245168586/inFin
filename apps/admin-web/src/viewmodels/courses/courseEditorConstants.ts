import type { CourseSectionKey, PodEnding } from "../../models/course/types.ts";

export const COURSE_SECTION_COPY: Record<CourseSectionKey, string> = {
  warmup: "三个竖屏同步播放同一组横向动作视频，按瀑布流依次播放并自动滚动。",
  cooldown: "显示逻辑与热身一致，三个竖屏同步显示同一组冷身视频瀑布流。"
};

export const POD_ENDING_OPTIONS: Array<{ value: PodEnding; label: string; hint: string }> = [
  { value: "HYDRATE", label: "补水", hint: "Pod 结束后进入补水" },
  { value: "MOVE_ZONE", label: "更换区域", hint: "Pod 结束后提示 move zone" },
  { value: "FINISH", label: "课程结束", hint: "最后一个 Pod 结束后进入课程收尾" }
];
