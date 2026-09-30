/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchShortcut } from "../shortcuts";
import { runShortcutAction } from "../shortcutActions";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSplitViewStore, type TabItem } from "../../stores/splitViewStore";
import { useUiStore } from "../../stores/uiStore";
import { clearLocalStorage } from "../../stores/__tests__/setup";

function setTabs(count: number): void {
  const { focusedPaneId } = useSplitViewStore.getState();
  const tabs: TabItem[] = Array.from({ length: count }, (_, index) => ({
    id: `tab-${index + 1}`,
    type: "thread",
    threadId: `thread-${index + 1}`,
    label: `Tab ${index + 1}`,
  }));
  useSplitViewStore.setState({
    layout: { type: "pane", paneId: focusedPaneId },
    panes: {
      [focusedPaneId]: {
        id: focusedPaneId,
        tabs,
        activeTabId: tabs[0]?.id ?? null,
      },
    },
    focusedPaneId,
    closedTabs: [],
  });
}

beforeEach(() => {
  clearLocalStorage();
  useSettingsStore.getState().resetSettings();
  useSplitViewStore.getState().reset();
  useSplitViewStore.setState({ closedTabs: [] });
  useUiStore.setState({
    appMode: "agent",
    taskViewAllowed: false,
    sidebarTab: "agents",
    usagePanelOpen: false,
  });
});

describe("runShortcutAction", () => {
  it("dispatches top-bar shortcuts as cancelable events handled by the top bar", () => {
    const deps = { openCommandPalette: () => {} };
    expect(runShortcutAction("toggleTimeline" as never, deps)).toBe(false);

    const listener = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener("agmux-top-bar-action", listener);
    try {
      expect(runShortcutAction("toggleTerminal" as never, deps)).toBe(true);
      expect(listener).toHaveBeenCalledOnce();
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toBe("toggleTerminal");
    } finally {
      window.removeEventListener("agmux-top-bar-action", listener);
    }
  });

  it("consumes reopen-closed-tab while tabs are visible even when nothing can reopen", () => {
    setTabs(1);
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, multiViewEnabled: true },
    });

    expect(runShortcutAction("reopenClosedTab", { openCommandPalette: () => {} })).toBe(true);
    expect(useUiStore.getState().appMode).toBe("agent");
  });

  it("falls through to task mode when tabs are hidden and reopen is not applicable", () => {
    useUiStore.setState({ taskViewAllowed: true, appMode: "agent" });
    const event = {
      code: "KeyT", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, target: null,
      preventDefault: () => {}, stopPropagation: () => {},
    } as KeyboardEvent;

    expect(dispatchShortcut(event, {}, (id) => runShortcutAction(id, { openCommandPalette: () => {} }))).toBe(true);
    expect(useUiStore.getState().appMode).toBe("task");
  });

  it("does not select a tab that is outside the focused pane", () => {
    setTabs(2);
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, multiViewEnabled: true },
    });

    expect(runShortcutAction("goToTab3", { openCommandPalette: () => {} })).toBe(false);
    expect(useSplitViewStore.getState().panes[useSplitViewStore.getState().focusedPaneId].activeTabId).toBe("tab-1");
  });

  it("always handles close-tab, with or without a focused active tab", () => {
    setTabs(1);
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, multiViewEnabled: true },
    });
    expect(runShortcutAction("closeTab", { openCommandPalette: () => {} })).toBe(true);
    expect(useSplitViewStore.getState().panes[useSplitViewStore.getState().focusedPaneId].tabs).toHaveLength(0);

    setTabs(0);
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, multiViewEnabled: false },
    });
    expect(runShortcutAction("closeTab", { openCommandPalette: () => {} })).toBe(true);
  });

  it("does not toggle the review sidebar outside task mode", () => {
    useUiStore.setState({ appMode: "agent" });
    expect(runShortcutAction("toggleReviewSidebar", { openCommandPalette: () => {} })).toBe(false);
  });
});
