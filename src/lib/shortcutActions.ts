import { useProjectStore } from "../stores/projectStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useSplitViewStore } from "../stores/splitViewStore";
import { useTaskViewStore } from "../stores/taskViewStore";
import { useUiStore } from "../stores/uiStore";
import { coworkDraftProvider } from "./coworkMode";
import { isQuickOpenAction, runQuickOpenAction } from "./quickOpen";
import { TOP_BAR_ACTION_EVENT, type ShortcutId, type TopBarActionId } from "./shortcuts";

/** Focused split-view pane, but only while its tab bar is on screen. */
export function visibleFocusedPane() {
  const ui = useUiStore.getState();
  if (!useSettingsStore.getState().settings.multiViewEnabled) return null;
  if ((ui.appMode === "task" && ui.taskViewAllowed) || ui.usagePanelOpen || ui.sidebarTab !== "agents") return null;
  const splitView = useSplitViewStore.getState();
  return splitView.panes[splitView.focusedPaneId] ?? null;
}

export function runShortcutAction(
  id: ShortcutId,
  deps: { openCommandPalette: () => void },
): boolean {
  if (["toggleTerminal", "toggleGitPanel", "toggleTimeline", "openInApp"].includes(id)) {
    return !window.dispatchEvent(new CustomEvent<TopBarActionId>(TOP_BAR_ACTION_EVENT, { detail: id as TopBarActionId, cancelable: true }));
  }

  if (id.startsWith("goToTab")) {
    const pane = visibleFocusedPane();
    const tab = pane?.tabs[Number(id.slice("goToTab".length)) - 1];
    if (!pane || !tab) return false;
    useSplitViewStore.getState().setActiveTab(pane.id, tab.id);
    return true;
  }

  if (id === "previousTab" || id === "nextTab") {
    if (!visibleFocusedPane()) return false;
    useSplitViewStore.getState().selectAdjacentTab(id === "nextTab" ? 1 : -1);
    return true;
  }

  if (id === "reopenClosedTab") {
    if (!visibleFocusedPane()) return false;
    useSplitViewStore.getState().reopenClosedTab();
    return true;
  }

  if (id === "closeTab") {
    const pane = visibleFocusedPane();
    if (pane?.activeTabId) useSplitViewStore.getState().closeTab(pane.id, pane.activeTabId);
    return true;
  }

  if (id === "toggleTaskMode") {
    const ui = useUiStore.getState();
    if (!ui.taskViewAllowed) return false;
    ui.setAppMode(ui.appMode === "task" ? "agent" : "task");
    return true;
  }

  if (id === "toggleReviewSidebar") {
    if (useUiStore.getState().appMode !== "task") return false;
    useTaskViewStore.getState().toggleReviewSidebar();
    return true;
  }

  if (id === "newSession" || id === "newTab") {
    const ui = useUiStore.getState();
    if (ui.appMode === "task") {
      window.dispatchEvent(new CustomEvent("agmux-new-task"));
      return true;
    }
    const projects = useProjectStore.getState().projects;
    const settings = useSettingsStore.getState().settings;
    const cwd = ui.selectedClaudeSessionCwd ?? ui.selectedCodexSessionCwd ?? ui.selectedTerminalSessionCwd;
    const project = cwd ? projects.find((item) => item.repo_path === cwd) ?? projects[0] : projects[0];
    if (!project) return true;

    if (ui.appMode === "cowork") {
      void import("./coworkMode").then(({ resolveCoworkDraftProject }) => {
        const folder = resolveCoworkDraftProject();
        if (!folder) return;
        ui.selectProject(folder.id);
        ui.setDraftChat({
          projectId: folder.id,
          repoPath: folder.repo_path,
          provider: coworkDraftProvider(settings.defaultProvider),
          model: null,
          agentProfile: "cowork",
        });
      });
      return true;
    }

    const action = isQuickOpenAction(settings.quickOpenAction) ? settings.quickOpenAction : "chat";
    void runQuickOpenAction(
      { id: project.id, repo_path: project.repo_path },
      action,
      settings.defaultProvider,
    ).catch((err) => console.error("Cmd+N quick open failed:", err));
    return true;
  }

  if (id === "commandPalette") {
    deps.openCommandPalette();
    return true;
  }
  if (id === "search") {
    useUiStore.getState().setSearchDialogOpen(true);
    return true;
  }
  if (id === "openSettings") {
    useSettingsStore.getState().openSettings();
    return true;
  }
  if (id === "toggleSidebar") {
    useUiStore.getState().toggleSidebar();
    return true;
  }
  if (id === "toggleEditor") {
    useUiStore.getState().toggleEditorPanel();
    return true;
  }

  if (id === "previousSession" || id === "nextSession") {
    const seen = new Set<string>();
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-session-nav]"))
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => ({ element, top: element.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top)
      .map(({ element }) => element)
      .filter((element) => {
        const sessionId = element.dataset.sessionNav ?? "";
        if (seen.has(sessionId)) return false;
        seen.add(sessionId);
        return true;
      });
    if (elements.length === 0) return false;
    const ui = useUiStore.getState();
    const currentId = ui.selectedClaudeSessionId ?? ui.selectedCodexSessionId ?? ui.selectedThreadId;
    const currentIndex = currentId ? elements.findIndex((element) => element.dataset.sessionNav === currentId) : -1;
    const nextIndex = id === "previousSession"
      ? (currentIndex <= 0 ? elements.length - 1 : currentIndex - 1)
      : (currentIndex >= elements.length - 1 ? 0 : currentIndex + 1);
    elements[nextIndex].click();
    elements[nextIndex].scrollIntoView({ block: "nearest" });
    return true;
  }

  return false;
}
