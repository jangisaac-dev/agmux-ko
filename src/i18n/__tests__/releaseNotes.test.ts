import { describe, it, expect, afterEach } from "vitest";
import { localizedReleaseBody } from "../releaseNotes";
import { useSettingsStore } from "../../stores/settingsStore";

afterEach(() => useSettingsStore.getState().updateSettings({ uiLanguage: "system" }));

describe("localizedReleaseBody", () => {
  it("uses the bundled Korean body when one exists for the version", () => {
    useSettingsStore.getState().updateSettings({ uiLanguage: "ko" });
    const body = localizedReleaseBody("4.3.0", "English body");
    expect(body).not.toBe("English body");
    expect(body).toContain("### New");
    expect(body).toMatch(/^- \*\*[^*]+\*\* — /m);
  });

  it("falls back to the GitHub body for versions without a translation", () => {
    useSettingsStore.getState().updateSettings({ uiLanguage: "ko" });
    expect(localizedReleaseBody("0.0.1", "English body")).toBe("English body");
  });

  it("keeps the GitHub body in English", () => {
    useSettingsStore.getState().updateSettings({ uiLanguage: "en" });
    expect(localizedReleaseBody("4.3.0", "English body")).toBe("English body");
  });
});
