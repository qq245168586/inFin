import { EXACT_TRANSLATIONS, type Locale } from "./translations.ts";

const textSources = new WeakMap<Text, string>();
const attrSources = new WeakMap<Element, Record<string, string>>();

const TRANSLATABLE_ATTRS = ["placeholder", "title", "aria-label"];
const SKIP_TEXT_PARENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
const SUPPORTED_LOCALES: Locale[] = ["zh", "en", "ru"];

const TERM_TRANSLATIONS: Record<Exclude<Locale, "zh">, Array<[RegExp, string]>> = {
  en: [
    [/周一/g, "Mon"], [/周二/g, "Tue"], [/周三/g, "Wed"], [/周四/g, "Thu"], [/周五/g, "Fri"], [/周六/g, "Sat"], [/周日/g, "Sun"],
    [/动作\s*(\d+)/g, "Action $1"], [/训练\s*(\d+)/g, "Work $1"], [/休息\s*(\d+)/g, "Rest $1"],
    [/(\d+)\s*个动作位/g, "$1 action slots"], [/(\d+)\s*个动作/g, "$1 actions"], [/(\d+)\s*个 AB 素材/g, "$1 AB assets"],
    [/(\d+)\s*个 AB/g, "$1 AB"], [/每个 AB/g, "Each AB"], [/播放/g, "Play"], [/(\d+)\s*组/g, "$1 sets"], [/(\d+)\s*次/g, "$1 times"],
    [/(\d+)\s*台/g, "$1 devices"], [/屏幕\s*(\d+)/g, "Screen $1"], [/版本\s*([^\s，。]+)/g, "Version $1"], [/场馆：/g, "Venue: "],
    [/设备：/g, "Device: "], [/数量：/g, "Count: "], [/目标版本：/g, "Target version: "], [/失败：/g, "Failed: "], [/跳过：/g, "Skipped: "],
    [/已下发更新：/g, "Updates sent: "], [/正在通知/g, "Notifying"], [/安装/g, "install"], [/正在/g, ""]
  ],
  ru: [
    [/周一/g, "Пн"], [/周二/g, "Вт"], [/周三/g, "Ср"], [/周四/g, "Чт"], [/周五/g, "Пт"], [/周六/g, "Сб"], [/周日/g, "Вс"],
    [/动作\s*(\d+)/g, "Упражнение $1"], [/训练\s*(\d+)/g, "Работа $1"], [/休息\s*(\d+)/g, "Отдых $1"],
    [/(\d+)\s*个动作位/g, "$1 слотов"], [/(\d+)\s*个动作/g, "$1 упражнений"], [/(\d+)\s*个 AB 素材/g, "$1 AB материалов"],
    [/(\d+)\s*个 AB/g, "$1 AB"], [/每个 AB/g, "Каждый AB"], [/播放/g, "Воспроизвести"], [/(\d+)\s*组/g, "$1 подходов"], [/(\d+)\s*次/g, "$1 раз"],
    [/(\d+)\s*台/g, "$1 устройств"], [/屏幕\s*(\d+)/g, "Экран $1"], [/版本\s*([^\s，。]+)/g, "Версия $1"], [/场馆：/g, "Зал: "],
    [/设备：/g, "Устройство: "], [/数量：/g, "Количество: "], [/目标版本：/g, "Целевая версия: "], [/失败：/g, "Ошибки: "],
    [/跳过：/g, "Пропущено: "], [/已下发更新：/g, "Обновления отправлены: "], [/正在通知/g, "Уведомление"], [/安装/g, "установить"], [/正在/g, ""]
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

  const exact = EXACT_TRANSLATIONS[locale][trimmed];
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
