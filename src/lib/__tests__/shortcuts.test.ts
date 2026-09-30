import { describe, expect, it, vi } from "vitest";
import {
  SHORTCUT_ACTIONS,
  bindingFromEvent,
  dispatchShortcut,
  effectiveBinding,
  findBindingConflict,
  formatBinding,
  isReservedBinding,
  isValidBinding,
  type ShortcutId,
} from "../shortcuts";

type EventModifiers = Partial<Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat">>;

function keyEvent(
  code: string,
  modifiers: EventModifiers = {},
  target: EventTarget | null = null,
): KeyboardEvent {
  return {
    code,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...modifiers,
  } as unknown as KeyboardEvent;
}

describe("shortcuts", () => {
  it("builds bindings in canonical modifier order and rejects modifier-only codes", () => {
    expect(bindingFromEvent({
      code: "KeyK", metaKey: true, ctrlKey: true, altKey: true, shiftKey: true,
    })).toBe("Meta+Ctrl+Alt+Shift+KeyK");
    expect(bindingFromEvent({
      code: "", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
    })).toBeNull();
    expect(bindingFromEvent({
      code: "Unidentified", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
    })).toBeNull();
    for (const code of ["MetaLeft", "ControlRight", "AltLeft", "ShiftRight", "CapsLock", "Fn", "FnLock"]) {
      expect(bindingFromEvent({ code, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBeNull();
    }
  });

  it.each([
    ["Meta+Shift+KeyT", "⌘⇧T"],
    ["Meta+Comma", "⌘,"],
    ["Meta+ArrowUp", "⌘↑"],
    ["Meta+Shift+BracketLeft", "⌘⇧["],
    ["Meta+Ctrl+Alt+Shift+KeyK", "⌘⌃⌥⇧K"],
  ])("formats %s for display", (binding, label) => {
    expect(formatBinding(binding)).toBe(label);
  });

  it("uses defaults for missing or invalid overrides and respects null overrides", () => {
    expect(effectiveBinding("newSession", undefined)).toBe("Meta+KeyN");
    expect(effectiveBinding("newSession", { newSession: "Meta+KeyJ" })).toBe("Meta+KeyJ");
    expect(effectiveBinding("newSession", { newSession: null })).toBeNull();
    expect(effectiveBinding("newSession", { newSession: "Meta+Shift+Ctrl+KeyJ" })).toBe("Meta+KeyN");
    expect(effectiveBinding("newSession", Object.create({ newSession: "Meta+KeyJ" }))).toBe("Meta+KeyN");
  });

  it("keeps every non-null default valid, Meta-based, and outside reserved bindings", () => {
    expect(SHORTCUT_ACTIONS.length).toBeGreaterThan(0);
    for (const action of SHORTCUT_ACTIONS) {
      if (action.defaultBinding === null) continue;
      expect(isValidBinding(action.defaultBinding)).toBe(true);
      expect(action.defaultBinding.split("+")).toContain("Meta");
      expect(isReservedBinding(action.defaultBinding)).toBe(false);
    }
    expect(isReservedBinding("Meta+KeyQ")).toBe(true);
    expect(isReservedBinding("Meta+Shift+KeyZ")).toBe(true);
  });

  it("allows only the layered reopen-tab and task-mode actions to share a default", () => {
    const bindings = new Map<string, string[]>();
    for (const action of SHORTCUT_ACTIONS) {
      if (action.defaultBinding === null) continue;
      const ids = bindings.get(action.defaultBinding) ?? [];
      ids.push(action.id);
      bindings.set(action.defaultBinding, ids);
    }
    expect([...bindings.entries()].filter(([, ids]) => ids.length > 1)).toEqual([
      ["Meta+Shift+KeyT", ["reopenClosedTab", "toggleTaskMode"]],
    ]);
    expect(findBindingConflict("Meta+Shift+KeyT", {}, "reopenClosedTab")).toBeNull();
  });

  it("dispatches only exact modifiers and consumes a matching handled event", () => {
    const run = vi.fn((_id: ShortcutId) => true);
    const ctrlB = keyEvent("KeyB", { ctrlKey: true });
    expect(dispatchShortcut(ctrlB, {}, run)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(ctrlB.preventDefault).not.toHaveBeenCalled();

    const metaB = keyEvent("KeyB", { metaKey: true });
    expect(dispatchShortcut(metaB, {}, run)).toBe(true);
    expect(run).toHaveBeenCalledWith("toggleSidebar");
    expect(metaB.preventDefault).toHaveBeenCalledOnce();
    expect(metaB.stopPropagation).toHaveBeenCalledOnce();
  });

  it("moves and disables an action when its override changes", () => {
    const run = vi.fn((_id: ShortcutId) => true);
    expect(dispatchShortcut(keyEvent("KeyB", { metaKey: true }), { toggleSidebar: "Meta+KeyJ" }, run)).toBe(false);
    expect(dispatchShortcut(keyEvent("KeyJ", { metaKey: true }), { toggleSidebar: "Meta+KeyJ" }, run)).toBe(true);
    expect(dispatchShortcut(keyEvent("KeyB", { metaKey: true }), { toggleSidebar: null }, run)).toBe(false);
    expect(run.mock.calls).toEqual([["toggleSidebar"]]);
  });

  it("falls through when the first action sharing a binding is not applicable", () => {
    const run = vi.fn((id: ShortcutId) => id === "toggleTaskMode");
    const event = keyEvent("KeyT", { metaKey: true, shiftKey: true });
    expect(dispatchShortcut(event, {}, run)).toBe(true);
    expect(run.mock.calls).toEqual([["reopenClosedTab"], ["toggleTaskMode"]]);
  });

  it("swallows held-key repeats except for session and tab navigation", () => {
    const run = vi.fn((_id: ShortcutId) => true);
    const heldClose = keyEvent("KeyW", { metaKey: true, repeat: true });
    expect(dispatchShortcut(heldClose, {}, run)).toBe(true);
    expect(run).not.toHaveBeenCalled();
    expect(heldClose.preventDefault).toHaveBeenCalled();

    expect(dispatchShortcut(keyEvent("ArrowDown", { metaKey: true, repeat: true }), {}, run)).toBe(true);
    expect(dispatchShortcut(keyEvent("BracketRight", { metaKey: true, shiftKey: true, repeat: true }), {}, run)).toBe(true);
    expect(run.mock.calls).toEqual([["nextSession"], ["nextTab"]]);
  });

  it("leaves unmatched and editable arrow events untouched", () => {
    const run = vi.fn((_id: ShortcutId) => true);
    const unmatched = keyEvent("KeyL", { metaKey: true });
    expect(dispatchShortcut(unmatched, {}, run)).toBe(false);
    expect(unmatched.preventDefault).not.toHaveBeenCalled();

    const arrow = keyEvent("ArrowUp", { metaKey: true }, { tagName: "TEXTAREA" } as unknown as EventTarget);
    expect(dispatchShortcut(arrow, { previousSession: "Meta+ArrowUp" }, run)).toBe(false);
    expect(arrow.preventDefault).not.toHaveBeenCalled();
  });
});
