import type { TemplateKind } from "../../models/templates.ts";

export interface TemplateUseDialogState {
  target: TemplateKind;
  selectedTemplateId: string;
  targetVideoGroupId?: string;
  targetVideoGroupName?: string;
}
