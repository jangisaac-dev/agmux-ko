import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Zap, WifiOff, Gauge, HardDrive, CheckCircle2, XCircle } from "lucide-react";
import { useLocalModelStore } from "../../stores/localModelStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { localeTag, useT } from "../../i18n";

function formatBytes(bytes: number): string {
  const format = (value: number, maximumFractionDigits = 0) =>
    value.toLocaleString(localeTag(), { useGrouping: false, maximumFractionDigits });
  if (bytes >= 1_000_000_000) return `${format(bytes / 1_000_000_000, 1)} GB`;
  if (bytes >= 1_000_000) return `${format(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${format(bytes / 1_000)} KB`;
  return `${format(bytes)} B`;
}

/** Optional local-model setup, deferred while the main setup wizard is open. */
export function LocalModelSetupDialog() {
  const t = useT();
  const status = useLocalModelStore((s) => s.status);
  const downloading = useLocalModelStore((s) => s.downloading);
  const downloadProgress = useLocalModelStore((s) => s.downloadProgress);
  const error = useLocalModelStore((s) => s.error);
  const fetchStatus = useLocalModelStore((s) => s.fetchStatus);
  const startDownload = useLocalModelStore((s) => s.startDownload);
  const setupWizardOpen = useSettingsStore((s) => s.isSetupWizardOpen);
  const dismissed = useLocalModelStore(s => s.hasSeenSetupPrompt);
  const dismiss = useLocalModelStore(s => s.dismissSetupPrompt);

  useEffect(() => {
    fetchStatus().catch(() => {});
  }, [fetchStatus]);

  // Offer once when no model is on disk.
  // Defer to SetupWizard while that flow is active.
  const shouldShow =
    !setupWizardOpen && !dismissed && status !== null && !status.model_downloaded;

  function handleRetry() {
    startDownload().catch(() => {});
  }

  const progressPercent =
    downloadProgress && downloadProgress.total_bytes
      ? Math.round((downloadProgress.bytes_downloaded / downloadProgress.total_bytes) * 100)
      : null;

  const downloadComplete = downloadProgress?.complete && !downloadProgress.error;
  const downloadError = downloadProgress?.error ?? error;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center fx-scrim"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(16px)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="local-model-setup-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-md rounded-[20px] border border-white/10 bg-zinc-900/90 p-7 shadow-2xl fx-dialog"
            style={{ backdropFilter: "blur(24px)" }}
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 fx-soft-blue">
              <HardDrive size={22} className="text-blue-400" />
            </div>

            <h2 id="local-model-setup-title" className="mb-2 text-lg font-semibold text-zinc-100">
              {t("localModel.setup.title")}
            </h2>
            <p className="mb-5 text-sm text-zinc-400 leading-relaxed">
              {t("localModel.setup.description")}
            </p>

            <div className="mb-6 space-y-2.5">
              {[
                { id: "responses", icon: <Zap size={14} className="text-amber-400" />, label: t("localModel.setup.benefit.responses") },
                { id: "offline", icon: <WifiOff size={14} className="text-[color:var(--accent)]" />, label: t("localModel.setup.benefit.offline") },
                { id: "limits", icon: <Gauge size={14} className="text-blue-400" />, label: t("localModel.setup.benefit.limits") },
              ].map(({ id, icon, label }) => (
                <div key={id} className="flex items-center gap-2.5 text-sm text-zinc-300 fx-graphite">
                  {icon}
                  {label}
                </div>
              ))}
            </div>

            {downloading && (
              <div className="mb-5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
                  <span className="capitalize">
                    {downloadProgress?.stage === "server"
                      ? t("localModel.setup.progress.downloadingServer")
                      : downloading
                        ? t("localModel.setup.progress.downloadingModel")
                        : t("localModel.setup.progress.starting")}
                  </span>
                  {progressPercent !== null && (
                    <span className="tabular-nums">{progressPercent.toLocaleString(localeTag())}%</span>
                  )}
                  {downloadProgress && downloadProgress.total_bytes && (
                    <span className="tabular-nums text-zinc-500">
                      {formatBytes(downloadProgress.bytes_downloaded)} /{" "}
                      {formatBytes(downloadProgress.total_bytes)}
                    </span>
                  )}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    className="bg-pausable h-full rounded-full bg-blue-600"
                    animate={{ width: progressPercent !== null ? `${progressPercent}%` : "30%" }}
                    transition={{ ease: "linear", duration: 0.3 }}
                    style={
                      progressPercent === null
                        ? { animation: "pulse 1.5s ease-in-out infinite" }
                        : undefined
                    }
                  />
                </div>
              </div>
            )}

            {downloadComplete && (
              <div className="mb-5 flex items-center gap-2 text-sm text-[color:var(--accent)]">
                <CheckCircle2 size={15} />
                {t("localModel.setup.status.complete")}
              </div>
            )}

            {!downloading && !downloadError && <button type="button" onClick={handleRetry} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white fx-accent">{t("localModel.setup.action.download")}</button>}
            <button type="button" onClick={dismiss} className="ml-3 rounded-lg px-4 py-2 text-sm text-zinc-300 fx-quiet">{downloading ? t("localModel.setup.action.continueBackground") : t("localModel.setup.action.later")}</button>

            {downloadError && !downloading && (
              <>
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">
                  <XCircle size={13} className="mt-0.5 shrink-0" />
                  {downloadError}
                </div>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors fx-accent"
                >
                  <Download size={15} />
                  {t("localModel.setup.action.retry")}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
