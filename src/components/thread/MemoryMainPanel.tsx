import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pin,
  RefreshCw,
  Search,
  Archive,
  AlertCircle,
  Lightbulb,
  Scale,
  StickyNote,
  FolderOpen,
  MessageSquareText,
  Pencil,
  RotateCcw,
  CheckCircle2,
  Star,
  ShieldCheck,
  ShieldAlert,
  Eraser,
  Share2,
} from "lucide-react";
import { ShareToTeamDialog } from "../teams/ShareToTeamDialog";
import { useProjectStore } from "../../stores/projectStore";
import {
  handoffList,
  memoryArchiveDetailed,
  memoryRestoreDetailed,
  memoryResolveDetailed,
  memoryReopenDetailed,
  memoryUpdateDetailed,
  memorySnapshot,
  memoryHealth,
  memorySupersedeDetailed,
  memoryRevokeBinding,
  memoryClean,
  type MemoryHealth,
  type MemoryMutationResult,
  type SessionHandoff,
  type SessionMemoryEntry,
} from "../../lib/commands";
import type { Project } from "../../lib/types";
import { sortMemoryEntries } from "./memoryPanelData";
import { EmptyState } from "../ui/panel";
import { localeTag, useT } from "../../i18n";

type KindFilter =
  | "all"
  | "session"
  | "important"
  | "binding"
  | "pin"
  | "decision"
  | "fact"
  | "issue"
  | "note";

const KIND_ORDER: Array<Exclude<KindFilter, "all" | "session">> = [
  "binding",
  "important",
  "pin",
  "decision",
  "fact",
  "issue",
  "note",
];

const KIND_META: Record<
  Exclude<KindFilter, "all" | "session" | "important" | "binding">,
  { labelKey: string; icon: typeof Pin; className: string }
> = {
  pin: {
    labelKey: "chat.memory.kind.pin",
    icon: Pin,
    className: "mem-kind mem-kind-pin",
  },
  decision: {
    labelKey: "chat.memory.kind.decision",
    icon: Scale,
    className: "mem-kind mem-kind-decision",
  },
  fact: {
    labelKey: "chat.memory.kind.fact",
    icon: Lightbulb,
    className: "mem-kind mem-kind-fact",
  },
  issue: {
    labelKey: "chat.memory.kind.issue",
    icon: AlertCircle,
    className: "mem-kind mem-kind-issue",
  },
  note: {
    labelKey: "chat.memory.kind.note",
    icon: StickyNote,
    className: "mem-kind mem-kind-note",
  },
};

interface ProjectMemoryBucket {
  project: Project;
  entries: SessionMemoryEntry[];
  sessions: SessionHandoff[];
  revision: number;
  health: MemoryHealth | null;
  memoryError: string | null;
  healthError: string | null;
  sessionError: string | null;
}

type MemoryView = "durable" | "sessions" | "archived";

function formatRelative(iso: string | null | undefined, t: ReturnType<typeof useT>): string {
  if (!iso) return "—";
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "—";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return t("chat.memory.relative.justNow");
  if (diff < 3_600_000) return t("chat.memory.relative.minute", { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t("chat.memory.relative.hour", { count: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t("chat.memory.relative.day", { count: Math.floor(diff / 86_400_000) });
  return new Date(timestamp).toLocaleDateString(localeTag(), {
    month: "short",
    day: "numeric",
  });
}

function normalizeKind(
  kind: string | undefined,
): Exclude<KindFilter, "all" | "session" | "important" | "binding"> {
  const k = (kind || "note").toLowerCase();
  if (k === "pin" || k === "decision" || k === "fact" || k === "issue" || k === "note") {
    return k;
  }
  return "note";
}

function memoryStatusLabel(status: string, t: ReturnType<typeof useT>): string {
  if (status === "resolved") return t("chat.memory.status.resolved");
  if (status === "superseded") return t("chat.memory.status.superseded");
  return status;
}

function entryMatchesQuery(entry: SessionMemoryEntry, q: string): boolean {
  if (!q) return true;
  const hay = `${entry.title}\n${entry.content}\n${entry.kind}`.toLowerCase();
  return hay.includes(q);
}

function sessionMatchesQuery(s: SessionHandoff, q: string): boolean {
  if (!q) return true;
  const hay = `${s.title}\n${s.summary}\n${s.provider}\n${s.status}`.toLowerCase();
  return hay.includes(q);
}

/** Ordering lives in `memoryPanelData` so it can be tested without React. */
const sortEntries = sortMemoryEntries;

function sortSessions(sessions: SessionHandoff[]): SessionHandoff[] {
  return sessions.slice().sort((a, b) =>
    String(b.updatedAt || b.createdAt || "").localeCompare(
      String(a.updatedAt || a.createdAt || ""),
    ),
  );
}

function bucketTotal(b: { entries: unknown[]; sessions: unknown[] }): number {
  return b.entries.length + b.sessions.length;
}

function mergeProjectionWarnings(...warnings: Array<string | null | undefined>): string | null {
  const unique = [...new Set(warnings.filter((warning): warning is string => Boolean(warning)))];
  return unique.length > 0 ? unique.join(" · ") : null;
}

function isStaleRevisionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /stale[^\n]*revision|revision[^\n]*stale/i.test(message);
}

const FINDING_LABELS: Record<string, string> = {
  duplicate_active_title: "chat.memory.finding.duplicateActiveTitle",
  supersession_cycle: "chat.memory.finding.supersessionCycle",
  status_lineage_inconsistency: "chat.memory.finding.statusLineageInconsistency",
  secret_candidate: "chat.memory.finding.secretCandidate",
  projection_omitted: "chat.memory.finding.projectionOmitted",
  important_over_soft_cap: "chat.memory.finding.importantOverSoftCap",
  binding_over_soft_cap: "chat.memory.finding.bindingOverSoftCap",
  cleanable_lifecycle: "chat.memory.finding.cleanableLifecycle",
};

/** Soft caps shown when health payload omits them (older builds). */
const DEFAULT_IMPORTANT_SOFT_CAP = 12;
const DEFAULT_BINDING_SOFT_CAP = 8;

export function MemoryMainPanel() {
  const t = useT();
  const projects = useProjectStore((s) => s.projects);
  const fetchProjects = useProjectStore((s) => s.fetchProjects);

  const [buckets, setBuckets] = useState<ProjectMemoryBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [view, setView] = useState<MemoryView>("durable");
  /** Collapsed by default — only keys set to `false` are expanded. */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** When editing, ids of other current entries this one should supersede. */
  const [supersedeTargets, setSupersedeTargets] = useState<string[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshFailedProjectId, setRefreshFailedProjectId] = useState<string | null>(null);
  const [projectionWarning, setProjectionWarning] = useState<string | null>(null);
  const [cleanConfirmOpen, setCleanConfirmOpen] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastArchived, setLastArchived] = useState<{
    projectId: string;
    entry: SessionMemoryEntry;
  } | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    projectId: string;
    mode: "promote" | "digest";
    title: string;
    content: string;
    kind?: string;
  } | null>(null);

  const loadAll = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      else setRefreshing(true);
      try {
        if (projects.length === 0) {
          await fetchProjects().catch(() => {});
        }
        const list = useProjectStore.getState().projects;
        if (list.length === 0) {
          setBuckets([]);
          return;
        }
        const results = await Promise.all(
          list.map(async (project): Promise<ProjectMemoryBucket> => {
            const [memoryResult, healthResult, sessionResult] = await Promise.allSettled([
              memorySnapshot({
                projectId: project.id,
                includeArchived: true,
                includeInactive: true,
              }),
              memoryHealth({ projectId: project.id }),
              handoffList({ projectId: project.id }),
            ]);
            return {
              project,
              entries:
                memoryResult.status === "fulfilled"
                  ? sortEntries(memoryResult.value.entries)
                  : [],
              sessions:
                sessionResult.status === "fulfilled" ? sortSessions(sessionResult.value) : [],
              revision: memoryResult.status === "fulfilled" ? memoryResult.value.revision : 0,
              health: healthResult.status === "fulfilled" ? healthResult.value : null,
              memoryError:
                memoryResult.status === "rejected"
                  ? memoryResult.reason instanceof Error
                    ? memoryResult.reason.message
                    : String(memoryResult.reason)
                  : null,
              healthError:
                healthResult.status === "rejected"
                  ? healthResult.reason instanceof Error
                    ? healthResult.reason.message
                    : String(healthResult.reason)
                  : null,
              sessionError:
                sessionResult.status === "rejected"
                  ? sessionResult.reason instanceof Error
                    ? sessionResult.reason.message
                    : String(sessionResult.reason)
                  : null,
            };
          }),
        );
        results.sort((a, b) => {
          const ae = bucketTotal(a) > 0 ? 0 : 1;
          const be = bucketTotal(b) > 0 ? 0 : 1;
          if (ae !== be) return ae - be;
          return a.project.name.localeCompare(b.project.name);
        });
        setBuckets(results);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchProjects, projects.length],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return buckets
      .map((bucket) => {
        const showSessions = view === "sessions";
        const showMemory = view !== "sessions";
        const entries = showMemory
          ? bucket.entries.filter((e) => {
              const inactive = Boolean(e.archived || (e.status && e.status !== "current"));
              if (view === "archived" ? !inactive : inactive) return false;
              if (view === "durable" && e.status && e.status !== "current") return false;
              if (kindFilter === "important") {
                if (!e.important) return false;
              } else if (kindFilter === "binding") {
                if (!e.binding) return false;
              } else if (kindFilter !== "all" && normalizeKind(e.kind) !== kindFilter) {
                return false;
              }
              return entryMatchesQuery(e, q);
            })
          : [];
        const sessions = showSessions
          ? bucket.sessions.filter((s) => sessionMatchesQuery(s, q))
          : [];
        return { ...bucket, entries, sessions };
      })
      .filter((b) => {
        if (q || kindFilter !== "all") return bucketTotal(b) > 0;
        return true;
      });
  }, [buckets, kindFilter, q, view]);

  const totals = useMemo(() => {
    let entries = 0;
    let sessions = 0;
    let withContent = 0;
    for (const b of buckets) {
      entries += b.entries.length;
      sessions += b.sessions.length;
      if (bucketTotal(b) > 0) withContent++;
    }
    return { entries, sessions, withContent, projects: buckets.length };
  }, [buckets]);

  const healthTotals = useMemo(() => {
    let active = 0;
    let binding = 0;
    let review = 0;
    const findings = new Map<string, number>();
    for (const bucket of buckets) {
      if (!bucket.health) continue;
      active += bucket.health.activeEntries;
      binding += bucket.health.bindingCount;
      review += bucket.health.needsReviewCount;
      for (const finding of bucket.health.findings) {
        findings.set(finding.code, (findings.get(finding.code) ?? 0) + finding.count);
      }
    }
    return { active, binding, review, findings };
  }, [buckets]);

  const toggleProject = (id: string) => {
    // Default is collapsed (true). Toggle flips known state or expands when unset.
    setCollapsed((c) => {
      const currentlyCollapsed = c[id] ?? true;
      return { ...c, [id]: !currentlyCollapsed };
    });
  };

  const toggleEntry = (id: string) => {
    setExpandedIds((e) => ({ ...e, [id]: !e[id] }));
  };

  const projectRevision = (projectId: string): number =>
    buckets.find((bucket) => bucket.project.id === projectId)?.revision ?? 0;

  const refreshProjectMemory = async (projectId: string) => {
    const [memoryResult, healthResult] = await Promise.allSettled([
      memorySnapshot({
        projectId,
        includeArchived: true,
        includeInactive: true,
      }),
      memoryHealth({ projectId }),
    ]);
    setBuckets((current) =>
      current.map((bucket) =>
        bucket.project.id === projectId
          ? {
              ...bucket,
              entries:
                memoryResult.status === "fulfilled"
                  ? sortEntries(memoryResult.value.entries)
                  : bucket.entries,
              revision:
                memoryResult.status === "fulfilled"
                  ? memoryResult.value.revision
                  : bucket.revision,
              health: healthResult.status === "fulfilled" ? healthResult.value : null,
              memoryError:
                memoryResult.status === "rejected"
                  ? memoryResult.reason instanceof Error
                    ? memoryResult.reason.message
                    : String(memoryResult.reason)
                  : null,
              healthError:
                healthResult.status === "rejected"
                  ? healthResult.reason instanceof Error
                    ? healthResult.reason.message
                    : String(healthResult.reason)
                  : null,
            }
          : bucket,
      ),
    );
    if (memoryResult.status === "rejected") throw memoryResult.reason;
  };

  const applyCommittedResult = (
    projectId: string,
    result: MemoryMutationResult,
    supersededIds: readonly string[] = [],
  ) => {
    const superseded = new Set(supersededIds);
    setBuckets((current) =>
      current.map((bucket) =>
        bucket.project.id === projectId
          ? {
              ...bucket,
              entries: sortEntries(
                bucket.entries.map((entry) =>
                  entry.id === result.entry.id
                    ? result.entry
                    : superseded.has(entry.id)
                      ? { ...entry, status: "superseded" as const }
                      : entry,
                ),
              ),
              revision: result.revision,
              health: null,
              memoryError: null,
              healthError: "Refresh required",
            }
          : bucket,
      ),
    );
  };

  const finishMutation = async (
    projectId: string,
    result: MemoryMutationResult,
    warnings: Array<string | null | undefined>,
    supersededIds: readonly string[] = [],
  ) => {
    setProjectionWarning(mergeProjectionWarnings(...warnings));
    try {
      await refreshProjectMemory(projectId);
      setRefreshFailedProjectId(null);
    } catch (error) {
      applyCommittedResult(projectId, result, supersededIds);
      setRefreshFailedProjectId(projectId);
      const message = error instanceof Error ? error.message : String(error);
      setActionError(t("chat.memory.savedRefreshFailed", { message }));
    }
  };

  const retryFailedRefresh = async () => {
    if (!refreshFailedProjectId) return;
    setRefreshing(true);
    try {
      await refreshProjectMemory(refreshFailedProjectId);
      setRefreshFailedProjectId(null);
      setActionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setActionError(t("chat.memory.savedRefreshFailed", { message }));
    } finally {
      setRefreshing(false);
    }
  };

  const handleMutationError = async (
    error: unknown,
    authoritativeStateLoaded = false,
  ) => {
    if (isStaleRevisionError(error)) {
      if (!authoritativeStateLoaded) await loadAll({ quiet: true });
      setActionError(`${t("chat.memory.staleReloaded")} ${t("chat.memory.staleReloadedReview")}`);
      return;
    }
    setActionError(error instanceof Error ? error.message : String(error));
  };

  const cleanPreview = useMemo(() => {
    let important = 0;
    let superseded = 0;
    let resolved = 0;
    let total = 0;
    for (const bucket of buckets) {
      for (const entry of bucket.entries) {
        if (entry.archived) continue;
        const isImportant = Boolean(entry.important);
        const isSuperseded = entry.status === "superseded";
        const isResolvedIssue = entry.kind === "issue" && entry.status === "resolved";
        if (isImportant) important += 1;
        if (isSuperseded) superseded += 1;
        else if (isResolvedIssue) resolved += 1;
        if (isImportant || isSuperseded || isResolvedIssue) total += 1;
      }
    }
    return { important, superseded, resolved, total };
  }, [buckets]);

  const softCapWarnings = useMemo(() => {
    const importantCap =
      buckets.find((b) => b.health?.importantSoftCap != null)?.health?.importantSoftCap ??
      DEFAULT_IMPORTANT_SOFT_CAP;
    const bindingCap =
      buckets.find((b) => b.health?.bindingSoftCap != null)?.health?.bindingSoftCap ??
      DEFAULT_BINDING_SOFT_CAP;
    const important = buckets.reduce(
      (sum, b) => sum + b.entries.filter((e) => !e.archived && e.important).length,
      0,
    );
    return {
      importantCap,
      bindingCap,
      importantOver: important > importantCap,
      bindingOver: healthTotals.binding > bindingCap,
      important,
    };
  }, [buckets, healthTotals.binding]);

  const runCleanMemories = async () => {
    setCleaning(true);
    setActionError(null);
    setCleanConfirmOpen(false);
    const warnings: Array<string | null | undefined> = [];
    let clearedTotal = 0;
    try {
      // Snapshot order so revision races still surface as stale errors.
      for (const bucket of buckets) {
        const hasWork = bucket.entries.some(
          (entry) =>
            !entry.archived &&
            (entry.important ||
              entry.status === "superseded" ||
              (entry.kind === "issue" && entry.status === "resolved")),
        );
        if (!hasWork || bucket.memoryError) continue;
        const result = await memoryClean({
          projectId: bucket.project.id,
          expectedRevision: bucket.revision,
        });
        clearedTotal += result.cleared;
        warnings.push(result.projectionWarning);
      }
      setProjectionWarning(mergeProjectionWarnings(...warnings));
      await loadAll({ quiet: true });
      if (clearedTotal === 0) {
        setActionError(null);
      }
    } catch (error) {
      await handleMutationError(error);
    } finally {
      setCleaning(false);
    }
  };

  const handleArchive = async (projectId: string, entryId: string) => {
    setArchivingId(entryId);
    setActionError(null);
    try {
      const result = await memoryArchiveDetailed({
        projectId,
        id: entryId,
        expectedRevision: projectRevision(projectId),
      });
      await finishMutation(projectId, result, [result.projectionWarning]);
      setLastArchived({ projectId, entry: result.entry });
    } catch (e) {
      await handleMutationError(e);
    } finally {
      setArchivingId(null);
    }
  };

  const undoArchive = async () => {
    if (!lastArchived) return;
    setActionError(null);
    try {
      const result = await memoryRestoreDetailed({
        projectId: lastArchived.projectId,
        id: lastArchived.entry.id,
        expectedRevision: projectRevision(lastArchived.projectId),
      });
      await finishMutation(lastArchived.projectId, result, [result.projectionWarning]);
      setLastArchived(null);
    } catch (error) {
      await handleMutationError(error);
    }
  };

  const saveEdit = async (projectId: string, id: string) => {
    setActionError(null);
    let updateWarning: string | null = null;
    try {
      const updateResult = await memoryUpdateDetailed({
        projectId,
        id,
        title: editTitle,
        content: editContent,
        expectedRevision: projectRevision(projectId),
      });
      updateWarning = updateResult.projectionWarning;
      let finalResult = updateResult;
      let supersedeWarning: string | null = null;
      if (supersedeTargets.length > 0) {
        try {
          const supersedeResult = await memorySupersedeDetailed({
            projectId,
            id,
            targetIds: supersedeTargets,
            expectedRevision: updateResult.revision,
          });
          supersedeWarning = supersedeResult.projectionWarning;
          finalResult = supersedeResult;
        } catch (error) {
          setProjectionWarning(mergeProjectionWarnings(updateWarning));
          let reloaded = false;
          let refreshError: unknown = null;
          try {
            await refreshProjectMemory(projectId);
            reloaded = true;
            setRefreshFailedProjectId(null);
          } catch (reloadError) {
            refreshError = reloadError;
            applyCommittedResult(projectId, updateResult);
            setRefreshFailedProjectId(projectId);
          }
          setEditingId(null);
          setSupersedeTargets([]);
          if (refreshError) {
            const supersedeMessage = error instanceof Error ? error.message : String(error);
            const refreshMessage =
              refreshError instanceof Error ? refreshError.message : String(refreshError);
            const prefix = isStaleRevisionError(error)
              ? t("chat.memory.staleEditSaved")
              : t("chat.memory.editSupersedeFailed", { message: supersedeMessage });
            setActionError(t("chat.memory.refreshAfterEditFailed", { prefix, message: refreshMessage }));
            return;
          }
          await handleMutationError(error, reloaded);
          return;
        }
      }
      await finishMutation(
        projectId,
        finalResult,
        [updateWarning, supersedeWarning],
        supersedeTargets,
      );
      setEditingId(null);
      setSupersedeTargets([]);
    } catch (error) {
      if (isStaleRevisionError(error)) {
        setEditingId(null);
        setSupersedeTargets([]);
      }
      await handleMutationError(error);
    }
  };

  const sourceLabel = (entry: SessionMemoryEntry) => {
    if (entry.source === "user") return t("chat.speaker.you");
    if (entry.source === "system") return "agmux";
    if (entry.source.startsWith("agent:")) return entry.source.slice(6) || t("chat.memory.source.agentLower");
    if (entry.source === "agent") return t("chat.memory.source.agent");
    return entry.source || t("chat.memory.source.agent");
  };

  const updateLifecycle = async (
    projectId: string,
    entry: SessionMemoryEntry,
    action: "restore" | "resolve" | "reopen",
  ) => {
    setActionError(null);
    try {
      const result = await (action === "restore"
        ? memoryRestoreDetailed({
            projectId,
            id: entry.id,
            expectedRevision: projectRevision(projectId),
          })
        : action === "resolve"
          ? memoryResolveDetailed({
              projectId,
              id: entry.id,
              expectedRevision: projectRevision(projectId),
            })
          : memoryReopenDetailed({
              projectId,
              id: entry.id,
              expectedRevision: projectRevision(projectId),
            }));
      await finishMutation(projectId, result, [result.projectionWarning]);
    } catch (error) {
      await handleMutationError(error);
    }
  };

  const updateBinding = async (projectId: string, entry: SessionMemoryEntry) => {
    setActionError(null);
    try {
      const result = await memoryRevokeBinding({
        projectId,
        id: entry.id,
        expectedRevision: projectRevision(projectId),
      });
      await finishMutation(projectId, result, [result.projectionWarning]);
    } catch (error) {
      await handleMutationError(error);
    }
  };

  const statusLine =
    totals.projects === 0
      ? t("chat.memory.noProjects")
      : [
          totals.entries > 0
            ? t("chat.memory.status.memories", { count: totals.entries })
            : null,
          totals.sessions > 0
            ? t("chat.memory.status.sessions", { count: totals.sessions })
            : null,
          totals.entries === 0 && totals.sessions === 0 ? t("chat.memory.status.zeroEntries", { count: 0 }) : null,
          t("chat.memory.status.projectCount", { withContent: totals.withContent, count: totals.projects }),
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="mem-root relative flex h-full min-h-0 flex-col overflow-hidden" data-testid="memory-main-panel">
      <div className="codex-wall" aria-hidden />

      <div className="codex-glass relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="orch-header shrink-0" data-tauri-drag-region>
          <div className="flex min-w-0 items-center gap-3">
            <div className="mem-mark">
              <Brain size={15} strokeWidth={1.7} />
            </div>
            <div className="min-w-0">
              <h1
                className="ui-title-xl truncate font-semibold tracking-tight text-[var(--text-primary)]"
                style={{ fontSize: "var(--text-ui)", lineHeight: 1.2 }}
              >
                {t("chat.memory.title")}
              </h1>
              <p
                className="mt-0.5 text-[12px] text-[var(--text-muted)] fx-graphite"
              >
                {statusLine}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCleanConfirmOpen(true)}
              disabled={loading || refreshing || cleaning || cleanPreview.total === 0}
              className="mem-refresh"
              title={
                cleanPreview.total === 0
                  ? t("chat.memory.nothingToClean")
                  : t("chat.memory.cleanPreviewTitle", { count: cleanPreview.total })
              }
              aria-label={t("chat.memory.cleanMemories")}
            >
              {cleaning ? <Loader2 size={13} className="animate-spin" /> : <Eraser size={13} />}
            </button>
            <button
              type="button"
              onClick={() => void loadAll({ quiet: true })}
              disabled={loading || refreshing || cleaning}
              className="mem-refresh"
              title={t("chat.memory.refresh")}
              aria-label={t("chat.memory.refreshMemory")}
            >
              <RefreshCw size={13} className={refreshing || loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {!loading && buckets.length > 0 && (
          <section className="mem-health" aria-label={t("chat.memory.healthLabel")}>
            <div className="mem-health-counts">
              <span><strong>{healthTotals.active}</strong> {t("chat.memory.active")}</span>
              <span data-warning={softCapWarnings.bindingOver ? "true" : "false"}>
                <strong>{healthTotals.binding}</strong> {t("chat.memory.binding")}
                {softCapWarnings.bindingOver ? t("chat.memory.cap", { count: softCapWarnings.bindingCap }) : ""}
              </span>
              <span data-warning={softCapWarnings.importantOver ? "true" : "false"}>
                <strong>{healthTotals.review}</strong> {t("chat.memory.importantNonBinding")}
                {softCapWarnings.importantOver ? t("chat.memory.cap", { count: softCapWarnings.importantCap }) : ""}
              </span>
            </div>
            {[...healthTotals.findings.entries()].map(([code, count]) => (
              <span key={code} className="mem-health-finding">
                <ShieldAlert size={11} /> {FINDING_LABELS[code] ? t(FINDING_LABELS[code], { count }) : `${count} ${code.replace(/_/g, " ")}`}
              </span>
            ))}
            {(softCapWarnings.importantOver || softCapWarnings.bindingOver) && (
              <span className="mem-health-finding">
                <ShieldAlert size={11} /> {t("chat.memory.keepBindingImportantSparse")}
                {softCapWarnings.importantOver
                  ? t("chat.memory.importantCapCount", { count: softCapWarnings.important, cap: softCapWarnings.importantCap })
                  : ""}
                {softCapWarnings.bindingOver
                  ? t("chat.memory.bindingCapCount", { count: healthTotals.binding, cap: softCapWarnings.bindingCap })
                  : ""}
              </span>
            )}
            {buckets.some((bucket) => bucket.healthError) && (
              <span className="mem-health-finding"><ShieldAlert size={11} /> {t("chat.memory.healthUnavailable")}</span>
            )}
            {cleanPreview.total > 0 && (
              <button
                type="button"
                className="mem-more"
                disabled={cleaning}
                onClick={() => setCleanConfirmOpen(true)}
              >
                {t("chat.memory.cleanMemories")}
              </button>
            )}
          </section>
        )}

        {cleanConfirmOpen && (
          <div
            className="mem-binding-confirm mx-3 mt-2"
            role="alertdialog"
            aria-label={t("chat.memory.confirmCleanMemories")}
          >
            <p>
              {t("chat.memory.cleanItem", { count: cleanPreview.total })}:
              {cleanPreview.important > 0
                ? t("chat.memory.clearImportantFlag", { count: cleanPreview.important })
                : ""}
              {cleanPreview.superseded > 0
                ? t("chat.memory.archiveSuperseded", { separator: cleanPreview.important > 0 ? ";" : "", count: cleanPreview.superseded })
                : ""}
              {cleanPreview.resolved > 0
                ? t("chat.memory.archiveResolvedIssue", { separator: cleanPreview.important + cleanPreview.superseded > 0 ? ";" : "", count: cleanPreview.resolved })
                : ""}
              . {t("chat.memory.bindingConstraintsStay")} {t("chat.memory.nothingPermanentlyDeleted")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="mem-more"
                disabled={cleaning}
                onClick={() => void runCleanMemories()}
              >
                {cleaning ? t("chat.memory.cleaning") : t("chat.memory.cleanMemories")}
              </button>
              <button
                type="button"
                className="mem-more"
                disabled={cleaning}
                onClick={() => setCleanConfirmOpen(false)}
              >
                {t("chat.journal.cancel")}
              </button>
            </div>
          </div>
        )}

        <div className="mem-toolbar shrink-0">
          <div className="mem-filters" aria-label={t("chat.memory.viewLabel")}>
            {(["durable", "sessions", "archived"] as const).map((item) => (
              <button
                key={item}
                type="button"
                data-active={view === item ? "true" : "false"}
                className="mem-filter"
                onClick={() => {
                  setView(item);
                  if (item === "sessions") setKindFilter("all");
                }}
              >
                {item === "durable" ? t("chat.memory.view.durable") : item === "sessions" ? t("chat.memory.view.sessions") : t("chat.memory.view.archived")}
              </button>
            ))}
          </div>
          <div className="relative min-w-0 flex-1">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                view === "durable"
                  ? t("chat.memory.searchDurable")
                  : view === "sessions"
                    ? t("chat.memory.searchSessions")
                    : t("chat.memory.searchArchived")
              }
              className="mem-search"
            />
          </div>
          <div className="mem-filters">
            <button
              type="button"
              data-active={kindFilter === "all" ? "true" : "false"}
              className="mem-filter"
              onClick={() => setKindFilter("all")}
            >
              {t("chat.memory.filter.all")}
            </button>
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                data-active={kindFilter === k ? "true" : "false"}
                className="mem-filter"
                onClick={() => setKindFilter(k)}
              >
                {k === "important"
                  ? t("chat.memory.filter.important")
                  : k === "binding"
                    ? t("chat.memory.filter.binding")
                    : t(KIND_META[k as Exclude<KindFilter, "all" | "session" | "important" | "binding">].labelKey)}
              </button>
            ))}
          </div>
        </div>

        {(actionError || projectionWarning || lastArchived) && (
          <div className="flex shrink-0 flex-wrap gap-x-4 border-b border-white/5 px-4 py-2 text-xs text-[var(--text-secondary)]">
            {actionError && <span className="text-amber-300/90">{actionError}</span>}
            {refreshFailedProjectId && (
              <button
                type="button"
                className="mem-more"
                disabled={refreshing}
                onClick={() => void retryFailedRefresh()}
              >
                {t("chat.memory.retryRefresh")}
              </button>
            )}
            {projectionWarning && (
              <span className="text-amber-300/90">
                {projectionWarning}{" "}
                <button className="mem-more" onClick={() => setProjectionWarning(null)}>{t("chat.memory.dismiss")}</button>
              </span>
            )}
            {lastArchived && (
              <span>
                {t("chat.memory.archivedEntry", { title: lastArchived.entry.title })}{" "}
                <button type="button" className="mem-more" onClick={() => void undoArchive()}>
                  {t("chat.memory.undo")}
                </button>
              </span>
            )}
          </div>
        )}

        <div className="mem-body min-h-0 flex-1 overflow-y-auto">
          {loading && buckets.length === 0 ? (
            <div className="orch-empty">
              <Loader2 size={22} className="mb-3 animate-spin text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">{t("chat.memory.loadingProjectMemory")}</p>
            </div>
          ) : filtered.length === 0 ||
            filtered.every(
              (bucket) =>
                bucketTotal(bucket) === 0 &&
                !(view === "sessions" ? bucket.sessionError : bucket.memoryError),
            ) ? (
            <EmptyState
              icon={Brain}
              headline={
                q || kindFilter !== "all"
                  ? view === "sessions" ? t("chat.memory.noMatchingSessions") : t("chat.memory.noMatchingMemory")
                  : projects.length === 0
                    ? t("chat.memory.noProjects")
                    : view === "durable"
                      ? t("chat.memory.noDurableMemory")
                      : view === "sessions"
                        ? t("chat.memory.noSessionHistory")
                        : t("chat.memory.noArchivedMemory")
              }
              body={
                q || kindFilter !== "all"
                  ? t("chat.memory.tryDifferentSearch")
                  : view === "durable"
                    ? t("chat.memory.durableEmptyHelp")
                    : view === "sessions"
                      ? t("chat.memory.sessionsEmptyHelp")
                      : t("chat.memory.archivedEmptyHelp")
              }
            />
          ) : (
            <div className="mem-project-list">
              {filtered.map((bucket) => {
                const isCollapsed = q ? false : (collapsed[bucket.project.id] ?? true);
                const count = bucket.entries.length + bucket.sessions.length;
                return (
                  <section
                    key={bucket.project.id}
                    className="mem-project"
                  >
                    <button
                      type="button"
                      className="mem-project-head"
                      onClick={() => toggleProject(bucket.project.id)}
                      aria-expanded={!isCollapsed}
                    >
                      <span className="mem-project-chevron">
                        {isCollapsed ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </span>
                      <FolderOpen size={14} className="shrink-0 text-[var(--text-muted)]" />
                      <span className="min-w-0 flex-1 truncate text-left">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                          {bucket.project.name}
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-[var(--text-muted)]">
                          {bucket.project.repo_path.split("/").slice(-2).join("/")}
                        </span>
                      </span>
                      <span className="mem-count">{count}</span>
                    </button>

                    {!isCollapsed && (
                      <div className="mem-entries">
                        {view !== "sessions" && bucket.memoryError && (
                          <p className="px-3 py-2 text-xs text-amber-300/90">
                            {t("chat.memory.loadDurableFailed", { message: bucket.memoryError })}{" "}
                            <button className="mem-more" onClick={() => void loadAll({ quiet: true })}>
                              {t("chat.memory.retry")}
                            </button>
                          </p>
                        )}
                        {view === "sessions" && bucket.sessionError && (
                          <p className="px-3 py-2 text-xs text-amber-300/90">
                            {t("chat.memory.loadSessionFailed", { message: bucket.sessionError })}{" "}
                            <button className="mem-more" onClick={() => void loadAll({ quiet: true })}>
                              {t("chat.memory.retry")}
                            </button>
                          </p>
                        )}
                        {!bucket.memoryError && !bucket.sessionError && count === 0 && (
                          <p className="px-3 py-3 text-xs text-[var(--text-muted)]">
                            {t("chat.memory.noProjectEntries")}
                          </p>
                        )}

                        {bucket.sessions.length > 0 && (
                          <>
                            <p className="mem-section-label">{t("chat.memory.section.sessions")}</p>
                            {bucket.sessions.map((session) => {
                              const open = expandedIds[`s:${session.id}`] ?? false;
                              const long = (session.summary || "").length > 160;
                              return (
                                <article
                                  key={`s:${session.id}`}
                                  className="mem-entry"
                                  data-kind="session"
                                  data-testid="mem-session-entry"
                                >
                                  <div className="mem-entry-top">
                                    <span className="mem-kind mem-kind-session">
                                      <MessageSquareText size={11} strokeWidth={2} />
                                      {t("chat.memory.session")}
                                    </span>
                                    {session.provider && (
                                      <span className="ui-meta text-[10px] text-[var(--text-muted)]">
                                        {session.provider}
                                      </span>
                                    )}
                                    {session.status && (
                                      <span className="ui-meta text-[10px] text-[var(--text-muted)]">
                                        {session.status}
                                      </span>
                                    )}
                                    {session.source && (
                                      <span className="ui-meta text-[10px] text-[var(--text-muted)]">
                                        {session.source === "agent"
                                          ? t("chat.memory.recordedByAgent")
                                          : session.source === "auto"
                                            ? t("chat.memory.autoSummarized")
                                            : t("chat.memory.extractedFromLogs")}
                                      </span>
                                    )}
                                    <span className="ml-auto ui-meta text-[10px] text-[var(--text-muted)]">
                                      {formatRelative(session.updatedAt || session.createdAt, t)}
                                    </span>
                                  </div>
                                  <h3 className="mem-entry-title">
                                    {session.title || t("chat.memory.untitledSession")}
                                  </h3>
                                  <p
                                    className={
                                      open || !long
                                        ? "mem-entry-body"
                                        : "mem-entry-body mem-entry-body-clamp"
                                    }
                                  >
                                    {session.summary || t("chat.memory.noSummaryYet")}
                                  </p>
                                  {long && (
                                    <button
                                      type="button"
                                      className="mem-more"
                                      onClick={() => toggleEntry(`s:${session.id}`)}
                                    >
                                      {open ? t("chat.memory.showLess") : t("chat.memory.showMore")}
                                    </button>
                                  )}
                                  {session.transcriptPath && (
                                    <button
                                      type="button"
                                      className="mem-more"
                                      title={session.transcriptPath}
                                      onClick={() => {
                                        void import("@tauri-apps/plugin-opener")
                                          .then(({ openPath }) => openPath(session.transcriptPath))
                                          .catch((error) =>
                                            setActionError(
                                              error instanceof Error ? error.message : String(error),
                                            ),
                                          );
                                      }}
                                    >
                                      {t("chat.memory.openTranscript")}
                                    </button>
                                  )}
                                  {(session.summary || session.title) && (
                                    <button
                                      type="button"
                                      className="mem-more"
                                      onClick={() => {
                                        setShareTarget({
                                          projectId: bucket.project.id,
                                          mode: "digest",
                                          title: session.title || t("chat.memory.sessionDigest"),
                                          content: session.summary || session.title || "",
                                        });
                                      }}
                                    >
                                      <Share2 size={11} className="mr-1 inline" />
                                      {t("chat.memory.shareToTeam")}
                                    </button>
                                  )}
                                </article>
                              );
                            })}
                          </>
                        )}

                        {bucket.entries.length > 0 && (
                          <>
                            {bucket.sessions.length > 0 && (
                              <p className="mem-section-label">{t("chat.memory.section.projectMemory")}</p>
                            )}
                            {bucket.entries.map((entry) => {
                              const kind = normalizeKind(entry.kind);
                              const meta = KIND_META[kind];
                              const Icon = meta.icon;
                              const open = expandedIds[entry.id] ?? false;
                              const long = (entry.content || "").length > 160;
                              return (
                                <article
                                  key={entry.id}
                                  className={
                                    entry.important ? "mem-entry mem-entry-important" : "mem-entry"
                                  }
                                  data-kind={kind}
                                  data-important={entry.important ? "true" : "false"}
                                >
                                  <div className="mem-entry-top">
                                    {entry.binding ? (
                                      <span
                                        className="mem-kind mem-kind-binding"
                                        title={
                                          entry.bindingConfirmedBy
                                            ? t("chat.memory.bindingSetBy", { name: entry.bindingConfirmedBy })
                                            : t("chat.memory.bindingConstraint")
                                        }
                                      >
                                        <ShieldCheck size={11} strokeWidth={2} /> {t("chat.memory.binding")}
                                      </span>
                                    ) : null}
                                    {entry.important && (
                                      <span
                                        className="mem-kind mem-kind-important"
                                        title={t("chat.memory.attentionOnly")}
                                      >
                                        <Star size={11} strokeWidth={2} />
                                        {t("chat.memory.important")}
                                      </span>
                                    )}
                                    <span className={meta.className}>
                                      <Icon size={11} strokeWidth={2} />
                                      {t(meta.labelKey)}
                                    </span>
                                    <span className="ui-meta text-[10px] text-[var(--text-muted)]">
                                      {formatRelative(entry.updatedAt || entry.createdAt, t)}
                                    </span>
                                    <span
                                      className="ui-meta text-[10px] text-[var(--text-muted)]"
                                      title={t("chat.memory.sourceCreatedUpdated", { source: entry.source || t("chat.memory.unknown"), created: entry.createdAt || "—", updated: entry.updatedAt || "—" })}
                                    >
                                      {sourceLabel(entry)}
                                      {entry.createdAt
                                        ? ` · ${formatRelative(entry.createdAt, t)}`
                                        : ""}
                                    </span>
                                    {entry.status && entry.status !== "current" && (
                                      <span className="ui-meta text-[10px] text-[var(--text-muted)]">
                                        {memoryStatusLabel(entry.status, t)}
                                      </span>
                                    )}
                                    {entry.supersedes && entry.supersedes.length > 0 && (
                                      <span
                                        className="ui-meta text-[10px] text-[var(--text-muted)]"
                                        title={entry.supersedes.join(", ")}
                                      >
                                        {t("chat.memory.replacesCount", { count: entry.supersedes.length })}
                                      </span>
                                    )}
                                    <div className="mem-entry-actions">
                                      <button
                                        type="button"
                                        className="mem-action"
                                        title={entry.important ? t("chat.memory.clearImportant") : t("chat.memory.markImportant")}
                                        aria-label={
                                          entry.important
                                            ? t("chat.memory.clearImportantOn", { title: entry.title })
                                            : t("chat.memory.markImportantTitle", { title: entry.title })
                                        }
                                        onClick={() => {
                                          setActionError(null);
                                          void memoryUpdateDetailed({
                                            projectId: bucket.project.id,
                                            id: entry.id,
                                            important: !entry.important,
                                            expectedRevision: bucket.revision,
                                          })
                                            .then((result) =>
                                              finishMutation(
                                                bucket.project.id,
                                                result,
                                                [result.projectionWarning],
                                              ),
                                            )
                                            .catch((error) => void handleMutationError(error));
                                        }}
                                      >
                                        <Star
                                          size={12}
                                          fill={entry.important ? "currentColor" : "none"}
                                        />
                                      </button>
                                      {entry.binding && (
                                        <button
                                          type="button"
                                          className="mem-action"
                                          title={t("chat.memory.revokeBinding")}
                                          aria-label={t("chat.memory.revokeBindingTitle", { title: entry.title })}
                                          onClick={() => {
                                            void updateBinding(bucket.project.id, entry);
                                          }}
                                        >
                                          <ShieldCheck size={12} />
                                        </button>
                                      )}
                                      {!entry.archived &&
                                        (kind === "decision" ||
                                          kind === "fact" ||
                                          kind === "issue") && (
                                          <button
                                            type="button"
                                            className="mem-action"
                                            title={t("chat.memory.shareToTeamKnowledge")}
                                            aria-label={t("chat.memory.shareTitleToTeam", { title: entry.title })}
                                            onClick={() => {
                                              setShareTarget({
                                                projectId: bucket.project.id,
                                                mode: "promote",
                                                title: entry.title,
                                                content: entry.content,
                                                kind,
                                              });
                                            }}
                                          >
                                            <Share2 size={12} />
                                          </button>
                                        )}
                                      <button
                                        type="button"
                                        className="mem-action"
                                        title={t("chat.journal.edit")}
                                        aria-label={t("chat.memory.editTitle", { title: entry.title })}
                                        onClick={() => {
                                          setEditingId(entry.id);
                                          setEditTitle(entry.title);
                                          setEditContent(entry.content);
                                          // Default supersede candidates: same-title current peers.
                                          const peers = bucket.entries
                                            .filter(
                                              (e) =>
                                                e.id !== entry.id &&
                                                !e.archived &&
                                                e.status === "current" &&
                                                e.title.trim().toLowerCase() ===
                                                  entry.title.trim().toLowerCase(),
                                            )
                                            .map((e) => e.id);
                                          setSupersedeTargets(peers);
                                        }}
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        className="mem-action mem-action-danger"
                                        title={entry.archived ? t("chat.memory.restore") : t("chat.memory.archive")}
                                        aria-label={t(entry.archived ? "chat.memory.restoreTitle" : "chat.memory.archiveTitle", { title: entry.title })}
                                        disabled={archivingId === entry.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (entry.archived) {
                                            void updateLifecycle(bucket.project.id, entry, "restore");
                                          } else {
                                            void handleArchive(bucket.project.id, entry.id);
                                          }
                                        }}
                                      >
                                        {entry.archived ? (
                                          <RotateCcw size={12} />
                                        ) : archivingId === entry.id ? (
                                          <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                          <Archive size={12} />
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                  {editingId === entry.id ? (
                                    <div className="mt-2 space-y-2">
                                      <input
                                        className="mem-search w-full"
                                        value={editTitle}
                                        onChange={(event) => setEditTitle(event.target.value)}
                                        aria-label={t("chat.memory.titleLabel")}
                                      />
                                      <textarea
                                        className="mem-search min-h-20 w-full resize-y py-2"
                                        value={editContent}
                                        onChange={(event) => setEditContent(event.target.value)}
                                        aria-label={t("chat.memory.contentLabel")}
                                      />
                                      {(() => {
                                        const candidates = bucket.entries.filter(
                                          (e) =>
                                            e.id !== entry.id &&
                                            !e.archived &&
                                            (e.status === "current" || !e.status),
                                        );
                                        if (candidates.length === 0) return null;
                                        return (
                                          <div className="rounded-md border border-[var(--border-subtle)] p-2 space-y-1">
                                            <p className="text-[11px] text-[var(--text-muted)]">
                                              {t("chat.memory.markOutdatedEntries")}
                                            </p>
                                            <div className="max-h-28 overflow-y-auto space-y-1">
                                              {candidates.map((c) => (
                                                <label
                                                  key={c.id}
                                                  className="flex items-start gap-2 text-[11px] cursor-pointer"
                                                >
                                                  <input
                                                    type="checkbox"
                                                    className="mt-0.5"
                                                    checked={supersedeTargets.includes(c.id)}
                                                    onChange={(ev) => {
                                                      setSupersedeTargets((prev) =>
                                                        ev.target.checked
                                                          ? [...prev, c.id]
                                                          : prev.filter((x) => x !== c.id),
                                                      );
                                                    }}
                                                  />
                                                  <span>
                                                    <span className="font-medium">{c.title}</span>
                                                    <span className="text-[var(--text-muted)]">
                                                      {" "}
                                                      · {sourceLabel(c)}
                                                    </span>
                                                  </span>
                                                </label>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          className="mem-more"
                                          onClick={() => void saveEdit(bucket.project.id, entry.id)}
                                        >
                                          {t("chat.journal.save")}
                                          {supersedeTargets.length > 0
                                            ? t("chat.memory.replaceCount", { count: supersedeTargets.length })
                                            : ""}
                                        </button>
                                        <button
                                          type="button"
                                          className="mem-more"
                                          onClick={() => {
                                            setEditingId(null);
                                            setSupersedeTargets([]);
                                          }}
                                        >
                                          {t("chat.journal.cancel")}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                  <h3 className="mem-entry-title">{entry.title}</h3>
                                  <p
                                    className={
                                      open || !long
                                        ? "mem-entry-body"
                                        : "mem-entry-body mem-entry-body-clamp"
                                    }
                                  >
                                    {entry.content}
                                  </p>
                                  {long && (
                                    <button
                                      type="button"
                                      className="mem-more"
                                      onClick={() => toggleEntry(entry.id)}
                                    >
                                      {open ? t("chat.memory.showLess") : t("chat.memory.showMore")}
                                    </button>
                                  )}
                                    </>
                                  )}
                                  {entry.kind === "issue" && !entry.archived && (
                                    <button
                                      type="button"
                                      className="mem-more"
                                      onClick={() =>
                                        void updateLifecycle(
                                          bucket.project.id,
                                          entry,
                                          entry.status === "resolved" ? "reopen" : "resolve",
                                        )
                                      }
                                    >
                                      <CheckCircle2 size={11} className="mr-1 inline" />
                                      {entry.status === "resolved" ? t("chat.memory.reopen") : t("chat.memory.resolve")}
                                    </button>
                                  )}
                                </article>
                              );
                            })}
                          </>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {shareTarget && (
        <ShareToTeamDialog
          open
          mode={shareTarget.mode}
          projectId={shareTarget.projectId}
          payload={{
            title: shareTarget.title,
            content: shareTarget.content,
            summary: shareTarget.content,
            kind: shareTarget.kind,
          }}
          onClose={() => setShareTarget(null)}
          onShared={({ teamName }) => {
            setActionError(null);
            setProjectionWarning(t("chat.memory.sharedToTeamKnowledge", { teamName }));
            setShareTarget(null);
          }}
        />
      )}
    </div>
  );
}
