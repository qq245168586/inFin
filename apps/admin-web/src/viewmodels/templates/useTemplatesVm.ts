import { useMemo, useState } from "react";
import type { TemplateCollections, TemplateDraft, TemplateKind, TemplateRecord } from "../../models/templates.ts";
import { createTemplateCollections, createTemplateDraft, getTemplateKindLabel } from "../../models/templates.ts";
import { requestJson } from "../../services/requestJson.ts";
import { getErrorMessage } from "../../utils/errors.ts";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export function useTemplatesVm({
  templateCollections,
  onReloadMeta,
  onBusyText,
  onNotice
}: {
  templateCollections: TemplateCollections | null | undefined;
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
    setTemplateEditor(createTemplateDraft(template, nextKind));
  }

  async function saveTemplate() {
    if (!templateEditor) return;
    if (!templateEditor.name.trim()) {
      onNotice("模板名称不能为空。", "error");
      return;
    }

    onBusyText("正在保存模板...");
    try {
      const payload =
        templateEditor.kind === "training"
          ? {
              kind: "training",
              name: templateEditor.name.trim(),
              videoGroup: templateEditor.videoGroup
                ? { ...templateEditor.videoGroup, name: templateEditor.name.trim() }
                : null
            }
          : {
              kind: templateEditor.kind,
              name: templateEditor.name.trim(),
              section: templateEditor.section
            };

      if (templateEditor.id) {
        await requestJson<ApiResponse<TemplateRecord>>(`/api/templates/${templateEditor.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await requestJson<ApiResponse<TemplateRecord>>("/api/templates", {
          method: "POST",
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
      await requestJson(`/api/templates/${template.id}`, { method: "DELETE" });
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
