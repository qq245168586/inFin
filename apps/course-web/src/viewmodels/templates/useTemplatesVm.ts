import { useMemo, useState } from "react";
import type { TemplateCollections, TemplateDraft, TemplateKind, TemplateRecord } from "../../models/templates.ts";
import { createTemplateCollections, createTemplateDraft, getTemplateKindLabel } from "../../models/templates.ts";
import { cloneCourseScriptWithFreshIds } from "../../models/course/factories.ts";
import { requestJson } from "../../services/requestJson.ts";
import { buildCoursePackageRequestHeaders } from "../../services/api/coursePackageContext.ts";
import { uploadBinary } from "../../services/uploadBinary.ts";
import { getErrorMessage } from "../../utils/errors.ts";
import { getCourseDraftIssues } from "../courses/courseValidation.ts";
import { normalizeCourseScriptLocal } from "../courses/courseScriptNormalize.ts";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export function useTemplatesVm({
  templateCollections,
  selectedCoursePackageId,
  authHeader,
  onReloadMeta,
  onBusyText,
  onNotice
}: {
  templateCollections: TemplateCollections | null | undefined;
  selectedCoursePackageId: number | null;
  authHeader: string;
  onReloadMeta: () => Promise<void>;
  onBusyText: (text: string) => void;
  onNotice: (message: string, tone?: "success" | "error") => void;
}) {
  const collections = templateCollections || createTemplateCollections();
  const [templateTab, setTemplateTab] = useState<TemplateKind>("warmup");
  const [templateEditor, setTemplateEditor] = useState<TemplateDraft | null>(null);
  const activeTemplateList = collections[templateTab] || [];

  const editingLabel = useMemo(() => {
    if (!templateEditor) return "编辑模板";
    return `${templateEditor.id ? "编辑" : "添加"}${getTemplateKindLabel(templateEditor.kind)}`;
  }, [templateEditor]);

  function updateTemplateEditor(updater: (current: TemplateDraft) => TemplateDraft) {
    setTemplateEditor((current) => (current ? updater(current) : current));
  }

  function openTemplateEditor(template: TemplateRecord | null = null, kind: TemplateKind = templateTab) {
    const nextKind = template?.kind || kind;
    setTemplateTab(nextKind);
    const nextDraft = createTemplateDraft(template, nextKind);
    setTemplateEditor({
      ...nextDraft,
      coursePackageId: nextDraft.coursePackageId || selectedCoursePackageId
    });
  }

  async function saveTemplate() {
    if (!templateEditor) return;
    if (!templateEditor.name.trim()) {
      onNotice("模板名称不能为空。", "error");
      return;
    }

    onBusyText("正在保存模板...");
    try {
      let payload: Record<string, unknown>;
      if (templateEditor.kind === "training") {
        payload = {
          kind: "training",
          name: templateEditor.name.trim(),
          coursePackageId: templateEditor.coursePackageId || undefined,
          coursePackageIds: templateEditor.coursePackageId ? [templateEditor.coursePackageId] : [],
          videoGroup: templateEditor.videoGroup ? { ...templateEditor.videoGroup, name: templateEditor.name.trim() } : null
        };
      } else if (templateEditor.kind === "course") {
        if (!templateEditor.script) {
          onNotice("请先选择一门已有课程生成整课模板。", "error");
          return;
        }

        let logoMedia = templateEditor.logoMedia;
        if (templateEditor.logoFile) {
          logoMedia = await uploadBinary("image", templateEditor.logoFile);
        }

        const script = normalizeCourseScriptLocal(cloneCourseScriptWithFreshIds(templateEditor.script));
        script.metadata.name = (templateEditor.courseName || templateEditor.name).trim();
        script.metadata.description = script.metadata.description.trim();
        script.metadata.topic = script.metadata.topic.trim();
        script.metadata.rotationType = script.metadata.rotationType || "REGION";
        const issues = getCourseDraftIssues({
          id: null,
          typeIds: templateEditor.typeIds,
          logoMedia,
          logoFile: null,
          logoPreview: logoMedia?.url || "",
          script
        });
        if (issues.length) {
          onNotice(issues[0], "error");
          return;
        }

        payload = {
          kind: "course",
          name: templateEditor.name.trim(),
          courseName: (templateEditor.courseName || templateEditor.name).trim(),
          description: script.metadata.description,
          topic: script.metadata.topic,
          rotationType: script.metadata.rotationType,
          logoMedia,
          typeIds: templateEditor.typeIds,
          script,
          coursePackageId: templateEditor.coursePackageId || undefined,
          coursePackageIds: templateEditor.coursePackageId ? [templateEditor.coursePackageId] : [],
          sourceCourseId: templateEditor.sourceCourseId || undefined,
          summary: templateEditor.summary || undefined
        };
      } else {
        payload = {
          kind: templateEditor.kind,
          name: templateEditor.name.trim(),
          coursePackageId: templateEditor.coursePackageId || undefined,
          coursePackageIds: templateEditor.coursePackageId ? [templateEditor.coursePackageId] : [],
          section: templateEditor.section
        };
      }

    if (templateEditor.id) {
        await requestJson<ApiResponse<TemplateRecord>>(`/api/templates/${templateEditor.id}`, {
          method: "PUT",
          headers: buildCoursePackageRequestHeaders(authHeader, selectedCoursePackageId),
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson<ApiResponse<TemplateRecord>>("/api/templates", {
          method: "POST",
          headers: buildCoursePackageRequestHeaders(authHeader, selectedCoursePackageId),
          body: JSON.stringify(payload)
        });
      }

      await onReloadMeta();
      setTemplateEditor(null);
      onNotice("模板已保存。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }

  async function removeTemplate(template: TemplateRecord) {
    if (!window.confirm(`确认删除模板“${template.name}”吗？`)) return;
    onBusyText("正在删除模板...");
    try {
      await requestJson(`/api/templates/${template.id}`, {
        method: "DELETE",
        headers: buildCoursePackageRequestHeaders(authHeader, selectedCoursePackageId)
      });
      await onReloadMeta();
      if (templateEditor?.id === template.id) {
        setTemplateEditor(null);
      }
      onNotice("模板已删除。");
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      onBusyText("");
    }
  }

  return {
    templateTab,
    setTemplateTab,
    templateEditor,
    setTemplateEditor,
    editingLabel,
    activeTemplateList,
    updateTemplateEditor,
    openTemplateEditor,
    saveTemplate,
    removeTemplate
  };
}
