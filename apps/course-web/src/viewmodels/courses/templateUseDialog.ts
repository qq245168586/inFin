import type { SegmentTemplateKind } from "../../models/templates.ts";

export interface TemplateUseDialogState {
  target: SegmentTemplateKind;
  selectedTemplateId: string;
  targetVideoGroupId?: string;
  targetVideoGroupName?: string;
}
