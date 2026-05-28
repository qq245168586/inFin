import { useMemo, useState } from "react";
import { cloneDeep } from "../../utils/cloneDeep.ts";
import { useAuth } from "../../providers/AuthProvider.tsx";
import { useBusy } from "../../providers/BusyProvider.tsx";
import { useMeta } from "../../providers/MetaProvider.tsx";
import { useNotice } from "../../providers/NoticeProvider.tsx";
import type { Pod, PodScreen, VideoGroup } from "../../models/course/types.ts";
import type { CoursePackageRecord } from "../venues/types.ts";
import { cloneVideoGroupForEditor, cloneWaterfallSectionForEditor, createPodSetConfig } from "../../models/course/factories.ts";
import CourseLibrary from "./CourseLibrary.tsx";
import CoursesOverlays from "./CoursesOverlays.tsx";
import CourseEditorPane from "./CourseEditorPane.tsx";
import type { SegmentTemplateKind, TrainingTemplateRecord, WaterfallTemplateRecord } from "../../models/templates.ts";
import { formatTemplateSummary, getTemplateKindLabel } from "../../models/templates.ts";
import TemplateUseDialog from "./dialogs/TemplateUseDialog.tsx";
import { normalizePodSetConfigsForLayout } from "../../models/course/podSetConfigs.ts";
import { createPodName, syncPodsForVideoGroup } from "../../viewmodels/courses/podGraph.ts";
import { createPodRuleDialogState, resizePodRuleSetDrafts, type PodConfigCopyDialogState, type PodCopyDialogState, type PodRuleDialogState } from "../../viewmodels/courses/podDialogs.ts";
import type { TemplateUseDialogState } from "../../viewmodels/courses/templateUseDialog.ts";
import { parseNonNegativeIntInput, parsePositiveIntInput } from "../../utils/number.ts";
import { hasEditedVideoGroup } from "../../viewmodels/courses/courseEditorGuards.ts";
import useCourseFiltersVm from "../../viewmodels/courses/useCourseFiltersVm.ts";
import useCourseTabsVm from "../../viewmodels/courses/useCourseTabsVm.ts";
import useCourseCrudVm from "../../viewmodels/courses/useCourseCrudVm.ts";
import { createCourseDraftFromCourseTemplate } from "../../viewmodels/courses/courseEditorFactories.ts";
import { formatSecondsStrategy } from "../../viewmodels/courses/podFormatters.ts";
import { filterCoursesByCoursePackage } from "../../utils/coursePackageScope.ts";
import { displayTypeName } from "../../utils/typeNames.ts";

export default function CoursesRoute({
  selectedCoursePackage,
  onAddLessonType
}: {
  selectedCoursePackage: CoursePackageRecord | null;
  onAddLessonType: () => void;
}) {
  const { authHeader } = useAuth();
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();
  const { appData, reloadMeta } = useMeta();

  const courses = filterCoursesByCoursePackage(appData?.courses || [], selectedCoursePackage);
  const lessonTypes = appData?.lessonTypes || [];
  const lessonTypeMap = useMemo(
    () => new Map(lessonTypes.map((item) => [item.id, displayTypeName(item.name)])),
    [lessonTypes]
  );
  const templateCollections = appData?.templates || { warmup: [], cooldown: [], training: [], course: [] };
  const courseTemplates = useMemo(
    () =>
      (templateCollections.course || []).filter(
        (template) => {
          if (!selectedCoursePackage?.id) return true;
          const packageIds = template.coursePackageIds?.length
            ? template.coursePackageIds
            : template.coursePackageId
              ? [template.coursePackageId]
              : [];
          return !packageIds.length || packageIds.some((id) => Number(id) === Number(selectedCoursePackage.id));
        }
      ),
    [selectedCoursePackage?.id, templateCollections.course]
  );

  const courseFiltersVm = useCourseFiltersVm(courses);
  const tabsVm = useCourseTabsVm();
  const [templateUseDialog, setTemplateUseDialog] = useState<TemplateUseDialogState | null>(null);
  const [courseTemplateDialog, setCourseTemplateDialog] = useState<{ selectedTemplateId: string } | null>(null);
  const [podRuleDialog, setPodRuleDialog] = useState<PodRuleDialogState | null>(null);
  const [podCopyDialog, setPodCopyDialog] = useState<PodCopyDialogState | null>(null);
  const [podConfigCopyDialog, setPodConfigCopyDialog] = useState<PodConfigCopyDialogState | null>(null);

  const activeCourseEditorTab = tabsVm.activeCourseEditorTab;
  const courseEditor = tabsVm.courseEditor;
  const isCourseLibraryActive = tabsVm.isCourseLibraryActive;

  const courseCrudVm = useCourseCrudVm({
    authHeader,
    courseEditor,
    coursePackageId: activeCourseEditorTab?.coursePackageId || selectedCoursePackage?.id || null,
    existingCourses: appData?.courses || [],
    onBusyText: setBusyText,
    onNotice: (message, tone) => pushNotice(message, tone === "error" ? "error" : undefined),
    onReloadMeta: reloadMeta,
    onSavedCourse: tabsVm.applySavedCourseToActiveTab,
    onDeletedCourse: tabsVm.closeCourseById
  });

  function closeCourseTab(tabId: string) {
    tabsVm.closeCourseTab(tabId);
    setPodRuleDialog(null);
    setPodCopyDialog(null);
    setPodConfigCopyDialog(null);
  }

  function openCourseEditorForCurrentPackage(course: Parameters<typeof tabsVm.openCourseEditor>[0] = null) {
    if (!selectedCoursePackage) {
      pushNotice("请先选择课程包。", "error");
      return;
    }
    tabsVm.openCourseEditor(course ?? null, selectedCoursePackage.id);
  }

  function openTemplateUseDialog(target: SegmentTemplateKind, targetVideoGroup?: VideoGroup | null) {
    if (!(templateCollections[target] || []).length) {
      pushNotice(`还没有可用的${getTemplateKindLabel(target)}。`, "error");
      return;
    }

    if (target === "training" && !targetVideoGroup) {
      pushNotice("请先选择要套用模版的视频组。", "error");
      return;
    }

    setTemplateUseDialog({
      target,
      selectedTemplateId: String((templateCollections[target] || [])[0]?.id ?? ""),
      targetVideoGroupId: targetVideoGroup?.id,
      targetVideoGroupName: targetVideoGroup?.name || undefined
    });
  }

  function openCourseTemplateDialog() {
    if (!selectedCoursePackage) {
      pushNotice("请先选择课程包。", "error");
      return;
    }
    if (!courseTemplates.length) {
      pushNotice("当前课程包还没有可用的整课模板。", "error");
      return;
    }
    setCourseTemplateDialog({ selectedTemplateId: String(courseTemplates[0]?.id ?? "") });
  }

  function createCourseFromTemplate() {
    if (!selectedCoursePackage) {
      pushNotice("请先选择课程包。", "error");
      return;
    }

    const selectedTemplate = courseTemplates.find(
      (template) => String(template.id) === String(courseTemplateDialog?.selectedTemplateId)
    );
    if (!selectedTemplate) {
      pushNotice("请选择要使用的整课模板。", "error");
      return;
    }

    const draft = createCourseDraftFromCourseTemplate(selectedTemplate);
    tabsVm.openCourseDraft(draft, selectedCoursePackage.id);
    setCourseTemplateDialog(null);
    pushNotice(`已从整课模板“${selectedTemplate.name}”创建课程，请先修改正式训练内容后再保存。`);
  }

  function applyTemplateToCourse() {
    if (!courseEditor || !templateUseDialog?.selectedTemplateId) return;

    const templates = templateCollections[templateUseDialog.target] || [];
    const selectedTemplate = templates.find((template) => String(template.id) === String(templateUseDialog.selectedTemplateId));
    if (!selectedTemplate) {
      pushNotice("请选择要使用的模版。", "error");
      return;
    }

    if (templateUseDialog.target === "training") {
      const trainingTemplate = selectedTemplate as TrainingTemplateRecord;
      if (!templateUseDialog.targetVideoGroupId) {
        pushNotice("没有找到要覆盖的视频组。", "error");
        return;
      }
      const targetGroup = courseEditor.script.training.videoGroups.find((group) => group.id === templateUseDialog.targetVideoGroupId);
      if (!targetGroup) {
        pushNotice("当前视频组不存在。", "error");
        return;
      }
      if (
        hasEditedVideoGroup(targetGroup) &&
        !window.confirm(`使用模版会覆盖当前视频组“${templateUseDialog.targetVideoGroupName || targetGroup.name || "视频组"}”的内容，是否继续？`)
      ) {
        return;
      }
      tabsVm.updateCourseScript((current) => ({
        ...syncPodsForVideoGroup(current, {
          ...cloneVideoGroupForEditor(trainingTemplate.videoGroup, trainingTemplate.name),
          id: templateUseDialog.targetVideoGroupId
        })
      }));
      pushNotice(`已用模版“${trainingTemplate.name}”覆盖当前视频组。`);
    } else {
      const waterfallTemplate = selectedTemplate as WaterfallTemplateRecord;
      const sectionTitle = templateUseDialog.target === "cooldown" ? "冷身" : "热身";
      tabsVm.updateCourseScript((current) => ({
        ...current,
        sections: {
          ...current.sections,
          [templateUseDialog.target]: cloneWaterfallSectionForEditor(waterfallTemplate.section, sectionTitle)
        }
      }));
      pushNotice(`已应用${sectionTitle}模版“${waterfallTemplate.name}”。`);
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
    const pods = courseEditor?.script.training.pods || [];
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

    tabsVm.updateCourseScript((current) => ({
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

    tabsVm.updateCourseScript((current) => ({
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
    pushNotice("规则已复制。");
  }

  function confirmPodConfigCopyDialog() {
    if (!podConfigCopyDialog?.selectedSourcePodId) return;

    tabsVm.updateCourseScript((current) => {
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
    pushNotice("Pod 配置已复制。");
  }

  return (
    <>
      <section className="page-card is-no-padding">
        <div className="inner-tabs">
          <button
            className={`inner-tab ${isCourseLibraryActive ? "is-active" : ""}`}
            type="button"
            onClick={() => tabsVm.setActiveCourseTabId("all-courses")}
          >
            全部课程
          </button>
          {tabsVm.courseEditorTabs.map((tab) => (
            <button
              key={tab.tabId}
              className={`inner-tab is-closable ${tabsVm.activeCourseTabId === tab.tabId ? "is-active" : ""}`}
              type="button"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest(".inner-tab-close-mark")) {
                  event.preventDefault();
                  closeCourseTab(tab.tabId);
                  return;
                }
                tabsVm.setActiveCourseTabId(tab.tabId);
              }}
            >
              <span>{tab.title}</span>
              <span className="inner-tab-close-mark">×</span>
            </button>
          ))}
        </div>

        {!isCourseLibraryActive && courseEditor ? (
          <CourseEditorPane
            tabId={tabsVm.activeCourseTabId}
            tabTitle={activeCourseEditorTab?.title || "编辑课程"}
            coursePackageName={
              activeCourseEditorTab?.coursePackageId
                ? selectedCoursePackage?.id === activeCourseEditorTab.coursePackageId
                  ? selectedCoursePackage.name
                  : appData?.coursePackages?.find((item) => Number(item.id) === Number(activeCourseEditorTab.coursePackageId))?.name || ""
                : selectedCoursePackage?.name || ""
            }
            courseEditor={courseEditor}
            lessonTypes={lessonTypes}
            actions={appData?.actions || []}
            actionTypes={appData?.actionTypes || []}
            onAddLessonType={onAddLessonType}
            onUseWarmupTemplate={() => openTemplateUseDialog("warmup")}
            onUseCooldownTemplate={() => openTemplateUseDialog("cooldown")}
            onUseTrainingTemplate={(groupId) => {
              const targetGroup = courseEditor.script.training.videoGroups.find((group) => group.id === groupId) || null;
              openTemplateUseDialog("training", targetGroup);
            }}
            onUpdateCourseDraft={(updater) => tabsVm.setCourseEditor((current) => updater(current))}
            onUpdateCourseScript={tabsVm.updateCourseScript}
            onSaveCourse={() => void courseCrudVm.saveCourse()}
            onNotice={pushNotice}
            onOpenPodRuleDialog={openPodRuleDialog}
            onOpenPodCopyDialog={openPodCopyDialog}
            onOpenPodConfigCopyDialog={openPodConfigCopyDialog}
          />
        ) : (
          <CourseLibrary
            lessonTypes={lessonTypes}
            lessonTypeNameById={lessonTypeMap}
            courseFiltersDraft={courseFiltersVm.draft}
            onCourseFiltersDraftChange={(updater) => courseFiltersVm.setDraft((current) => updater(current))}
            onSearch={courseFiltersVm.search}
            filteredCourses={courseFiltersVm.filteredCourses}
            courseTemplates={courseTemplates}
            coursePackageName={selectedCoursePackage?.name || ""}
            onOpenCourseEditor={(course) => openCourseEditorForCurrentPackage(course ?? null)}
            onOpenCourseTemplateDialog={openCourseTemplateDialog}
            onRemoveCourse={(courseId) => void courseCrudVm.removeCourse(courseId)}
          />
        )}
      </section>

      {!isCourseLibraryActive ? (
        <CoursesOverlays
          courseEditor={courseEditor}
          templateCollections={templateCollections}
          templateUseDialog={templateUseDialog}
          onTemplateUseDialogChange={(updater) => setTemplateUseDialog((current) => (current ? updater(current) : current))}
          onCloseTemplateUseDialog={() => setTemplateUseDialog(null)}
          onConfirmTemplateUseDialog={applyTemplateToCourse}
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
      ) : null}

      {isCourseLibraryActive && courseTemplateDialog ? (
        <TemplateUseDialog
          state={{ target: "course", selectedTemplateId: courseTemplateDialog.selectedTemplateId }}
          options={courseTemplates}
          title="从整课模板创建课程"
          confirmText="创建课程"
          confirmDisabled={!courseTemplateDialog.selectedTemplateId}
          formatTemplateSummary={formatTemplateSummary}
          onSelectTemplateId={(id) => setCourseTemplateDialog({ selectedTemplateId: id })}
          onClose={() => setCourseTemplateDialog(null)}
          onConfirm={createCourseFromTemplate}
        />
      ) : null}
    </>
  );
}
