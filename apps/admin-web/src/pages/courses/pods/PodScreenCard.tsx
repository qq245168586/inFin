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
  getPodScreenTotal: (screen: PodScreen, linkedScreen: VideoGroup["screens"][number] | null) => number;
  formatRestStrategy: (screen: PodScreen, isSingleScreen?: boolean) => string;
  formatSecondsStrategy: (values: number[]) => string;
  onOpenPodRuleDialog: (pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) => void;
  onOpenPodCopyDialog: (pod: Pod, screen: PodScreen, screenLabel: string) => void;
}) {
  const linkedScreen = linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
  const screenTotal = getPodScreenTotal(screen, linkedScreen);
  const actionCount = linkedScreen?.videoCards.length || 0;
  const isSingleScreenRule = (linkedGroup?.screenCount || 0) === 1;
  const effectiveSetConfigs = normalizePodSetConfigsForLayout(screen.setConfigs, isSingleScreenRule, 1);
  const screenLabel = linkedScreen?.stationLabel || `屏幕 ${screen.screenIndex}`;

  return (
    <div className="screen-card">
      <div className="screen-card-head">
        <div>
          <strong>{screenLabel}</strong>
          <span>
            {actionCount} 个动作 · {formatSecondsLabel(screenTotal)}
          </span>
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
          <span>循环次数</span>
          <input value={`${screen.loopCount} 次`} readOnly />
        </label>

        {!isSingleScreenRule ? (
          <label className="field">
            <span>组数</span>
            <input value={`${effectiveSetConfigs.length} 组`} readOnly />
          </label>
        ) : null}

        <label className="field">
          <span>休息时间策略</span>
          <input value={formatRestStrategy(screen, isSingleScreenRule)} readOnly />
        </label>

        <label className="field">
          <span>工作时间策略</span>
          <input value={formatSecondsStrategy(effectiveSetConfigs.map((setConfig) => setConfig.workSeconds))} readOnly />
        </label>
      </div>
    </div>
  );
}
