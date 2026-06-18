import EmptyBlock from "../../components/EmptyBlock.tsx";
import InnerTabs from "../../components/InnerTabs.tsx";
import { formatDate } from "../../utils/datetime.ts";
import {
  TEMPLATE_TABS,
  formatTemplateSummary,
  getTemplateKindLabel,
  type TemplateCollections,
  type TemplateRecord
} from "../../models/templates.ts";
import { useTemplatesVm } from "../../viewmodels/templates/useTemplatesVm.ts";
import type { CourseRecord } from "../../models/course/types.ts";
import type { CoursePackageRecord } from "../venues/types.ts";
import CourseTemplateEditor from "./CourseTemplateEditor.tsx";
import TrainingTemplateEditor from "./TrainingTemplateEditor.tsx";
import WaterfallTemplateEditor from "./WaterfallTemplateEditor.tsx";
import type { ActionRecord, TypeOption } from "../../services/api/meta.ts";
import { useAuth } from "../../providers/AuthProvider.tsx";
import {
  filterActionTypesByCoursePackage,
  filterActionsByCoursePackage,
  filterTemplateCollectionsByCoursePackage
} from "../../utils/coursePackageScope.ts";

export default function TemplatesPage({
  templateCollections,
  selectedCoursePackage,
  courses,
  coursePackages,
  lessonTypes,
  actions,
  actionTypes,
  onAddLessonType,
  onReloadMeta,
  onBusyTextChange,
  onNotice
}: {
  templateCollections: TemplateCollections | null | undefined;
  selectedCoursePackage: CoursePackageRecord | null;
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  lessonTypes: Array<{ id: number; name: string }>;
  actions: ActionRecord[];
  actionTypes: TypeOption[];
  onAddLessonType: () => void;
  onReloadMeta: () => Promise<void>;
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
}) {
  const { authHeader } = useAuth();
  const scopedTemplateCollections = filterTemplateCollectionsByCoursePackage(
    templateCollections || { warmup: [], cooldown: [], training: [], course: [] },
    selectedCoursePackage
  );
  const scopedActions = filterActionsByCoursePackage(actions, selectedCoursePackage);
  const scopedActionTypes = filterActionTypesByCoursePackage(actionTypes, selectedCoursePackage);
  const vm = useTemplatesVm({
    templateCollections: scopedTemplateCollections,
    selectedCoursePackageId: selectedCoursePackage?.id || null,
    authHeader,
    onReloadMeta,
    onBusyText: onBusyTextChange,
    onNotice
  });

  const isEditingTemplate = Boolean(vm.templateEditor);

  return (
    <section className="page-card is-no-padding">
      <InnerTabs
        baseLabel="课程模板"
        editingLabel={vm.editingLabel}
        isEditing={isEditingTemplate}
        onBack={() => vm.setTemplateEditor(null)}
        onClose={() => vm.setTemplateEditor(null)}
      />

      {vm.templateEditor ? (
        <div className="editor-layout">
          <div className="editor-header">
            <h2>{vm.editingLabel}</h2>
          </div>

          <div className="editor-form">
            <div className="form-row single">
              <label className="field">
                <span>模板名称</span>
                <input
                  value={vm.templateEditor.name}
                  onChange={(event) =>
                    vm.updateTemplateEditor((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder={`请输入${getTemplateKindLabel(vm.templateEditor.kind)}名称`}
                />
              </label>
            </div>

            <TrainingTemplateEditor
              draft={vm.templateEditor}
              actions={scopedActions}
              actionTypes={scopedActionTypes}
              onUpdateDraft={vm.updateTemplateEditor}
            />
            <WaterfallTemplateEditor
              draft={vm.templateEditor}
              actions={scopedActions}
              actionTypes={scopedActionTypes}
              onUpdateDraft={vm.updateTemplateEditor}
            />
            <CourseTemplateEditor
              draft={vm.templateEditor}
              courses={courses}
              coursePackages={coursePackages}
              lessonTypes={lessonTypes}
              actions={scopedActions}
              actionTypes={scopedActionTypes}
              onAddLessonType={onAddLessonType}
              templateCollections={scopedTemplateCollections}
              onUpdateDraft={vm.updateTemplateEditor}
              onSaveTemplate={vm.saveTemplate}
              onNotice={onNotice}
            />

            <div className="editor-actions">
              <button type="button" className="primary-button" onClick={vm.saveTemplate}>
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
                <p className="page-eyebrow">Template Library</p>
                <h2>课程模板</h2>
              </div>
              <div className="section-head-actions">
                <button type="button" className="primary-button" onClick={() => vm.openTemplateEditor(null, vm.templateTab)}>
                  + 添加模板
                </button>
              </div>
            </div>
          </div>

          <div className="tab-row template-tab-row">
            {TEMPLATE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-button ${vm.templateTab === tab.key ? "is-active" : ""}`}
                onClick={() => vm.setTemplateTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="divider" />

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>模板名称</th>
                  <th>模板类型</th>
                  <th>内容概览</th>
                  <th>更新时间</th>
                  <th>管理</th>
                </tr>
              </thead>
              <tbody>
                {vm.activeTemplateList.length ? (
                  vm.activeTemplateList.map((template: TemplateRecord) => (
                    <tr key={template.id}>
                      <td>{template.name}</td>
                      <td>{getTemplateKindLabel(template.kind)}</td>
                      <td>{formatTemplateSummary(template)}</td>
                      <td>{formatDate(template.updateTime)}</td>
                      <td>
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => vm.openTemplateEditor(template, template.kind)}
                        >
                          编辑
                        </button>
                        <button type="button" className="table-link danger" onClick={() => vm.removeTemplate(template)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <EmptyBlock title="还没有模板" copy="先创建一套热身、冷身或正式组模板，课程编辑里就能直接复用。" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
