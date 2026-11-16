import { useEffect, useState, type InputHTMLAttributes } from "react";

export interface DraftNumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number;
  minValue?: number;
  onValueChange: (value: number) => void;
}

export default function DraftNumberInput({ value, minValue = 0, onValueChange, onBlur, onFocus, ...props }: DraftNumberInputProps) {
  const [draft, setDraft] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value));
    }
  }, [value, isFocused]);

  return (
    <input
      {...props}
      type="number"
      min={minValue}
      value={draft}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);

        if (nextValue === "" || nextValue === "-") {
          return;
        }

        const parsed = Number(nextValue);
        if (Number.isFinite(parsed) && parsed >= minValue) {
          onValueChange(Math.floor(parsed));
        }
      }}
      onBlur={(event) => {
        setIsFocused(false);

        if (draft === "" || draft === "-") {
          const fallbackValue = Math.max(value, minValue);
          setDraft(String(fallbackValue));
          onValueChange(fallbackValue);
          onBlur?.(event);
          return;
        }

        const parsed = Number(draft);
        const normalized = Number.isFinite(parsed) ? Math.max(Math.floor(parsed), minValue) : Math.max(value, minValue);
        setDraft(String(normalized));
        onValueChange(normalized);
        onBlur?.(event);
      }}
    />
  );
}
