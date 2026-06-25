import { useEffect, useMemo, useState } from "react";
import type { CourseRecord, CourseScript, Pod, PodScreen, VideoGroup } from "../../models/course/types.ts";
import { cloneCourseScriptWithFreshIds, cloneVideoGroupForEditor, cloneWaterfallSectionForEditor } from "../../models/course/factories.ts";
import { createTemplateCollections, type TemplateCollections, type TemplateDraft, type TrainingTemplateRecord, type WaterfallTemplateRecord } from "../../models/templates.ts";
import type { CoursePackageRecord } from "../venues/types.ts";
import type { ActionRecord, TypeOption } from "../../services/api/meta.ts";
import type { CourseDraft } from "../../viewmodels/courses/types.ts";
import { createEmptyCourseScript } from "../../viewmodels/courses/courseScriptNormalize.ts";
import { createPodName, syncPodsForVideoGroup } from "../../viewmodels/courses/podGraph.ts";
import { createPodSetConfig } from "../../models/course/factories.ts";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";
import { createPodRuleDialogState, resizePodRuleSetDrafts, type PodConfigCopyDialogState, type PodCopyDialogState, type PodRuleDialogState } from "../../viewmodels/courses/podDialogs.ts";
import type { TemplateUseDialogState } from "../../viewmodels/courses/templateUseDialog.ts";
import { parseNonNegativeIntInput, parsePositiveIntInput } from "../../utils/number.ts";
import { cloneDeep } from "../../utils/cloneDeep.ts";
import { hasEditedVideoGroup } from "../../viewmodels/courses/courseEditorGuards.ts";
import { formatSecondsStrategy } from "../../viewmodels/courses/podFormatters.ts";
import { normalizeCourseScriptLocal } from "../../viewmodels/courses/courseScriptNormalize.ts";
import { createPod, rebalancePodEndings, syncPodWithVideoGroup } from "../../viewmodels/courses/podGraph.ts";
import { formatPodTimingMismatch, getPodScreenTotalForFlow } from "../../viewmodels/courses/podTiming.ts";
import { POD_ENDING_OPTIONS } from "../../viewmodels/courses/courseEditorConstants.ts";
import { formatRestStrategy } from "../../viewmodels/courses/podFormatters.ts";
import CourseEditorPane from "../courses/CourseEditorPane.tsx";
import CoursesOverlays from "../courses/CoursesOverlays.tsx";

function createBlankTemplateScript(draft: TemplateDraft): CourseScript {
  const script = createEmptyCourseScript();
  script.metadata.name = draft.courseName || draft.name || "";
  return script;
}

function toCourseDraft(draft: TemplateDraft): CourseDraft {
  return {
    id: null,
    typeIds: [...draft.typeIds],
    logoMedia: draft.logoMedia,
    logoFile: draft.logoFile,
    logoPreview: draft.logoPreview || draft.logoMedia?.url || "",
    script: normalizeCourseScriptLocal(draft.script || createBlankTemplateScript(draft))
  };
}

export default function CourseTemplateEditor({
  draft,
  courses,
  coursePackages,
  lessonTypes,
  actions,
  actionTypes,
  templateCollections,
  onAddLessonType,
  onLoadCourseDetail,
  onSaveTemplate,
  onNotice,
  onUpdateDraft
}: {
  draft: TemplateDraft;
  courses: CourseRecord[];
  coursePackages: CoursePackageRecord[];
  lessonTypes: Array<{ id: number; name: string }>;
  actions: ActionRecord[];
  actionTypes: TypeOption[];
  templateCollections: TemplateCollections | null | undefined;
  onAddLessonType: () => void;
  onLoadCourseDetail: (course: CourseRecord) => Promise<CourseRecord | null>;
  onSaveTemplate: () => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
  onUpdateDraft: (updater: (current: TemplateDraft) => TemplateDraft) => void;
}) {
  const [templateUseDialog, setTemplateUseDialog] = useState<TemplateUseDialogState | null>(null);
  const [podRuleDialog, setPodRuleDialog] = useState<PodRuleDialogState | null>(null);
  const [podCopyDialog, setPodCopyDialog] = useState<PodCopyDialogState | null>(null);
  const [podConfigCopyDialog, setPodConfigCopyDialog] = useState<PodConfigCopyDialogState | null>(null);

  useEffect(() => {
    if (draft.kind !== "course" || draft.script) return;
    onUpdateDraft((current) =>
      current.kind === "course" && !current.script
        ? {
            ...current,
            script: createBlankTemplateScript(current),
            courseName: current.courseName || current.name
          }
        : current
    );
  }, [draft.kind, draft.script, onUpdateDraft]);

  if (draft.kind !== "course") return null;

  const collections = templateCollections || createTemplateCollections();
  const courseDraft = toCourseDraft(draft);
  const selectedCourse = draft.sourceCourseId
    ? courses.find((course) => Number(course.id) === Number(draft.sourceCourseId)) || null
    : null;

  const coursePackageName = useMemo(() => {
    if (!draft.coursePackageId) return "";
    return coursePackages.find((coursePackage) => Number(coursePackage.id) === Number(draft.coursePackageId))?.name || "";
  }, [coursePackages, draft.coursePackageId]);

  function updateTemplateCourseDraft(updater: (current: CourseDraft) => CourseDraft) {
    onUpdateDraft((current) => {
      if (current.kind !== "course") return current;
      const next = updater(toCourseDraft(current));
      return {
        ...current,
        typeIds: [...next.typeIds],
        logoMedia: next.logoMedia,
        logoFile: next.logoFile,
        logoPreview: next.logoPreview,
        script: next.script,
        courseName: next.script.metadata.name || current.courseName
      };
    });
  }

  function updateTemplateCourseScript(updater: (current: CourseScript) => CourseScript) {
    onUpdateDraft((current) => {
      if (current.kind !== "course") return current;
      const nextScript = updater(normalizeCourseScriptLocal(current.script || createBlankTemplateScript(current)));
      return {
        ...current,
        script: nextScript,
        courseName: nextScript.metadata.name || current.courseName
      };
    });
  }

  async function applySourceCourse(course: CourseRecord | null) {
    const courseDetail = course ? await onLoadCourseDetail(course) : null;
    if (course && !courseDetail) {
      return;
    }
    onUpdateDraft((current) => {
      if (!courseDetail) {
        return {
          ...current,
          sourceCourseId: null
        };
      }

      const sourcePackage = coursePackages.find((coursePackage) =>
        (coursePackage.courseIds || []).some((courseId) => Number(courseId) === Number(courseDetail.id))
      );

      return {
        ...current,
        name: current.name || courseDetail.name,
        courseName: courseDetail.name,
        logoMedia: courseDetail.logoMedia,
        logoFile: null,
        logoPreview: courseDetail.logoMedia?.url || "",
        typeIds: [...courseDetail.typeIds],
        script: normalizeCourseScriptLocal(cloneCourseScriptWithFreshIds(courseDetail.script)),
        coursePackageId: current.coursePackageId || sourcePackage?.id || null,
        sourceCourseId: courseDetail.id,
        summary: courseDetail.summary
      };
    });
  }

  function openTemplateUseDialog(target: "warmup" | "cooldown" | "training", targetVideoGroup?: VideoGroup | null) {
    if (target === "training" && !targetVideoGroup) {
      onNotice("请先选择要套用模版的视频组。", "error");
      return;
    }

    setTemplateUseDialog({
      target,
      selectedTemplateId: String((collections[target] || [])[0]?.id ?? ""),
      targetVideoGroupId: targetVideoGroup?.id,
      targetVideoGroupName: targetVideoGroup?.name || undefined
    });
  }

  function applyTemplateToCourseTemplate() {
    if (!templateUseDialog?.selectedTemplateId) return;

    const templates = collections[templateUseDialog.target] || [];
    const selectedTemplate = templates.find((template) => String(template.id) === String(templateUseDialog.selectedTemplateId));
    if (!selectedTemplate) {
      onNotice("请选择要使用的模版。", "error");
      return;
    }

    if (templateUseDialog.target === "training") {
      const trainingTemplate = selectedTemplate as TrainingTemplateRecord;
      if (!templateUseDialog.targetVideoGroupId) {
        onNotice("没有找到要覆盖的视频组。", "error");
        return;
      }
      const targetGroup = courseDraft.script.training.videoGroups.find((group) => group.id === templateUseDialog.targetVideoGroupId);
      if (!targetGroup) {
        onNotice("当前视频组不存在。", "error");
        return;
      }
      if (
        hasEditedVideoGroup(targetGroup) &&
        !window.confirm(`使用模版会覆盖当前视频组“${templateUseDialog.targetVideoGroupName || targetGroup.name || "视频组"}”的内容，是否继续？`)
      ) {
        return;
      }

      updateTemplateCourseScript((current) =>
        syncPodsForVideoGroup(current, {
          ...cloneVideoGroupForEditor(trainingTemplate.videoGroup, trainingTemplate.name),
          id: templateUseDialog.targetVideoGroupId
        })
      );
      onNotice(`已用模版“${trainingTemplate.name}”覆盖当前视频组。`);
    } else {
      const waterfallTemplate = selectedTemplate as WaterfallTemplateRecord;
      const sectionTitle = templateUseDialog.target === "cooldown" ? "冷身" : "热身";
      updateTemplateCourseScript((current) => ({
        ...current,
        sections: {
          ...current.sections,
          [templateUseDialog.target]: cloneWaterfallSectionForEditor(waterfallTemplate.section, sectionTitle)
        }
      }));
      onNotice(`已应用${sectionTitle}模版“${waterfallTemplate.name}”。`);
    }

    setTemplateUseDialog(null);
  }

  function openPodRuleDialog(pod: Pod, screen: PodScreen, screenLabel: string, isSingleScreen: boolean) {
    setPodRuleDialog(createPodRuleDialogState(pod, screen, screenLabel, isSingleScreen));
  }

  function openPodCopyDialog(pod: Pod, screen: PodScreen, screenLabel: string) {
    setPodCopyDialog({
      podId: pod.id,
      podName: pod.name || "Pod",
      targetScreenId: screen.id,
      targetScreenIndex: screen.screenIndex,
      targetScreenLabel: screenLabel,
      selectedSourceScreenId: ""
    });
  }

  function openPodConfigCopyDialog(pod: Pod, podLabel: string) {
    const pods = courseDraft.script.training.pods || [];
    const firstAvailableSource = pods.find((candidate) => candidate.id !== pod.id && candidate.screens.some((s) => s.isCustomized)) || null;
    setPodConfigCopyDialog({
      targetPodId: pod.id,
      targetPodName: podLabel || pod.name || "Pod",
      selectedSourcePodId: firstAvailableSource?.id || ""
    });
  }

  function confirmPodRuleDialog() {
    if (!podRuleDialog) return;

    const nextSetCount = podRuleDialog.isSingleScreen ? 1 : parsePositiveIntInput(podRuleDialog.setCount, podRuleDialog.setConfigs.length || 1);
    const nextSetDrafts = resizePodRuleSetDrafts(podRuleDialog.setConfigs, nextSetCount);
    const nextSetConfigs = nextSetDrafts.map((setConfig, setIndex) =>
      createPodSetConfig({
        id: setConfig.id,
        workSeconds: parseNonNegativeIntInput(setConfig.workSeconds, 0),
        restSeconds: setIndex === nextSetCount - 1 ? 0 : parseNonNegativeIntInput(setConfig.restSeconds, 0)
      })
    );
    const nextScreen: PodScreen = {
      id: podRuleDialog.screenId,
      screenIndex: podRuleDialog.screenIndex,
      loopCount: parsePositiveIntInput(podRuleDialog.loopCount, 1),
      stationRestSeconds: parseNonNegativeIntInput(podRuleDialog.stationRestSeconds, 0),
      setConfigs: nextSetConfigs,
      isCustomized: true
    };

    updateTemplateCourseScript((current) => ({
      ...current,
      training: {
        ...current.training,
        pods: current.training.pods.map((pod) =>
          pod.id === podRuleDialog.podId ? { ...pod, screens: pod.screens.map((s) => (s.id === nextScreen.id ? nextScreen : s)) } : pod
        )
      }
    }));
    setPodRuleDialog(null);
  }

  function confirmPodCopyDialog() {
    if (!podCopyDialog?.selectedSourceScreenId) return;

    updateTemplateCourseScript((current) => ({
      ...current,
      training: {
        ...current.training,
        pods: current.training.pods.map((pod) => {
          if (pod.id !== podCopyDialog.podId) return pod;
          const sourceScreen = pod.screens.find((screen) => screen.id === podCopyDialog.selectedSourceScreenId);
          if (!sourceScreen?.isCustomized) return pod;
          return {
            ...pod,
            screens: pod.screens.map((screen) =>
              screen.id === podCopyDialog.targetScreenId
                ? { ...cloneDeep(sourceScreen), id: podCopyDialog.targetScreenId, screenIndex: podCopyDialog.targetScreenIndex, isCustomized: true }
                : screen
            )
          };
        })
      }
    }));
    setPodCopyDialog(null);
    onNotice("规则已复制。");
  }

  function confirmPodConfigCopyDialog() {
    if (!podConfigCopyDialog?.selectedSourcePodId) return;

    updateTemplateCourseScript((current) => {
      const sourcePod = current.training.pods.find((pod) => pod.id === podConfigCopyDialog.selectedSourcePodId) || null;
      if (!sourcePod) return current;

      return {
        ...current,
        training: {
          ...current.training,
          pods: current.training.pods.map((pod) => {
            if (pod.id !== podConfigCopyDialog.targetPodId) return pod;

            const linkedGroup = current.training.videoGroups.find((group) => group.id === pod.videoGroupId) || null;
            const targetIsSingleScreen = linkedGroup?.screenCount === 1;
            const sourceIsSingleScreen = sourcePod.screens.length === 1;

            const resolveSourceForTarget = (screenIndex: number) => {
              if (sourceIsSingleScreen) return sourcePod.screens[0] || null;
              return sourcePod.screens.find((screen) => screen.screenIndex === screenIndex) || sourcePod.screens[0] || null;
            };

            return {
              ...pod,
              ending: sourcePod.ending,
              screens: pod.screens.map((screen) => {
                const sourceScreen = resolveSourceForTarget(screen.screenIndex);
                if (!sourceScreen) return screen;

                const linkedScreen = linkedGroup?.screens.find((entry) => entry.screenIndex === screen.screenIndex) || null;
                const isSingleScreenRule = targetIsSingleScreen || linkedScreen?.layout === "WATERFALL";

                return {
                  ...screen,
                  loopCount: sourceScreen.loopCount,
                  stationRestSeconds: sourceScreen.stationRestSeconds,
                  setConfigs: normalizePodSetConfigsForLayout(sourceScreen.setConfigs, isSingleScreenRule, 1),
                  isCustomized: true
                };
              })
            };
          })
        }
      };
    });

    setPodConfigCopyDialog(null);
    onNotice("Pod 配置已复制。");
  }

  return (
    <>
      <div className="editor-layout">
        <div className="editor-header">
          <h2>{draft.id ? "编辑整课模板" : "添加整课模板"}</h2>
          <p className="section-copy">可以从已有课程复制，也可以直接从空白脚本开始预设 Logo、分类、热身、正式组、冷身和 Pod 规则。</p>
        </div>

        <div className="editor-form">
          <div className="form-row two">
            <label className="field">
              <span>从已有课程生成</span>
              <select
                value={draft.sourceCourseId ? String(draft.sourceCourseId) : ""}
                onChange={(event) => {
                  const course = courses.find((item) => String(item.id) === event.target.value) || null;
                  void applySourceCourse(course);
                }}
              >
                <option value="">不选择，直接从空白模板编辑</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} · {course.version}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>课程包归属</span>
              <select
                value={draft.coursePackageId ? String(draft.coursePackageId) : ""}
                onChange={(event) =>
                  onUpdateDraft((current) => ({
                    ...current,
                    coursePackageId: event.target.value ? Number(event.target.value) : null
                  }))
                }
              >
                <option value="">未指定课程包</option>
                {coursePackages.map((coursePackage) => (
                  <option key={coursePackage.id} value={coursePackage.id}>
                    {coursePackage.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedCourse ? <p className="section-copy">来源课程：{selectedCourse.name}。复制后可继续修改模板内容。</p> : null}
        </div>
      </div>

      <CourseEditorPane
        tabId={`course-template-${draft.id || "new"}`}
        tabTitle="编辑课程"
        coursePackageName={coursePackageName}
        courseEditor={courseDraft}
        lessonTypes={lessonTypes}
        actions={actions}
        actionTypes={actionTypes}
        onAddLessonType={onAddLessonType}
        onUseWarmupTemplate={() => openTemplateUseDialog("warmup")}
        onUseCooldownTemplate={() => openTemplateUseDialog("cooldown")}
        onUseTrainingTemplate={(groupId) => {
          const targetGroup = courseDraft.script.training.videoGroups.find((group) => group.id === groupId) || null;
          openTemplateUseDialog("training", targetGroup);
        }}
        onUpdateCourseDraft={updateTemplateCourseDraft}
        onUpdateCourseScript={updateTemplateCourseScript}
        onSaveCourse={onSaveTemplate}
        onNotice={onNotice}
        onOpenPodRuleDialog={openPodRuleDialog}
        onOpenPodCopyDialog={openPodCopyDialog}
        onOpenPodConfigCopyDialog={openPodConfigCopyDialog}
        showSaveAction={false}
      />

      <CoursesOverlays
        courseEditor={courseDraft}
        templateCollections={collections}
        templateUseDialog={templateUseDialog}
        onTemplateUseDialogChange={(updater) => setTemplateUseDialog((current) => (current ? updater(current) : current))}
        onCloseTemplateUseDialog={() => setTemplateUseDialog(null)}
        onConfirmTemplateUseDialog={applyTemplateToCourseTemplate}
        podRuleDialog={podRuleDialog}
        onClosePodRuleDialog={() => setPodRuleDialog(null)}
        onConfirmPodRuleDialog={confirmPodRuleDialog}
        onPodRuleDialogChange={(updater) => setPodRuleDialog((current) => (current ? updater(current) : current))}
        podCopyDialog={podCopyDialog}
        onClosePodCopyDialog={() => setPodCopyDialog(null)}
        onConfirmPodCopyDialog={confirmPodCopyDialog}
        onPodCopyDialogChange={(updater) => setPodCopyDialog((current) => (current ? updater(current) : current))}
        podConfigCopyDialog={podConfigCopyDialog}
        onClosePodConfigCopyDialog={() => setPodConfigCopyDialog(null)}
        onConfirmPodConfigCopyDialog={confirmPodConfigCopyDialog}
        onPodConfigCopyDialogChange={(updater) => setPodConfigCopyDialog((current) => (current ? updater(current) : current))}
        createPodName={createPodName}
        formatSecondsStrategy={formatSecondsStrategy}
      />
    </>
  );
}
