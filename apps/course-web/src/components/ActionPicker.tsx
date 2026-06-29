import { useMemo, useState } from "react";
import ActionMediaPreview, { type ActionMediaPreviewAction } from "./ActionMediaPreview.tsx";
import Dialog from "./Dialog.tsx";
import type { TypeOption } from "../services/api/meta.ts";
import { displayTypeName } from "../utils/typeNames.ts";
import { useI18n } from "../providers/I18nProvider.tsx";

function normalizeSearch(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function findActionName(actions: ActionMediaPreviewAction[], actionId: string): string {
  return actions.find((item) => String(item.id) === String(actionId))?.name || "";
}

function findAction(actions: ActionMediaPreviewAction[], actionId: string): ActionMediaPreviewAction | null {
  return actions.find((item) => String(item.id) === String(actionId)) ?? null;
}

export default function ActionPicker({
  value,
  actions,
  actionTypes,
  placeholder = "请选择动作",
  emptyLabel = "清空选择",
  onChange
}: {
  value: string;
  actions: ActionMediaPreviewAction[];
  actionTypes: TypeOption[];
  placeholder?: string;
  emptyLabel?: string;
  onChange: (actionId: string, actionName: string) => void;
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [courseTag, setCourseTag] = useState("");
  const [draftActionId, setDraftActionId] = useState(value || "");

  const selectedName = findActionName(actions, value);
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

  function openDialog() {
    setDraftActionId(value || "");
    setIsOpen(true);
  }

  function resetFilters() {
    setSearch("");
    setTypeId("");
    setCourseTag("");
  }

  function confirmSelection() {
    const nextAction = findAction(actions, draftActionId);
    setIsOpen(false);
    onChange(draftActionId, nextAction?.name || "");
  }

  return (
    <div className="action-picker">
      <button type="button" className={`action-picker-trigger ${value ? "has-value" : ""}`} onClick={openDialog}>
        <span>{selectedName || t(placeholder)}</span>
        <strong>{t("选择")}</strong>
      </button>

      {isOpen ? (
        <Dialog title={t("选择动作")} width={1080} onClose={() => setIsOpen(false)} onConfirm={confirmSelection} confirmText={draftActionId ? t("选择动作") : t(emptyLabel)}>
          <div className="action-picker-modal">
            <section className="action-picker-search-card">
              <div className="action-picker-filters">
                <label className="action-picker-filter">
                  <span>{t("动作名称")}</span>
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("输入名称关键字")} autoFocus />
                </label>
                <label className="action-picker-filter">
                  <span>{t("动作类型")}</span>
                  <select value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                    <option value="">{t("全部类型")}</option>
                    {actionTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {displayTypeName(type.name)}
                      </option>
                    ))}
                  </select>
                </label>
                {courseTagOptions.length ? (
                  <label className="action-picker-filter">
                    <span>{t("课程标签")}</span>
                    <select value={courseTag} onChange={(event) => setCourseTag(event.target.value)}>
                      <option value="">{t("全部标签")}</option>
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
                  {t("重置筛选")}
                </button>
                <span>{filteredActions.length} {t("个结果")}</span>
              </div>

              <div className="action-picker-options">
                <button type="button" className={`action-picker-option ${!draftActionId ? "is-selected" : ""}`} onClick={() => setDraftActionId("")}>
                  <strong>{t(emptyLabel)}</strong>
                  <span>{t("不绑定动作")}</span>
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
                        <span>{[typeNames || t("未分类"), courseTags].filter(Boolean).join(" · ")}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="action-picker-empty">{t("没有匹配动作，可以换一个名称或类型。")}</div>
                )}
              </div>
            </section>

            <section className="action-picker-preview-card">
              <div>
                <span className="eyebrow">VIDEO PREVIEW</span>
                <h3>{draftAction?.name || t("未选择动作")}</h3>
              </div>
              <ActionMediaPreview
                actionId={draftActionId}
                actions={actions}
                emptyCopy={t("在左侧选择动作后，可以先确认视频内容。")}
                autoPlayPreview
              />
            </section>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
