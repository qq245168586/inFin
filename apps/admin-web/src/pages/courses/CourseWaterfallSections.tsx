import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import DraftNumberInput from "../../components/DraftNumberInput.tsx";
import EmptyBlock from "../../components/EmptyBlock.tsx";
import type { CourseScript, CourseSectionKey, WaterfallSection } from "../../models/course/types.ts";
import { createWaterfallItem } from "../../models/course/factories.ts";
import { formatSecondsLabel } from "../../utils/datetime.ts";

function findActionName(actions: ActionMediaPreviewAction[], actionId: string): string {
  return actions.find((item) => String(item.id) === String(actionId))?.name || "";
}

export default function CourseWaterfallSections({
  sections,
  actions,
  sectionCopy,
  onUseTemplate,
  onUpdateScript
}: {
  sections: CourseScript["sections"];
  actions: ActionMediaPreviewAction[];
  sectionCopy: Record<CourseSectionKey, string>;
  onUseTemplate: (key: CourseSectionKey) => void;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
}) {
  return (
    <>
      {(["warmup", "cooldown"] as CourseSectionKey[]).map((sectionKey) => {
        const section = sections[sectionKey] as WaterfallSection;
        const isCooldownSection = sectionKey === "cooldown";
        const isSectionEmpty = section.items.length === 0;
        const totalSeconds = section.items.reduce((total, item) => total + Number(item.seconds || 0), 0);

        return (
          <div key={section.id} className="section-card">
            <div className="section-card-head">
              <div>
                <h3>{section.title}</h3>
                <p className="section-copy">{sectionCopy[sectionKey]}</p>
              </div>
              <div className="section-head-actions">
                <button type="button" className="ghost-button small" onClick={() => onUseTemplate(sectionKey)}>
                  使用模版
                </button>
                {isCooldownSection && !isSectionEmpty ? (
                  <button
                    type="button"
                    className="table-link danger"
                    onClick={() =>
                      onUpdateScript((current) => ({
                        ...current,
                        sections: {
                          ...current.sections,
                          cooldown: { ...current.sections.cooldown, items: [] }
                        }
                      }))
                    }
                  >
                    删除冷身
                  </button>
                ) : null}
              </div>
            </div>

            <div className="section-inline-summary">
              <span>{section.items.length} 个动作</span>
              <span>{formatSecondsLabel(totalSeconds)}</span>
            </div>

            {isSectionEmpty ? (
              <EmptyBlock
                title="当前未启用冷身"
                copy="这节课可以没有冷身模块。你可以直接保存，也可以重新添加动作或使用冷身模版恢复。"
              />
            ) : (
              <div className="stack-list">
                {section.items.map((item, index) => (
                  <div key={item.id} className="stack-row waterfall-row">
                    <div className="stack-row-main">
                      <label className="field grow">
                        <span>动作 {index + 1}</span>
                        <select
                          value={item.actionId}
                          onChange={(event) =>
                            onUpdateScript((current) => ({
                              ...current,
                              sections: {
                                ...current.sections,
                                [sectionKey]: {
                                  ...current.sections[sectionKey],
                                  items: current.sections[sectionKey].items.map((entry) =>
                                    entry.id === item.id
                                      ? {
                                          ...entry,
                                          actionId: event.target.value,
                                          actionName: findActionName(actions, event.target.value)
                                        }
                                      : entry
                                  )
                                }
                              }
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
                            onUpdateScript((current) => ({
                              ...current,
                              sections: {
                                ...current.sections,
                                [sectionKey]: {
                                  ...current.sections[sectionKey],
                                  items: current.sections[sectionKey].items.map((entry) =>
                                    entry.id === item.id ? { ...entry, seconds: value } : entry
                                  )
                                }
                              }
                            }))
                          }
                        />
                      </label>

                      <button
                        type="button"
                        className="table-link danger"
                        onClick={() =>
                          onUpdateScript((current) => {
                            const nextItems = current.sections[sectionKey].items.filter((entry) => entry.id !== item.id);
                            return {
                              ...current,
                              sections: {
                                ...current.sections,
                                [sectionKey]: {
                                  ...current.sections[sectionKey],
                                  items: nextItems.length || isCooldownSection ? nextItems : [createWaterfallItem()]
                                }
                              }
                            };
                          })
                        }
                      >
                        删除
                      </button>
                    </div>

                    <ActionMediaPreview actionId={item.actionId} actions={actions} />
                  </div>
                ))}
              </div>
            )}

            <div className="section-card-footer">
              <button
                type="button"
                className="ghost-button small"
                onClick={() =>
                  onUpdateScript((current) => ({
                    ...current,
                    sections: {
                      ...current.sections,
                      [sectionKey]: {
                        ...current.sections[sectionKey],
                        items: [...current.sections[sectionKey].items, createWaterfallItem()]
                      }
                    }
                  }))
                }
              >
                {isCooldownSection && isSectionEmpty ? "+ 添加冷身动作" : "+ 添加动作"}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
