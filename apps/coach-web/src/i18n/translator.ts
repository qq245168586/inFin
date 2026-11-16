import { EXACT_TRANSLATIONS, type Locale } from "./translations";

const textSources = new WeakMap<Text, string>();
const attrSources = new WeakMap<Element, Record<string, string>>();

const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"];
const SKIP_TEXT_PARENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
const SUPPORTED_LOCALES: Locale[] = ["zh", "en", "ru"];

const TERM_TRANSLATIONS: Record<Exclude<Locale, "zh">, Array<[RegExp, string]>> = {
  en: [
    [/屏幕\s*(\d+)/g, "Screen $1"],
    [/(\d+)\s*节课程/g, "$1 courses"],
    [/(\d+)\s*站/g, "$1 sets"],
    [/健身房：/g, "Gym: "]
  ],
  ru: [
    [/屏幕\s*(\d+)/g, "Экран $1"],
    [/(\d+)\s*节课程/g, "$1 курсов"],
    [/(\d+)\s*站/g, "$1 станций"],
    [/健身房：/g, "Зал: "]
  ]
};

function preserveWhitespace(source: string, translated: string): string {
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

export function translateText(source: string, locale: Locale): string {
  if (locale === "zh") return source;
  const trimmed = source.trim();
  if (!trimmed) return source;
  const exact = EXACT_TRANSLATIONS[locale][trimmed as keyof typeof EXACT_TRANSLATIONS[typeof locale]];
  if (exact) return preserveWhitespace(source, exact);
  let translated = trimmed;
  for (const [pattern, replacement] of TERM_TRANSLATIONS[locale]) {
    translated = translated.replace(pattern, replacement);
  }
  return preserveWhitespace(source, translated);
}

function isKnownRenderedValue(source: string, currentValue: string): boolean {
  return SUPPORTED_LOCALES.some((locale) => currentValue === translateText(source, locale));
}

function translateTextNode(node: Text, locale: Locale) {
  const parent = node.parentElement;
  if (!parent || SKIP_TEXT_PARENTS.has(parent.tagName)) return;

  let source = textSources.get(node);
  const currentValue = node.nodeValue ?? "";
  if (source) {
    if (!isKnownRenderedValue(source, currentValue)) {
      source = currentValue;
      textSources.set(node, source);
    }
  } else {
    source = currentValue;
    textSources.set(node, source);
  }

  const nextValue = translateText(source, locale);
  if (node.nodeValue !== nextValue) {
    node.nodeValue = nextValue;
  }
}

function translateElementAttrs(element: Element, locale: Locale) {
  const sourceAttrs = attrSources.get(element) || {};
  let changed = false;

  TRANSLATABLE_ATTRS.forEach((attr) => {
    const currentValue = element.getAttribute(attr);
    if (!currentValue) return;
    let source = sourceAttrs[attr];
    if (source) {
      if (!isKnownRenderedValue(source, currentValue)) {
        source = currentValue;
      }
    } else {
      source = currentValue;
    }
    sourceAttrs[attr] = source;
    const nextValue = translateText(source, locale);
    if (currentValue !== nextValue) {
      element.setAttribute(attr, nextValue);
    }
    changed = true;
  });

  if (changed) {
    attrSources.set(element, sourceAttrs);
  }
}

export function applyTranslations(root: ParentNode, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text, locale);
    current = walker.nextNode();
  }

  if (root instanceof Element) {
    translateElementAttrs(root, locale);
  }
  root.querySelectorAll?.("*").forEach((element) => translateElementAttrs(element, locale));
}
