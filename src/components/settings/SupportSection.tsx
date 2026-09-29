import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNativeFileDrop } from "../../hooks/useNativeFileDrop";
import { useT } from "../../i18n";

function useDialogOpen() {
  const [open, setOpen] = useState<typeof import("@tauri-apps/plugin-dialog").open | null>(null);
  useEffect(() => { import("@tauri-apps/plugin-dialog").then(m => setOpen(() => m.open)).catch(() => {}); }, []);
  return open;
}

export function SupportSection({ initialDetails = "" }: { initialDetails?: string }) {
  const t = useT();
  const [kind, setKind] = useState(initialDetails ? "crash" : "bug");
  const [title, setTitle] = useState(initialDetails ? t("settings.support.appErrorTitle") : "");
  const [description, setDescription] = useState(initialDetails);
  const [email, setEmail] = useState("");
  const [paths, setPaths] = useState<string[]>([]);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const pending = useRef(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const open = useDialogOpen();
  function addFiles(files: string[]) {
    if (pending.current) return;
    setPaths(current => {
      const next = [...new Set([...current, ...files])];
      if (next.length + Number(includeDiagnostics) > 5) { setError(t("settings.support.attachmentLimit")); return current; }
      return next;
    });
  }
  useNativeFileDrop(dropRef, addFiles);
  async function attach(crashes = false) {
    if (!open) return;
    try {
      const selected = await open({ multiple: true, directory: false, title: crashes ? t("settings.support.chooseCrashReportTitle") : t("settings.support.attachFilesDialogTitle"), ...(crashes ? { defaultPath: `${await (await import("@tauri-apps/api/path")).homeDir()}Library/Logs/DiagnosticReports/`, filters: [{ name: t("settings.support.crashReports"), extensions: ["ips", "crash"] }] } : {}) });
      if (selected) addFiles(Array.isArray(selected) ? selected : [selected]);
    } catch (e) { setError(String(e)); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const id = await invoke<string>("submit_support_report", { report: { kind, title, description, email, paths, includeDiagnostics } });
      setReceipt(id);
    } catch (e) { setError(String(e)); }
    finally { pending.current = false; setBusy(false); }
  }
  const input = "block w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-app)] px-3 py-2 text-sm text-[var(--text-primary)]";
  if (receipt) return <div className="space-y-4"><h3 className="text-lg font-medium">{t("settings.support.reportSent")}</h3><p>{t("settings.support.reportDelivered")} {t(email ? "settings.support.replyEmailProvided" : "settings.support.noReplyEmail")}</p><p className="text-xs text-[var(--text-secondary)] break-all">{t("settings.support.reference", { reference: receipt })}</p><button className={input} onClick={() => { setReceipt(""); setTitle(""); setDescription(""); setPaths([]); setIncludeDiagnostics(false); }}>{t("settings.support.sendAnother")}</button></div>;
  return <form onSubmit={e => void submit(e)} className="space-y-4">
    <div><h3 className="text-lg font-medium">{t("settings.nav.support")}</h3><p className="mt-1 text-sm text-[var(--text-secondary)]">{t("settings.support.description")}</p></div>
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm">{t("settings.support.reportType")}<select aria-label={t("settings.support.reportType")} className={input} value={kind} onChange={e => setKind(e.target.value)}><option value="bug">{t("settings.support.type.bug")}</option><option value="crash">{t("settings.support.type.crash")}</option><option value="question">{t("settings.support.type.question")}</option><option value="feedback">{t("settings.support.type.feedback")}</option></select></label>
      <label className="block text-sm">{t("settings.support.titleLabel")}<input className={input} required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block text-sm">{t("settings.support.whatHappened")}<textarea className={input} required maxLength={20000} rows={7} placeholder={`${t("settings.support.whatWereYouDoing.first")} ${t("settings.support.whatWereYouDoing.second")}`} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label className="block text-sm">{t("settings.support.replyEmailLabel")}<input className={input} type="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <div ref={dropRef} className="rounded-lg border border-dashed border-[var(--glass-border)] p-3 space-y-2">
        <p className="text-xs text-[var(--text-secondary)]">{t("settings.support.dropFiles.first")} {t("settings.support.dropFiles.second")}</p>
        {paths.map(path => <div key={path} className="flex items-center gap-2 text-xs"><span className="truncate flex-1" title={path}>{path.split("/").pop()}</span><button type="button" aria-label={t("settings.support.removeAttachment", { name: path.split("/").pop() ?? "" })} onClick={() => setPaths(paths.filter(p => p !== path))}>{t("settings.support.removeFile")}</button></div>)}
        <div className="flex gap-3 text-sm"><button type="button" disabled={!open} onClick={() => void attach()}>{t("settings.support.attachFiles")}</button><button type="button" disabled={!open} onClick={() => void attach(true)}>{t("settings.support.chooseCrashReport")}</button></div>
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={includeDiagnostics} disabled={!includeDiagnostics && paths.length >= 5} onChange={e => setIncludeDiagnostics(e.target.checked)} />{t("settings.support.includeDebugCapture", { mode: t("settings.nav.debug") })}</label>
      <p className="text-xs text-[var(--text-secondary)]">{t("settings.support.captureMustExist", { section: t("settings.nav.debug") })} {t("settings.support.diagnosticsMetadata")} {t("settings.support.reportDestination")} {t("settings.support.reviewAttachments")}</p>
      <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-[var(--accent-foreground)] disabled:opacity-50" disabled={!title.trim() || !description.trim()}>{busy ? t("settings.support.sending") : t("settings.support.sendReport")}</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
  </form>;
}
