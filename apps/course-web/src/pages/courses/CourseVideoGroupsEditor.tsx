import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import ActionPicker from "../../components/ActionPicker.tsx";
import type { CourseScript, VideoGroup, VideoRowLayout } from "../../models/course/types.ts";
import { createVideoCard, createVideoGroup, createVideoGroupScreen } from "../../models/course/factories.ts";
import { buildVideoRows, normalizeVideoRowLayouts } from "../../models/course/videoRows.ts";
import type { TypeOption } from "../../services/api/meta.ts";

export default function CourseVideoGroupsEditor({
  script,
  actions,
  actionTypes,
  onUseTemplate,
  onUpdateScript,
  syncPodsForVideoGroup,
  onRemoveGroup,
  onNotice
}: {
  script: CourseScript;
  actions: ActionMediaPreviewAction[];
  actionTypes: TypeOption[];
  onUseTemplate: (group: VideoGroup) => void;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
  syncPodsForVideoGroup: (script: CourseScript, nextGroup: VideoGroup) => CourseScript;
  onRemoveGroup: (groupId: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
}) {
  function updateScreen(
    group: VideoGroup,
    screenIndex: number,
    updater: (screen: VideoGroup["screens"][number], group: VideoGroup) => VideoGroup["screens"][number]
  ) {
    return (current: CourseScript) => {
      const currentGroup = current.training.videoGroups.find((entry) => entry.id === group.id) || group;
      const nextGroup = {
        ...currentGroup,
        screens: currentGroup.screens.map((entry) => {
          if (entry.screenIndex !== screenIndex) return entry;
          const nextScreen = updater(entry, currentGroup);
          return {
            ...nextScreen,
            rowLayouts: normalizeVideoRowLayouts(nextScreen.rowLayouts, nextScreen.videoCards, currentGroup.screenCount)
          };
        })
      };
      return syncPodsForVideoGroup(current, nextGroup);
    };
  }

  function updateRowLayout(group: VideoGroup, screenIndex: number, rowIndex: number, columns: VideoRowLayout) {
    onUpdateScript(
      updateScreen(group, screenIndex, (screen) => {
        const nextRows = normalizeVideoRowLayouts(screen.rowLayouts, screen.videoCards, group.screenCount);
        nextRows[rowIndex] = columns;
        return { ...screen, rowLayouts: nextRows };
      })
    );
  }

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
                              layout: nextScreenCount === 1 ? "WATERFALL" : "STATIONS",
                              rowLayouts: normalizeVideoRowLayouts(existingScreen.rowLayouts, existingScreen.videoCards, nextScreenCount)
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
                    {group.screenCount === 3 ? (
                      <div className="screen-card-actions">
                        <button
                          type="button"
                          className="ghost-button small"
                          onClick={() =>
                            onUpdateScript(
                              updateScreen(group, screen.screenIndex, (entry) => ({
                                ...entry,
                                rowLayouts: Array.from(
                                  { length: Math.ceil(Math.max(entry.videoCards.length, 1) / 2) },
                                  () => 2 as VideoRowLayout
                                )
                              }))
                            )
                          }
                        >
                          全部双列
                        </button>
                        <button
                          type="button"
                          className="ghost-button small"
                          onClick={() =>
                            onUpdateScript(
                              updateScreen(group, screen.screenIndex, (entry) => ({
                                ...entry,
                                rowLayouts: Array.from({ length: Math.max(entry.videoCards.length, 1) }, () => 1 as VideoRowLayout)
                              }))
                            )
                          }
                        >
                          全部单列
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="screen-video-rows">
                    {buildVideoRows(screen, group.screenCount).map((row) => (
                      <div key={`${screen.id}-row-${row.index}`} className={`screen-video-row is-${row.columns}`}>
                        {group.screenCount === 3 ? (
                          <div className="screen-video-row-head">
                            <span>第 {row.index + 1} 行</span>
                            <div className="row-layout-toggle" aria-label={`第 ${row.index + 1} 行视频数量`}>
                              <button
                                type="button"
                                className={row.columns === 1 ? "is-active" : ""}
                                onClick={() => updateRowLayout(group, screen.screenIndex, row.index, 1)}
                              >
                                1 个
                              </button>
                              <button
                                type="button"
                                className={row.columns === 2 ? "is-active" : ""}
                                onClick={() => updateRowLayout(group, screen.screenIndex, row.index, 2)}
                              >
                                2 个
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className={`screen-video-grid is-${row.columns}`}>
                          {row.cards.map((card, rowCardIndex) => {
                            const cardIndex = screen.videoCards.findIndex((entry) => entry.id === card.id);
                            const displayIndex = cardIndex >= 0 ? cardIndex : row.index + rowCardIndex;
                            return (
                              <div key={card.id} className="screen-video-edit-card">
                        <div className="screen-video-edit-toolbar">
                          <div className="screen-video-action-title">动作 {displayIndex + 1}</div>
                          <ActionPicker
                            value={card.actionId}
                            actions={actions}
                            actionTypes={actionTypes}
                            onChange={(actionId, actionName) =>
                              onUpdateScript(
                                updateScreen(group, screen.screenIndex, (entry) => ({
                                  ...entry,
                                  videoCards: entry.videoCards.map((videoCard) =>
                                    videoCard.id === card.id
                                      ? {
                                          ...videoCard,
                                          actionId,
                                          actionName
                                        }
                                      : videoCard
                                  )
                                }))
                              )
                            }
                          />

                          {group.screenCount === 3 ? (
                            <label className="field station-field">
                              <span>站点</span>
                              <input
                                type="text"
                                value={card.stationNumber}
                                placeholder="1 / A / 1A"
                                onChange={(event) =>
                                  onUpdateScript(
                                    updateScreen(group, screen.screenIndex, (entry) => ({
                                      ...entry,
                                      videoCards: entry.videoCards.map((videoCard) =>
                                        videoCard.id === card.id ? { ...videoCard, stationNumber: event.target.value } : videoCard
                                      )
                                    }))
                                  )
                                }
                              />
                            </label>
                          ) : null}

                          <button
                            type="button"
                            className="table-link danger"
                            onClick={() =>
                              onUpdateScript(
                                updateScreen(group, screen.screenIndex, (entry) => {
                                  const nextCards = entry.videoCards.filter((videoCard) => videoCard.id !== card.id);
                                  return {
                                    ...entry,
                                    videoCards: nextCards.length ? nextCards : [createVideoCard()]
                                  };
                                })
                              )
                            }
                          >
                            删除
                          </button>
                        </div>

                        <div className="screen-video-preview-shell">
                          <div className="screen-video-index">{card.stationNumber || displayIndex + 1}</div>
                          <ActionMediaPreview actionId={card.actionId} actions={actions} compact />
                        </div>
                      </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="screen-card-footer">
                    <button
                      type="button"
                      className="ghost-button small"
                      onClick={() =>
                        onUpdateScript(
                          updateScreen(group, screen.screenIndex, (entry) => ({
                            ...entry,
                            videoCards: [...entry.videoCards, createVideoCard()]
                          }))
                        )
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
