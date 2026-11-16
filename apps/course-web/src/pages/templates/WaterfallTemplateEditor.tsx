import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import ActionPicker from "../../components/ActionPicker.tsx";
import DraftNumberInput from "../../components/DraftNumberInput.tsx";
import { createWaterfallItem, getWaterfallSectionTotal } from "../../models/course/factories.ts";
import type { TemplateDraft } from "../../models/templates.ts";
import type { TypeOption } from "../../services/api/meta.ts";
import { formatSecondsLabel } from "../../utils/datetime.ts";

export default function WaterfallTemplateEditor({
  draft,
  actions,
  actionTypes,
  onUpdateDraft
}: {
  draft: TemplateDraft;
  actions: ActionMediaPreviewAction[];
  actionTypes: TypeOption[];
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
                <ActionPicker
                  value={item.actionId}
                  actions={actions}
                  actionTypes={actionTypes}
                  onChange={(actionId, actionName) =>
                    onUpdateDraft((current) => ({
                      ...current,
                      section: current.section
                        ? {
                            ...current.section,
                            items: current.section.items.map((entry) =>
                              entry.id === item.id
                                ? {
                                    ...entry,
                                    actionId,
                                    actionName
                                  }
                                : entry
                            )
                          }
                        : current.section
                    }))
                  }
                />
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
