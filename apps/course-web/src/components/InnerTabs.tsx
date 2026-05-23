import type { ReactNode } from "react";

interface InnerTabsProps {
  baseLabel: string;
  editingLabel: string;
  isEditing: boolean;
  onBack: () => void;
  onClose: () => void;
  trailing?: ReactNode;
}

export default function InnerTabs({ baseLabel, editingLabel, isEditing, onBack, onClose, trailing }: InnerTabsProps) {
  return (
    <div className="inner-tabs">
      <button className={`inner-tab ${!isEditing ? "is-active" : ""}`} type="button" onClick={onBack}>
        {baseLabel}
      </button>
      {isEditing ? (
        <button className="inner-tab is-active is-closable" type="button" onClick={onClose}>
          {editingLabel}
          <span className="inner-tab-close-mark">×</span>
        </button>
      ) : null}
      {trailing}
    </div>
  );
}
