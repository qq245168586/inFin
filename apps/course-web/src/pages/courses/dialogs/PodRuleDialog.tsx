import Dialog from "../../../components/Dialog.tsx";
import type { PodRuleDialogState } from "../../../viewmodels/courses/podDialogs.ts";

export default function PodRuleDialog({
  state,
  onClose,
  onConfirm,
  onStateChange,
  resizeSetDrafts
}: {
  state: PodRuleDialogState;
  onClose: () => void;
  onConfirm: () => void;
  onStateChange: (updater: (current: PodRuleDialogState) => PodRuleDialogState) => void;
  resizeSetDrafts: (setConfigs: PodRuleDialogState["setConfigs"], nextCount: number) => PodRuleDialogState["setConfigs"];
}) {
  return (
    <Dialog
      title={`${state.podName} · ${state.screenLabel} 规则`}
      width={860}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText="确定"
    >
      <div className="dialog-form pod-rule-dialog-form">
        <div className={`form-row ${state.isSingleScreen ? "single" : "two"}`}>
          <label className="field">
            <span>循环次数</span>
            <input
              type="number"
              min="1"
              value={state.loopCount}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  loopCount: event.target.value
                }))
              }
            />
          </label>

          {!state.isSingleScreen ? (
            <label className="field">
              <span>组数</span>
              <input
                type="number"
                min="1"
                value={state.setCount}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onStateChange((current) => {
                    const parsedCount = Number(nextValue);
                    return {
                      ...current,
                      setCount: nextValue,
                      setConfigs:
                        Number.isFinite(parsedCount) && parsedCount >= 1
                          ? resizeSetDrafts(current.setConfigs, Math.floor(parsedCount))
                          : current.setConfigs
                    };
                  });
                }}
              />
            </label>
          ) : null}
        </div>

        <div className="pod-rule-dialog-section">
          <strong>工作时间（秒）</strong>
          <div className="pod-rule-grid">
            {state.setConfigs.map((setConfig, setIndex) => (
              <label key={setConfig.id} className="field">
                <span>训练 {setIndex + 1}</span>
                <input
                  type="number"
                  min="1"
                  value={setConfig.workSeconds}
                  onChange={(event) =>
                    onStateChange((current) => ({
                      ...current,
                      setConfigs: current.setConfigs.map((item) =>
                        item.id === setConfig.id ? { ...item, workSeconds: event.target.value } : item
                      )
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        {!state.isSingleScreen && state.setConfigs.length > 1 ? (
          <div className="pod-rule-dialog-section">
            <strong>组间休息时间（秒）</strong>
            <div className="pod-rule-grid secondary">
              {state.setConfigs.slice(0, -1).map((setConfig, setIndex) => (
                <label key={`${setConfig.id}-rest`} className="field">
                  <span>休息 {setIndex + 1}</span>
                  <input
                    type="number"
                    min="0"
                    value={setConfig.restSeconds}
                    onChange={(event) =>
                      onStateChange((current) => ({
                        ...current,
                        setConfigs: current.setConfigs.map((item) =>
                          item.id === setConfig.id ? { ...item, restSeconds: event.target.value } : item
                        )
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="form-row single">
          <label className="field">
            <span>{state.isSingleScreen ? "休息时间（动作间）（秒）" : "休息时间（换站）（秒）"}</span>
            <input
              type="number"
              min="0"
              value={state.stationRestSeconds}
              onChange={(event) =>
                onStateChange((current) => ({
                  ...current,
                  stationRestSeconds: event.target.value
                }))
              }
            />
          </label>
        </div>
      </div>
    </Dialog>
  );
}
