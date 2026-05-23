import Dialog from "../components/Dialog.tsx";
import EmptyBlock from "../components/EmptyBlock.tsx";
import FilterChips, { type ChipOption } from "../components/FilterChips.tsx";
import InnerTabs from "../components/InnerTabs.tsx";
import { FirstFrameVideo } from "../components/ActionMediaPreview.tsx";
import { formatDate } from "../utils/datetime.ts";
import type { ActionRecord } from "../services/api/meta.ts";

interface ActionDraft {
  id: number | null;
  name: string;
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
  actionTypeNameById,
  actionFiltersDraft,
  onActionFiltersDraftChange,
  onApplySearch,
  onToggleFilterType,
  onOpenActionEditor,
  onCloseActionEditor,
  onActionEditorNameChange,
  onToggleActionEditorType,
  onAddActionType,
  onSaveAction,
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
  onSaveBatchActions
}: {
  actionEditor: ActionDraft | null;
  actionTypes: ChipOption[];
  filteredActions: ActionRecord[];
  actionTypeNameById: Map<number, string>;
  actionFiltersDraft: FilterState;
  onActionFiltersDraftChange: (next: FilterState) => void;
  onApplySearch: () => void;
  onToggleFilterType: (typeId: number) => void;
  onOpenActionEditor: (action?: ActionRecord | null) => void;
  onCloseActionEditor: () => void;
  onActionEditorNameChange: (name: string) => void;
  onToggleActionEditorType: (typeId: number) => void;
  onAddActionType: () => void;
  onSaveAction: () => void;
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
}) {
  const batchReadyCount = actionBatchDialog?.items.filter((item) => item.status === "ready").length || 0;
  const batchInvalidCount = actionBatchDialog?.items.filter((item) => item.status === "invalid").length || 0;

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

            <div className="form-row">
              <div className="field grow">
                <span>动作类型</span>
                <FilterChips
                  options={actionTypes}
                  selectedIds={actionEditor.typeIds}
                  onToggle={onToggleActionEditorType}
                  onAdd={onAddActionType}
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
              <button type="button" className="primary-button" onClick={onSaveAction}>
                保存
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
                <h2>全部动作</h2>
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
              <FilterChips options={actionTypes} selectedIds={actionFiltersDraft.typeIds} onToggle={onToggleFilterType} />
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
                      <EmptyBlock title="没有找到匹配动作" copy="可以调整筛选条件，或者直接新建一个动作。" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
        <Dialog title="批量上传动作" width={920} onClose={onCloseBatchDialog} onConfirm={onSaveBatchActions} confirmText="开始上传">
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
