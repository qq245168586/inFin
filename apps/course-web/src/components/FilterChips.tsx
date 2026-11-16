import { displayTypeName } from "../utils/typeNames.ts";

export interface ChipOption {
  id: number;
  name: string;
  sourceLabel?: string;
}

export interface FilterChipsProps {
  options: ChipOption[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onAdd?: () => void;
  addLabel?: string;
}

export default function FilterChips({ options, selectedIds, onToggle, onAdd, addLabel = "+ 添加" }: FilterChipsProps) {
  return (
    <div className="chip-row">
      {options.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`filter-chip ${selectedIds.includes(item.id) ? "is-active" : ""}`}
          onClick={() => onToggle(item.id)}
        >
          {displayTypeName(item.name)}
          {item.sourceLabel ? <span className="filter-chip-source">{item.sourceLabel}</span> : null}
        </button>
      ))}
      {onAdd ? (
        <button type="button" className="filter-chip is-add" onClick={onAdd}>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}
