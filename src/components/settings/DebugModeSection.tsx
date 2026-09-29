import { useSettingsStore } from "../../stores/settingsStore";
import { useEffect, useRef, useState } from "react";
import { getDebugStatus, setDebugEnabled, type DebugStatus } from "../../lib/debugMode";
import { GlassButton } from "../ui/GlassButton";
import { PageHeader, SettingsCard, SettingsRow, Toggle } from "./settingsLayout";
import { useT } from "../../i18n";

export function DebugModeSection() {
  const t = useT();
  const [status, setStatus] = useState<DebugStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const version = useRef(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (pending.current) return;
      const request = ++version.current;
      try {
        const next = await getDebugStatus();
        if (!cancelled && request === version.current) { setStatus(next); setError(null); }
      } catch (err) {
        if (!cancelled && request === version.current) setError(String(err));
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);
  const toggle = async () => {
    if (!status || pending.current) return;
    pending.current = true;
    ++version.current;
    setBusy(true);
    setError(null);
    try { setStatus(await setDebugEnabled(!status.enabled)); }
    catch (err) { setError(String(err)); }
    finally { pending.current = false; setBusy(false); }
  };
  return (
    <div>
      <PageHeader title={t("settings.nav.debug")} description={t("settings.debug.description")} />
      <SettingsCard
        eyebrow={t("settings.debug.recorder")}
        title={t(status?.enabled ? "settings.debug.recording" : "settings.debug.off")}
        description={`${t("settings.debug.recorderDescription.first")} ${t("settings.debug.recorderDescription.second")} ${t("settings.debug.recorderDescription.third")}`}
      >
        <SettingsRow label={t("settings.nav.debug")} description={`${t("settings.debug.samplesSaved", { count: status?.recordCount ?? 0 })} · ${t("settings.debug.resetOnRestart")}`}>
          {status && <Toggle label={t("settings.nav.debug")} enabled={status.enabled} disabled={busy} onChange={() => void toggle()} />}
        </SettingsRow>
        <SettingsRow label={t("settings.debug.privacy")} description={`${t("settings.debug.privacyDescription.first")} ${t("settings.debug.privacyDescription.second")}`} />
        {(error || status?.lastError) && (
          <div role="alert" className="px-6 py-3.5 text-[12px] text-red-400/90">{error || status?.lastError}</div>
        )}
      </SettingsCard>
      <SettingsCard eyebrow={t("settings.debug.investigate")} title={t("settings.debug.shareCapture")} description={t("settings.debug.shareCaptureDescription")}>
        <SettingsRow label={t("settings.debug.askAgent")} description={`${t("settings.debug.askAgentDescription.first")} ${t("settings.debug.askAgentDescription.second")} ${t("settings.debug.askAgentDescription.third")}`} />
        <SettingsRow label={t("settings.debug.localCapture")} description={<code className="break-all">~/.agmux/debug/diagnostics.json</code>} />
        <SettingsRow label={t("settings.debug.sendSupportReport")} description={t("settings.debug.sendSupportReportDescription")}>
          <GlassButton size="sm" onClick={() => useSettingsStore.getState().openSettings("support")}>{t("settings.debug.openSupport")}</GlassButton>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
