import { useMemo, useState } from "react";
import Dialog from "../components/Dialog.tsx";
import EmptyBlock from "../components/EmptyBlock.tsx";
import FilterChips, { type ChipOption } from "../components/FilterChips.tsx";
import InnerTabs from "../components/InnerTabs.tsx";
import { FirstFrameVideo } from "../components/ActionMediaPreview.tsx";
import { formatDate } from "../utils/datetime.ts";
import type { ActionRecord } from "../services/api/meta.ts";
import { displayTypeName, stripMediaSuffix } from "../utils/typeNames.ts";

interface ActionDraft {
  id: number | null;
  name: string;
  description: string;
  typeIds: number[];
  previewUrl: string;
  uploadFile: File | null;
}

interface BatchUploadItem {
  id: string;
  fileName: string;
  actionName: string;
  resolvedTypeName: string;
  needsCreateType: boolean;
  status: "ready" | "invalid";
  message: string;
}

interface BatchUploadDialogState {
  items: BatchUploadItem[];
}

interface FilterState {
  search: string;
  typeIds: number[];
}

export default function ActionsPage({
  actionEditor,
  actionTypes,
  filteredActions,
  actionScopeName,
  actionTypeNameById,
  actionFiltersDraft,
  onActionFiltersDraftChange,
  onApplySearch,
  onToggleFilterType,
  onOpenActionEditor,
  onCloseActionEditor,
  onActionEditorNameChange,
  onActionEditorDescriptionChange,
  onToggleActionEditorType,
  onCreateAndSelectActionType,
  onSaveAction,
  actionSaving,
  onRemoveAction,
  onTriggerVideoUpload,
  onVideoPicked,
  actionBatchGuideOpen,
  onCloseBatchGuide,
  onConfirmBatchGuide,
  onOpenBatchGuide,
  onBatchFilesPicked,
  actionBatchDialog,
  onCloseBatchDialog,
  onSaveBatchActions,
  batchUploading
}: {
  actionEditor: ActionDraft | null;
  actionTypes: ChipOption[];
  filteredActions: ActionRecord[];
  actionScopeName: string;
  actionTypeNameById: Map<number, string>;
  actionFiltersDraft: FilterState;
  onActionFiltersDraftChange: (next: FilterState) => void;
  onApplySearch: () => void;
  onToggleFilterType: (typeId: number) => void;
  onOpenActionEditor: (action?: ActionRecord | null) => void;
  onCloseActionEditor: () => void;
  onActionEditorNameChange: (name: string) => void;
  onActionEditorDescriptionChange: (description: string) => void;
  onToggleActionEditorType: (typeId: number) => void;
  onCreateAndSelectActionType: (name: string) => void;
  onSaveAction: () => void;
  actionSaving: boolean;
  onRemoveAction: (actionId: number) => void;
  onTriggerVideoUpload: () => void;
  onVideoPicked: (file: File) => void;
  actionBatchGuideOpen: boolean;
  onCloseBatchGuide: () => void;
  onConfirmBatchGuide: () => void;
  onOpenBatchGuide: () => void;
  onBatchFilesPicked: (files: FileList | null) => void;
  actionBatchDialog: BatchUploadDialogState | null;
  onCloseBatchDialog: () => void;
  onSaveBatchActions: () => void;
  batchUploading: boolean;
}) {
  const [typeFilterDialogOpen, setTypeFilterDialogOpen] = useState(false);
  const [editorTypeDialogOpen, setEditorTypeDialogOpen] = useState(false);
  const [editorTypeName, setEditorTypeName] = useState("");
  const batchReadyCount = actionBatchDialog?.items.filter((item) => item.status === "ready").length || 0;
  const batchInvalidCount = actionBatchDialog?.items.filter((item) => item.status === "invalid").length || 0;
  const selectedFilterTypes = useMemo(
    () => actionTypes.filter((item) => actionFiltersDraft.typeIds.includes(item.id)),
    [actionFiltersDraft.typeIds, actionTypes]
  );
  const selectedEditorTypes = useMemo(
    () => actionEditor ? actionTypes.filter((item) => actionEditor.typeIds.includes(item.id)) : [],
    [actionEditor, actionTypes]
  );

  function clearFilterTypes() {
    onActionFiltersDraftChange({
      ...actionFiltersDraft,
      typeIds: []
    });
  }

  function openEditorTypeDialog() {
    setEditorTypeName("");
    setEditorTypeDialogOpen(true);
  }

  function createEditorType() {
    const cleanedName = stripMediaSuffix(editorTypeName);
    if (!cleanedName) {
      return;
    }
    onCreateAndSelectActionType(cleanedName);
    setEditorTypeName("");
    setEditorTypeDialogOpen(false);
  }

  return (
    <section className="page-card is-no-padding">
      <InnerTabs
        baseLabel="动作库"
        editingLabel={actionEditor?.id ? "编辑动作" : "上传动作"}
        isEditing={Boolean(actionEditor)}
        onBack={onCloseActionEditor}
        onClose={onCloseActionEditor}
      />

      {actionEditor ? (
        <div className="editor-layout">
          <div className="editor-header">
            <h2>编辑动作</h2>
          </div>
          <div className="editor-form">
            <div className="form-row single">
              <label className="field">
                <span>名称</span>
                <input
                  value={actionEditor.name}
                  onChange={(event) => onActionEditorNameChange(event.target.value)}
                  placeholder="请输入动作名称"
                />
              </label>
            </div>

            <div className="form-row single">
              <label className="field">
                <span>动作描述</span>
                <textarea
                  className="action-description-input"
                  value={actionEditor.description}
                  onChange={(event) => onActionEditorDescriptionChange(event.target.value)}
                  placeholder="输入动作要点、目标肌群、注意事项等"
                />
              </label>
            </div>

            <div className="form-row">
              <div className="field grow">
                <span>动作类型</span>
                <FilterChips
                  options={selectedEditorTypes}
                  selectedIds={actionEditor.typeIds}
                  onToggle={onToggleActionEditorType}
                  onAdd={openEditorTypeDialog}
                  addLabel="添加"
                />
              </div>
            </div>

            <div className="editor-divider" />

            <div className="asset-panel">
              <div className="asset-panel-head">
                <button type="button" className="primary-button" onClick={onTriggerVideoUpload}>
                  + 上传动作
                </button>
                <input
                  id="action-video-upload"
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    onVideoPicked(file);
                  }}
                />
              </div>

              <div className="video-preview">
                {actionEditor.previewUrl ? <FirstFrameVideo src={actionEditor.previewUrl} /> : <div className="asset-placeholder">点击上方按钮上传动作视频</div>}
              </div>
            </div>

            <div className="editor-actions">
              <button type="button" className="primary-button" onClick={onSaveAction} disabled={actionSaving}>
                {actionSaving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="page-content">
          <div className="page-section">
            <div className="section-head">
              <div>
                <p className="page-eyebrow">Action Library</p>
                <h2>{actionScopeName ? "当前课程包动作" : "全部动作"}</h2>
                {actionScopeName ? <span className="section-subtitle">{actionScopeName}</span> : null}
              </div>
              <div className="section-head-actions">
                <button type="button" className="ghost-button" onClick={onOpenBatchGuide}>
                  批量上传
                </button>
                <input
                  id="action-batch-upload"
                  type="file"
                  accept="video/*"
                  multiple
                  hidden
                  onChange={(event) => {
                    onBatchFilesPicked(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <button type="button" className="primary-button" onClick={() => onOpenActionEditor(null)}>
                  + 添加动作
                </button>
              </div>
            </div>

            <div className="filter-grid">
              <label className="field">
                <span>动作名称</span>
                <input
                  value={actionFiltersDraft.search}
                  onChange={(event) => onActionFiltersDraftChange({ ...actionFiltersDraft, search: event.target.value })}
                  placeholder="按动作名称搜索"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      onApplySearch();
                    }
                  }}
                />
              </label>
              <div className="filter-action">
                <button type="button" className="primary-button" onClick={onApplySearch}>
                  搜索
                </button>
              </div>
            </div>

            <div className="filter-line">
              <span className="filter-label">动作类型</span>
              <div className="type-filter-summary">
                <button type="button" className="ghost-button type-filter-trigger" onClick={() => setTypeFilterDialogOpen(true)}>
                  选择类型
                  {selectedFilterTypes.length ? <span>{selectedFilterTypes.length}</span> : null}
                </button>
                <div className="type-filter-selected">
                  {selectedFilterTypes.length ? (
                    selectedFilterTypes.map((type) => (
                      <button key={type.id} type="button" className="filter-chip is-active" onClick={() => onToggleFilterType(type.id)}>
                        {type.name}
                      </button>
                    ))
                  ) : (
                    <span className="type-filter-empty">全部类型</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="divider" />

            <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>动作序号</th>
                  <th>动作名称</th>
                  <th>动作类型</th>
                  <th>添加时间</th>
                  <th>管理</th>
                </tr>
              </thead>
              <tbody>
                {filteredActions.length ? (
                  filteredActions.map((action) => (
                    <tr key={action.id}>
                      <td>{action.id}</td>
                      <td>{action.name}</td>
                      <td>
                        <div className="table-tags">
                          {action.typeIds.length ? (
                            action.typeIds.map((typeId) => (
                              <span key={typeId} className="table-tag">
                                {actionTypeNameById.get(typeId) || `分类 ${typeId}`}
                              </span>
                            ))
                          ) : (
                            <span className="table-tag is-muted">未分类</span>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(action.createTime)}</td>
                      <td>
                        <button type="button" className="table-link" onClick={() => onOpenActionEditor(action)}>
                          编辑
                        </button>
                        <button type="button" className="table-link danger" onClick={() => onRemoveAction(action.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <EmptyBlock
                        title="没有找到匹配动作"
                        copy={actionScopeName ? "当前课程包里的课程暂时还没有引用动作，可以调整筛选条件或先到课程中配置动作。" : "可以调整筛选条件，或者直接新建一个动作。"}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {typeFilterDialogOpen ? (
        <Dialog title="选择动作类型" width={820} onClose={() => setTypeFilterDialogOpen(false)} onConfirm={() => setTypeFilterDialogOpen(false)} confirmText="完成">
          <div className="type-filter-dialog">
            <div className="type-filter-dialog-head">
              <p>已选择 {selectedFilterTypes.length} 个类型</p>
              <button type="button" className="ghost-button small" onClick={clearFilterTypes} disabled={!selectedFilterTypes.length}>
                清除所有类型
              </button>
            </div>
            <FilterChips options={actionTypes} selectedIds={actionFiltersDraft.typeIds} onToggle={onToggleFilterType} />
          </div>
        </Dialog>
      ) : null}

      {editorTypeDialogOpen ? (
        <Dialog
          title="添加动作类型"
          width={620}
          onClose={() => setEditorTypeDialogOpen(false)}
          onConfirm={() => setEditorTypeDialogOpen(false)}
          confirmText="完成"
        >
          <div className="action-type-select-dialog">
            <div className="type-filter-dialog-head">
              <p>选择已有类型</p>
            </div>
            <div className="chip-row action-type-select-list">
              {actionTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`filter-chip ${actionEditor?.typeIds.includes(type.id) ? "is-active" : ""}`}
                  onClick={() => onToggleActionEditorType(type.id)}
                >
                  {displayTypeName(type.name)}
                </button>
              ))}
            </div>
            <div className="action-type-create-row">
              <label className="field">
                <span>输入新类型</span>
                <input
                  value={editorTypeName}
                  onChange={(event) => setEditorTypeName(stripMediaSuffix(event.target.value))}
                  placeholder="输入之前没有过的类型"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && stripMediaSuffix(editorTypeName)) {
                      createEditorType();
                    }
                  }}
                />
              </label>
              <button type="button" className="primary-button" onClick={createEditorType} disabled={!stripMediaSuffix(editorTypeName)}>
                新增并选择
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}

      {actionBatchGuideOpen ? (
        <Dialog title="批量上传动作" width={640} onClose={onCloseBatchGuide} onConfirm={onConfirmBatchGuide} confirmText="选择视频">
          <div className="dialog-form">
            <div className="batch-upload-note">
              <strong>上传前请先按规则命名视频</strong>
              <p>文件名需要使用 `动作-类型` 格式，例如：`划船-hyrox.mp4`、`推雪橇-耐力.mp4`。</p>
              <p>系统会根据文件名自动创建动作，并自动匹配或创建对应的动作分类。</p>
              <p>确认命名无误后，再点击下方“选择视频”开始挑选要上传的文件。</p>
            </div>
          </div>
        </Dialog>
      ) : null}

      {actionBatchDialog ? (
        <Dialog
          title="批量上传动作"
          width={920}
          onClose={onCloseBatchDialog}
          onConfirm={onSaveBatchActions}
          confirmText={batchUploading ? "上传中..." : "开始上传"}
          confirmDisabled={batchUploading}
        >
          <div className="dialog-form">
            <div className="batch-upload-note">
              <strong>命名规则：动作-类型</strong>
              <p>例如：`划船-hyrox.mp4` 会自动创建动作“划船”，并自动匹配或创建分类“HYROX”。</p>
            </div>

            <div className="batch-upload-summary">
              <span>待处理 {batchReadyCount} 个</span>
              <span>命名异常 {batchInvalidCount} 个</span>
            </div>

            <div className="batch-upload-table-wrap">
              <table className="data-table batch-upload-table">
                <thead>
                  <tr>
                    <th>文件名</th>
                    <th>动作名</th>
                    <th>分类</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {actionBatchDialog.items.map((item) => (
                    <tr key={item.id}>
                      <td className="cell-break">{item.fileName}</td>
                      <td>{item.actionName || "--"}</td>
                      <td>
                        {item.resolvedTypeName ? (
                          <span className={`table-tag ${item.needsCreateType ? "is-pending" : ""}`}>
                            {item.needsCreateType ? `将创建 ${item.resolvedTypeName}` : item.resolvedTypeName}
                          </span>
                        ) : (
                          <span className="table-tag is-muted">--</span>
                        )}
                      </td>
                      <td className={item.status === "invalid" ? "batch-status is-invalid" : "batch-status"}>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
