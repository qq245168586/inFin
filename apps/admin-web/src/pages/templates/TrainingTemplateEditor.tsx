import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import { createVideoCard, createVideoGroupScreen } from "../../models/course/factories.ts";
import type { TemplateDraft } from "../../models/templates.ts";

function findActionName(actions: ActionMediaPreviewAction[], actionId: string): string {
  const matched = actions.find((item) => String(item.id) === String(actionId));
  return matched ? matched.name : "";
}

export default function TrainingTemplateEditor({
  draft,
  actions,
  onUpdateDraft
}: {
  draft: TemplateDraft;
  actions: ActionMediaPreviewAction[];
  onUpdateDraft: (updater: (current: TemplateDraft) => TemplateDraft) => void;
}) {
  if (draft.kind !== "training" || !draft.videoGroup) {
    return null;
  }

  return (
    <div className="section-card">
      <div className="section-card-head">
        <div>
          <h3>正式组模板</h3>
          <p className="section-copy">这里负责定义屏幕数量、站点和动作位结构，动作可以先留空，后面在课程里再填。</p>
        </div>
        <button
          type="button"
          className="ghost-button small"
          onClick={() =>
            onUpdateDraft((current) => ({
              ...current,
              videoGroup: current.videoGroup
                ? {
                    ...current.videoGroup,
                    screenCount: current.videoGroup.screenCount === 1 ? 3 : 1,
                    screens: Array.from({ length: current.videoGroup.screenCount === 1 ? 3 : 1 }, (_, index) => {
                      const screenCount = current.videoGroup!.screenCount === 1 ? 3 : 1;
                      const screenIndex = index + 1;
                      const existingScreen = current.videoGroup!.screens.find((entry) => entry.screenIndex === screenIndex);

                      return existingScreen
                        ? {
                            ...existingScreen,
                            stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
                            layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
                            videoCards: existingScreen.videoCards.map((card) => ({
                              ...card,
                              stationNumber: screenCount === 1 ? "" : card.stationNumber
                            }))
                          }
                        : createVideoGroupScreen(screenIndex, screenCount);
                    })
                  }
                : current.videoGroup
            }))
          }
        >
          切换为{draft.videoGroup.screenCount === 1 ? "三屏" : "单屏"}
        </button>
      </div>

      <div className={`screen-grid ${draft.videoGroup.screenCount === 1 ? "is-single" : ""}`}>
        {draft.videoGroup.screens.map((screen) => (
          <div key={screen.id} className="screen-card">
            <div className="screen-card-head">
              <div>
                <strong>{screen.stationLabel}</strong>
                <span>{screen.layout === "WATERFALL" ? "瀑布流动作列表" : "站点动作列表"}</span>
              </div>
            </div>

            <div className="stack-list">
              {screen.videoCards.map((card, cardIndex) => (
                <div key={card.id} className="stack-row compact card-row">
                  <div className="stack-row-main">
                    <label className="field grow action-field">
                      <span>动作位 {cardIndex + 1}</span>
                      <select
                        value={card.actionId}
                        onChange={(event) =>
                          onUpdateDraft((current) => ({
                            ...current,
                            videoGroup: current.videoGroup
                              ? {
                                  ...current.videoGroup,
                                  screens: current.videoGroup.screens.map((entry) =>
                                    entry.id === screen.id
                                      ? {
                                          ...entry,
                                          videoCards: entry.videoCards.map((videoCard) =>
                                            videoCard.id === card.id
                                              ? {
                                                  ...videoCard,
                                                  actionId: event.target.value,
                                                  actionName: findActionName(actions, event.target.value)
                                                }
                                              : videoCard
                                          )
                                        }
                                      : entry
                                  )
                                }
                              : current.videoGroup
                          }))
                        }
                      >
                        <option value="">先留空，课程里再选动作</option>
                        {actions.map((action) => (
                          <option key={action.id} value={action.id}>
                            {action.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {draft.videoGroup.screenCount === 3 ? (
                      <label className="field station-field">
                        <span>站点</span>
                        <input
                          type="text"
                          value={card.stationNumber}
                          placeholder="1 / A / 1A"
                          onChange={(event) =>
                            onUpdateDraft((current) => ({
                              ...current,
                              videoGroup: current.videoGroup
                                ? {
                                    ...current.videoGroup,
                                    screens: current.videoGroup.screens.map((entry) =>
                                      entry.id === screen.id
                                        ? {
                                            ...entry,
                                            videoCards: entry.videoCards.map((videoCard) =>
                                              videoCard.id === card.id
                                                ? { ...videoCard, stationNumber: event.target.value }
                                                : videoCard
                                            )
                                          }
                                        : entry
                                    )
                                  }
                                : current.videoGroup
                            }))
                          }
                        />
                      </label>
                    ) : null}

                    <button
                      type="button"
                      className="table-link danger"
                      onClick={() =>
                        onUpdateDraft((current) => ({
                          ...current,
                          videoGroup: current.videoGroup
                            ? {
                                ...current.videoGroup,
                                screens: current.videoGroup.screens.map((entry) =>
                                  entry.id === screen.id
                                    ? {
                                        ...entry,
                                        videoCards: entry.videoCards.filter((videoCard) => videoCard.id !== card.id).length
                                          ? entry.videoCards.filter((videoCard) => videoCard.id !== card.id)
                                          : [createVideoCard()]
                                      }
                                    : entry
                                )
                              }
                            : current.videoGroup
                        }))
                      }
                    >
                      删除
                    </button>
                  </div>

                  <ActionMediaPreview
                    actionId={card.actionId}
                    actions={actions}
                    emptyCopy="模板里可以先不选动作，保留结构占位"
                  />
                </div>
              ))}
            </div>

            <div className="screen-card-footer">
              <button
                type="button"
                className="ghost-button small"
                onClick={() =>
                  onUpdateDraft((current) => ({
                    ...current,
                    videoGroup: current.videoGroup
                      ? {
                          ...current.videoGroup,
                          screens: current.videoGroup.screens.map((entry) =>
                            entry.id === screen.id ? { ...entry, videoCards: [...entry.videoCards, createVideoCard()] } : entry
                          )
                        }
                      : current.videoGroup
                  }))
                }
              >
                + 添加动作
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
