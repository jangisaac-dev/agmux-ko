/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ShortcutsSection } from "../ShortcutsSection";
import { useSettingsStore } from "../../../stores/settingsStore";
import { clearLocalStorage } from "../../../stores/__tests__/setup";
import { isShortcutRecording, setShortcutRecording } from "../../../lib/shortcuts";

beforeEach(() => {
  clearLocalStorage();
  useSettingsStore.getState().resetSettings();
  setShortcutRecording(false);
});

afterEach(() => {
  cleanup();
  setShortcutRecording(false);
});

function changeShortcut(action: string): HTMLButtonElement {
  return screen.getByRole("button", { name: `Change shortcut: ${action}` }) as HTMLButtonElement;
}

describe("ShortcutsSection", () => {
  it("shows the default shortcut and records a new binding that can be reset", () => {
    render(<ShortcutsSection />);
    expect(screen.getByText("⌘N")).toBeTruthy();

    fireEvent.click(changeShortcut("New session"));
    expect(isShortcutRecording()).toBe(true);
    fireEvent.keyDown(window, { code: "KeyU", metaKey: true });

    expect(useSettingsStore.getState().settings.keyboardShortcuts.newSession).toBe("Meta+KeyU");
    expect(screen.getByText("⌘U")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset to default: New session" })).toBeTruthy();
    expect(isShortcutRecording()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Reset to default: New session" }));
    expect(useSettingsStore.getState().settings.keyboardShortcuts).not.toHaveProperty("newSession");
    expect(screen.getByText("⌘N")).toBeTruthy();
  });

  it("cancels recording with Escape and turns a shortcut off with Backspace", () => {
    render(<ShortcutsSection />);
    fireEvent.click(changeShortcut("New session"));
    fireEvent.keyDown(window, { code: "Escape" });
    expect(isShortcutRecording()).toBe(false);
    expect(useSettingsStore.getState().settings.keyboardShortcuts).not.toHaveProperty("newSession");

    fireEvent.click(changeShortcut("New session"));
    fireEvent.keyDown(window, { code: "Backspace" });
    expect(useSettingsStore.getState().settings.keyboardShortcuts.newSession).toBeNull();
    expect(changeShortcut("New session").textContent).toContain("None");
    expect(isShortcutRecording()).toBe(false);
  });

  it("keeps recording and reports a conflict, a reserved binding, or a missing Command key", () => {
    render(<ShortcutsSection />);
    fireEvent.click(changeShortcut("New session"));
    fireEvent.keyDown(window, { code: "KeyK", metaKey: true });
    expect(screen.getByText("⌘K is already used by Command palette.")).toBeTruthy();
    expect(useSettingsStore.getState().settings.keyboardShortcuts).toEqual({});
    expect(isShortcutRecording()).toBe(true);

    fireEvent.keyDown(window, { code: "KeyQ", metaKey: true });
    expect(screen.getByText("⌘Q is used by macOS or text editing.")).toBeTruthy();
    expect(useSettingsStore.getState().settings.keyboardShortcuts).toEqual({});
    expect(isShortcutRecording()).toBe(true);

    fireEvent.keyDown(window, { code: "KeyJ", ctrlKey: true });
    expect(screen.getByText("Shortcuts must include ⌘.")).toBeTruthy();
    expect(useSettingsStore.getState().settings.keyboardShortcuts).toEqual({});
    expect(isShortcutRecording()).toBe(true);
  });

  it("refuses a row reset when another override already owns its default", () => {
    useSettingsStore.getState().updateSettings({
      keyboardShortcuts: { newSession: "Meta+KeyJ", toggleSidebar: "Meta+KeyN" },
    });
    render(<ShortcutsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Reset to default: New session" }));
    expect(screen.getByText("⌘N is already used by Show or hide the sidebar.")).toBeTruthy();
    expect(useSettingsStore.getState().settings.keyboardShortcuts).toEqual({
      newSession: "Meta+KeyJ", toggleSidebar: "Meta+KeyN",
    });
  });

  it("restores every override with Reset all", () => {
    useSettingsStore.getState().updateSettings({
      keyboardShortcuts: { newSession: "Meta+KeyJ", search: null },
    });
    render(<ShortcutsSection />);

    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));
    expect(useSettingsStore.getState().settings.keyboardShortcuts).toEqual({});
    expect((screen.getByRole("button", { name: "Reset all" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the Panels group and the timeline action with no default binding", () => {
    render(<ShortcutsSection />);

    expect(screen.getByText("Panels")).toBeTruthy();
    expect(changeShortcut("Show or hide the session timeline").textContent).toContain("None");
  });

  it("does not store a null override when turning off the timeline shortcut", () => {
    render(<ShortcutsSection />);

    fireEvent.click(changeShortcut("Show or hide the session timeline"));
    fireEvent.keyDown(window, { code: "Backspace" });

    expect(useSettingsStore.getState().settings.keyboardShortcuts).not.toHaveProperty("toggleTimeline");
  });
});
