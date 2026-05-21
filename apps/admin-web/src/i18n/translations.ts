import en from "./en.ts";
import ru from "./ru.ts";

export type Locale = "zh" | "en" | "ru";

export const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" }
];

export const EXACT_TRANSLATIONS = { en, ru } as const;
