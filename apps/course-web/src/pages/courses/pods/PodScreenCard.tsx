import type { Pod, PodScreen, VideoGroup } from "../../../models/course/types.ts";
import { normalizePodSetConfigsForLayout } from "../../../models/course/podSetConfigs.ts";
import { formatSecondsLabel } from "../../../utils/datetime.ts";

export default function PodScreenCard({
  pod,
  screen,
  linkedGroup,
  getPodScreenTotal,
  formatRestStrategy,
  formatSecondsStrategy,
  onOpenPodRuleDialog,
  onOpenPodCopyDialog
}: {
  pod: Pod;
  screen: PodScreen;
  linkedGroup: VideoGroup | null;
  getPodScreenTotal: (pod: Pod, screen: PodScreen, linkedScreen: VideoGroup["screens"][number] | null) => number;
  formatRestStrategy: (screen: PodScreen, isSingleScreen?: boolean) => string;
  formatSecondsStrategy: (values: number[]) => string;
  onOpenPodRuleDialog: (pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) => void;
  onOpenPodCopyDialog: (pod: Pod, screen: PodScreen, screenLabel: string) => void;
}) {
  const linkedScreen = linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
  const screenTotal = getPodScreenTotal(pod, screen, linkedScreen);
  const actionCount = linkedScreen?.videoCards.length || 0;
  const isSingleScreenRule = (linkedGroup?.screenCount || 0) === 1;
  const effectiveSetConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, isSingleScreenRule, 1);
  const screenLabel = linkedScreen?.stationLabel || `屏幕 ${screen.screenIndex}`;
  const switchPairCount = pod.stationFlow === "SWITCH" && !isSingleScreenRule ? Math.floor(actionCount / 2) : 0;
  const switchLoopCount = Math.max(screen.loopCount || 1, 1);
  const groupRestValues = effectiveSetConfigs.slice(0, -1).map((setConfig) => setConfig.restSeconds);
  const switchRestStrategy = groupRestValues.length
    ? `A/B 换站 ${screen.stationRestSeconds}s · 组间休息 ${formatSecondsStrategy(groupRestValues)}`
    : `A/B 换站 ${screen.stationRestSeconds}s`;
  const screenMeta =
    pod.stationFlow === "SWITCH" && !isSingleScreenRule
      ? `${actionCount} 个动作 · ${switchPairCount} 个 AB 素材 · 每个 AB ${effectiveSetConfigs.length} 组 · 播放 ${switchLoopCount} 个 AB · ${formatSecondsLabel(screenTotal)}`
      : `${actionCount} 个动作 · ${formatSecondsLabel(screenTotal)}`;
  const isSwitchRule = pod.stationFlow === "SWITCH" && !isSingleScreenRule;

  return (
    <div className="screen-card">
      <div className="screen-card-head">
        <div>
          <strong>{screenLabel}</strong>
          <span>{screenMeta}</span>
        </div>
        <div className="screen-card-actions">
          {linkedGroup?.screenCount === 3 ? (
            <button type="button" className="ghost-button small" onClick={() => onOpenPodCopyDialog(pod, screen, screenLabel)}>
              复制
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button small"
            onClick={() => onOpenPodRuleDialog(pod, screen, screenLabel, isSingleScreenRule)}
          >
            编辑规则
          </button>
        </div>
      </div>

      <div className={`form-row ${isSingleScreenRule ? "three" : "four"}`}>
        <label className="field">
          <span>{isSwitchRule ? "AB 轮次数" : "循环次数"}</span>
          <input value={`${screen.loopCount} 次`} readOnly />
        </label>

        {!isSingleScreenRule ? (
          <label className="field">
            <span>{isSwitchRule ? "每个 AB 内组数" : "组数"}</span>
            <input value={`${effectiveSetConfigs.length} 组`} readOnly />
          </label>
        ) : null}

        <label className="field">
          <span>{isSwitchRule ? "休息控制" : "休息时间策略"}</span>
          <input value={isSwitchRule ? switchRestStrategy : formatRestStrategy(screen, isSingleScreenRule)} readOnly />
        </label>

        <label className="field">
          <span>{isSwitchRule ? "每组工作时间" : "工作时间策略"}</span>
          <input value={formatSecondsStrategy(effectiveSetConfigs.map((setConfig) => setConfig.workSeconds))} readOnly />
        </label>
      </div>
    </div>
  );
}
