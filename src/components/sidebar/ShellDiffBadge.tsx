import { selectShellDiffStats, useShellDiffStore, useShellDiffSubscription } from "../../stores/shellDiffStore";
import { useUiStore } from "../../stores/uiStore";
import { useDiffRecalculationStore } from "../../stores/diffRecalculationStore";
import { useT } from "../../i18n";

interface Props {
  id: string;
  sessionId?: string | null;
  linesAdded?: number;
  linesRemoved?: number;
  filesChanged?: number;
  additionClassName?: string;
}

export function ShellDiffBadge({ id, sessionId, linesAdded = 0, linesRemoved = 0, filesChanged, additionClassName = "text-[color:var(--status-green)]" }: Props) {
  const t = useT();
  useShellDiffSubscription();
  const rows = useShellDiffStore((state) => state.rows);
  const mappedIds = useUiStore((state) => state.claudeSessionMap);
  const notices = useDiffRecalculationStore((state) => state.notices);
  const ids = [id, ...(sessionId ? [sessionId] : []), ...(mappedIds?.[id] ?? [])];
  const missingCapture = ids.some((key) => notices[key] === "incomplete");
  const incomplete = missingCapture || ids.some((key) => notices[key] === "history-incomplete");
  const shell = selectShellDiffStats(rows, ids);
  const added = linesAdded + (shell?.linesAdded ?? 0);
  const removed = linesRemoved + (shell?.linesRemoved ?? 0);
  if (added === 0 && removed === 0 && !shell?.filesChanged && !filesChanged) {
    if (!incomplete && !ids.some((key) => notices[key] === "empty")) return null;
    return <span className="shrink-0 text-[10px] text-zinc-500" title={missingCapture
      ? t("sidebar.diff.originalVersionsMissing")
      : incomplete ? t("sidebar.diff.historyTotalsUnavailable")
      : t("sidebar.diff.recalculationFoundNoChanges")}>{incomplete ? t("sidebar.diff.unavailable") : t("sidebar.diff.noneRecorded")}</span>;
  }
  const includesShell = shell && (shell.linesAdded > 0 || shell.linesRemoved > 0 || shell.filesChanged > 0);
  const title = missingCapture ? t("sidebar.diff.partialOriginalVersionsMissing")
    : incomplete ? t("sidebar.diff.partialHistoryIncomplete")
    : includesShell
    ? t("sidebar.diff.includesVerifiedShellChanges")
    : filesChanged == null ? undefined : t("sidebar.diff.filesChanged", { count: filesChanged });
  return (
    <span className="ui-diff shrink-0 leading-none" title={title || undefined}>
      <span className={additionClassName}>+{added}</span>
      <span className="text-zinc-600"> </span>
      <span className="text-[color:var(--status-red)]">−{removed}</span>
      {incomplete && <span className="text-zinc-500">{t("sidebar.diff.partialSuffix")}</span>}
    </span>
  );
}
