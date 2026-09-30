import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useT } from "../../i18n";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_GROUPS,
  bindingFromEvent,
  effectiveBinding,
  findBindingConflict,
  formatBinding,
  isReservedBinding,
  setShortcutRecording,
  type ShortcutId,
} from "../../lib/shortcuts";
import { GlassButton } from "../ui/GlassButton";
import { PageHeader, SettingsCard, SettingsRow } from "./settingsLayout";

export function ShortcutsSection() {
  const t = useT();
  const keyboardShortcuts = useSettingsStore((s) => s.settings.keyboardShortcuts);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [recordingId, setRecordingId] = useState<ShortcutId | null>(null);
  const [error, setError] = useState<{ id: ShortcutId; message: string } | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    setShortcutRecording(true);
    const id = recordingId;
    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      const binding = bindingFromEvent(event);
      if (binding === null) return;
      const hasModifiers = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
      if (!hasModifiers && event.code === "Escape") {
        setError(null);
        setRecordingId(null);
        return;
      }
      if (!hasModifiers && (event.code === "Backspace" || event.code === "Delete")) {
        const action = SHORTCUT_ACTIONS.find((item) => item.id === id);
        const next = { ...keyboardShortcuts };
        if (action?.defaultBinding === null) delete next[id];
        else next[id] = null;
        updateSettings({ keyboardShortcuts: next });
        setError(null);
        setRecordingId(null);
        return;
      }
      if (!event.metaKey) {
        setError({ id, message: t("settings.shortcuts.error.needsCommand") });
        return;
      }
      if (isReservedBinding(binding)) {
        setError({ id, message: t("settings.shortcuts.error.reserved", { keys: formatBinding(binding) }) });
        return;
      }
      const conflict = findBindingConflict(binding, keyboardShortcuts, id);
      if (conflict) {
        setError({
          id,
          message: t("settings.shortcuts.error.inUse", {
            keys: formatBinding(binding),
            action: t(conflict.labelKey, conflict.labelParams),
          }),
        });
        return;
      }

      const next = { ...keyboardShortcuts };
      const action = SHORTCUT_ACTIONS.find((item) => item.id === id);
      if (binding === action?.defaultBinding) delete next[id];
      else next[id] = binding;
      updateSettings({ keyboardShortcuts: next });
      setError(null);
      setRecordingId(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      setShortcutRecording(false);
    };
  }, [keyboardShortcuts, recordingId, t, updateSettings]);

  const startRecording = (id: ShortcutId) => {
    setError(null);
    setRecordingId((current) => current === id ? null : id);
  };

  const resetShortcut = (id: ShortcutId) => {
    const action = SHORTCUT_ACTIONS.find((item) => item.id === id);
    if (!action) return;
    if (action.defaultBinding !== null) {
      const conflict = findBindingConflict(action.defaultBinding, keyboardShortcuts, id);
      if (conflict) {
        setError({
          id,
          message: t("settings.shortcuts.error.inUse", {
            keys: formatBinding(action.defaultBinding),
            action: t(conflict.labelKey, conflict.labelParams),
          }),
        });
        return;
      }
    }
    const next = { ...keyboardShortcuts };
    delete next[id];
    updateSettings({ keyboardShortcuts: next });
    if (error?.id === id) setError(null);
  };

  return (
    <div>
      <PageHeader title={t("settings.nav.shortcuts")} description={t("settings.shortcuts.description")} />
      {SHORTCUT_GROUPS.map((group) => (
        <SettingsCard key={group} eyebrow={t(`settings.shortcuts.group.${group}`)}>
          {SHORTCUT_ACTIONS.filter((action) => action.group === group).map((action) => {
            const actionLabel = t(action.labelKey, action.labelParams);
            const isRecording = recordingId === action.id;
            const binding = effectiveBinding(action.id, keyboardShortcuts);
            const hasOverride = Object.prototype.hasOwnProperty.call(keyboardShortcuts, action.id);
            const description = error?.id === action.id
              ? error.message
              : isRecording
                ? t("settings.shortcuts.recordingHint")
                : action.hintKey
                  ? t(action.hintKey)
                  : undefined;
            return (
              <SettingsRow key={action.id} label={actionLabel} description={description}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={t("settings.shortcuts.change", { action: actionLabel })}
                    onClick={() => startRecording(action.id)}
                    className={`inline-flex min-h-8 items-center rounded-md border px-2.5 text-xs transition-colors ${
                      isRecording
                        ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text-primary)]"
                        : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                    style={isRecording ? { borderColor: "var(--accent)" } : undefined}
                  >
                    {isRecording || binding === null ? (
                      <span>{t(isRecording ? "settings.shortcuts.recording" : "settings.shortcuts.none")}</span>
                    ) : (
                      <kbd className="ui-kbd font-mono">{formatBinding(binding)}</kbd>
                    )}
                  </button>
                  {hasOverride && (
                    <button
                      type="button"
                      aria-label={t("settings.shortcuts.reset", { action: actionLabel })}
                      onClick={() => resetShortcut(action.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </SettingsRow>
            );
          })}
        </SettingsCard>
      ))}
      <SettingsCard>
        <SettingsRow label={t("settings.shortcuts.resetAll")}>
          <GlassButton
            size="sm"
            disabled={Object.keys(keyboardShortcuts).length === 0}
            onClick={() => {
              updateSettings({ keyboardShortcuts: {} });
              setError(null);
            }}
          >
            {t("settings.shortcuts.resetAllButton")}
          </GlassButton>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
