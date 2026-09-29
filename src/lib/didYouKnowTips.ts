/**
 * "Did you know?" tips shown on the home screen.
 *
 * Each tip is a single sentence. Wrap inline keyboard shortcuts, paths,
 * or code references in backticks (`like-this`) — HomeScreen renders the
 * backticked spans with the <Code> primitive.
 *
 * Tips should be useful for non-technical users: what you can do, not how
 * the app is built. Avoid engineering jargon.
 *
 * Add freely. The home screen picks one at random on every mount.
 */
export const DID_YOU_KNOW_TIPS: readonly string[] = [
  // ── Command palette + navigation ────────────────────────────────────────
  "tips.navigation.commandPalette",
  "tips.navigation.approvalBanners",
  "tips.search.allChats",
  "tips.chat.newInSelectedProject",
  "tips.sessions.newRecentProject",
  "tips.projects.openFolder",
  "tips.editor.toggleBesideChat",
  "tips.tasks.taskMode",
  "tips.navigation.sidebarEditorShortcuts",

  // ── Composer / input bar ────────────────────────────────────────────────
  "tips.composer.slashShortcuts",
  "tips.composer.attachProjectFile",
  "tips.composer.sendImageByDrag",
  "tips.composer.pasteImage",
  "tips.models.remembersPerAgent",
  "tips.models.effortDial",
  "tips.composer.stopReply",
  "tips.composer.followUpShortcut",
  "tips.composer.permissionModes",
  "tips.composer.contextRing",
  "tips.composer.planMode",

  // ── Agents & providers ─────────────────────────────────────────────────
  "tips.providers.multipleAgents",
  "tips.localModels.onMac",
  "tips.settings.defaultAgent",
  "tips.providers.independentSignIn",
  "tips.models.fastOrStrong",

  // ── Sidebar features ───────────────────────────────────────────────────
  "tips.sidebar.manageChat",
  "tips.sidebar.pendingApproval",
  "tips.sidebar.unreadCompletion",
  "tips.sidebar.pinnedChatsStayVisible",
  "tips.sidebar.recentActivity",
  "tips.sidebar.resize",
  "tips.sidebar.collapseProjects",

  // ── Files & editor ─────────────────────────────────────────────────────
  "tips.editor.builtInBesideChat",
  "tips.editor.fileActions",
  "tips.editor.quickOpen",
  "tips.editor.unsavedChanges",
  "tips.editor.openChatDiff",
  "tips.terminal.copySelection",

  // ── Hooks, notifications, automation ───────────────────────────────────
  "tips.notifications.backgroundApprovals",
  "tips.notifications.noDuplicateApproval",
  "tips.notifications.history",
  "tips.remote.phoneApprovals",

  // ── Task mode ──────────────────────────────────────────────────────────
  "tips.tasks.isolatedBranch",
  "tips.tasks.links",
  "tips.tasks.stopOrArchive",
  "tips.tasks.diffSummary",
  "tips.tasks.commitDialog",

  // ── Settings & themes ──────────────────────────────────────────────────
  "tips.appearance.themes",
  "tips.appearance.glass",
  "tips.appearance.fonts",
  "tips.appearance.animations",
  "tips.appearance.lightMode",
  "tips.editor.openExternal",
  "tips.settings.multiView",
  "tips.updates.releaseChannel",

  // ── Sessions, history, journal ─────────────────────────────────────────
  "tips.sessions.restore",
  "tips.journal.decisions",
  "tips.sessions.forkChat",
  "tips.search.archivedChats",
  "tips.usage.estimatedCost",

  // ── Productivity ───────────────────────────────────────────────────────
  "tips.sessions.resumeTerminal",
  "tips.editor.openMention",
  "tips.composer.optimizePrompt",
  "tips.skills.shortcuts",
  "tips.sidebar.pinShortcut",
  "tips.multiView.dragToSplit",

  // ── Local models & remote ──────────────────────────────────────────────
  "tips.localModels.browse",
  "tips.localModels.eject",
  "tips.remote.openChats",
  "tips.teams.privacy",

  // ── Misc ───────────────────────────────────────────────────────────────
  "tips.editor.ideShortcut",
  "tips.projects.rememberSelection",
  "tips.appearance.lightModeAccent",
  "tips.whatsNew.reopen",
  "tips.sessions.quitCleanly",
  "tips.home.greetingChanges",
];

export function pickDidYouKnowTip(): string {
  return DID_YOU_KNOW_TIPS[Math.floor(Math.random() * DID_YOU_KNOW_TIPS.length)];
}

/**
 * Render a tip string into segments — plain text and inline-code spans —
 * so the consumer can render `code-fenced` portions with their own primitive.
 */
export interface TipSegment {
  kind: "text" | "code";
  value: string;
}

export function parseTip(tip: string): TipSegment[] {
  const parts = tip.split("`");
  const segments: TipSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    const value = parts[i];
    if (!value) continue;
    segments.push({ kind: i % 2 === 1 ? "code" : "text", value });
  }
  return segments;
}
