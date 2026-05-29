import { useMemo, useState } from "react";
import ActionMediaPreview, { type ActionMediaPreviewAction } from "../../components/ActionMediaPreview.tsx";
import ActionPicker from "../../components/ActionPicker.tsx";
import Dialog from "../../components/Dialog.tsx";
import { createVideoCard, createVideoGroupScreen } from "../../models/course/factories.ts";
import { buildVideoRows, getVideoRowCapacity, normalizeVideoRowLayouts } from "../../models/course/videoRows.ts";
import type { VideoCard, VideoGroup, VideoGroupScreenCount, VideoRowLayout } from "../../models/course/types.ts";
import type { TemplateDraft } from "../../models/templates.ts";
import type { TypeOption } from "../../services/api/meta.ts";
import { stationInputValue } from "../../utils/station.ts";
import { displayTypeName } from "../../utils/typeNames.ts";

type VideoGroupScreen = VideoGroup["screens"][number];

interface VideoSlotDialogState {
  screenId: string;
  slotIndex: number;
  actionId: string;
  stationNumber: string;
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

export default function TrainingTemplateEditor({
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
  const [slotDialog, setSlotDialog] = useState<VideoSlotDialogState | null>(null);

  if (draft.kind !== "training" || !draft.videoGroup) {
    return null;
  }

  function updateScreen(screenId: string, updater: (screen: VideoGroupScreen, group: VideoGroup) => VideoGroupScreen) {
    onUpdateDraft((current) => {
      if (!current.videoGroup) return current;
      const nextGroup = {
        ...current.videoGroup,
        screens: current.videoGroup.screens.map((screen) =>
          screen.id === screenId ? normalizeScreenForUpdate(updater(screen, current.videoGroup!), current.videoGroup!.screenCount) : screen
        )
      };
      return { ...current, videoGroup: nextGroup };
    });
  }

  function updateRowLayout(screenId: string, rowIndex: number, columns: VideoRowLayout) {
    setSlotDialog(null);
    updateScreen(screenId, (screen, group) => {
      const firstRows = normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount).slice(0, 3) as VideoRowLayout[];
      const targetRowIndex = rowIndex < 3 ? rowIndex : 2;
      firstRows[targetRowIndex] = columns;
      return { ...screen, rowLayouts: normalizeVideoRowLayouts(firstRows, group.screenCount) };
    });
  }

  function openSlotDialog(screen: VideoGroupScreen, slotIndex: number, card?: VideoCard) {
    setSlotDialog({
      screenId: screen.id,
      slotIndex,
      actionId: card?.actionId || "",
      stationNumber: card?.stationNumber || ""
    });
  }

  function confirmSlotDialog(actionId: string, stationNumber: string) {
    if (!slotDialog) return;
    const nextAction = findAction(actions, actionId);
    updateScreen(slotDialog.screenId, (screen, group) => {
      const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, group.screenCount);
      const nextCards = fitVideoCardsForRows(screen.videoCards || [], rowLayouts, group.screenCount);
      const currentCard = nextCards[slotDialog.slotIndex] || createVideoCard();
      nextCards[slotDialog.slotIndex] = {
        ...currentCard,
        actionId,
        actionName: nextAction?.name || "",
        stationNumber: stationInputValue(stationNumber)
      };
      return { ...screen, rowLayouts, videoCards: nextCards };
    });
    setSlotDialog(null);
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
                        ? normalizeScreenForUpdate(
                            {
                              ...existingScreen,
                              stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
                              layout: screenCount === 1 ? "WATERFALL" : "STATIONS",
                              rowLayouts: normalizeVideoRowLayouts(existingScreen.rowLayouts, screenCount)
                            },
                            screenCount
                          )
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

            {draft.videoGroup?.screenCount === 3 ? (
              <div className="screen-video-rows">
                {buildVideoSlotRows(screen, draft.videoGroup.screenCount).map((row) => (
                  <div key={`${screen.id}-row-${row.index}`} className={`screen-video-row is-${row.columns}`}>
                    <div className="screen-video-row-head">
                      <span>第 {row.index + 1} 行</span>
                      <div className="row-layout-toggle" aria-label={`第 ${row.index + 1} 行视频数量`}>
                        <button
                          type="button"
                          className={row.columns === 1 ? "is-active" : ""}
                          onClick={() => updateRowLayout(screen.id, row.index, 1)}
                        >
                          1
                        </button>
                        <button
                          type="button"
                          className={row.columns === 2 ? "is-active" : ""}
                          onClick={() => updateRowLayout(screen.id, row.index, 2)}
                        >
                          2
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
                            className={`screen-video-slot-card ${card?.actionId || card?.stationNumber ? "has-action" : "is-empty"}`}
                            onClick={() => openSlotDialog(screen, slotIndex, card)}
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
                                  <span className="screen-video-slot-hint">点击这里修改</span>
                                </div>
                              </>
                            ) : (
                              <div className="screen-video-slot-empty-copy">
                                {card?.stationNumber ? <span className="screen-video-slot-station">站点 {card.stationNumber}</span> : null}
                                <strong>点击这里选动作</strong>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="stack-list">
                  {screen.videoCards.map((card, cardIndex) => (
                    <div key={card.id} className="stack-row compact card-row">
                      <div className="stack-row-main">
                        <label className="field grow action-field">
                          <span>动作位 {cardIndex + 1}</span>
                          <ActionPicker
                            value={card.actionId}
                            actions={actions}
                            actionTypes={actionTypes}
                            placeholder="先留空，课程里再选动作"
                            emptyLabel="保留空动作位"
                            onChange={(actionId, actionName) =>
                              updateScreen(screen.id, (entry) => ({
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
                            }
                          />
                        </label>

                        <button
                          type="button"
                          className="table-link danger"
                          onClick={() =>
                            updateScreen(screen.id, (entry) => {
                              const nextCards = entry.videoCards.filter((videoCard) => videoCard.id !== card.id);
                              return { ...entry, videoCards: nextCards.length ? nextCards : [createVideoCard()] };
                            })
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
                      updateScreen(screen.id, (entry) => ({ ...entry, videoCards: [...entry.videoCards, createVideoCard()] }))
                    }
                  >
                    + 添加动作
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {slotDialog ? (
        <VideoSlotDialog
          key={`${slotDialog.screenId}-${slotDialog.slotIndex}`}
          actions={actions}
          actionTypes={actionTypes}
          initialActionId={slotDialog.actionId}
          initialStationNumber={slotDialog.stationNumber}
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
  onClose,
  onConfirm
}: {
  actions: ActionMediaPreviewAction[];
  actionTypes: TypeOption[];
  initialActionId: string;
  initialStationNumber: string;
  onClose: () => void;
  onConfirm: (actionId: string, stationNumber: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [courseTag, setCourseTag] = useState("");
  const [draftActionId, setDraftActionId] = useState(initialActionId || "");
  const [draftStationNumber, setDraftStationNumber] = useState(initialStationNumber || "");

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

  return (
    <Dialog
      title="编辑动作位"
      width={1120}
      onClose={onClose}
      onConfirm={() => onConfirm(draftActionId, draftStationNumber)}
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
            <p>{draftStationNumber ? `站点 ${draftStationNumber}` : "未填写站点"}</p>
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
