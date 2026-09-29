import { useRef, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { scanAppCleanup, cleanAppCleanup, getCleanupSessionActivity, type CleanupFileScan } from "../../lib/cleanupCommands";
import { useSessionNameStore, type SessionCleanupPreview } from "../../stores/sessionNameStore";
import { useUiStore } from "../../stores/uiStore";
import { useSplitViewStore } from "../../stores/splitViewStore";
import { useThreadStore } from "../../stores/threadStore";
import { useTaskViewStore } from "../../stores/taskViewStore";
import { GlassButton } from "../ui/GlassButton";
import { PageHeader, SettingsCard, SettingsRow } from "./settingsLayout";
import { useT } from "../../i18n";

function protectedSessionIds(): string[] {
  const ui = useUiStore.getState();
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => { if (id) ids.add(id); };
  [ui.selectedThreadId, ui.selectedClaudeSessionId, ui.selectedCodexSessionId, ui.selectedTerminalSessionId].forEach(add);
  for (const map of [ui.codexProcessingById, ui.claudeProcessingById, ui.pendingApprovalsBySession]) {
    for (const [id, value] of Object.entries(map)) if (value) add(id);
  }
  const cutoff = Date.now() - 90 * 86400000;
  for (const map of [ui.lastPromptAt, ui.sessionFinishedAt]) {
    for (const [id, time] of Object.entries(map)) if (time >= cutoff) add(id);
  }
  // Conservatively keep every open tab, including persisted split panes.
  for (const pane of Object.values(useSplitViewStore.getState().panes)) {
    for (const tab of pane.tabs) {
      [tab.threadId, tab.claudeSessionId, tab.codexSessionId, tab.terminalSessionId, tab.opencodeThreadId].forEach(add);
    }
  }
  Object.values(useTaskViewStore.getState().activeAgentTabId).forEach(add);
  const threads = useThreadStore.getState();
  for (const rows of [...Object.values(threads.threads), ...Object.values(threads.archivedThreads)]) {
    for (const thread of rows) {
      if (thread.status === "Running" || ids.has(thread.id) || ids.has(thread.sdk_session_id ?? "") || ids.has(thread.opencode_session_id ?? "")) {
        [thread.id, thread.sdk_session_id, thread.opencode_session_id].forEach(add);
      }
    }
  }
  for (const [id, aliases] of Object.entries(ui.claudeSessionMap)) {
    if (ids.has(id) || aliases.some(alias => ids.has(alias))) [id, ...aliases].forEach(add);
  }
  return [...ids];
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CleanupSection() {
  const t = useT();
  const [preview, setPreview] = useState<{ summaries: SessionCleanupPreview; files: CleanupFileScan } | null>(null);
  const [summariesSelected, setSummariesSelected] = useState(true);
  const [filesSelected, setFilesSelected] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const scan = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setPreview(null);
    setConfirming(false);
    setErrors([]);
    setResult(null);
    try {
      const [fileScan, summaryScan] = await Promise.allSettled([
        scanAppCleanup(),
        (async () => {
          const ids = useSessionNameStore.getState().cleanupSessionIds();
          const activity = await getCleanupSessionActivity(ids);
          return useSessionNameStore.getState().previewCleanup(activity, protectedSessionIds());
        })(),
      ]);
      const failures: string[] = [];
      const files = fileScan.status === "fulfilled" ? fileScan.value : { files: [], errors: [] };
      const summaries = summaryScan.status === "fulfilled" ? summaryScan.value : { entries: [], unknownCount: 0 };
      if (fileScan.status === "rejected") failures.push(t("settings.cleanup.fileScanFailed", { error: String(fileScan.reason) }));
      if (summaryScan.status === "rejected") failures.push(`${t("settings.cleanup.summaryScanFailed", { error: String(summaryScan.reason) })} ${t("settings.cleanup.summaryDataKept")}`);
      if (fileScan.status === "fulfilled" || summaryScan.status === "fulfilled") setPreview({ summaries, files });
      setErrors([...failures, ...files.errors]);
    } catch (error) {
      setErrors([t("settings.cleanup.scanFailed", { error: String(error) })]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const clean = async () => {
    if (!preview || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setErrors([]);
    const failures: string[] = [];
    let summaryCount = 0;
    let fileCount = 0;
    let bytes = 0;
    let skipped = 0;
    try {
      if (summariesSelected && preview.summaries.entries.length > 0) {
        try {
          const activity = await getCleanupSessionActivity(preview.summaries.entries.map(item => item.id));
          const removed = useSessionNameStore.getState().cleanup(preview.summaries, activity, protectedSessionIds());
          summaryCount = removed.removedCount;
          bytes += removed.removedBytes;
          skipped += removed.skippedCount;
        } catch (error) {
          failures.push(`${t("settings.cleanup.summaryCleanupStopped", { error: String(error) })} ${t("settings.cleanup.scanAgain")}`);
        }
      }
      if (filesSelected && preview.files.files.length > 0) {
        try {
          const removed = await cleanAppCleanup(preview.files.files);
          fileCount = removed.removedCount;
          bytes += removed.removedBytes;
          skipped += removed.skippedCount;
          failures.push(...removed.errors);
        } catch (error) {
          failures.push(`${t("settings.cleanup.fileCleanupStopped", { error: String(error) })} ${t("settings.cleanup.scanAgain")}`);
        }
      }
      setResult(`${t("settings.cleanup.removedSummaries", { count: summaryCount })} ${t("settings.cleanup.removedFiles", { count: fileCount, size: sizeLabel(bytes) })}${skipped ? ` ${t("settings.cleanup.skipped", { count: skipped })}` : ""}`);
      setErrors(failures);
      setPreview(null);
      setConfirming(false);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const summaryCount = summariesSelected ? preview?.summaries.entries.length ?? 0 : 0;
  const fileCount = filesSelected ? preview?.files.files.length ?? 0 : 0;
  const bytes = (summariesSelected ? preview?.summaries.entries.reduce((sum, item) => sum + item.bytes, 0) ?? 0 : 0)
    + (filesSelected ? preview?.files.files.reduce((sum, item) => sum + item.bytes, 0) ?? 0 : 0);

  const selectedCount = summaryCount + fileCount;

  return (
    <div>
      <PageHeader title={t("settings.nav.cleanup")} description={t("settings.cleanup.description")} />
      <SettingsCard
        eyebrow={t("settings.cleanup.scan")}
        title={t("settings.cleanup.oldData")}
        description={`${t("settings.cleanup.oldDataDescription.first")} ${t("settings.cleanup.oldDataDescription.second")}`}
      >
        <SettingsRow label={t("settings.cleanup.findOldData")} description={t("settings.cleanup.reviewFirst")}>
          <GlassButton size="sm" icon={Search} onClick={() => void scan()} disabled={busy}>
            {busy ? t("settings.cleanup.working") : t("settings.cleanup.scanForCleanup")}
          </GlassButton>
        </SettingsRow>
        {result && <div role="status" className="px-6 py-3.5 text-[12px] text-[var(--text-secondary)]">{result}</div>}
        {errors.length > 0 && (
          <div role="alert" className="space-y-1 px-6 py-3.5 text-[12px] text-red-400/90">{errors.map((error, index) => <p key={index} className="m-0">{error}</p>)}</div>
        )}
      </SettingsCard>

      {preview && (
        <SettingsCard eyebrow={t("settings.cleanup.review")} title={t("settings.cleanup.availableToClean")}>
          <CleanupOption
            label={t("settings.cleanup.savedSummaries")}
            count={preview.summaries.entries.length}
            description={`${t("settings.cleanup.savedSummariesDescription.first")} ${t("settings.cleanup.savedSummariesDescription.second")}`}
            checked={summariesSelected}
            disabled={busy || confirming}
            onChange={setSummariesSelected}
          />
          <CleanupOption
            label={t("settings.cleanup.cachedFiles")}
            count={preview.files.files.length}
            description={t("settings.cleanup.cachedFilesDescription")}
            checked={filesSelected}
            disabled={busy || confirming}
            onChange={setFilesSelected}
          />
          {preview.summaries.unknownCount > 0 && (
            <SettingsRow label={t("settings.cleanup.kept")} description={t("settings.cleanup.unknownAge", { count: preview.summaries.unknownCount })} />
          )}
          {preview.files.files.length > 0 && (
            <details className="settings-row px-6 py-3.5 text-[12px] text-[var(--text-muted)]">
              <summary className="cursor-pointer text-[13.5px] text-[var(--text-primary)]">{t("settings.cleanup.reviewCachedFiles")}</summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {preview.files.files.map(file => <li key={file.relativePath} className="break-all">{file.relativePath} · {sizeLabel(file.bytes)}</li>)}
              </ul>
            </details>
          )}
          {!confirming ? (
            <SettingsRow
              label={selectedCount === 0 ? t("settings.cleanup.noEligibleSelected") : t("settings.cleanup.itemsSelected", { count: selectedCount })}
              description={selectedCount === 0 ? undefined : t("settings.cleanup.aboutSize", { size: sizeLabel(bytes) })}
            >
              <GlassButton size="sm" icon={Trash2} onClick={() => setConfirming(true)} disabled={busy || selectedCount === 0}>{t("settings.cleanup.reviewCleanup")}</GlassButton>
            </SettingsRow>
          ) : (
            <div role="alertdialog" aria-label={t("settings.cleanup.confirmCleanup")}>
              <SettingsRow
                label={t("settings.cleanup.removeSelected", { count: selectedCount })}
                description={`${t("settings.cleanup.confirmDescription.first")} ${t("settings.cleanup.confirmDescription.second")}`}
              >
                <GlassButton size="sm" onClick={() => setConfirming(false)} disabled={busy}>{t("settings.cleanup.cancel")}</GlassButton>
                <GlassButton size="sm" variant="destructive" icon={Trash2} onClick={() => void clean()} disabled={busy}>{t("settings.cleanup.cleanNow")}</GlassButton>
              </SettingsRow>
            </div>
          )}
        </SettingsCard>
      )}
    </div>
  );
}

function CleanupOption({ label, count, description, checked, disabled, onChange }: {
  label: string;
  count: number;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-row flex cursor-pointer items-start gap-3 px-6 py-3.5 transition-colors">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="mt-[3px] accent-[var(--accent)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] text-[var(--text-primary)]" style={{ letterSpacing: "-0.015em" }}>
          {label} <span className="text-[var(--text-muted)]">· {count}</span>
        </span>
        <span className="mt-[3px] block text-[12px] leading-[1.45] text-[var(--text-muted)]">{description}</span>
      </span>
    </label>
  );
}
