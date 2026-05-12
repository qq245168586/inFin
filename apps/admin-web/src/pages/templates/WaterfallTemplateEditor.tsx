import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import DraftNumberInput from "../../components/DraftNumberInput.tsx";
import { createWaterfallItem, getWaterfallSectionTotal } from "../../models/course/factories.ts";
import type { TemplateDraft } from "../../models/templates.ts";
import { formatSecondsLabel } from "../../utils/datetime.ts";

function findActionName(actions: ActionMediaPreviewAction[], actionId: string): string {
  const matched = actions.find((item) => String(item.id) === String(actionId));
  return matched ? matched.name : "";
}

export default function WaterfallTemplateEditor({
  draft,
  actions,
  onUpdateDraft
}: {
  draft: TemplateDraft;
  actions: ActionMediaPreviewAction[];
  onUpdateDraft: (updater: (current: TemplateDraft) => TemplateDraft) => void;
}) {
  if (draft.kind === "training" || !draft.section) {
    return null;
  }

  return (
    <div className="section-card">
      <div className="section-card-head">
        <div>
          <h3>{draft.kind === "cooldown" ? "冷身模板" : "热身模板"}</h3>
          <p className="section-copy">模板会保存动作和持续时间，方便在课程编辑里直接复用。</p>
        </div>
      </div>

      <div className="section-inline-summary">
        <span>{draft.section.items.length} 个动作</span>
        <span>{formatSecondsLabel(getWaterfallSectionTotal(draft.section))}</span>
      </div>

      <div className="stack-list">
        {draft.section.items.map((item, index) => (
          <div key={item.id} className="stack-row waterfall-row">
            <div className="stack-row-main">
              <label className="field grow">
                <span>动作 {index + 1}</span>
                <select
                  value={item.actionId}
                  onChange={(event) =>
                    onUpdateDraft((current) => ({
                      ...current,
                      section: current.section
                        ? {
                            ...current.section,
                            items: current.section.items.map((entry) =>
                              entry.id === item.id
                                ? {
                                    ...entry,
                                    actionId: event.target.value,
                                    actionName: findActionName(actions, event.target.value)
                                  }
                                : entry
                            )
                          }
                        : current.section
                    }))
                  }
                >
                  <option value="">请选择动作</option>
                  {actions.map((action) => (
                    <option key={action.id} value={action.id}>
                      {action.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field narrow">
                <span>时长</span>
                <DraftNumberInput
                  value={item.seconds}
                  minValue={0}
                  onValueChange={(value) =>
                    onUpdateDraft((current) => ({
                      ...current,
                      section: current.section
                        ? {
                            ...current.section,
                            items: current.section.items.map((entry) =>
                              entry.id === item.id ? { ...entry, seconds: value } : entry
                            )
                          }
                        : current.section
                    }))
                  }
                />
              </label>

              <button
                type="button"
                className="table-link danger"
                onClick={() =>
                  onUpdateDraft((current) => ({
                    ...current,
                    section: current.section
                      ? {
                          ...current.section,
                          items: current.section.items.filter((entry) => entry.id !== item.id).length
                            ? current.section.items.filter((entry) => entry.id !== item.id)
                            : [createWaterfallItem()]
                        }
                      : current.section
                  }))
                }
              >
                删除
              </button>
            </div>

            <ActionMediaPreview actionId={item.actionId} actions={actions} />
          </div>
        ))}
      </div>

      <div className="section-card-footer">
        <button
          type="button"
          className="ghost-button small"
          onClick={() =>
            onUpdateDraft((current) => ({
              ...current,
              section: current.section ? { ...current.section, items: [...current.section.items, createWaterfallItem()] } : current.section
            }))
          }
        >
          + 添加动作
        </button>
      </div>
    </div>
  );
}
