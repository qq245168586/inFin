import { useMemo, useState } from "react";
import ActionsPage from "../ActionsPage.tsx";
import type { ActionRecord, TypeOption } from "../../services/api/meta.ts";
import { requestJson } from "../../services/requestJson.ts";
import { uploadBinary } from "../../services/uploadBinary.ts";
import { triggerFileInput } from "../../utils/dom.ts";
import { getErrorMessage } from "../../utils/errors.ts";
import { uid } from "../../utils/uid.ts";
import { displayTypeName, stripMediaSuffix } from "../../utils/typeNames.ts";
import { useMeta } from "../../providers/MetaProvider.tsx";
import { useBusy } from "../../providers/BusyProvider.tsx";
import { useNotice } from "../../providers/NoticeProvider.tsx";
import type { CoursePackageRecord } from "../venues/types.ts";
import { filterCoursesByCoursePackage } from "../../utils/coursePackageScope.ts";
import type { CourseRecord, CourseScript } from "../../models/course/types.ts";

interface FilterState {
  search: string;
  typeIds: number[];
}

interface ActionDraft {
  id: number | null;
  name: string;
  typeIds: number[];
  media: ActionRecord["media"] | null;
  uploadFile: File | null;
  previewUrl: string;
}

interface BatchUploadItem {
  id: string;
  file: File;
  fileName: string;
  actionName: string;
  rawTypeName: string;
  resolvedTypeId: number | null;
  resolvedTypeName: string;
  needsCreateType: boolean;
  status: "ready" | "invalid";
  message: string;
}

interface BatchUploadDialogState {
  items: BatchUploadItem[];
}

function normalizeBatchKey(value: string): string {
  return stripMediaSuffix(value)
    .toLowerCase()
    .replace(/\\s+/g, "");
}

function buildActionTypeLookup(actionTypes: TypeOption[]): Map<string, TypeOption> {
  const lookup = new Map<string, TypeOption>();
  actionTypes.forEach((type) => {
    lookup.set(normalizeBatchKey(type.name), type);
  });
  return lookup;
}

function formatGeneratedTypeName(rawTypeName: string): string {
  const cleaned = stripMediaSuffix(rawTypeName);
  if (!cleaned) return "未命名";
  return cleaned.length > 20 ? cleaned.slice(0, 20) : cleaned;
}

function createBatchUploadItem(file: File, actionTypes: TypeOption[]): BatchUploadItem {
  const rawName = file.name.replace(/\\.[^.]+$/, "");
  const separatorIndex = rawName.indexOf("-");

  if (separatorIndex <= 0) {
    return {
      id: uid("batch"),
      file,
      fileName: file.name,
      actionName: "",
      rawTypeName: "",
      resolvedTypeId: null,
      resolvedTypeName: "",
      needsCreateType: false,
      status: "invalid",
      message: "文件名需按“动作-类型”命名，例如：划船-hyrox.mp4"
    };
  }

  const actionName = stripMediaSuffix(rawName.slice(0, separatorIndex));
  const rawTypeName = stripMediaSuffix(rawName.slice(separatorIndex + 1));

  if (!actionName || !rawTypeName) {
    return {
      id: uid("batch"),
      file,
      fileName: file.name,
      actionName,
      rawTypeName,
      resolvedTypeId: null,
      resolvedTypeName: "",
      needsCreateType: false,
      status: "invalid",
      message: "动作名和类型都不能为空。"
    };
  }

  const typeLookup = buildActionTypeLookup(actionTypes);
  const matchedType = typeLookup.get(normalizeBatchKey(rawTypeName)) || null;
  const resolvedTypeName = matchedType ? matchedType.name : formatGeneratedTypeName(rawTypeName);

  return {
    id: uid("batch"),
    file,
    fileName: file.name,
    actionName,
    rawTypeName,
    resolvedTypeId: matchedType?.id ?? null,
    resolvedTypeName,
    needsCreateType: !matchedType,
    status: "ready",
    message: matchedType ? "将自动创建动作。" : `未找到现有分类，将自动创建“${resolvedTypeName}”。`
  };
}

function findExistingActionForBatch(actions: ActionRecord[], actionName: string, typeId: number): ActionRecord | null {
  const normalizedName = normalizeBatchKey(actionName);
  return actions.find((item) => normalizeBatchKey(item.name) === normalizedName && item.typeIds.includes(typeId)) ?? null;
}

function createActionDraft(action: ActionRecord | null = null): ActionDraft {
  return {
    id: action?.id ?? null,
    name: action?.name ?? "",
    typeIds: [...(action?.typeIds ?? [])],
    media: action?.media ?? null,
    uploadFile: null,
    previewUrl: action?.media?.url ?? ""
  };
}

function matchesTypeFilter(sourceIds: number[], selectedIds: number[]): boolean {
  return selectedIds.length === 0 || selectedIds.some((id) => sourceIds.includes(id));
}

function collectActionIdsFromCourseScript(script?: CourseScript | null): Set<string> {
  const actionIds = new Set<string>();
  const add = (value: unknown) => {
    const actionId = String(value ?? "").trim();
    if (actionId) {
      actionIds.add(actionId);
    }
  };

  for (const item of script?.sections?.warmup?.items || []) {
    add(item.actionId);
  }
  for (const item of script?.sections?.cooldown?.items || []) {
    add(item.actionId);
  }
  for (const group of script?.training?.videoGroups || []) {
    for (const screen of group.screens || []) {
      for (const card of screen.videoCards || []) {
        add(card.actionId);
      }
    }
  }

  return actionIds;
}

function collectActionIdsFromCourses(courses: CourseRecord[]): Set<string> {
  const actionIds = new Set<string>();
  for (const course of courses) {
    collectActionIdsFromCourseScript(course.script).forEach((id) => actionIds.add(id));
  }
  return actionIds;
}

export default function ActionsRoute({
  selectedCoursePackage,
  onAddActionType
}: {
  selectedCoursePackage: CoursePackageRecord | null;
  onAddActionType: () => void;
}) {
  const { appData, reloadMeta } = useMeta();
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();
  const actions = (appData?.actions || []) as ActionRecord[];
  const actionTypes = (appData?.actionTypes || []) as TypeOption[];
  const packageCourses = useMemo(
    () => filterCoursesByCoursePackage((appData?.courses || []) as CourseRecord[], selectedCoursePackage),
    [appData?.courses, selectedCoursePackage]
  );
  const packageActionIds = useMemo(() => collectActionIdsFromCourses(packageCourses), [packageCourses]);
  const scopedActions = useMemo(
    () => (selectedCoursePackage ? actions.filter((action) => packageActionIds.has(String(action.id))) : actions),
    [actions, packageActionIds, selectedCoursePackage]
  );

  const [actionFiltersDraft, setActionFiltersDraft] = useState<FilterState>({ search: "", typeIds: [] });
  const [actionFilters, setActionFilters] = useState<FilterState>({ search: "", typeIds: [] });
  const [actionEditor, setActionEditor] = useState<ActionDraft | null>(null);
  const [actionBatchGuideOpen, setActionBatchGuideOpen] = useState(false);
  const [actionBatchDialog, setActionBatchDialog] = useState<BatchUploadDialogState | null>(null);

  const actionTypeNameById = useMemo(
    () => new Map(actionTypes.map((item) => [item.id, displayTypeName(item.name)])),
    [actionTypes]
  );

  const filteredActions = useMemo(() => {
    return scopedActions.filter((action) => {
      const nameMatches = !actionFilters.search || action.name.toLowerCase().includes(actionFilters.search.toLowerCase());
      return nameMatches && matchesTypeFilter(action.typeIds || [], actionFilters.typeIds);
    });
  }, [actionFilters.search, actionFilters.typeIds, scopedActions]);

  function openActionEditor(action: ActionRecord | null = null) {
    setActionEditor(createActionDraft(action));
  }

  function openBatchUploadDialog(files: FileList | null) {
    const pickedFiles = Array.from(files || []);
    if (!pickedFiles.length) {
      return;
    }

    const items = pickedFiles.map((file) => createBatchUploadItem(file, actionTypes));
    setActionBatchDialog({ items });
  }

  function openBatchUploadGuide() {
    setActionBatchGuideOpen(true);
  }

  function confirmBatchUploadGuide() {
    setActionBatchGuideOpen(false);
    triggerFileInput("action-batch-upload");
  }

  async function saveAction() {
    if (!actionEditor?.name.trim()) {
      pushNotice("动作名称不能为空。", "error");
      return;
    }

    setBusyText("正在保存动作...");

    try {
      let media = actionEditor.media;
      if (actionEditor.uploadFile) {
        media = await uploadBinary("video", actionEditor.uploadFile);
      }

      const payload = {
        name: actionEditor.name.trim(),
        typeIds: actionEditor.typeIds,
        media
      };

      if (actionEditor.id) {
        await requestJson(`/api/actions/${actionEditor.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson("/api/actions", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      await reloadMeta();
      setActionEditor(null);
      pushNotice("动作已保存。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  async function removeAction(actionId: number) {
    if (!window.confirm("确认删除这个动作吗？")) {
      return;
    }

    setBusyText("正在删除动作...");

    try {
      await requestJson(`/api/actions/${actionId}`, { method: "DELETE" });
      await reloadMeta();
      pushNotice("动作已删除。");
    } catch (error) {
      pushNotice(getErrorMessage(error), "error");
    } finally {
      setBusyText("");
    }
  }

  async function saveBatchActions() {
    const batchItems = actionBatchDialog?.items || [];
    const validItems = batchItems.filter((item) => item.status === "ready");

    if (!validItems.length) {
      pushNotice("没有可上传的文件，请检查命名是否符合“动作-类型”。", "error");
      return;
    }

    const workingTypes = [...actionTypes];
    const workingActions = [...actions];
    const typeLookup = buildActionTypeLookup(workingTypes);
    const createdTypeCache = new Map<string, TypeOption>();
    let createdCount = 0;
    let updatedCount = 0;
    let createdTypeCount = 0;
    const failures: string[] = [];

    setBusyText(`正在批量上传 1/${validItems.length}...`);

    for (const [index, item] of validItems.entries()) {
      setBusyText(`正在批量上传 ${index + 1}/${validItems.length}：${item.fileName}`);

      try {
        const typeKey = normalizeBatchKey(item.rawTypeName);
        let typeOption = typeLookup.get(typeKey) || createdTypeCache.get(typeKey) || null;

        if (!typeOption) {
          const created = await requestJson<{ data: TypeOption }>("/api/action-types", {
            method: "POST",
            body: JSON.stringify({ name: item.resolvedTypeName })
          });

          typeOption = created.data;
          workingTypes.push(typeOption);
          createdTypeCache.set(typeKey, typeOption);
          buildActionTypeLookup([typeOption]).forEach((value, key) => {
            if (!typeLookup.has(key)) {
              typeLookup.set(key, value);
            }
          });
          createdTypeCount += 1;
        }

        const media = await uploadBinary("video", item.file);
        const existing = findExistingActionForBatch(workingActions, item.actionName, typeOption.id);
        const payload = {
          name: item.actionName,
          typeIds: existing ? [...new Set([...existing.typeIds, typeOption.id])] : [typeOption.id],
          media
        };

        if (existing) {
          const response = await requestJson<{ data: ActionRecord }>(`/api/actions/${existing.id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          const existingIndex = workingActions.findIndex((action) => action.id === existing.id);
          if (existingIndex >= 0) {
            workingActions[existingIndex] = response.data;
          }
          updatedCount += 1;
        } else {
          const response = await requestJson<{ data: ActionRecord }>("/api/actions", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          workingActions.push(response.data);
          createdCount += 1;
        }
      } catch (error) {
        failures.push(`${item.fileName}：${getErrorMessage(error)}`);
      }
    }

    setBusyText("");

    if (failures.length) {
      pushNotice(failures[0], "error");
      return;
    }

    await reloadMeta();
    setActionBatchDialog(null);
    pushNotice(`批量上传完成：新增动作 ${createdCount}，更新动作 ${updatedCount}，新增分类 ${createdTypeCount}。`);
  }

  return (
    <ActionsPage
      actionEditor={actionEditor}
      actionTypes={actionTypes}
      filteredActions={filteredActions}
      actionScopeName={selectedCoursePackage?.name || ""}
      actionTypeNameById={actionTypeNameById}
      actionFiltersDraft={actionFiltersDraft}
      onActionFiltersDraftChange={setActionFiltersDraft}
      onApplySearch={() => setActionFilters(actionFiltersDraft)}
      onToggleFilterType={(typeId) => {
        const nextTypeIds = actionFiltersDraft.typeIds.includes(typeId)
          ? actionFiltersDraft.typeIds.filter((id) => id !== typeId)
          : [...actionFiltersDraft.typeIds, typeId];
        setActionFiltersDraft((current) => ({ ...current, typeIds: nextTypeIds }));
        setActionFilters((current) => ({ ...current, typeIds: nextTypeIds }));
      }}
      onOpenActionEditor={(action) => openActionEditor(action ?? null)}
      onCloseActionEditor={() => setActionEditor(null)}
      onActionEditorNameChange={(name) => setActionEditor((current) => (current ? { ...current, name } : current))}
      onToggleActionEditorType={(typeId) =>
        setActionEditor((current) =>
          current
            ? {
                ...current,
                typeIds: current.typeIds.includes(typeId)
                  ? current.typeIds.filter((id) => id !== typeId)
                  : [...current.typeIds, typeId]
              }
            : current
        )
      }
      onAddActionType={onAddActionType}
      onSaveAction={() => void saveAction()}
      onRemoveAction={(actionId) => void removeAction(actionId)}
      onTriggerVideoUpload={() => triggerFileInput("action-video-upload")}
      onVideoPicked={(file) =>
        setActionEditor((current) => (current ? { ...current, uploadFile: file, previewUrl: URL.createObjectURL(file) } : current))
      }
      actionBatchGuideOpen={actionBatchGuideOpen}
      onCloseBatchGuide={() => setActionBatchGuideOpen(false)}
      onConfirmBatchGuide={confirmBatchUploadGuide}
      onOpenBatchGuide={openBatchUploadGuide}
      onBatchFilesPicked={openBatchUploadDialog}
      actionBatchDialog={actionBatchDialog}
      onCloseBatchDialog={() => setActionBatchDialog(null)}
      onSaveBatchActions={() => void saveBatchActions()}
    />
  );
}
