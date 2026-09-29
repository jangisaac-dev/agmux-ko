import { useCallback, useEffect, useMemo, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { RefreshCw } from "lucide-react";
import {
  HARDWARE_TIERS,
  formatLocalModelLabel,
  mlxCancelDownload,
  mlxDeleteCatalogModel,
  mlxDownloadModel,
  mlxDownloadStatus,
  mlxHardwareInfo,
  mlxListModels,
  mlxModelCatalog,
  tierLabel,
  type CatalogModel,
  type HardwareTier,
  type MlxDownloadProgress,
  type MlxHardwareInfo,
  type MlxModel,
} from "../../lib/mlx";
import { formatError } from "../../lib/formatError";
import { useSettingsStore } from "../../stores/settingsStore";
import { PageHeader, SettingsCard, SettingsRow, Toggle } from "./settingsLayout";
import { ChoiceGroup, type Choice } from "./accounts/ChoiceGroup";
import { MlxRuntimeSection } from "./MlxRuntimeSection";
import { CatalogModelRow, ModelRowShell, RemoveButton, RepoLink, type DownloadControls } from "./localModels/ModelRow";
import { HfSearch } from "./localModels/HfSearch";
import { ExaKeyRow } from "./localModels/ExaKeyRow";
import { ErrorNote, iconBtn, roleOrder } from "./localModels/ui";
import { localeTag, useT } from "../../i18n";

type TierChoice = "auto" | HardwareTier;

const GIB = 1024 ** 3;

export function LocalModelsPanel() {
  const t = useT();
  const [hardware, setHardware] = useState<MlxHardwareInfo | null>(null);
  const [catalog, setCatalog] = useState<CatalogModel[]>([]);
  const [installed, setInstalled] = useState<MlxModel[]>([]);
  const [progress, setProgress] = useState<MlxDownloadProgress | null>(null);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const catalogTierPref = useSettingsStore((s) => s.settings.mlxCatalogTier ?? "auto");
  const nativeTools = useSettingsStore((s) => s.settings.mlxUseNativeTools);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // Catalog `installed` flags and the on-disk list change together.
  const refreshModels = useCallback(async () => {
    try {
      const [list, onDisk] = await Promise.all([mlxModelCatalog(), mlxListModels()]);
      setCatalog(list);
      setInstalled(onDisk.filter((m) => m.source === "xanomManaged"));
    } catch (e) {
      setError(formatError(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;
    (async () => {
      try {
        const [hw, status] = await Promise.all([mlxHardwareInfo(), mlxDownloadStatus()]);
        if (cancelled) return;
        setHardware(hw);
        if (status.active && status.repoId) setActiveRepo(status.repoId);
        await refreshModels();
      } catch (e) {
        if (!cancelled) setError(formatError(e));
      }
      const handle = await listen<MlxDownloadProgress>("mlx-model-download", (event) => {
        const p = event.payload;
        setProgress(p);
        if (p.complete || p.cancelled || p.error) {
          setActiveRepo(null);
          if (p.error) setError(p.error);
          refreshModels().catch(() => {});
        }
      });
      // If the component unmounted while listen() was pending, detach now.
      if (cancelled) handle();
      else unlisten = handle;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshModels]);

  const detectedTier: HardwareTier = hardware?.tier ?? "16";
  const tierToShow: HardwareTier = catalogTierPref === "auto" ? detectedTier : catalogTierPref;

  const recommended = useMemo(
    () =>
      catalog
        .filter((m) => m.tier === tierToShow)
        .sort((a, b) => roleOrder(a.role) - roleOrder(b.role)),
    [catalog, tierToShow],
  );

  const catalogById = useMemo(() => new Map(catalog.map((m) => [m.repoId.toLowerCase(), m])), [catalog]);
  const installedIds = useMemo(() => new Set(installed.map((m) => m.id.toLowerCase())), [installed]);

  const tierChoices = useMemo<Choice<TierChoice>[]>(
    () => [
      { value: "auto", label: hardware ? t("settings.localModels.tier.autoChoice", { tier: tierLabel(detectedTier) }) : t("settings.localModels.tier.auto") },
      ...HARDWARE_TIERS.map((tier) => ({ value: tier, label: tierLabel(tier) })),
    ],
    [hardware, detectedTier, t],
  );

  const handleDownload = useCallback(async (repoId: string) => {
    setError(null);
    setActiveRepo(repoId);
    setProgress({
      repoId,
      stage: "starting",
      percent: null,
      message: t("settings.localModels.startingDownload"),
      complete: false,
      cancelled: false,
      error: null,
    });
    try {
      await mlxDownloadModel(repoId);
    } catch (e) {
      setError(formatError(e));
      setActiveRepo(null);
    }
  }, [t]);

  const handleCancel = useCallback(async () => {
    try {
      await mlxCancelDownload();
    } catch (e) {
      setError(formatError(e));
    }
  }, []);

  const handleRemove = useCallback(
    async (repoId: string) => {
      setError(null);
      try {
        await mlxDeleteCatalogModel(repoId);
        await refreshModels();
      } catch (e) {
        setError(formatError(e));
      }
    },
    [refreshModels],
  );

  const controls: DownloadControls = {
    activeRepo,
    progress,
    onDownload: handleDownload,
    onCancel: handleCancel,
    onRemove: handleRemove,
  };

  return (
    <div>
      <PageHeader title={t("settings.nav.localModels")} description={t("settings.localModels.description")} />

      {error && (
        <div className="mb-5">
          <ErrorNote message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <SettingsCard eyebrow={t("settings.localModels.setup")} title={t("settings.localModels.thisMac")}>
        <SettingsRow
          label={hardware ? hardware.chip : t("settings.localModels.detectingHardware")}
          description={
            hardware ? (
              <>
                {t("settings.localModels.hardwareSpecs", {
                  memory: hardware.totalRamGb.toLocaleString(localeTag()),
                  cores: hardware.cores.toLocaleString(localeTag()),
                })}
                {!hardware.isAppleSilicon && (
                  <span className="text-amber-400"> · {t("settings.localModels.appleSiliconWarning")}</span>
                )}
              </>
            ) : undefined
          }
        >
          <button type="button" className={iconBtn} onClick={() => refreshModels()} title={t("settings.localModels.refreshModels")} aria-label={t("settings.localModels.refreshModels")}>
            <RefreshCw size={12} />
          </button>
        </SettingsRow>
        {/* Every Download below fails until the runtime is installed. */}
        <MlxRuntimeSection />
      </SettingsCard>

      <SettingsCard
        eyebrow={t("settings.localModels.library")}
        title={catalogTierPref === "auto" ? t("settings.localModels.recommendedForThisMac") : t("settings.localModels.recommendedForTier", { tier: tierLabel(tierToShow) })}
        description={`${t("settings.localModels.recommendationsDescription.first")} ${t("settings.localModels.recommendationsDescription.second")}`}
      >
        <SettingsRow
          label={t("settings.localModels.memory")}
          description={`${t("settings.localModels.memoryDescription.first")} ${t("settings.localModels.memoryDescription.second")}`}
          stacked
        >
          <ChoiceGroup<TierChoice>
            label={t("settings.localModels.memoryTierLabel")}
            choices={tierChoices}
            value={catalogTierPref}
            onChange={(next) => updateSettings({ mlxCatalogTier: next })}
          />
        </SettingsRow>
        {recommended.map((model) => (
          <CatalogModelRow key={model.repoId} model={model} controls={controls} />
        ))}
        {recommended.length === 0 && (
          <div className="px-6 py-3.5 text-[12px] text-[var(--text-muted)]">
            {catalog.length === 0 ? t("settings.localModels.loadingRecommendations") : t("settings.localModels.noRecommendedModels")}
          </div>
        )}
      </SettingsCard>

      {installed.length > 0 && (
        <SettingsCard eyebrow={t("settings.localModels.onDisk")} title={t("settings.localModels.installed")} description={`${t("settings.localModels.installedDescription.first")} ${t("settings.localModels.installedDescription.second")}`}>
          {installed.map((model) => (
            <InstalledModelRow key={model.id} model={model} catalogModel={catalogById.get(model.id.toLowerCase())} onRemove={handleRemove} />
          ))}
        </SettingsCard>
      )}

      <SettingsCard
        eyebrow="HuggingFace"
        title={t("settings.localModels.browseMore")}
        description={`${t("settings.localModels.browseMoreDescription.first")} ${t("settings.localModels.browseMoreDescription.second")}`}
      >
        <HfSearch installedIds={installedIds} controls={controls} />
      </SettingsCard>

      <SettingsCard eyebrow={t("settings.localModels.tools")} title={t("settings.localModels.agentTools")} description={t("settings.localModels.agentToolsDescription")}>
        <ExaKeyRow />
        <SettingsRow
          label={t("settings.localModels.nativeToolCalling")}
          description={`${t("settings.localModels.nativeToolCallingDescription.first")} ${t("settings.localModels.nativeToolCallingDescription.second")} ${t("settings.localModels.nativeToolCallingDescription.third")} ${t("settings.localModels.nativeToolCallingDescription.fourth")}`}
        >
          <Toggle
            enabled={nativeTools}
            onChange={(v) => updateSettings({ mlxUseNativeTools: v })}
            label={t("settings.localModels.nativeToolCalling")}
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

function InstalledModelRow({
  model,
  catalogModel,
  onRemove,
}: {
  model: MlxModel;
  catalogModel: CatalogModel | undefined;
  onRemove: (repoId: string) => void;
}) {
  const t = useT();
  const quant = catalogModel?.quant ?? model.quant;
  return (
    <ModelRowShell
      title={catalogModel?.name ?? formatLocalModelLabel(model.id) ?? model.id}
      meta={[
        t("settings.localModels.installedSize", { size: (model.sizeBytes / GIB).toFixed(1) }),
        ...(quant ? [quant] : []),
        <RepoLink key="repo" repoId={model.id} />,
      ]}
      action={<RemoveButton onConfirm={() => onRemove(model.id)} />}
    />
  );
}
