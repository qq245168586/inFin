import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTranslations, translateText } from "../i18n/translator";
import { LOCALES, type Locale } from "../i18n/translations";

const STORAGE_KEY = "infini-coach-locale";

interface I18nContextValue {
  locale: Locale;
  locales: typeof LOCALES;
  setLocale: (locale: Locale) => void;
  t: (text: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" || saved === "ru" || saved === "zh" ? saved : "zh";
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
  }, []);

  const t = useCallback((text: string) => translateText(text, locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
    applyTranslations(document.body, locale);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") {
          applyTranslations(mutation.target.parentNode || document.body, locale);
          return;
        }
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          applyTranslations(mutation.target, locale);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            applyTranslations(node.parentNode || document.body, locale);
          } else if (node instanceof Element) {
            applyTranslations(node, locale);
          }
        });
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
      characterData: true,
      childList: true,
      subtree: true
    });
    return () => observer.disconnect();
  }, [locale]);

  useEffect(() => {
    const nativeConfirm = window.confirm;
    window.confirm = (message?: string) => nativeConfirm(translateText(String(message ?? ""), locale));
    return () => {
      window.confirm = nativeConfirm;
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, locales: LOCALES, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
