import type { CourseScript, Pod, PodEnding, PodScreen, PodStationFlow, VideoGroup } from "../../../models/course/types.ts";
import DraftNumberInput from "../../../components/DraftNumberInput.tsx";
import { formatSecondsLabel } from "../../../utils/datetime.ts";
import { podHasCustomizedRules } from "../../../viewmodels/courses/podDialogs.ts";
import type { PodEndingOption } from "../../../viewmodels/courses/podEndings.ts";
import PodScreenCard from "./PodScreenCard.tsx";

export default function PodCard({
  script,
  pod,
  podIndex,
  linkedGroup,
  podEndingOptions,
  createPodName,
  syncPodWithVideoGroup,
  rebalancePodEndings,
  getPodScreenTotal,
  formatPodTimingMismatch,
  formatRestStrategy,
  formatSecondsStrategy,
  onUpdateScript,
  onNotice,
  onOpenPodRuleDialog,
  onOpenPodCopyDialog,
  onOpenPodConfigCopyDialog
}: {
  script: CourseScript;
  pod: Pod;
  podIndex: number;
  linkedGroup: VideoGroup | null;
  podEndingOptions: PodEndingOption[];
  createPodName: (index: number) => string;
  syncPodWithVideoGroup: (pod: Pod, group: VideoGroup | null | undefined) => Pod;
  rebalancePodEndings: (pods: Pod[]) => Pod[];
  getPodScreenTotal: (pod: Pod, screen: PodScreen, linkedScreen: VideoGroup["screens"][number] | null) => number;
  formatPodTimingMismatch: (pod: Pod, group: VideoGroup | null) => string;
  formatRestStrategy: (screen: PodScreen, isSingleScreen?: boolean) => string;
  formatSecondsStrategy: (values: number[]) => string;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onOpenPodRuleDialog: (pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) => void;
  onOpenPodCopyDialog: (pod: Pod, screen: PodScreen, screenLabel: string) => void;
  onOpenPodConfigCopyDialog: (pod: Pod, podLabel: string) => void;
}) {
  const podTotals = pod.screens.map((screen) => {
    const linkedScreen = linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
    return getPodScreenTotal(pod, screen, linkedScreen);
  });
  const isBalanced = podTotals.every((total) => total === (podTotals[0] ?? 0));
  const isLastPod = podIndex === script.training.pods.length - 1;
  const canUseSwitch = linkedGroup?.screenCount === 3;
  const hasOddSwitchCards = Boolean(
    pod.stationFlow === "SWITCH" && linkedGroup?.screens.some((screen) => (screen.videoCards.length || 0) % 2 !== 0)
  );
  const switchReferenceScreen = pod.screens[0] || null;
  const switchReferenceLinkedScreen =
    switchReferenceScreen && linkedGroup?.screens.find((entry) => entry.screenIndex === switchReferenceScreen.screenIndex);
  const switchActionCount = switchReferenceLinkedScreen?.videoCards.length || 0;
  const switchPairCount = Math.floor(switchActionCount / 2);
  const switchLoopCount = Math.max(switchReferenceScreen?.loopCount || 1, 1);
  const switchSequence = switchPairCount
    ? Array.from({ length: switchLoopCount }, (_, index) => `AB${(index % switchPairCount) + 1}`).join(" → ")
    : "暂无 AB 组合";
  const switchGroupCount = Math.max(switchReferenceScreen?.setConfigs?.length || 1, 1);

  return (
    <div className="module-card is-pod">
      <div className="module-card-head">
        <div>
          <strong>{pod.name || createPodName(podIndex)}</strong>
          <span>
            {linkedGroup?.name || "未绑定视频组"} · {linkedGroup?.screenCount === 1 ? "单屏瀑布" : "多屏站点"}
          </span>
        </div>
        <div className="module-card-actions">
          <button
            type="button"
            className="ghost-button small"
            disabled={!script.training.pods.some((candidate) => candidate.id !== pod.id && podHasCustomizedRules(candidate))}
            onClick={() => onOpenPodConfigCopyDialog(pod, pod.name || createPodName(podIndex))}
          >
            复制 Pod
          </button>
          <button
            type="button"
            className="table-link danger"
            onClick={() => {
              if (script.training.pods.length <= 1) {
                onNotice("至少保留一个 Pod。", "error");
                return;
              }
              onUpdateScript((current) => ({
                ...current,
                training: {
                  ...current.training,
                  pods: rebalancePodEndings(current.training.pods.filter((entry) => entry.id !== pod.id))
                }
              }));
            }}
          >
            删除
          </button>
        </div>
      </div>

      <div className={`form-row ${pod.ending === "FINISH" ? "four" : "five"}`}>
        <label className="field">
          <span>Pod 名称</span>
          <input
            value={pod.name}
            onChange={(event) =>
              onUpdateScript((current) => ({
                ...current,
                training: {
                  ...current.training,
                  pods: current.training.pods.map((entry) => (entry.id === pod.id ? { ...entry, name: event.target.value } : entry))
                }
              }))
            }
          />
        </label>

        <label className="field">
          <span>绑定视频组</span>
          <select
            value={pod.videoGroupId}
            onChange={(event) =>
              onUpdateScript((current) => {
                const nextGroup = current.training.videoGroups.find((group) => group.id === event.target.value);
                return {
                  ...current,
                  training: {
                    ...current.training,
                    pods: current.training.pods.map((entry) =>
                      entry.id === pod.id ? syncPodWithVideoGroup({ ...entry, videoGroupId: event.target.value }, nextGroup) : entry
                    )
                  }
                };
              })
            }
          >
            {(script.training.videoGroups || []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name || `视频组 ${group.screenCount} 屏`}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Pod 结束方式</span>
          <select
            value={pod.ending}
            onChange={(event) =>
              onUpdateScript((current) => ({
                ...current,
                training: {
                  ...current.training,
                  pods: current.training.pods.map((entry) => (entry.id === pod.id ? { ...entry, ending: event.target.value as PodEnding } : entry))
                }
              }))
            }
          >
            {podEndingOptions.map((item) => (
              <option
                key={item.value}
                value={item.value}
                disabled={(item.value === "FINISH" && !isLastPod) || (isLastPod && item.value !== "FINISH")}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>站点流转</span>
          <select
            value={pod.stationFlow || "NORMAL"}
            onChange={(event) =>
              onUpdateScript((current) => ({
                ...current,
                training: {
                  ...current.training,
                  pods: current.training.pods.map((entry) =>
                    entry.id === pod.id ? { ...entry, stationFlow: event.target.value as PodStationFlow } : entry
                  )
                }
              }))
            }
          >
            <option value="NORMAL">正常换站</option>
            <option value="SWITCH" disabled={!canUseSwitch}>
              SWITCH A/B
            </option>
          </select>
        </label>

        {pod.ending !== "FINISH" ? (
          <label className="field">
            <span>{pod.ending === "HYDRATE" ? "补水时长（秒）" : "换区时长（秒）"}</span>
            <DraftNumberInput
              value={script.metadata.defaultHydrateSeconds}
              minValue={0}
              onValueChange={(value) =>
                onUpdateScript((current) => ({
                  ...current,
                  metadata: {
                    ...current.metadata,
                    defaultHydrateSeconds: value
                  }
                }))
              }
            />
          </label>
        ) : null}
      </div>

      <div className="section-inline-summary">
        {pod.screens.map((screen) => (
          <span key={screen.id}>
            屏幕 {screen.screenIndex}:{" "}
            {formatSecondsLabel(getPodScreenTotal(pod, screen, linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null))}
          </span>
        ))}
      </div>

      {pod.stationFlow === "SWITCH" ? (
        <div className="switch-rule-summary">
          <strong>
            SWITCH 规则：{switchActionCount} 个动作 = {switchPairCount} 个 AB 素材；本 Pod 播放 {switchLoopCount} 个 AB 组合
          </strong>
          <span>组数控制同一个 AB 内做几组：每组都是 A → 换站休息 → B；多组时，组与组之间用组间休息。</span>
          <span>循环次数控制连续播放几个 AB：做完当前 AB 后进入下一个 AB，直到 Pod 结束后再补水或换区。</span>
          <span>当前设置：每个 AB 内 {switchGroupCount} 组；播放顺序：{switchSequence}</span>
        </div>
      ) : null}

      {!isBalanced ? <div className="inline-warning">{formatPodTimingMismatch(pod, linkedGroup || null)}</div> : null}
      {pod.stationFlow === "SWITCH" && !canUseSwitch ? (
        <div className="inline-warning">SWITCH 只能绑定三屏视频组。</div>
      ) : null}
      {hasOddSwitchCards ? <div className="inline-warning">SWITCH 视频组每个屏幕都需要偶数个视频卡片。</div> : null}

      <div className={`screen-grid ${linkedGroup?.screenCount === 1 ? "is-single" : ""}`}>
        {pod.screens.map((screen) => (
          <PodScreenCard
            key={screen.id}
            pod={pod}
            screen={screen}
            linkedGroup={linkedGroup}
            getPodScreenTotal={getPodScreenTotal}
            formatRestStrategy={formatRestStrategy}
            formatSecondsStrategy={formatSecondsStrategy}
            onOpenPodRuleDialog={onOpenPodRuleDialog}
            onOpenPodCopyDialog={onOpenPodCopyDialog}
          />
        ))}
      </div>
    </div>
  );
}
