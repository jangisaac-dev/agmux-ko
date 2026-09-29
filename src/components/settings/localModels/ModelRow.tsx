import { useState } from "react";
import { CheckCircle2, Download, ExternalLink, Loader2, Trash2, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { tierLabel, type CatalogModel, type MlxDownloadProgress } from "../../../lib/mlx";
import { MetaLine, RoleBadge, btn, btnAccent, btnDanger } from "./ui";
import { useT } from "../../../i18n";

export interface DownloadControls {
  activeRepo: string | null;
  progress: MlxDownloadProgress | null;
  onDownload: (repoId: string) => void;
  onCancel: () => void;
  onRemove: (repoId: string) => void;
}

const MEMORY_HINT_KEYS = [
  "settings.localModels.memoryHint.first",
  "settings.localModels.memoryHint.second",
] as const;

/** One curated catalog model inside a SettingsCard. */
export function CatalogModelRow({
  model,
  controls,
  showTier,
}: {
  model: CatalogModel;
  controls: DownloadControls;
  showTier?: boolean;
}) {
  const t = useT();
  const downloading = controls.activeRepo === model.repoId;
  return (
    <ModelRowShell
      title={model.name}
      badges={
        <>
          <RoleBadge role={model.role} />
          {showTier && (
            <span className="rounded-full border border-[var(--glass-border)] px-1.5 py-px font-mono text-[10px] text-[var(--text-muted)]">
              {tierLabel(model.tier)}
            </span>
          )}
          {model.installed && <InstalledBadge />}
        </>
      }
      description={model.description}
      meta={[
        model.params,
        model.quant,
        t("settings.localModels.downloadSize", { size: model.sizeGb.toFixed(1) }),
        model.fitsThisMac ? (
          <span key="memory" title={`${t(MEMORY_HINT_KEYS[0])} ${t(MEMORY_HINT_KEYS[1])}`}>
            {t("settings.localModels.memoryAvailable", { memory: model.memoryGb.toFixed(0) })}
          </span>
        ) : (
          <span key="memory" title={`${t(MEMORY_HINT_KEYS[0])} ${t(MEMORY_HINT_KEYS[1])}`} className="text-[var(--status-amber)]">
            {t("settings.localModels.memoryNeeded", { memory: model.memoryGb.toFixed(0) })}
          </span>
        ),
        <RepoLink key="repo" repoId={model.repoId} />,
      ]}
      action={
        model.installed ? (
          <RemoveButton onConfirm={() => controls.onRemove(model.repoId)} />
        ) : downloading ? (
          <button type="button" className={btn} onClick={controls.onCancel}>
            <X size={12} /> {t("settings.localModels.cancelDownload")}
          </button>
        ) : (
          <button
            type="button"
            className={btnAccent}
            onClick={() => controls.onDownload(model.repoId)}
            disabled={!!controls.activeRepo}
            title={controls.activeRepo ? t("settings.localModels.anotherDownloadInProgress") : undefined}
          >
            <Download size={12} /> {t("settings.localModels.download")}
          </button>
        )
      }
      progress={downloading && controls.progress?.repoId === model.repoId ? controls.progress : null}
    />
  );
}

export function ModelRowShell({
  title,
  badges,
  description,
  meta,
  action,
  progress,
}: {
  title: string;
  badges?: React.ReactNode;
  description?: string;
  meta: React.ReactNode[];
  action: React.ReactNode;
  /** Only pass progress that belongs to this row. */
  progress?: MlxDownloadProgress | null;
}) {
  return (
    <div className="settings-row px-6 py-3.5 transition-colors">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13.5px] text-[var(--text-primary)]" style={{ letterSpacing: "-0.015em" }}>
              {title}
            </span>
            {badges}
          </div>
          {description && (
            <p className="m-0 mt-[3px] text-[12px] leading-[1.45] text-[var(--text-tertiary)]">{description}</p>
          )}
          <MetaLine items={meta} />
        </div>
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      </div>
      {progress && <DownloadProgressBar progress={progress} />}
    </div>
  );
}

export function InstalledBadge() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)]">
      <CheckCircle2 size={11} /> {t("settings.localModels.installed")}
    </span>
  );
}

export function RepoLink({ repoId }: { repoId: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => openUrl(`https://huggingface.co/${repoId}`).catch(() => {})}
      className="inline-flex min-w-0 items-center gap-1 font-mono text-[10.5px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      title={t("settings.localModels.openOnHuggingFace")}
    >
      <span className="truncate">{repoId}</span>
      <ExternalLink size={9} className="shrink-0" />
    </button>
  );
}

/** Two-step remove so a stray click doesn't delete a multi-GB download. */
export function RemoveButton({ onConfirm }: { onConfirm: () => void }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" className={btnDanger} onClick={() => setConfirming(true)}>
        <Trash2 size={12} /> {t("settings.localModels.remove")}
      </button>
    );
  }
  return (
    <>
      <button type="button" className={btn} onClick={() => setConfirming(false)}>
        {t("settings.localModels.keep")}
      </button>
      <button
        type="button"
        className={`${btnDanger} border-red-500/40 bg-red-500/10 text-red-400`}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        <Trash2 size={12} /> {t("settings.localModels.deleteFiles")}
      </button>
    </>
  );
}

function DownloadProgressBar({ progress }: { progress: MlxDownloadProgress }) {
  const t = useT();
  const label =
    progress.stage === "downloading" ? t("settings.localModels.downloading") : (progress.message ?? progress.stage);
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
        <span className="inline-flex items-center gap-1.5 first-letter:uppercase">
          <Loader2 size={11} className="animate-spin" />
          {label}
        </span>
        {progress.percent != null && <span className="tabular-nums">{progress.percent}%</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: progress.percent != null ? `${progress.percent}%` : "8%" }}
        />
      </div>
    </div>
  );
}
