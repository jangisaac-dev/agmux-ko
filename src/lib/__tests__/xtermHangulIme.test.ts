/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { hangulEditToPty, installHangulIme } from "../xtermHangulIme";

// What a line editor shows after receiving these bytes (DEL deletes one char).
function applyPty(chunks: string[]): string {
  const out: string[] = [];
  for (const ch of [...chunks.join("")]) {
    if (ch === "\x7f") out.pop();
    else out.push(ch);
  }
  return out.join("");
}

function setup() {
  const root = document.createElement("div");
  const ta = document.createElement("textarea");
  root.appendChild(ta);
  document.body.appendChild(root);
  const sent: string[] = [];
  const term = { element: root, textarea: ta, input: vi.fn((d: string) => sent.push(d)) };
  // Stand-ins for xterm's own textarea listeners.
  const xtermInput = vi.fn();
  const xtermKeydown = vi.fn();
  ta.addEventListener("input", xtermInput, true);
  ta.addEventListener("keydown", xtermKeydown, true);
  installHangulIme(term as never);
  // Replays one event triple in the order the installed app delivers it:
  // beforeinput, (textarea edited), input, then keydown(229).
  const type = (inputType: string, data: string, value: string, key = true) => {
    ta.dispatchEvent(new InputEvent("beforeinput", { inputType, data, bubbles: true }));
    ta.value = value;
    ta.dispatchEvent(new InputEvent("input", { inputType, data, bubbles: true }));
    if (key) {
      const kd = new KeyboardEvent("keydown", { key: data, bubbles: true });
      Object.defineProperty(kd, "keyCode", { value: 229 });
      ta.dispatchEvent(kd);
    }
  };
  return { ta, sent, type, xtermInput, xtermKeydown };
}

describe("xterm Hangul IME", () => {
  it("sends every jamo edit so 한글 reaches the PTY whole (trace from the installed app)", () => {
    const { sent, type, xtermInput, xtermKeydown } = setup();
    type("insertText", "ㅎ", "ㅎ");
    type("insertReplacementText", "하", "하");
    type("insertReplacementText", "한", "한");
    type("insertReplacementText", "한", "한", false);
    type("insertText", "ㄱ", "한ㄱ");
    type("insertReplacementText", "그", "한그");
    type("insertReplacementText", "글", "한글");
    expect(applyPty(sent)).toBe("한글");
    expect(xtermInput).not.toHaveBeenCalled();
    expect(xtermKeydown).not.toHaveBeenCalled();
  });

  it("handles a final consonant moving to the next syllable (헉 → 허거 → 허걱)", () => {
    const { sent, type } = setup();
    type("insertText", "ㅎ", "ㅎ");
    type("insertReplacementText", "허", "허");
    type("insertReplacementText", "헉", "헉");
    type("insertReplacementText", "허", "허", false);
    type("insertText", "거", "허거");
    type("insertReplacementText", "걱", "허걱");
    expect(applyPty(sent)).toBe("허걱");
  });

  it("leaves ASCII input to xterm", () => {
    const { sent, ta, xtermInput } = setup();
    ta.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: "a", bubbles: true }));
    ta.value = "a";
    ta.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: "a", bubbles: true }));
    expect(sent).toEqual([]);
    expect(xtermInput).toHaveBeenCalledOnce();
  });

  it("builds DELs per replaced character", () => {
    expect(hangulEditToPty("한그", "한글")).toBe("\x7f글");
    expect(hangulEditToPty("", "ㅎ")).toBe("ㅎ");
    expect(hangulEditToPty("한", "한")).toBe("");
  });
});
