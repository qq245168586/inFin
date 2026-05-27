import { useMemo } from "react";
import FilterChips from "../../components/FilterChips.tsx";
import type { CourseScript } from "../../models/course/types.ts";
import type { ActionRecord, TypeOption } from "../../services/api/meta.ts";
import { toggleNumberId } from "../../utils/array.ts";
import { triggerFileInput } from "../../utils/dom.ts";
import { removeVideoGroup, syncPodWithVideoGroup, syncPodsForVideoGroup, createPod, createPodName, rebalancePodEndings } from "../../viewmodels/courses/podGraph.ts";
import { formatRestStrategy, formatSecondsStrategy } from "../../viewmodels/courses/podFormatters.ts";
import { formatPodTimingMismatch, getPodScreenTotalForFlow } from "../../viewmodels/courses/podTiming.ts";
import type { CourseDraft, CourseEditorTabState } from "../../viewmodels/courses/types.ts";
import { COURSE_SECTION_COPY, POD_ENDING_OPTIONS } from "../../viewmodels/courses/courseEditorConstants.ts";
import CoursePlanEditor from "./CoursePlanEditor.tsx";
import CourseWaterfallSections from "./CourseWaterfallSections.tsx";
import CourseVideoGroupsEditor from "./CourseVideoGroupsEditor.tsx";
import CoursePodsEditor from "./CoursePodsEditor.tsx";

export default function CourseEditorPane({
  tabId,
  tabTitle,
  coursePackageName,
  courseEditor,
  lessonTypes,
  actions,
  actionTypes,
  onAddLessonType,
  onUseWarmupTemplate,
  onUseCooldownTemplate,
  onUseTrainingTemplate,
  onUpdateCourseDraft,
  onUpdateCourseScript,
  onSaveCourse,
  onNotice,
  onOpenPodRuleDialog,
  onOpenPodCopyDialog,
  onOpenPodConfigCopyDialog
}: {
  tabId: string;
  tabTitle: CourseEditorTabState["title"];
  coursePackageName: string;
  courseEditor: CourseDraft;
  lessonTypes: TypeOption[];
  actions: ActionRecord[];
  actionTypes: TypeOption[];
  onAddLessonType: () => void;
  onUseWarmupTemplate: () => void;
  onUseCooldownTemplate: () => void;
  onUseTrainingTemplate: (groupId: string) => void;
  onUpdateCourseDraft: (updater: (current: CourseDraft) => CourseDraft) => void;
  onUpdateCourseScript: (updater: (current: CourseScript) => CourseScript) => void;
  onSaveCourse: () => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onOpenPodRuleDialog: Parameters<typeof CoursePodsEditor>[0]["onOpenPodRuleDialog"];
  onOpenPodCopyDialog: Parameters<typeof CoursePodsEditor>[0]["onOpenPodCopyDialog"];
  onOpenPodConfigCopyDialog: Parameters<typeof CoursePodsEditor>[0]["onOpenPodConfigCopyDialog"];
}) {
  const videoGroupMap = useMemo(() => {
    return new Map(courseEditor.script.training.videoGroups.map((group) => [group.id, group]) || []);
  }, [courseEditor.script.training.videoGroups]);

  const logoInputId = `course-logo-upload-${tabId}`;

  return (
    <div className="editor-layout">
      <div className="editor-header">
        <h2>{tabTitle || "编辑课程"}</h2>
        <p className="section-copy">
          {coursePackageName ? `当前课程包：${coursePackageName}。` : ""}
          课程脚本已升级为热身、正式训练、冷身三段式动态编辑。
        </p>
      </div>

      <div className="editor-form">
        <div className="form-row three">
          <label className="field">
            <span>名称</span>
            <input
              value={courseEditor.script.metadata.name}
              onChange={(e) => onUpdateCourseScript((c) => ({ ...c, metadata: { ...c.metadata, name: e.target.value } }))}
            />
          </label>
          <label className="field">
            <span>课程设计者</span>
            <input
              value={courseEditor.script.metadata.creator}
              onChange={(e) => onUpdateCourseScript((c) => ({ ...c, metadata: { ...c.metadata, creator: e.target.value } }))}
            />
          </label>
          <label className="field">
            <span>课程版本</span>
            <input
              value={courseEditor.script.metadata.version}
              onChange={(e) => onUpdateCourseScript((c) => ({ ...c, metadata: { ...c.metadata, version: e.target.value } }))}
            />
          </label>
        </div>

        <div className="form-row single">
          <div className="field">
            <span>课程类型</span>
            <FilterChips
              options={lessonTypes}
              selectedIds={courseEditor.typeIds}
              onToggle={(typeId) => onUpdateCourseDraft((current) => ({ ...current, typeIds: toggleNumberId(current.typeIds, typeId) }))}
              onAdd={onAddLessonType}
            />
          </div>
        </div>

        <div className="logo-panel">
          <div className="field">
            <span>课程 Logo</span>
            <button type="button" className="ghost-button" onClick={() => triggerFileInput(logoInputId)}>
              上传 Logo
            </button>
            <input
              id={logoInputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (!file) return;
                onUpdateCourseDraft((current) => ({ ...current, logoFile: file, logoPreview: URL.createObjectURL(file) }));
              }}
            />
          </div>
          {courseEditor.logoPreview ? (
            <div className="logo-preview">
              <img src={courseEditor.logoPreview} alt="课程 Logo" />
            </div>
          ) : null}
        </div>

        <div className="divider" />

        <CoursePlanEditor
          plan={courseEditor.script.plan}
          readyDurations={courseEditor.script.metadata.readyDurations}
          onUpdateScript={onUpdateCourseScript}
        />

        <div className="divider" />

        <CourseWaterfallSections
          sections={courseEditor.script.sections}
          actions={actions}
          actionTypes={actionTypes}
          sectionCopy={COURSE_SECTION_COPY}
          onUseTemplate={(key) => (key === "warmup" ? onUseWarmupTemplate() : onUseCooldownTemplate())}
          onUpdateScript={onUpdateCourseScript}
        />

        <div className="divider" />

        <CourseVideoGroupsEditor
          script={courseEditor.script}
          actions={actions}
          actionTypes={actionTypes}
          onUseTemplate={(group) => onUseTrainingTemplate(group.id)}
          onUpdateScript={onUpdateCourseScript}
          syncPodsForVideoGroup={syncPodsForVideoGroup}
          onRemoveGroup={(groupId) => onUpdateCourseScript((current) => removeVideoGroup(current, groupId))}
          onNotice={onNotice}
        />

        <CoursePodsEditor
          script={courseEditor.script}
          videoGroupMap={videoGroupMap}
          podEndingOptions={POD_ENDING_OPTIONS}
          createPodName={createPodName}
          createPod={createPod}
          syncPodWithVideoGroup={syncPodWithVideoGroup}
          rebalancePodEndings={rebalancePodEndings}
          getPodScreenTotal={getPodScreenTotalForFlow}
          formatPodTimingMismatch={formatPodTimingMismatch}
          formatRestStrategy={formatRestStrategy}
          formatSecondsStrategy={formatSecondsStrategy}
          onUpdateScript={onUpdateCourseScript}
          onNotice={onNotice}
          onOpenPodRuleDialog={onOpenPodRuleDialog}
          onOpenPodCopyDialog={onOpenPodCopyDialog}
          onOpenPodConfigCopyDialog={onOpenPodConfigCopyDialog}
        />

        <div className="editor-actions">
          <button type="button" className="primary-button" onClick={() => onSaveCourse()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
