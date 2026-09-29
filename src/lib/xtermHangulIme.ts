// Korean (Hangul) IME for xterm on macOS WKWebView.
//
// The installed app's WebKit sends Korean to xterm's helper textarea without
// composition events: a syllable's first jamo arrives as `insertText`, every
// later edit replaces it in place as `insertReplacementText` (ㅎ → 하 → 한),
// and keydown(229) comes after the input. xterm 5.5 forwards only
// `insertText`, so vowels and finals never reached the PTY (xterm.js #6084,
// unfixed upstream). Mirror the textarea instead: for each Hangul edit send
// one DEL per replaced character plus the new tail, and keep xterm from also
// handling that input and its trailing keydown(229).
import type { Terminal } from "@xterm/xterm";

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const installed = new WeakSet<object>();

/** PTY bytes that turn `before` into `after` at the end of the line. */
export function hangulEditToPty(before: string, after: string): string {
  const a = [...before];
  const b = [...after];
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return "\x7f".repeat(a.length - p) + b.slice(p).join("");
}

type ImeTerminal = Pick<Terminal, "element" | "textarea" | "input">;

export function installHangulIme(term: ImeTerminal): void {
  const root = term.element;
  const ta = term.textarea;
  if (!root || !ta || installed.has(term)) return;
  installed.add(term);

  let before: string | null = null;
  let handled = false;

  root.addEventListener("beforeinput", (e) => {
    if (e.target === ta) before = ta.value;
  }, true);

  root.addEventListener("input", (e) => {
    if (e.target !== ta) return;
    const ev = e as InputEvent;
    const hangul = ev.inputType === "insertReplacementText"
      || (ev.inputType === "insertText" && !!ev.data && HANGUL.test(ev.data));
    const old = before;
    before = null;
    if (!hangul || old === null) return;
    e.stopImmediatePropagation();
    handled = true;
    const data = hangulEditToPty(old, ta.value);
    if (data) term.input(data, true);
  }, true);

  root.addEventListener("keydown", (e) => {
    if (e.target !== ta) return;
    if (handled && e.keyCode === 229) e.stopImmediatePropagation();
    handled = false;
  }, true);
}
