import { useMemo, useState } from "react";
import type { CourseRecord, CourseScript } from "../../models/course/types.ts";
import type { CourseDraft, CourseEditorTabState } from "./types.ts";
import { createCourseDraft, createCourseEditorTab } from "./courseEditorFactories.ts";
import { normalizeCourseScriptLocal } from "./courseScriptNormalize.ts";

export type CourseTabId = "all-courses" | string;

export default function useCourseTabsVm() {
  const [courseEditorTabs, setCourseEditorTabs] = useState<CourseEditorTabState[]>([]);
  const [activeCourseTabId, setActiveCourseTabId] = useState<CourseTabId>("all-courses");

  const activeCourseEditorTab = useMemo(
    () => courseEditorTabs.find((tab) => tab.tabId === activeCourseTabId) ?? null,
    [activeCourseTabId, courseEditorTabs]
  );
  const courseEditor = activeCourseEditorTab?.draft ?? null;
  const isCourseLibraryActive = activeCourseTabId === "all-courses" || !activeCourseEditorTab;

  function setCourseEditor(nextValue: CourseDraft | ((current: CourseDraft) => CourseDraft) | null) {
    if (activeCourseTabId === "all-courses") return;
    if (nextValue === null) {
      setActiveCourseTabId("all-courses");
      return;
    }
    setCourseEditorTabs((current) =>
      current.map((tab) =>
        tab.tabId === activeCourseTabId ? { ...tab, draft: typeof nextValue === "function" ? nextValue(tab.draft) : nextValue } : tab
      )
    );
  }

  function updateCourseScript(updater: (current: CourseScript) => CourseScript) {
    setCourseEditor((current) => ({ ...current, script: normalizeCourseScriptLocal(updater(current.script)) }));
  }

  function openCourseEditor(course: CourseRecord | null = null) {
    if (course?.id) {
      const existingTab = courseEditorTabs.find((tab) => tab.courseId === course.id);
      if (existingTab) {
        setActiveCourseTabId(existingTab.tabId);
        return;
      }
    }

    const nextTab = createCourseEditorTab(course);
    setCourseEditorTabs((current) => [...current, nextTab]);
    setActiveCourseTabId(nextTab.tabId);
  }

  function closeCourseTab(tabId: string) {
    const currentIndex = courseEditorTabs.findIndex((tab) => tab.tabId === tabId);
    const nextTabs = courseEditorTabs.filter((tab) => tab.tabId !== tabId);
    setCourseEditorTabs(nextTabs);

    if (activeCourseTabId === tabId) {
      const fallbackTab = nextTabs[currentIndex - 1] || nextTabs[currentIndex] || null;
      setActiveCourseTabId(fallbackTab ? fallbackTab.tabId : "all-courses");
    }
  }

  function closeCourseById(courseId: number) {
    setCourseEditorTabs((current) => current.filter((tab) => tab.courseId !== courseId));
    if (activeCourseEditorTab?.courseId === courseId) {
      setActiveCourseTabId("all-courses");
    }
  }

  function applySavedCourseToActiveTab(savedCourse: CourseRecord) {
    setCourseEditorTabs((current) =>
      current.map((tab) =>
        tab.tabId === activeCourseTabId ? { ...tab, courseId: savedCourse.id, title: "编辑课程", draft: createCourseDraft(savedCourse) } : tab
      )
    );
  }

  function openNewCourse() {
    openCourseEditor(null);
  }

  function closeAllEditors() {
    setCourseEditorTabs([]);
    setActiveCourseTabId("all-courses");
  }

  return {
    courseEditorTabs,
    setCourseEditorTabs,
    activeCourseTabId,
    setActiveCourseTabId,
    activeCourseEditorTab,
    courseEditor,
    isCourseLibraryActive,
    setCourseEditor,
    updateCourseScript,
    openCourseEditor,
    openNewCourse,
    closeCourseTab,
    closeCourseById,
    closeAllEditors,
    applySavedCourseToActiveTab
  };
}
