// UI translation. English is the source text; every key must exist in
// locales/en/*.json. Korean falls back to English for missing keys.
// Rules for adding copy: .claude/rules/src.md → "Translation (i18n)".
import { Fragment, createElement, type ReactNode } from "react";
import { useSettingsStore, type AppSettings } from "../stores/settingsStore";

export type UiLanguage = AppSettings["uiLanguage"];
export type Lang = "en" | "ko";
export type Dict = Record<string, string>;
type Params = Record<string, string | number>;

function mergeDicts(files: Record<string, Dict>): Dict {
  return Object.assign({}, ...Object.values(files));
}

/** Every locale file merged per language (keys carry their area prefix). */
export const localeDicts: Record<Lang, Dict> = {
  en: mergeDicts(import.meta.glob<Dict>("./locales/en/*.json", { eager: true, import: "default" })),
  ko: mergeDicts(import.meta.glob<Dict>("./locales/ko/*.json", { eager: true, import: "default" })),
};

export function resolveLanguage(setting: UiLanguage | undefined): Lang {
  if (setting === "en" || setting === "ko") return setting;
  const system = typeof navigator === "undefined" ? "" : navigator.language ?? "";
  return system.toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function currentLanguage(): Lang {
  return resolveLanguage(useSettingsStore.getState().settings.uiLanguage);
}

export function createTranslator(dicts: Record<Lang, Dict>, getLang: () => Lang) {
  // Korean has no plural forms; English picks `_one` for exactly one.
  const pick = (dict: Dict, lang: Lang, key: string, count: unknown) => {
    if (typeof count === "number") {
      const plural = dict[`${key}_${lang === "en" && count === 1 ? "one" : "other"}`];
      if (plural !== undefined) return plural;
    }
    return dict[key];
  };
  const raw = (key: string, count: unknown) => {
    const lang = getLang();
    return (lang === "ko" ? pick(dicts.ko, "ko", key, count) : undefined)
      ?? pick(dicts.en, "en", key, count)
      ?? key;
  };

  /** Translated text with `{{name}}` placeholders filled from params. */
  function t(key: string, params?: Params): string {
    const text = raw(key, params?.count);
    if (!params) return text;
    return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match);
  }

  /**
   * Like t(), but placeholders may be React elements (links, <kbd>, <code>),
   * so a sentence stays one translation unit whatever its word order.
   */
  function tx(key: string, parts: Record<string, ReactNode>): ReactNode {
    const count = typeof parts.count === "number" ? parts.count : undefined;
    return raw(key, count).split(/\{\{(\w+)\}\}/).map((segment, i) =>
      createElement(Fragment, { key: i }, i % 2 === 1 ? (parts[segment] ?? `{{${segment}}}`) : segment));
  }

  return { t, tx };
}

export const { t, tx } = createTranslator(localeDicts, currentLanguage);

/** BCP 47 tag for date/number formatting in the active UI language. */
export function localeTag(): string {
  return currentLanguage() === "ko" ? "ko-KR" : "en-US";
}

const translators: Record<Lang, typeof t> = {
  en: (key, params) => t(key, params),
  ko: (key, params) => t(key, params),
};

/**
 * Re-renders the calling component when the language changes. The returned
 * function changes identity only when the language does, so memos and effects
 * that list it as a dependency recompute on a switch and nowhere else.
 * Components that use `tx` must also call this hook.
 */
export function useT(): typeof t {
  return translators[useSettingsStore((s) => resolveLanguage(s.settings.uiLanguage))];
}

function syncDocumentLang() {
  if (typeof document !== "undefined") document.documentElement.lang = currentLanguage();
}
syncDocumentLang();
useSettingsStore.subscribe(syncDocumentLang);
