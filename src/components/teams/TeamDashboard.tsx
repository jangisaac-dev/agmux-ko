/** Design screen 12 — desktop manager dashboard (parity with web team home). */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CircleSlash,
  Coins,
  ExternalLink,
  Layers,
  MessageSquare,
  Moon,
  Receipt,
  Timer,
  TrendingUp,
} from "lucide-react";
import {
  fmtMoney,
  fmtPct,
  fmtTokens,
  teamsOverview,
  TEAM_RANGES,
  type MemberRow,
  type ProjectRow,
  type TeamMembership,
  type TeamOverview,
  type TeamRange,
} from "../../lib/teams";
import { localeTag, useT, tx } from "../../i18n";
import { GlassButton } from "../ui/GlassButton";
import { DailyTrends, HourHeatmap, MixBars, PeakSessions, Sparkline } from "./charts";
import {
  Avatar,
  Banner,
  EmptyState,
  fmtTeamSessions,
  Panel,
  RangeSeg,
  RoleBadge,
  Skeleton,
  StatCard,
  SyncPill,
  teamAgoLabel,
  teamRangeLabel,
} from "./primitives";

export function TeamDashboard({
  team,
  onOpenMember,
  onOpenWeb,
}: {
  team: TeamMembership;
  onOpenMember?: (userId: string) => void;
  onOpenWeb?: () => void;
}) {
  const t = useT();
  const [range, setRange] = useState<TeamRange>("30d");
  const [data, setData] = useState<TeamOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await teamsOverview(team.slug, range));
    } catch (e) {
      setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [team.slug, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-[16px] font-semibold text-[var(--text-primary)]" style={{ letterSpacing: "-0.02em" }}>
            {team.name}
          </span>
          <RoleBadge role={team.role} />
        </div>
        <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">
          {data
            ? data.scope === "partial"
              ? t("teams.dashboard.partialMembers", {
                  count: data.memberCount,
                  countDisplay: data.memberCount,
                  total: data.teamMemberCount && data.teamMemberCount !== data.memberCount ? t("teams.dashboard.memberCountOf", { countDisplay: data.teamMemberCount }) : "",
                  scope: data.scopeLabel ? ` · ${data.scopeLabel}` : "",
                })
              : t("teams.dashboard.memberCount", { count: data.memberCount, countDisplay: data.memberCount })
            : "—"}
          {data?.lastUploadAt ? t("teams.dashboard.asOf", { time: String(teamAgoLabel(data.lastUploadAt, t)) }) : ""}
        </div>
      </div>
      <div className="flex-1" />
      <RangeSeg value={range} onChange={setRange} options={TEAM_RANGES} />
      {onOpenWeb ? (
        <GlassButton icon={ExternalLink} size="sm" variant="ghost" onClick={onOpenWeb}>
          {t("teams.dashboard.openOnWeb")}
        </GlassButton>
      ) : null}
    </div>
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-white/[0.06] bg-[var(--surface-code-panel)] p-2.5">
              <Skeleton width={54} height={8} />
              <Skeleton width={78} height={20} />
              <Skeleton height={20} />
            </div>
          ))}
        </div>
        <Panel title={t("teams.panels.dailyTrends")}>
          <Skeleton height={160} />
        </Panel>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Panel padded={false}>
          <EmptyState
            icon={AlertTriangle}
            title={t("teams.dashboard.loadErrorTitle")}
            body={error}
            actions={
              <GlassButton size="sm" onClick={() => void load()}>
                {t("teams.actions.tryAgain")}
              </GlassButton>
            }
          />
        </Panel>
      </div>
    );
  }

  if (!data) return null;

  // Employees never see team totals; the server scopes them and we route on it.
  if (data.scope === "self") {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Banner tone="plain" icon={Activity}>
          {t("teams.dashboard.selfScopeOnly")}
        </Banner>
      </div>
    );
  }

  const totals = data.totals;
  const neverSynced = data.members.filter((m) => m.neverSynced).length;
  const hasAnyData = totals.daysWithData > 0 || data.members.some((m) => !m.neverSynced);

  if (!hasAnyData) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Panel padded={false}>
          <EmptyState
            icon={Activity}
            title={t("teams.dashboard.waitingForFirstSyncTitle")}
            body={t("teams.dashboard.waitingForFirstSyncBody")}
          />
        </Panel>
      </div>
    );
  }

  const tokens = fmtTokens(totals.tokens);
  const cost = fmtMoney(totals.costUsd);
  const concurrency = data.daily.map((d) => d.peakConcurrent);

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      {neverSynced > 0 ? (
        <Banner tone="warn" icon={AlertTriangle}>
          <b className="font-medium">{t("teams.dashboard.neverSynced", { count: neverSynced, countDisplay: neverSynced })}</b>{" "}
          {t("teams.dashboard.totalsExcludeNeverSynced")}
        </Banner>
      ) : null}

      <div className="grid grid-cols-5 gap-2">
        <StatCard icon={Coins} label={t("teams.stats.reportedTokens")} help={t("teams.stats.reportedTokensHelp")} value={tokens.value} unit={tokens.unit} delta={data.deltas.tokens} />
        <StatCard icon={Receipt} label={totals.costIncomplete === false ? t("teams.stats.estimatedCost") : t("teams.stats.partialEstimatedCost")} help={t("teams.stats.costHelp")} value={cost.value} unit={cost.unit} delta={data.deltas.costUsd} />
        <StatCard
          icon={Timer}
          label={t("teams.stats.active")}
          value={totals.activeHours.toFixed(1)}
          unit="h"
          note={t("teams.stats.agentWorkingTime")}
        />
        <StatCard
          icon={MessageSquare}
          label={totals.sessionsStartedIncomplete ? t("teams.stats.partialSessions") : t("teams.stats.sessions")}
          help={totals.sessionsStartedIncomplete ? t("teams.stats.partialSessionsHelp") : t("teams.stats.sessionsHelp")}
          value={fmtTeamSessions(totals)}
          note={`${t("teams.stats.turnCount", { count: totals.turns, countDisplay: totals.turns.toLocaleString(localeTag()) })} · ${t("teams.stats.toolCallCount", { count: totals.toolCalls, countDisplay: totals.toolCalls.toLocaleString(localeTag()) })}`}
        />
        <StatCard
          icon={Layers}
          label={t("teams.stats.peakConcurrency")}
          value={String(totals.peakConcurrent)}
          note={t("teams.stats.highestSimultaneousSessions")}
        />
      </div>

      {/* Wide chart takes the full width. Pairing it with the taller mix list
          in a 2-column grid left a hole under the chart. */}
      <Panel
        title={t("teams.panels.dailyTrends")}
        sub={t("teams.panels.tokensAndActiveHours")}
        right={
          <div className="flex gap-3.5 text-[11px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <i className="block h-2 w-2 rounded-sm" style={{ background: "#60a5fa", opacity: 0.55 }} />
              {t("teams.charts.tokens")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="block h-2 w-2 rounded-sm" style={{ background: "#fbbf24" }} />
              {t("teams.stats.active")}
            </span>
          </div>
        }
      >
        <DailyTrends days={data.daily} />
      </Panel>

      {data.budget ? (
        <Panel title={t("teams.panels.monthlyBudget")} sub={t("teams.panels.calendarMonthAllProviders")}>
          <BudgetPanel budget={data.budget} />
        </Panel>
      ) : null}

      {/* Masonry, not a grid. A grid row is only as short as its TALLEST cell,
          so a short panel beside a tall one left a hole underneath it. These
          five are card-like and width-tolerant, so multi-column packs them by
          height with no fixed rows to leave dead space. The heatmap below needs
          its full width and stays in a real grid. */}
      <div className="columns-3 gap-2.5 [&>*]:mb-2.5 [&>*]:inline-block [&>*]:w-full [&>*]:break-inside-avoid">
        <Panel title={t("teams.panels.providerAndModelMix")} right={<span className="text-[11.5px] text-[var(--text-muted)]">{t("teams.panels.tokensAndTime")}</span>}>
          <div className="flex flex-col gap-2.5">
            <MixBars slices={data.providerMix} />
            {data.modelMix.length ? (
              <>
                <hr className="my-1 border-0 border-t border-white/[0.06]" />
                <div className="ui-eyebrow text-[var(--text-muted)]">{t("teams.panels.topModels")}</div>
                <MixBars slices={data.modelMix.slice(0, 6)} mono />
              </>
            ) : null}
          </div>
        </Panel>
        <Panel
          title={t("teams.panels.whatAgentsDid")}
          right={
            <span className="tabular-nums text-[11.5px] text-[var(--text-muted)]">
              {t("teams.stats.toolCallCount", { count: totals.toolCalls, countDisplay: totals.toolCalls.toLocaleString(localeTag()) })}
            </span>
          }
        >
          <ToolMix totals={totals} />
        </Panel>
        <Panel title={t("teams.panels.outputAndReliability")} sub={t("teams.panels.codeWrittenCallsFailed")}>
          <OutputPanel totals={totals} />
        </Panel>
        <Panel title={t("teams.panels.tokenComposition")} right={<span className="tabular-nums text-[11.5px] text-[var(--text-muted)]">{fmtTokens(totals.tokens).value}{fmtTokens(totals.tokens).unit} {t("teams.panels.total")}</span>}>
          <TokenBreakdown totals={totals} />
        </Panel>
        <Panel title={t("teams.panels.workRates")} sub={t("teams.panels.derivedFromThisRange")}>
          <EfficiencyGrid totals={totals} />
        </Panel>
        <Panel title={t("teams.panels.flags")} sub={teamRangeLabel(range, t)}>
          <Flags flags={data.flags} range={range} />
        </Panel>
        <Panel
          title={t("teams.panels.peakSimultaneousSessions")}
          right={<span className="tabular-nums text-[11.5px] text-[var(--text-muted)]">{t("teams.panels.maximum", { count: Math.max(0, ...concurrency) })}</span>}
        >
          <PeakSessions
            values={concurrency}
            labels={[t("teams.charts.daysAgo", { count: data.daily.length }), t("teams.charts.midpoint"), t("teams.charts.today")]}
            dayDates={data.daily.map((d) => d.date)}
          />
          <div className="mt-2">
            <Sparkline values={concurrency} color="#fbbf24" />
          </div>
        </Panel>
        <Panel title={t("teams.panels.projects")} sub={t("teams.panels.basenameOrHashOnly")} padded={false}>
          <ProjectsTable rows={data.projects ?? []} />
        </Panel>
      </div>

      <Panel title={t("teams.panels.members")} sub={t("teams.panels.tapRowForDetail")} padded={false}>
        <MemberTable members={data.members} onOpenMember={onOpenMember} />
      </Panel>

      {/* Full width: the heatmap has 24 columns and was previously squeezed
          into 2/3 while the taller projects list left a hole beside it. */}
      <Panel title={t("teams.panels.hourOfDay")} sub={t("teams.panels.teamActiveHoursLocalTime")}>
        <HourHeatmap matrix={data.heatmap} />
      </Panel>
    </div>
  );
}

function TokenBreakdown({ totals }: { totals: TeamOverview["totals"] }) {
  const t = useT();
  // Reasoning is a reported subset of output, so it is split out of Output
  // rather than added again — the bar must sum to the token total.
  const reasoning = Math.min(totals.tokensReasoning, totals.tokensOut);
  const parts = [
    { key: "Input", label: t("teams.tokens.input"), n: totals.tokensIn, color: "#60a5fa" },
    { key: "Output", label: t("teams.tokens.output"), n: totals.tokensOut - reasoning, color: "#f2a516" },
    { key: "Cache read", label: t("teams.tokens.cacheRead"), n: totals.tokensCacheRead, color: "#a78bfa" },
    { key: "Cache write", label: t("teams.tokens.cacheWrite"), n: totals.tokensCacheWrite, color: "#22d3ee" },
    { key: "Reasoning", label: t("teams.tokens.reasoning"), n: reasoning, color: "#fbbf24" },
  ].filter((p) => p.n > 0);
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) {
    return <p className="m-0 text-[11.5px] text-[var(--text-muted)]">{t("teams.tokens.noBreakdown")}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 overflow-hidden rounded-[5px] bg-white/[0.05]">
        {parts.map((p) => (
          <i
            key={p.key}
            className="block h-full min-w-[2px]"
            style={{ width: `${((p.n / total) * 100).toFixed(2)}%`, background: p.color }}
            title={t("teams.tokens.itemTitle", { label: p.label, value: `${fmtTokens(p.n).value}${fmtTokens(p.n).unit}` })}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {parts.map((p) => {
          const tok = fmtTokens(p.n);
          return (
            <div key={p.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 text-[12px]">
              <span className="flex items-center gap-2 text-[var(--text-tertiary)]">
                <i className="block h-2 w-2 rounded-sm" style={{ background: p.color }} />
                {p.label}
              </span>
              <span className="tabular-nums text-[11.5px] text-[var(--text-secondary)]">
                {tok.value}
                {tok.unit}
              </span>
              <span className="min-w-9 text-right text-[11.5px] text-[var(--text-muted)]">{fmtPct(p.n / total)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[12px] text-[var(--text-muted)]">
        <span>{t("teams.tokens.cacheHitRate")}</span>
        <b className="tabular-nums font-medium text-[var(--text-secondary)]">{fmtPct(totals.cacheHitRate)}</b>
      </div>
    </div>
  );
}

/** Foreground ink for the budget projection marker. */
const MARKER_INK = "var(--text-secondary)";

/** Fixed order and colour per tool kind, matching the server's `TOOL_KINDS`. */
const TOOL_KINDS = [
  { key: "bash", labelKey: "teams.toolKinds.terminal", color: "#fbbf24" },
  { key: "edit", labelKey: "teams.toolKinds.edits", color: "#f2a516" },
  { key: "read", labelKey: "teams.toolKinds.reads", color: "#60a5fa" },
  { key: "search", labelKey: "teams.toolKinds.search", color: "#a78bfa" },
  { key: "web", labelKey: "teams.toolKinds.web", color: "#22d3ee" },
  { key: "agent", labelKey: "teams.toolKinds.subagents", color: "#fb7185" },
  { key: "mcp", labelKey: "teams.toolKinds.mcp", color: "#2dd4bf" },
  { key: "other", labelKey: "teams.toolKinds.other", color: "#71717a" },
] as const;

/**
 * What the agents actually did. A single "tool calls" number can't tell
 * exploring a codebase apart from writing to it.
 */
/**
 * True when a range has tool calls but no breakdown — buckets uploaded before
 * the per-kind columns existed, which default to 0.
 *
 * Without this the panel claims "no tool activity" directly under a header
 * reading "3,307 tool calls". Genuinely read-only work still records
 * `tool_read`, so an all-zero mix beside a non-zero total only ever means the
 * data predates the breakdown.
 */
export function isPreBreakdown(t: TeamOverview["totals"]): boolean {
  if (!(t.toolCalls > 0)) return false;
  const mix = t.toolMix ?? {};
  return TOOL_KINDS.every((k) => !((mix[k.key] ?? 0) > 0));
}

export function ToolMix({ totals }: { totals: TeamOverview["totals"] }) {
  const t = useT();
  const mix = totals.toolMix ?? {};
  const parts = TOOL_KINDS.map((k) => ({ ...k, label: t(k.labelKey), n: mix[k.key] ?? 0 })).filter((p) => p.n > 0);
  const total = parts.reduce((a, p) => a + p.n, 0);
  if (!total) {
    return (
      <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        {isPreBreakdown(totals)
          ? t("teams.toolMix.preBreakdown", { count: totals.toolCalls, countDisplay: totals.toolCalls.toLocaleString(localeTag()) })
          : t("teams.toolMix.noActivity")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 overflow-hidden rounded-[5px] bg-white/[0.05]">
        {parts.map((p) => (
          <i
            key={p.key}
            className="block h-full min-w-[2px]"
            style={{ width: `${((p.n / total) * 100).toFixed(2)}%`, background: p.color }}
            title={t("teams.toolMix.itemTitle", { label: p.label, count: p.n.toLocaleString(localeTag()) })}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {parts.map((p) => (
          <div key={p.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 text-[12px]">
            <span className="flex items-center gap-2 text-[var(--text-tertiary)]">
              <i className="block h-2 w-2 rounded-sm" style={{ background: p.color }} />
              {p.label}
            </span>
            <span className="tabular-nums text-[11.5px] text-[var(--text-secondary)]">{p.n.toLocaleString(localeTag())}</span>
            <span className="min-w-9 text-right text-[11.5px] text-[var(--text-muted)]">{fmtPct(p.n / total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Output and reliability.
 *
 * The failure rate divides by *measured* calls. Codex reports no outcome for
 * most tool calls, so counting them as successes would invent a reassuring
 * number; when nothing was measurable this says so instead of showing 0%.
 */
export function OutputPanel({ totals }: { totals: TeamOverview["totals"] }) {
  const t = useT();
  const rate = totals.toolErrorRate;
  const measured = totals.toolsMeasured ?? 0;

  // A grid of zeros would assert "nothing was edited" when the truth is "this
  // data predates the counters" — the honest-state rule again.
  if (isPreBreakdown(totals)) {
    return (
      <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        {t("teams.output.notRecordedForRange")}
      </p>
    );
  }
  const rows = [
    { id: "filesChanged", label: t("teams.output.filesChanged"), v: (totals.filesChanged ?? 0).toLocaleString(localeTag()) },
    { id: "linesAdded", label: t("teams.output.linesAdded"), v: `+${(totals.linesAdded ?? 0).toLocaleString(localeTag())}` },
    { id: "linesRemoved", label: t("teams.output.linesRemoved"), v: `−${(totals.linesRemoved ?? 0).toLocaleString(localeTag())}` },
    { id: "netLines", label: t("teams.output.netLines"), v: ((totals.linesAdded ?? 0) - (totals.linesRemoved ?? 0)).toLocaleString(localeTag()) },
    { id: "failedToolCalls", label: t("teams.output.failedToolCalls"), v: (totals.toolErrors ?? 0).toLocaleString(localeTag()) },
    { id: "failureRate", label: t("teams.output.failureRate"), v: rate == null ? t("teams.output.notReported") : t("teams.output.failuresOutOfMeasuredCalls", { rate: fmtPct(rate), count: measured.toLocaleString(localeTag()) }) },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
            <div className="mb-1 text-[10.5px] leading-snug text-[var(--text-muted)]">{r.label}</div>
            <div className="tabular-nums text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{r.v}</div>
          </div>
        ))}
      </div>
      {rate == null ? (
        <p className="m-0 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {t("teams.output.outcomesByProviders")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Monthly spend against budget with a straight-line month-end projection.
 *
 * Renders nothing when no budget is set — a $0 budget would show every team as
 * instantly over.
 */
export function BudgetPanel({ budget }: { budget: NonNullable<TeamOverview["budget"]> }) {
  const t = useT();
  const pct = Math.min(100, Math.round(budget.usedShare * 100));
  const over = budget.usedShare >= 1;
  const partial = budget.costIncomplete !== false;
  const color = over ? "#f87171" : budget.onTrackToExceed || partial ? "#fbbf24" : "#f2a516";
  const projPct = Math.min(99, Math.round(budget.projectedShare * 100));
  const spend = fmtMoney(budget.spendUsd);
  const monthly = fmtMoney(budget.monthlyUsd);
  const projected = fmtMoney(budget.projectedUsd);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] text-[var(--text-muted)]">{partial ? t("teams.budget.partialEstimate") : t("teams.budget.estimatedCost")}</div>
          <div className="tabular-nums text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
            {spend.value}
            <span className="text-[14px] font-normal text-[var(--text-tertiary)]">{spend.unit}</span>
          </div>
          <div className="text-[11.5px] text-[var(--text-muted)]">
            {t("teams.budget.ofMonthlyAmount", { amount: `${monthly.value}${monthly.unit}` })}
          </div>
        </div>
        <div className="tabular-nums text-[18px] font-semibold" style={{ color }}>
          {pct}%
        </div>
      </div>
      <div className="relative h-2.5 rounded-[5px] bg-white/[0.05]">
        <i
          className="block h-full min-w-[2px] rounded-[5px]"
          style={{ width: `${pct}%`, background: color }}
        />
        {budget.projectedShare > budget.usedShare ? (
          <b
            className="absolute -top-[3px] h-4 w-[2px] rounded-[1px] opacity-75"
            style={{ left: `${projPct}%`, background: MARKER_INK }}
            title={t("teams.budget.projectedMonthEnd")}
          />
        ) : null}
      </div>
      <div className="flex justify-between gap-3 text-[11px] text-[var(--text-muted)]">
        <span>
          {t("teams.budget.dayProgress", { day: budget.daysElapsed, days: budget.daysInMonth })}
        </span>
        <span className="tabular-nums">
          {t("teams.budget.projectedAmount", { qualifier: partial ? `(${t("teams.budget.partialQualifier")}) ` : "", amount: `${projected.value}${projected.unit}` })}
        </span>
      </div>
      <div className="text-[11px] text-[var(--text-muted)]">{t("teams.budget.disclaimer")}</div>
      {budget.onTrackToExceed ? (
        <Banner tone="warn" icon={TrendingUp}>
          {tx("teams.budget.overBudgetMessage", {
            projected: (
              <b>
                {projected.value}
                {projected.unit}
              </b>
            ),
            amount: `${monthly.value}${monthly.unit}`,
          })}
        </Banner>
      ) : null}
    </div>
  );
}

function EfficiencyGrid({ totals }: { totals: TeamOverview["totals"] }) {
  const t = useT();
  if (!totals.sessions && !totals.turns) {
    return <p className="m-0 text-[11.5px] text-[var(--text-muted)]">{t("teams.efficiency.notEnoughActivity")}</p>;
  }
  const tokPerSession = totals.sessions > 0 ? fmtTokens(totals.tokens / totals.sessions) : null;
  const costPerHour = totals.activeHours > 0 ? fmtMoney(totals.costUsd / totals.activeHours) : null;
  const rows = [
    { k: "turnsPerSessionHour", label: t("teams.efficiency.turnsPerActiveSessionHour"), v: totals.sessions > 0 ? (totals.turns / totals.sessions).toFixed(1) : "—" },
    { k: "toolCallsPerTurn", label: t("teams.efficiency.toolCallsPerTurn"), v: totals.turns > 0 ? (totals.toolCalls / totals.turns).toFixed(1) : "—" },
    {
      k: "tokensPerSessionHour",
      label: t("teams.efficiency.tokensPerActiveSessionHour"),
      v: tokPerSession ? `${tokPerSession.value}${tokPerSession.unit}` : "—",
    },
    {
      k: "estimatedCostPerHour",
      label: t("teams.efficiency.estimatedCostPerActiveHour"),
      v: costPerHour ? `${costPerHour.value}${costPerHour.unit}` : "—",
    },
    { k: "afterHoursShare", label: t("teams.efficiency.afterHoursShare"), v: fmtPct(totals.afterHoursShare) },
    { k: "weekendShare", label: t("teams.efficiency.weekendShare"), v: fmtPct(totals.weekendShare) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((r) => (
        <div key={r.k} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
          <div className="mb-1 text-[10.5px] leading-snug text-[var(--text-muted)]">{r.label}</div>
          <div className="tabular-nums text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const t = useT();
  if (!rows.length) {
    return <p className="m-0 px-3.5 py-4 text-[11.5px] text-[var(--text-muted)]">{t("teams.projects.noActivity")}</p>;
  }
  const headers = [
    { id: "project", label: t("teams.projects.project") },
    { id: "active", label: t("teams.stats.active") },
    { id: "tokens", label: t("teams.charts.tokens") },
    { id: "sessions", label: t("teams.stats.sessions") },
  ];
  return (
    <table className="w-full border-collapse tabular-nums">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={h.id}
              className={`ui-eyebrow border-b border-white/[0.06] px-3 py-[7px] text-[var(--text-muted)] ${
                i === 0 ? "text-left" : "text-right"
              }`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 10).map((r) => {
          const tok = fmtTokens(r.tokens);
          return (
            <tr key={r.projectKey} className="h-[34px]">
              <td className="border-b border-white/[0.035] px-3 text-left font-mono text-[11.5px] text-[var(--text-secondary)]">
                {r.projectKey}
              </td>
              <td className="border-b border-white/[0.035] px-3 text-right text-[12px] text-[var(--text-primary)]">
                {r.activeHours.toFixed(1)}h
              </td>
              <td className="border-b border-white/[0.035] px-3 text-right text-[12px] text-[var(--text-secondary)]">
                {tok.value}
                {tok.unit}
              </td>
              <td className="border-b border-white/[0.035] px-3 text-right text-[12px] text-[var(--text-muted)]">{fmtTeamSessions(r)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Flags are observations with a named cause — never verdicts, never a score. */
function Flags({ flags, range }: { flags: TeamOverview["flags"]; range: TeamRange }) {
  const t = useT();
  const rows: { id: string; icon: typeof Moon; tone: boolean; title: string; detail: string }[] = [];

  if (flags.afterHoursShare > 0) {
    rows.push({
      id: "afterHours",
      icon: Moon,
      tone: flags.afterHoursShare > 0.15,
      title: t("teams.flags.afterHoursTitle", { share: fmtPct(flags.afterHoursShare) }),
      detail:
        flags.afterHoursSharePrev > 0
          ? t(flags.afterHoursShare > flags.afterHoursSharePrev ? "teams.flags.upFromLastPeriod" : "teams.flags.downFromLastPeriod", { share: fmtPct(flags.afterHoursSharePrev) })
          : t("teams.flags.outsideMemberHours"),
    });
  }
  if (flags.weekendShare > 0) {
    rows.push({
      id: "weekend",
      icon: Calendar,
      tone: false,
      title: t("teams.flags.weekendTitle", { share: fmtPct(flags.weekendShare) }),
      detail: t("teams.flags.memberWeekendTime"),
    });
  }
  if (flags.idleDays > 0) {
    rows.push({
      id: "idleDays",
      icon: CircleSlash,
      tone: false,
      title: t("teams.flags.idleDaysTitle", { count: flags.idleDays, countDisplay: flags.idleDays, range: teamRangeLabel(range, t) }),
      detail: t("teams.flags.noActivityDays"),
    });
  }
  if (!rows.length) {
    return (
      <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        {t("teams.flags.nothingToFlag")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div
          key={r.id}
          className={`flex items-start gap-2.5 rounded-[9px] border p-3 text-[12px] leading-snug ${
            r.tone
              ? "border-[#fbbf24]/20 bg-[#fbbf24]/[0.06]"
              : "border-white/[0.06] bg-white/[0.02]"
          }`}
        >
          <r.icon size={14} className={`mt-px shrink-0 ${r.tone ? "text-[var(--status-amber)]" : "text-[var(--text-muted)]"}`} />
          <div>
            <b className="font-medium text-[var(--text-primary)]">{r.title}</b>
            <div className="text-[var(--text-muted)]">{r.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberTable({
  members,
  onOpenMember,
}: {
  members: MemberRow[];
  onOpenMember?: (userId: string) => void;
}) {
  const t = useT();
  const maxActive = Math.max(1, ...members.filter((m) => !m.neverSynced).map((m) => m.totals.activeHours));
  const headers = [
    { id: "member", label: t("teams.members.member") },
    { id: "active", label: t("teams.stats.active") },
    { id: "tokens", label: t("teams.charts.tokens") },
    { id: "sessions", label: t("teams.stats.sessions") },
    { id: "peak", label: t("teams.members.peak") },
    { id: "lastSeen", label: t("teams.members.lastSeen") },
  ];

  return (
    <table className="w-full border-collapse tabular-nums">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={h.id}
              className={`ui-eyebrow border-b border-white/[0.06] px-3 py-[7px] text-[var(--text-muted)] ${
                i === 0 ? "text-left" : "text-right"
              }`}
            >
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {members.map((m) => {
          const tokens = fmtTokens(m.totals.tokens);
          return (
            <tr
              key={m.userId}
              onClick={() => !m.neverSynced && onOpenMember?.(m.userId)}
              className="h-[38px] cursor-default hover:bg-white/[0.025]"
            >
              <td className="border-b border-white/[0.035] px-3 text-left text-[12.5px] text-[var(--text-secondary)]">
                <div className="flex items-center gap-2.5">
                  <Avatar name={m.displayName} color={m.avatarColor} imageUrl={m.avatarUrl} />
                  <span className={`font-medium ${m.neverSynced ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                    {m.displayName}
                  </span>
                  {m.role === "employee" ? null : <RoleBadge role={m.role} />}
                </div>
              </td>
              {m.neverSynced ? (
                // Honest state: one sentence, not a row of zeros.
                <td
                  colSpan={4}
                  className="border-b border-white/[0.035] px-3 text-left text-[11px] text-[var(--text-muted)]"
                >
                  {t("teams.dashboard.waitingForFirstSync")}
                </td>
              ) : (
                <>
                  <td className="border-b border-white/[0.035] px-3 text-right text-[12.5px]">
                    <span className="inline-flex w-full items-center justify-end gap-2">
                      <i
                        className="block h-[5px] rounded-sm bg-[#60a5fa] opacity-75"
                        style={{ width: Math.round((m.totals.activeHours / maxActive) * 56) || 2 }}
                      />
                      <span className="font-medium text-[var(--text-primary)]">{m.totals.activeHours.toFixed(1)}h</span>
                    </span>
                  </td>
                  <td className="border-b border-white/[0.035] px-3 text-right text-[12.5px] text-[var(--text-secondary)]">
                    {tokens.value}
                    {tokens.unit}
                  </td>
                  <td className="border-b border-white/[0.035] px-3 text-right text-[12.5px] text-[var(--text-muted)]">
                    {fmtTeamSessions(m.totals)}
                  </td>
                  <td className="border-b border-white/[0.035] px-3 text-right text-[12.5px] text-[var(--text-muted)]">
                    {m.totals.peakConcurrent.toLocaleString(localeTag())}
                  </td>
                </>
              )}
              <td className="border-b border-white/[0.035] px-3 text-right">
                <SyncPill lastUploadAt={m.lastUploadAt} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
