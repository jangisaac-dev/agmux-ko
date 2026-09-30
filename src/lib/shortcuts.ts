import { useSettingsStore } from "../stores/settingsStore";
import { isEditableKeyboardTarget } from "./textFieldNav";

export type ShortcutGroup = "general" | "panels" | "tabs" | "taskMode";
export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ["general", "panels", "tabs", "taskMode"];

export type ShortcutId =
  | "newSession" | "commandPalette" | "search" | "openSettings" | "toggleSidebar"
  | "toggleEditor" | "toggleTerminal" | "toggleGitPanel" | "toggleTimeline" | "openInApp"
  | "previousSession" | "nextSession" | "newTab" | "closeTab" | "reopenClosedTab" | "previousTab"
  | "nextTab" | "goToTab1" | "goToTab2" | "goToTab3" | "goToTab4" | "goToTab5" | "goToTab6"
  | "goToTab7" | "goToTab8" | "goToTab9" | "toggleTaskMode" | "toggleReviewSidebar";

export interface ShortcutAction {
  id: ShortcutId;
  group: ShortcutGroup;
  labelKey: string;
  labelParams?: Record<string, string>;
  hintKey?: string;
  defaultBinding: string | null;
}

export const TOP_BAR_ACTION_EVENT = "agmux-top-bar-action";
export type TopBarActionId = "toggleTerminal" | "toggleGitPanel" | "toggleTimeline" | "openInApp";

export const SHORTCUT_ACTIONS: readonly ShortcutAction[] = [
  { id: "newSession", group: "general", labelKey: "settings.shortcuts.action.newSession", hintKey: "settings.shortcuts.hint.newSession", defaultBinding: "Meta+KeyN" },
  { id: "commandPalette", group: "general", labelKey: "settings.shortcuts.action.commandPalette", defaultBinding: "Meta+KeyK" },
  { id: "search", group: "general", labelKey: "settings.shortcuts.action.search", defaultBinding: "Meta+Shift+KeyF" },
  { id: "openSettings", group: "general", labelKey: "settings.shortcuts.action.openSettings", defaultBinding: "Meta+Comma" },
  { id: "toggleSidebar", group: "general", labelKey: "settings.shortcuts.action.toggleSidebar", defaultBinding: "Meta+KeyB" },
  { id: "previousSession", group: "general", labelKey: "settings.shortcuts.action.previousSession", hintKey: "settings.shortcuts.hint.sessionNav", defaultBinding: "Meta+ArrowUp" },
  { id: "nextSession", group: "general", labelKey: "settings.shortcuts.action.nextSession", hintKey: "settings.shortcuts.hint.sessionNav", defaultBinding: "Meta+ArrowDown" },
  { id: "toggleEditor", group: "panels", labelKey: "settings.shortcuts.action.toggleEditor", defaultBinding: "Meta+KeyE" },
  { id: "toggleTerminal", group: "panels", labelKey: "settings.shortcuts.action.toggleTerminal", hintKey: "settings.shortcuts.hint.topBar", defaultBinding: "Meta+KeyJ" },
  { id: "toggleGitPanel", group: "panels", labelKey: "settings.shortcuts.action.toggleGitPanel", hintKey: "settings.shortcuts.hint.topBar", defaultBinding: "Meta+Shift+KeyG" },
  { id: "toggleTimeline", group: "panels", labelKey: "settings.shortcuts.action.toggleTimeline", hintKey: "settings.shortcuts.hint.topBar", defaultBinding: null },
  { id: "openInApp", group: "panels", labelKey: "settings.shortcuts.action.openInApp", hintKey: "settings.shortcuts.hint.openInApp", defaultBinding: "Meta+Shift+KeyO" },
  { id: "newTab", group: "tabs", labelKey: "settings.shortcuts.action.newTab", hintKey: "settings.shortcuts.hint.newTab", defaultBinding: "Meta+KeyT" },
  { id: "closeTab", group: "tabs", labelKey: "settings.shortcuts.action.closeTab", defaultBinding: "Meta+KeyW" },
  { id: "reopenClosedTab", group: "tabs", labelKey: "settings.shortcuts.action.reopenClosedTab", defaultBinding: "Meta+Shift+KeyT" },
  { id: "previousTab", group: "tabs", labelKey: "settings.shortcuts.action.previousTab", defaultBinding: "Meta+Shift+BracketLeft" },
  { id: "nextTab", group: "tabs", labelKey: "settings.shortcuts.action.nextTab", defaultBinding: "Meta+Shift+BracketRight" },
  ...Array.from({ length: 9 }, (_, index) => ({
    id: `goToTab${index + 1}` as ShortcutId,
    group: "tabs" as const,
    labelKey: "settings.shortcuts.action.goToTab",
    labelParams: { n: String(index + 1) },
    defaultBinding: `Meta+Digit${index + 1}`,
  })),
  { id: "toggleTaskMode", group: "taskMode", labelKey: "settings.shortcuts.action.toggleTaskMode", hintKey: "settings.shortcuts.hint.toggleTaskMode", defaultBinding: "Meta+Shift+KeyT" },
  { id: "toggleReviewSidebar", group: "taskMode", labelKey: "settings.shortcuts.action.toggleReviewSidebar", defaultBinding: "Meta+Shift+KeyR" },
];

const MODIFIERS = ["Meta", "Ctrl", "Alt", "Shift"] as const;
const MODIFIER_CODES = new Set([
  "MetaLeft", "MetaRight", "OSLeft", "OSRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight",
  "ShiftLeft", "ShiftRight", "CapsLock", "Fn", "FnLock",
]);

export function bindingFromEvent(
  e: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
): string | null {
  if (!e.code || e.code === "Unidentified" || MODIFIER_CODES.has(e.code)) return null;
  return [
    ...(e.metaKey ? ["Meta"] : []),
    ...(e.ctrlKey ? ["Ctrl"] : []),
    ...(e.altKey ? ["Alt"] : []),
    ...(e.shiftKey ? ["Shift"] : []),
    e.code,
  ].join("+");
}

export function isValidBinding(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const tokens = s.split("+");
  if (!tokens.length || tokens.some((token) => !token)) return false;
  const code = tokens.pop()!;
  if (!/^[A-Za-z0-9]+$/.test(code) || MODIFIERS.includes(code as (typeof MODIFIERS)[number]) || MODIFIER_CODES.has(code)) return false;
  let lastIndex = -1;
  for (const modifier of tokens) {
    const index = MODIFIERS.indexOf(modifier as (typeof MODIFIERS)[number]);
    if (index <= lastIndex) return false;
    lastIndex = index;
  }
  return true;
}

const MODIFIER_LABELS: Record<string, string> = { Meta: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" };
const KEY_LABELS: Record<string, string> = {
  BracketLeft: "[", BracketRight: "]", Comma: ",", Period: ".", Slash: "/", Backslash: "\\", Semicolon: ";",
  Quote: "'", Backquote: "`", Minus: "-", Equal: "=", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←",
  ArrowRight: "→", Enter: "↩", Tab: "⇥", Space: "Space", Backspace: "⌫", Delete: "⌦", Escape: "⎋",
  Home: "↖", End: "↘", PageUp: "⇞", PageDown: "⇟",
};

export function formatBinding(binding: string): string {
  return binding.split("+").map((token) => {
    if (MODIFIER_LABELS[token]) return MODIFIER_LABELS[token];
    if (KEY_LABELS[token]) return KEY_LABELS[token];
    if (/^Key[A-Z]$/.test(token)) return token.slice(3);
    if (/^Digit[0-9]$/.test(token)) return token.slice(5);
    return token;
  }).join("");
}

export function effectiveBinding(
  id: ShortcutId,
  overrides: Record<string, string | null> | undefined,
): string | null {
  const fallback = SHORTCUT_ACTIONS.find((action) => action.id === id)?.defaultBinding ?? null;
  if (!overrides || !Object.prototype.hasOwnProperty.call(overrides, id)) return fallback;
  const override = overrides[id];
  return override === null ? null : isValidBinding(override) ? override : fallback;
}

export const RESERVED_BINDINGS: ReadonlySet<string> = new Set([
  "Meta+KeyQ", "Meta+KeyH", "Meta+Alt+KeyH", "Meta+KeyM", "Meta+Alt+Shift+KeyI", "Meta+KeyC", "Meta+KeyV",
  "Meta+KeyX", "Meta+KeyA", "Meta+KeyZ", "Meta+Shift+KeyZ", "Meta+KeyS", "Meta+KeyF", "Meta+Enter",
  "Meta+Backspace", "Meta+ArrowLeft", "Meta+ArrowRight", "Meta+Shift+ArrowLeft", "Meta+Shift+ArrowRight",
  "Meta+Shift+ArrowUp", "Meta+Shift+ArrowDown",
]);

export function isReservedBinding(binding: string): boolean {
  return RESERVED_BINDINGS.has(binding);
}

export const SHARED_BINDING_PAIRS: readonly [ShortcutId, ShortcutId][] = [["reopenClosedTab", "toggleTaskMode"]];

export function findBindingConflict(
  binding: string,
  overrides: Record<string, string | null> | undefined,
  forId: ShortcutId,
): ShortcutAction | null {
  return SHORTCUT_ACTIONS.find((action) => {
    if (action.id === forId || effectiveBinding(action.id, overrides) !== binding) return false;
    return !SHARED_BINDING_PAIRS.some(([first, second]) =>
      (first === forId && second === action.id) || (second === forId && first === action.id));
  }) ?? null;
}

let recording = false;

export function setShortcutRecording(on: boolean): void {
  recording = on;
}

export function isShortcutRecording(): boolean {
  return recording;
}

/** Only moving through sessions and tabs repeats while the keys are held; a held ⌘W or ⌘N
 *  (or a combo still held right after it was recorded) must not fire over and over. */
const REPEATABLE_SHORTCUTS: ReadonlySet<ShortcutId> = new Set(["previousSession", "nextSession", "previousTab", "nextTab"]);

export function dispatchShortcut(
  e: KeyboardEvent,
  overrides: Record<string, string | null> | undefined,
  run: (id: ShortcutId) => boolean,
): boolean {
  const binding = bindingFromEvent(e);
  if (binding === null) return false;
  if (e.code.startsWith("Arrow") && isEditableKeyboardTarget(e.target)) return false;
  for (const action of SHORTCUT_ACTIONS) {
    if (effectiveBinding(action.id, overrides) !== binding) continue;
    if (e.repeat && !REPEATABLE_SHORTCUTS.has(action.id)) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    if (!run(action.id)) continue;
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
  return false;
}

export function useShortcutLabel(id: ShortcutId): string | null {
  return useSettingsStore((s) => {
    const binding = effectiveBinding(id, s.settings.keyboardShortcuts);
    return binding ? formatBinding(binding) : null;
  });
}
