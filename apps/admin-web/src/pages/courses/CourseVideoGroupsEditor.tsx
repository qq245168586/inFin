import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import type { CourseScript, VideoGroup } from "../../models/course/types.ts";
import { createVideoCard, createVideoGroup, createVideoGroupScreen } from "../../models/course/factories.ts";

function findActionName(actions: ActionMediaPreviewAction[], actionId: string): string {
  return actions.find((item) => String(item.id) === String(actionId))?.name || "";
}

export default function CourseVideoGroupsEditor({
  script,
  actions,
  onUseTemplate,
  onUpdateScript,
  syncPodsForVideoGroup,
  onRemoveGroup,
  onNotice
}: {
  script: CourseScript;
  actions: ActionMediaPreviewAction[];
  onUseTemplate: (group: VideoGroup) => void;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
  syncPodsForVideoGroup: (script: CourseScript, nextGroup: VideoGroup) => CourseScript;
  onRemoveGroup: (groupId: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
}) {
  return (
    <div className="section-card">
      <div className="section-card-head">
        <div>
          <h3>正式训练 · 视频组</h3>
          <p className="section-copy">先定义视频组的屏幕和站点动作，再由 Pod 多次引用这些视频组。</p>
        </div>
        <div className="section-head-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              onUpdateScript((current) => ({
                ...current,
                training: {
                  ...current.training,
                  videoGroups: [...current.training.videoGroups, createVideoGroup(3)]
                }
              }))
            }
          >
            + 三屏组
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              onUpdateScript((current) => ({
                ...current,
                training: {
                  ...current.training,
                  videoGroups: [...current.training.videoGroups, createVideoGroup(1)]
                }
              }))
            }
          >
            + 单屏组
          </button>
        </div>
      </div>

      <div className="module-list">
        {script.training.videoGroups.map((group, groupIndex) => (
          <div key={group.id} className="module-card">
            <div className="module-card-head">
              <div>
                <strong>{group.name || `视频组 ${groupIndex + 1}`}</strong>
                <span>{group.screenCount === 1 ? "单屏瀑布流展示" : "三屏站点展示"}</span>
              </div>
              <div className="screen-card-actions">
                <button type="button" className="ghost-button small" onClick={() => onUseTemplate(group)}>
                  使用模版
                </button>
              </div>
            </div>

            <div className="form-row two">
              <label className="field">
                <span>视频组名称</span>
                <input
                  value={group.name}
                  onChange={(event) =>
                    onUpdateScript((current) => {
                      const nextGroup = { ...group, name: event.target.value };
                      return syncPodsForVideoGroup(current, nextGroup);
                    })
                  }
                  placeholder="例如：拳击三屏组 / 有氧瀑布组"
                />
              </label>

              <label className="field">
                <span>屏幕模式</span>
                <input value={group.screenCount === 1 ? "单屏瀑布流" : "三屏站点"} readOnly />
              </label>
            </div>

            <div className="group-meta-actions">
              <button
                type="button"
                className="ghost-button small"
                onClick={() =>
                  onUpdateScript((current) => {
                    const nextScreenCount = group.screenCount === 1 ? 3 : 1;
                    const nextGroup: VideoGroup = {
                      ...group,
                      screenCount: nextScreenCount,
                      screens: Array.from({ length: nextScreenCount }, (_, index) => {
                        const screenIndex = index + 1;
                        const existingScreen = group.screens.find((entry) => entry.screenIndex === screenIndex);
                        return existingScreen
                          ? {
                              ...existingScreen,
                              stationLabel: nextScreenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
                              layout: nextScreenCount === 1 ? "WATERFALL" : "STATIONS"
                            }
                          : createVideoGroupScreen(screenIndex, nextScreenCount);
                      })
                    };
                    return syncPodsForVideoGroup(current, nextGroup);
                  })
                }
              >
                切换为{group.screenCount === 1 ? "三屏" : "单屏"}
              </button>

              <button
                type="button"
                className="table-link danger"
                onClick={() => {
                  if (script.training.videoGroups.length <= 1) {
                    onNotice("至少保留一个视频组。", "error");
                    return;
                  }
                  onRemoveGroup(group.id);
                }}
              >
                删除视频组
              </button>
            </div>

            <div className={`screen-grid ${group.screenCount === 1 ? "is-single" : ""}`}>
              {group.screens.map((screen) => (
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
                            <span>动作 {cardIndex + 1}</span>
                            <select
                              value={card.actionId}
                              onChange={(event) =>
                                onUpdateScript((current) => {
                                  const nextGroup = {
                                    ...group,
                                    screens: group.screens.map((entry) =>
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
                                  };
                                  return syncPodsForVideoGroup(current, nextGroup);
                                })
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

                          {group.screenCount === 3 ? (
                            <label className="field station-field">
                              <span>站点</span>
                              <input
                                type="text"
                                value={card.stationNumber}
                                placeholder="1 / A / 1A"
                                onChange={(event) =>
                                  onUpdateScript((current) => {
                                    const nextGroup = {
                                      ...group,
                                      screens: group.screens.map((entry) =>
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
                                    };
                                    return syncPodsForVideoGroup(current, nextGroup);
                                  })
                                }
                              />
                            </label>
                          ) : null}

                          <button
                            type="button"
                            className="table-link danger"
                            onClick={() =>
                              onUpdateScript((current) => {
                                const nextGroup = {
                                  ...group,
                                  screens: group.screens.map((entry) =>
                                    entry.id === screen.id
                                      ? {
                                          ...entry,
                                          videoCards: entry.videoCards.filter((videoCard) => videoCard.id !== card.id).length
                                            ? entry.videoCards.filter((videoCard) => videoCard.id !== card.id)
                                            : [createVideoCard()]
                                        }
                                      : entry
                                  )
                                };
                                return syncPodsForVideoGroup(current, nextGroup);
                              })
                            }
                          >
                            删除
                          </button>
                        </div>

                        <ActionMediaPreview actionId={card.actionId} actions={actions} />
                      </div>
                    ))}
                  </div>

                  <div className="screen-card-footer">
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={() =>
                        onUpdateScript((current) => {
                          const nextGroup = {
                            ...group,
                            screens: group.screens.map((entry) =>
                              entry.id === screen.id ? { ...entry, videoCards: [...entry.videoCards, createVideoCard()] } : entry
                            )
                          };
                          return syncPodsForVideoGroup(current, nextGroup);
                        })
                      }
                    >
                      + 添加动作
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
