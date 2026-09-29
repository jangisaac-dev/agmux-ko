import type { Provider } from "./types";
import { t } from "../i18n";

export type SlashCommandAction = "passthrough" | "local";

export interface SlashCommand {
  name: string;
  description: string;
  providers: Provider[];
  args?: string;
  action: SlashCommandAction;
  source?: string; // "built-in", "user", "project", "sdk", or plugin name
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ── Claude Code built-in commands ─────────────────────
  {
    name: "/help",
    get description() { return t("palette.slash.claude.help"); },
    providers: ["ClaudeCode", "Codex"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/clear",
    get description() { return t("palette.slash.claude.clear"); },
    providers: ["ClaudeCode", "Codex"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/compact",
    get description() { return t("palette.slash.claude.compact"); },
    providers: ["ClaudeCode", "Codex"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/cost",
    get description() { return t("palette.slash.claude.cost"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/doctor",
    get description() { return t("palette.slash.claude.doctor"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/memory",
    get description() { return t("palette.slash.claude.memory"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/review",
    get description() { return t("palette.slash.claude.review"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/pr",
    get description() { return t("palette.slash.claude.pr"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/model",
    get description() { return t("palette.slash.claude.model"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/config",
    get description() { return t("palette.slash.claude.config"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/permissions",
    get description() { return t("palette.slash.claude.permissions"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/login",
    get description() { return t("palette.slash.claude.login"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/logout",
    get description() { return t("palette.slash.claude.logout"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/status",
    get description() { return t("palette.slash.claude.status"); },
    providers: ["ClaudeCode", "Codex"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/bug",
    get description() { return t("palette.slash.claude.bug"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/init",
    get description() { return t("palette.slash.claude.init"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/mcp",
    get description() { return t("palette.slash.claude.mcp"); },
    providers: ["ClaudeCode", "Codex"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/vim",
    get description() { return t("palette.slash.claude.vim"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/terminal-setup",
    get description() { return t("palette.slash.claude.terminalSetup"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/ide",
    get description() { return t("palette.slash.claude.ide"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/add-dir",
    get description() { return t("palette.slash.claude.addDir"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/release-notes",
    get description() { return t("palette.slash.claude.releaseNotes"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },
  {
    name: "/listen",
    get description() { return t("palette.slash.claude.listen"); },
    providers: ["ClaudeCode"],
    action: "passthrough",
    source: "built-in",
  },

  // ── Codex-only commands ───────────────────────────────
  // Mirrors codex-rs/tui/src/slash_command.rs (visible commands).
  // Re-sync if Codex adds/removes commands upstream.
  { name: "/model", get description() { return t("palette.slash.codex.model"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/fast", get description() { return t("palette.slash.codex.fast"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/approvals", get description() { return t("palette.slash.codex.approvals"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/permissions", get description() { return t("palette.slash.codex.permissions"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/setup-default-sandbox", get description() { return t("palette.slash.codex.setupDefaultSandbox"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/experimental", get description() { return t("palette.slash.codex.experimental"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/autoreview", get description() { return t("palette.slash.codex.autoReview"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/memories", get description() { return t("palette.slash.codex.memories"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/skills", get description() { return t("palette.slash.codex.skills"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/review", get description() { return t("palette.slash.codex.review"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/rename", get description() { return t("palette.slash.codex.rename"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/new", get description() { return t("palette.slash.codex.new"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/resume", get description() { return t("palette.slash.codex.resume"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/fork", get description() { return t("palette.slash.codex.fork"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/init", get description() { return t("palette.slash.codex.init"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/plan", get description() { return t("palette.slash.codex.plan"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/goal", get description() { return t("palette.slash.codex.goal"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/collab", get description() { return t("palette.slash.codex.collab"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/agent", get description() { return t("palette.slash.codex.agent"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/side", get description() { return t("palette.slash.codex.side"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/copy", get description() { return t("palette.slash.codex.copy"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/diff", get description() { return t("palette.slash.codex.diff"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/mention", get description() { return t("palette.slash.codex.mention"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/title", get description() { return t("palette.slash.codex.title"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/statusline", get description() { return t("palette.slash.codex.statusline"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/theme", get description() { return t("palette.slash.codex.theme"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/apps", get description() { return t("palette.slash.codex.apps"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/plugins", get description() { return t("palette.slash.codex.plugins"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/logout", get description() { return t("palette.slash.codex.logout"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/quit", get description() { return t("palette.slash.codex.quit"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/exit", get description() { return t("palette.slash.codex.exit"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/feedback", get description() { return t("palette.slash.codex.feedback"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/ps", get description() { return t("palette.slash.codex.ps"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/stop", get description() { return t("palette.slash.codex.stop"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/personality", get description() { return t("palette.slash.codex.personality"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/realtime", get description() { return t("palette.slash.codex.realtime"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
  { name: "/settings", get description() { return t("palette.slash.codex.settings"); }, providers: ["Codex"], action: "passthrough", source: "built-in" },
];

export function getCommandsForProvider(provider: Provider): SlashCommand[] {
  return SLASH_COMMANDS.filter((cmd) => cmd.providers.includes(provider));
}

/** Merge built-in commands with dynamically discovered commands (user/project/plugin) */
export function mergeCommands(
  builtIn: SlashCommand[],
  dynamic: { name: string; description: string; source: string }[],
  provider: Provider = "ClaudeCode",
): SlashCommand[] {
  const builtInNames = new Set(builtIn.map((c) => c.name));
  const merged = [...builtIn];
  for (const cmd of dynamic) {
    if (!builtInNames.has(cmd.name)) {
      merged.push({
        name: cmd.name,
        description: cmd.description,
        providers: [provider],
        action: "passthrough",
        source: cmd.source,
      });
    }
  }
  return merged;
}

export function filterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  // Strip leading "/" so "/autopr" matches "/global-tools:autopr"
  const needle = query.replace(/^\//, "").toLowerCase();
  if (!needle) return commands;

  const matches = commands.filter((cmd) => {
    const haystack = cmd.name.replace(/^\//, "").toLowerCase();
    return haystack.includes(needle);
  });

  // Sort: exact prefix matches first, then contains matches, both alphabetical within group
  matches.sort((a, b) => {
    const aName = a.name.replace(/^\//, "").toLowerCase();
    const bName = b.name.replace(/^\//, "").toLowerCase();
    const aPrefix = aName.startsWith(needle);
    const bPrefix = bName.startsWith(needle);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return matches;
}

export function isSlashQuery(value: string): boolean {
  return value.startsWith("/") && !value.includes(" ");
}

/** Precomputed lookup for enriching SDK-discovered commands with known descriptions */
const KNOWN_BY_NAME = new Map(SLASH_COMMANDS.map((cmd) => [cmd.name, cmd]));

/**
 * Build SlashCommand objects from the SDK's session.init slash_commands[] array.
 * Uses known descriptions from the hardcoded list where available; otherwise
 * labels as "Custom command" (user/project commands and skills).
 */
export function buildCommandsFromSdk(sdkNames: string[]): SlashCommand[] {

  return sdkNames.map((raw) => {
    const name = raw.startsWith("/") ? raw : `/${raw}`;
    const known = KNOWN_BY_NAME.get(name);
    if (known) return known;
    return {
      name,
      get description() { return t("palette.slash.customCommand"); },
      providers: ["ClaudeCode"] as Provider[],
      action: "passthrough" as SlashCommandAction,
      source: "sdk",
    };
  });
}
