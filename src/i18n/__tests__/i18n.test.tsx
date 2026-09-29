/** @vitest-environment jsdom */
import { describe, it, expect, afterEach } from "vitest";
import { useState } from "react";
import { render, cleanup, act, screen, fireEvent } from "@testing-library/react";
import { createTranslator, currentLanguage, localeDicts, localeTag, resolveLanguage, useT, type Lang } from "..";
import { useSettingsStore } from "../../stores/settingsStore";

afterEach(() => {
  cleanup();
  act(() => useSettingsStore.getState().updateSettings({ uiLanguage: "system" }));
});

describe("translator", () => {
  const dicts: Record<Lang, Record<string, string>> = {
    en: {
      "a.hello": "Hello, {{name}}",
      "a.files_one": "{{count}} file",
      "a.files_other": "{{count}} files",
      "a.onlyEn": "English only",
      "a.run": "Run {{cmd}} now",
    },
    ko: {
      "a.hello": "{{name}}님, 안녕하세요",
      "a.files_other": "파일 {{count}}개",
      "a.run": "지금 {{cmd}}를 실행하세요",
    },
  };
  let lang: Lang = "en";
  const { t, tx } = createTranslator(dicts, () => lang);

  it("fills placeholders and falls back to English, then the key", () => {
    lang = "ko";
    expect(t("a.hello", { name: "민지" })).toBe("민지님, 안녕하세요");
    expect(t("a.onlyEn")).toBe("English only");
    expect(t("a.missing")).toBe("a.missing");
  });

  it("picks English plural forms; Korean uses _other", () => {
    lang = "en";
    expect(t("a.files", { count: 1 })).toBe("1 file");
    expect(t("a.files", { count: 3 })).toBe("3 files");
    lang = "ko";
    expect(t("a.files", { count: 1 })).toBe("파일 1개");
  });

  it("places React elements where the translation puts them", () => {
    lang = "ko";
    render(<p data-testid="p">{tx("a.run", { cmd: <code>npm test</code> })}</p>);
    expect(screen.getByTestId("p").innerHTML).toBe("지금 <code>npm test</code>를 실행하세요");
  });
});

describe("language setting", () => {
  it("resolves system from navigator.language", () => {
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("ko")).toBe("ko");
    expect(resolveLanguage("system")).toBe("en"); // setup pins en-US
    Object.defineProperty(navigator, "language", { value: "ko-KR", configurable: true });
    expect(resolveLanguage("system")).toBe("ko");
    Object.defineProperty(navigator, "language", { value: "en-US", configurable: true });
  });

  it("re-renders on change without losing component state, and syncs <html lang>", () => {
    function Probe() {
      useT();
      const [value, setValue] = useState("");
      return (
        <>
          <span data-testid="lang">{currentLanguage()}</span>
          <input data-testid="input" value={value} onChange={(e) => setValue(e.target.value)} />
        </>
      );
    }
    render(<Probe />);
    fireEvent.change(screen.getByTestId("input"), { target: { value: "draft" } });
    act(() => useSettingsStore.getState().updateSettings({ uiLanguage: "ko" }));
    expect(screen.getByTestId("lang").textContent).toBe("ko");
    expect((screen.getByTestId("input") as HTMLInputElement).value).toBe("draft");
    expect(document.documentElement.lang).toBe("ko");
  });

  it("gives useT a new identity only when the language changes", () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useT());
      return null;
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(seen[1]).toBe(seen[0]);
    act(() => useSettingsStore.getState().updateSettings({ uiLanguage: "ko" }));
    expect(seen[seen.length - 1]).not.toBe(seen[0]);
    expect(localeTag()).toBe("ko-KR");
  });

  it("persists the choice with the other settings", () => {
    act(() => useSettingsStore.getState().updateSettings({ uiLanguage: "ko" }));
    expect(JSON.parse(localStorage.getItem("agmux-settings") ?? "{}").uiLanguage).toBe("ko");
  });
});

describe("locale files", () => {
  const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

  it("no key is defined in two area files", () => {
    for (const lang of ["en", "ko"] as const) {
      const files = lang === "en"
        ? import.meta.glob<Record<string, string>>("../locales/en/*.json", { eager: true, import: "default" })
        : import.meta.glob<Record<string, string>>("../locales/ko/*.json", { eager: true, import: "default" });
      const total = Object.values(files).reduce((n, d) => n + Object.keys(d).length, 0);
      expect(Object.keys(localeDicts[lang]).length, lang).toBe(total);
    }
  });

  it("Korean keys exist in English with the same placeholders", () => {
    for (const [key, ko] of Object.entries(localeDicts.ko)) {
      expect(localeDicts.en, key).toHaveProperty([key]);
      expect(placeholders(ko), key).toEqual(placeholders(localeDicts.en[key]));
    }
  });
});
