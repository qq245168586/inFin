import { useMemo, useState } from "react";
import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import ActionPicker from "../../components/ActionPicker.tsx";
import Dialog from "../../components/Dialog.tsx";
import type { CourseScript, VideoCard, VideoGroup, VideoGroupScreenCount, VideoRowLayout } from "../../models/course/types.ts";
import { createVideoCard, createVideoGroup, createVideoGroupScreen } from "../../models/course/factories.ts";
import { buildVideoRows, getVideoRowCapacity, normalizeVideoRowLayouts } from "../../models/course/videoRows.ts";
import type { TypeOption } from "../../services/api/meta.ts";
import { stationInputValue } from "../../utils/station.ts";
import { displayTypeName } from "../../utils/typeNames.ts";

type VideoGroupScreen = VideoGroup["screens"][number];

interface VideoSlotDialogState {
  groupId: string;
  screenIndex: number;
  slotIndex: number;
  actionId: string;
  stationNumber: string;
  target: string;
}

function normalizeSearch(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function findAction(actions: ActionMediaPreviewAction[], actionId: string): ActionMediaPreviewAction | null {
  return actions.find((item) => String(item.id) === String(actionId)) ?? null;
}

function findActionName(actions: ActionMediaPreviewAction[], actionId: string): string {
  return findAction(actions, actionId)?.name || "";
}

function normalizeTarget(value: string): string {
  return String(value || "").trim();
}

function fitVideoCardsForRows(
  cards: VideoCard[],
  rowLayouts: VideoRowLayout[],
  screenCount: VideoGroupScreenCount
): VideoCard[] {
  if (screenCount === 1) {
    return cards.length ? cards : [createVideoCard()];
  }

  const capacity = getVideoRowCapacity(rowLayouts);
  const nextCards = cards.slice(0, capacity);
  while (nextCards.length < capacity) {
    nextCards.push(createVideoCard());
  }
  return nextCards;
}

function normalizeScreenForUpdate(screen: VideoGroupScreen, screenCount: VideoGroupScreenCount): VideoGroupScreen {
  const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, screenCount);
  return {
    ...screen,
    rowLayouts,
    videoCards: fitVideoCardsForRows(screen.videoCards || [], rowLayouts, screenCount)
  };
}

function buildVideoSlotRows(screen: VideoGroupScreen, screenCount: VideoGroupScreenCount) {
  const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, screenCount);
  let slotIndex = 0;

  return rowLayouts.map((columns, rowIndex) => {
    const slots = Array.from({ length: columns }, () => {
      const currentSlot = slotIndex;
      slotIndex += 1;
      return {
        slotIndex: currentSlot,
        card: screen.videoCards[currentSlot]
      };
    });

    return { index: rowIndex, columns, slots };
  });
}

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
  const [slotDialog, setSlotDialog] = useState<VideoSlotDialogState | null>(null);

  function updateScreen(
    group: VideoGroup,
    screenIndex: number,
    updater: (screen: VideoGroupScreen, group: VideoGroup) => VideoGroupScreen
  ) {
    return (current: CourseScript) => {
      const currentGroup = current.training.videoGroups.find((entry) => entry.id === group.id) || group;
      const nextGroup = {
        ...currentGroup,
        screens: currentGroup.screens.map((entry) => {
          if (entry.screenIndex !== screenIndex) return entry;
          return normalizeScreenForUpdate(updater(entry, currentGroup), currentGroup.screenCount);
        })
      };
      return syncPodsForVideoGroup(current, nextGroup);
    };
  }

  function updateRowLayout(group: VideoGroup, screenIndex: number, rowIndex: number, columns: VideoRowLayout) {
    setSlotDialog(null);
    onUpdateScript(
      updateScreen(group, screenIndex, (screen) => {
        const nextRows = normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount);
        const rowStart = nextRows.slice(0, rowIndex).reduce((total, rowColumns) => total + rowColumns, 0);
        const currentColumns = nextRows[rowIndex] || columns;
        const nextCards = [...screen.videoCards];

        if (columns > currentColumns) {
          nextCards.splice(rowStart + currentColumns, 0, createVideoCard());
        }
        if (columns < currentColumns) {
          nextCards.splice(rowStart + columns, currentColumns - columns);
        }

        nextRows[rowIndex] = columns;
        const normalizedRows = normalizeVideoRowLayouts(nextRows, group.screenCount);
        return { ...screen, rowLayouts: normalizedRows, videoCards: fitVideoCardsForRows(nextCards, normalizedRows, group.screenCount) };
      })
    );
  }

  function addRowLayout(group: VideoGroup, screenIndex: number) {
    setSlotDialog(null);
    onUpdateScript(
      updateScreen(group, screenIndex, (screen) => {
        const currentRows = normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount);
        if (currentRows.length >= 5) return screen;
        const nextRows = normalizeVideoRowLayouts([...currentRows, 1], group.screenCount);
        return { ...screen, rowLayouts: nextRows, videoCards: fitVideoCardsForRows(screen.videoCards || [], nextRows, group.screenCount) };
      })
    );
  }

  function deleteRowLayout(group: VideoGroup, screenIndex: number, rowIndex: number) {
    setSlotDialog(null);
    onUpdateScript(
      updateScreen(group, screenIndex, (screen) => {
        const currentRows = normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount);
        if (currentRows.length <= 1) return screen;
        const rowStart = currentRows.slice(0, rowIndex).reduce((total, rowColumns) => total + rowColumns, 0);
        const rowColumns = currentRows[rowIndex] || 1;
        const nextCards = screen.videoCards.filter((_, index) => index < rowStart || index >= rowStart + rowColumns);
        return { ...screen, rowLayouts: currentRows.filter((_, index) => index !== rowIndex), videoCards: nextCards };
      })
    );
  }

  function openSlotDialog(group: VideoGroup, screen: VideoGroupScreen, slotIndex: number, card?: VideoCard) {
    setSlotDialog({
      groupId: group.id,
      screenIndex: screen.screenIndex,
      slotIndex,
      actionId: card?.actionId || "",
      stationNumber: card?.stationNumber || "",
      target: card?.target || ""
    });
  }

  function confirmSlotDialog(actionId: string, stationNumber: string, target: string) {
    if (!slotDialog) return;

    const group = script.training.videoGroups.find((entry) => entry.id === slotDialog.groupId);
    if (!group) {
      setSlotDialog(null);
      return;
    }

    const nextAction = findAction(actions, actionId);
    onUpdateScript(
      updateScreen(group, slotDialog.screenIndex, (screen) => {
        const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount);
        const nextCards = fitVideoCardsForRows(screen.videoCards || [], rowLayouts, group.screenCount);
        const currentCard = nextCards[slotDialog.slotIndex] || createVideoCard();
        nextCards[slotDialog.slotIndex] = {
          ...currentCard,
          actionId,
          actionName: nextAction?.name || "",
          stationNumber: stationInputValue(stationNumber),
          target: normalizeTarget(target)
        };
        return { ...screen, rowLayouts, videoCards: nextCards };
      })
    );
    setSlotDialog(null);
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
                          ? normalizeScreenForUpdate(
                              {
                                ...existingScreen,
                                stationLabel: nextScreenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
                                layout: nextScreenCount === 1 ? "WATERFALL" : "STATIONS",
                                rowLayouts: normalizeVideoRowLayouts(existingScreen.rowLayouts, nextScreenCount)
                              },
                              nextScreenCount
                            )
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

                  {group.screenCount === 3 ? (
                    <div className="screen-video-rows">
                      {buildVideoSlotRows(screen, group.screenCount).map((row) => (
                        <div key={`${screen.id}-row-${row.index}`} className={`screen-video-row is-${row.columns}`}>
                          <div className="screen-video-row-head">
                            <span>第 {row.index + 1} 行</span>
                            <div className="screen-video-row-actions">
                              <div className="row-layout-toggle" aria-label={`第 ${row.index + 1} 行视频数量`}>
                                <button
                                  type="button"
                                  className={row.columns === 1 ? "is-active" : ""}
                                  onClick={() => updateRowLayout(group, screen.screenIndex, row.index, 1)}
                                >
                                  1
                                </button>
                                <button
                                  type="button"
                                  className={row.columns === 2 ? "is-active" : ""}
                                  onClick={() => updateRowLayout(group, screen.screenIndex, row.index, 2)}
                                >
                                  2
                                </button>
                              </div>
                              <button
                                type="button"
                                className="row-delete-button"
                                disabled={normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount).length <= 1}
                                onClick={() => deleteRowLayout(group, screen.screenIndex, row.index)}
                              >
                                删除
                              </button>
                            </div>
                          </div>

                          <div className={`screen-video-grid is-${row.columns}`}>
                            {row.slots.map(({ card, slotIndex }) => {
                              const actionName = card?.actionName || findActionName(actions, card?.actionId || "");
                              return (
                                <button
                                  key={`${screen.id}-slot-${slotIndex}`}
                                  type="button"
                                  className={`screen-video-slot-card ${
                                    card?.actionId || card?.stationNumber || card?.target ? "has-action" : "is-empty"
                                  }`}
                                  onClick={() => openSlotDialog(group, screen, slotIndex, card)}
                                >
                                  {actionName ? (
                                    <>
                                      <div className="screen-video-slot-preview">
                                        <ActionMediaPreview
                                          actionId={card?.actionId || ""}
                                          actions={actions}
                                          compact
                                          interactive={false}
                                          autoPlayPreview
                                        />
                                      </div>
                                      <div className="screen-video-slot-overlay">
                                        {card?.stationNumber ? (
                                          <span className="screen-video-slot-station">站点 {card.stationNumber}</span>
                                        ) : null}
                                        <strong>{actionName}</strong>
                                        {card?.target ? <span className="screen-video-slot-target">目标 {card.target}</span> : null}
                                        <span className="screen-video-slot-hint">点击这里修改</span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="screen-video-slot-empty-copy">
                                      {card?.stationNumber ? <span className="screen-video-slot-station">站点 {card.stationNumber}</span> : null}
                                      {card?.target ? <span className="screen-video-slot-target">目标 {card.target}</span> : null}
                                      <strong>点击这里选动作</strong>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount).length < 5 ? (
                        <button
                          type="button"
                          className="row-add-button"
                          onClick={() => addRowLayout(group, screen.screenIndex)}
                        >
                          + 添加行
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="screen-video-rows">
                      {buildVideoRows(screen, group.screenCount).map((row) => (
                        <div key={`${screen.id}-row-${row.index}`} className={`screen-video-row is-${row.columns}`}>
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
                                                    actionName,
                                                    target: videoCard.target || ""
                                                  }
                                                : videoCard
                                            )
                                          }))
                                        )
                                      }
                                    />

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

                                  <label className="field video-card-target-field">
                                    <span>目标</span>
                                    <input
                                      value={card.target || ""}
                                      onChange={(event) =>
                                        onUpdateScript(
                                          updateScreen(group, screen.screenIndex, (entry) => ({
                                            ...entry,
                                            videoCards: entry.videoCards.map((videoCard) =>
                                              videoCard.id === card.id ? { ...videoCard, target: normalizeTarget(event.target.value) } : videoCard
                                            )
                                          }))
                                        )
                                      }
                                      placeholder="12 次 / 300m / 20 cal"
                                    />
                                  </label>

                                  <div className="screen-video-preview-shell">
                                    <ActionMediaPreview actionId={card.actionId} actions={actions} compact />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {group.screenCount === 1 ? (
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
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {slotDialog ? (
        <VideoSlotDialog
          key={`${slotDialog.groupId}-${slotDialog.screenIndex}-${slotDialog.slotIndex}`}
          actions={actions}
          actionTypes={actionTypes}
          initialActionId={slotDialog.actionId}
          initialStationNumber={slotDialog.stationNumber}
          initialTarget={slotDialog.target}
          onClose={() => setSlotDialog(null)}
          onConfirm={confirmSlotDialog}
        />
      ) : null}
    </div>
  );
}

function VideoSlotDialog({
  actions,
  actionTypes,
  initialActionId,
  initialStationNumber,
  initialTarget,
  onClose,
  onConfirm
}: {
  actions: ActionMediaPreviewAction[];
  actionTypes: TypeOption[];
  initialActionId: string;
  initialStationNumber: string;
  initialTarget: string;
  onClose: () => void;
  onConfirm: (actionId: string, stationNumber: string, target: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [courseTag, setCourseTag] = useState("");
  const [draftActionId, setDraftActionId] = useState(initialActionId || "");
  const [draftStationNumber, setDraftStationNumber] = useState(initialStationNumber || "");
  const [draftTarget, setDraftTarget] = useState(initialTarget || "");

  const draftAction = findAction(actions, draftActionId);
  const typeNameById = useMemo(() => new Map(actionTypes.map((item) => [Number(item.id), displayTypeName(item.name)])), [actionTypes]);
  const courseTagOptions = useMemo(
    () => [...new Set(actions.flatMap((action) => action.courseTags || []).map((tag) => String(tag || "").trim()).filter(Boolean))].sort(),
    [actions]
  );

  const filteredActions = useMemo(() => {
    const keyword = normalizeSearch(search);
    const selectedTypeId = typeId ? Number(typeId) : null;
    const selectedCourseTag = normalizeSearch(courseTag);

    return actions.filter((action) => {
      const matchesName = !keyword || normalizeSearch(action.name).includes(keyword);
      const matchesType = !selectedTypeId || (action.typeIds || []).some((id) => Number(id) === selectedTypeId);
      const matchesCourseTag =
        !selectedCourseTag || (action.courseTags || []).some((tag) => normalizeSearch(tag) === selectedCourseTag);
      return matchesName && matchesType && matchesCourseTag;
    });
  }, [actions, search, typeId, courseTag]);

  function resetFilters() {
    setSearch("");
    setTypeId("");
    setCourseTag("");
  }

  return (
    <Dialog
      title="编辑动作位"
      width={1120}
      onClose={onClose}
      onConfirm={() => onConfirm(draftActionId, draftStationNumber, draftTarget)}
      confirmText="确认"
    >
      <div className="action-picker-modal video-slot-modal">
        <section className="action-picker-search-card">
          <div className="action-picker-filters">
            <label className="action-picker-filter video-slot-station-field">
              <span>站点</span>
              <input
                value={draftStationNumber}
                onChange={(event) => setDraftStationNumber(event.target.value)}
                placeholder="1 / A / 1A"
                autoFocus
              />
            </label>
            <label className="action-picker-filter video-slot-target-field">
              <span>目标</span>
              <input
                value={draftTarget}
                onChange={(event) => setDraftTarget(event.target.value)}
                placeholder="12 次 / 300m / 20 cal"
              />
            </label>
            <label className="action-picker-filter">
              <span>动作名称</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入名称关键字" />
            </label>
            <label className="action-picker-filter">
              <span>动作类型</span>
              <select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                <option value="">全部类型</option>
                {actionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {displayTypeName(type.name)}
                  </option>
                ))}
              </select>
            </label>
            {courseTagOptions.length ? (
              <label className="action-picker-filter">
                <span>课程标签</span>
                <select value={courseTag} onChange={(event) => setCourseTag(event.target.value)}>
                  <option value="">全部标签</option>
                  {courseTagOptions.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="action-picker-toolbar">
            <button type="button" className="action-picker-mini-button" onClick={resetFilters}>
              重置筛选
            </button>
            <span>{filteredActions.length} 个结果</span>
          </div>

          <div className="action-picker-options">
            <button type="button" className={`action-picker-option ${!draftActionId ? "is-selected" : ""}`} onClick={() => setDraftActionId("")}>
              <strong>清空动作</strong>
              <span>这个动作位暂时不绑定视频</span>
            </button>

            {filteredActions.length ? (
              filteredActions.map((action) => {
                const typeNames = (action.typeIds || [])
                  .map((id) => typeNameById.get(Number(id)))
                  .filter(Boolean)
                  .join(" / ");
                const courseTags = (action.courseTags || []).join(" / ");

                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`action-picker-option ${String(action.id) === String(draftActionId) ? "is-selected" : ""}`}
                    onClick={() => setDraftActionId(String(action.id))}
                  >
                    <strong>{action.name}</strong>
                    <span>{[typeNames || "未分类", courseTags].filter(Boolean).join(" · ")}</span>
                  </button>
                );
              })
            ) : (
              <div className="action-picker-empty">没有匹配动作，可以换一个名称或类型。</div>
            )}
          </div>
        </section>

        <section className="action-picker-preview-card">
          <div>
            <span className="eyebrow">VIDEO SLOT</span>
            <h3>{draftAction?.name || "未选择动作"}</h3>
            <p>{[draftStationNumber ? `站点 ${draftStationNumber}` : "未填写站点", draftTarget ? `目标 ${draftTarget}` : ""].filter(Boolean).join(" · ")}</p>
          </div>
          <ActionMediaPreview
            actionId={draftActionId}
            actions={actions}
            emptyCopy="在左侧选择动作后，可以先确认视频内容。"
            interactive={false}
            autoPlayPreview
          />
        </section>
      </div>
    </Dialog>
  );
}
