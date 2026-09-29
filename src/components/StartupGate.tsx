import { lazy, Suspense, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SupportSection } from "./settings/SupportSection";
import { useT } from "../i18n";
const App = lazy(() => import("../App"));
interface Status { error: string | null; dataPath: string; backups: string[] }
export function StartupGate() {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [support, setSupport] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    invoke<Status>("startup_status").then(value => {
      if (cancelled) return;
      setStatus(value);
      setSelected(value.backups[0] ?? "");
      if (!value.error) {
        void import("../lib/appVisibility").then(m => m.installAppVisibilitySync());
        void import("../lib/notifications").then(m => m.installNotificationActivationHandler());
      }
    }).catch(e => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (status?.error || error) document.getElementById("splash")?.remove();
  }, [status, error]);
  async function restart() {
    try { const { relaunch } = await import("@tauri-apps/plugin-process"); await relaunch(); }
    catch (e) { setError(String(e)); }
  }
  async function restore() {
    if (busy) return;
    setBusy(true); setError("");
    try { await invoke("startup_restore_backup", { name: selected }); setRestored(true); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  if (status && !status.error) return <Suspense fallback={<div className="p-8">{t("startup.opening")}</div>}><App /></Suspense>;
  return <div className="h-screen overflow-auto bg-[var(--bg-app)] p-8 text-[var(--text-primary)]"><div className="mx-auto max-w-xl space-y-4">
    {support ? <><button onClick={() => setSupport(false)} className="fx-quiet">{t("startup.back")}</button><SupportSection initialDetails={t("startup.support.startupFailed", { error: status?.error ?? error })} /></> : <>
      <h1 className="text-xl font-semibold">{status?.error || error ? t("startup.title.failed") : t("startup.opening")}</h1>
      {(status?.error || error) && <><p>{t("startup.dataNotReset")}</p><pre className="whitespace-pre-wrap break-words text-sm fx-red">{status?.error}</pre><p className="text-xs break-all">{t("startup.dataFolder")}: {status?.dataPath}</p>
      <div className="flex gap-4"><button disabled={busy} onClick={() => void restart()} className="fx-accent">{t("startup.restartApp")}</button><button disabled={busy} onClick={() => setSupport(true)} className="fx-quiet">{t("startup.contactSupport")}</button></div>
      {status && <button onClick={() => void import("@tauri-apps/plugin-opener").then(m => m.openPath(status.dataPath)).catch(e => setError(String(e)))} className="fx-quiet">{t("startup.openDataFolder")}</button>}
      {!!status?.backups.length && !restored && <fieldset disabled={busy} className="space-y-3 rounded border border-[var(--glass-border)] p-4"><label className="block">{t("startup.savedDatabase")}<select className="block w-full bg-[var(--bg-app)] text-sm" value={selected} onChange={e => { setSelected(e.target.value); setConfirm(false); }}>{status.backups.map(name => <option key={name}>{name}</option>)}</select></label><p className="text-sm">{t("startup.restore.description.snapshot")} {t("startup.restore.description.backup")} {t("startup.restore.description.providerFiles")}</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />{t("startup.restore.confirm")}</label><button disabled={!confirm || busy} onClick={() => void restore()} className="fx-accent">{busy ? t("startup.restore.restoring") : t("startup.restore.restoreDatabase")}</button></fieldset>}
      {restored && <p role="status">{t("startup.restore.restored")}</p>}
      {status && !status.backups.length && <p>{t("startup.noBackup")}</p>}</>}
    </>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
  </div></div>;
}
