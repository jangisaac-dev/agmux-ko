/**
 * Settings → Your Data — local Teams-style usage for any individual, no team required.
 * Scans Claude / Codex / Grok provider logs on this machine (same pipeline as Teams upload).
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CloudOff,
  Coins,
  Layers,
  MessageSquare,
  RefreshCw,
  Timer,
} from "lucide-react";
import {
  buildLocalSelfView,
  type LocalSelfView,
} from "../../lib/localTeamsAggregate";
import {
  fmtPct,
  fmtTokens,
  since,
  teamsPreviewPayload,
  TEAM_RANGES,
  type HourlyBucket,
  type TeamRange,
} from "../../lib/teams";
import { GlassButton } from "../ui/GlassButton";
import { DailyTrends, MixBars, Sparkline } from "../teams/charts";
import { OutputPanel, ToolMix } from "../teams/TeamDashboard";
import {
  Banner,
  EmptyState,
  Panel,
  RangeSeg,
  Skeleton,
  StatCard,
} from "../teams/primitives";
import { localeTag, tx, useT } from "../../i18n";

/** hourUtc is `YYYY-MM-DDTHH` — coerce for parseTeamsTs. */
function hourAsTs(hourUtc: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(hourUtc)) return `${hourUtc}:00:00Z`;
  return hourUtc;
}

function relativeTimeLabel(value: string | null, t: ReturnType<typeof useT>): string | null {
  if (!value) return null;
  if (value === "now") return t("settings.relativeTime.justNow");
  const match = /^(\d+)(m|h|d)$/.exec(value);
  if (!match) return value;
  const key = match[2] === "m"
    ? "settings.relativeTime.minutes"
    : match[2] === "h"
      ? "settings.relativeTime.hours"
      : "settings.relativeTime.days";
  return t(key, { count: Number(match[1]) });
}

export function YourDataSection() {
  const t = useT();
  const [range, setRange] = useState<TeamRange>("30d");
  const [buckets, setBuckets] = useState<HourlyBucket[] | null>(null);
  const [data, setData] = useState<LocalSelfView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rangeLabels: Record<TeamRange, string> = {
    "7d": t("settings.yourData.range.7d"),
    "14d": t("settings.yourData.range.14d"),
    "30d": t("settings.yourData.range.30d"),
    "90d": t("settings.yourData.range.90d"),
  };

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBuckets(await teamsPreviewPayload());
    } catch (e) {
      setError(String(e));
      setBuckets(null);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial scan on mount.
  useEffect(() => {
    void scan();
  }, [scan]);

  // Fold (and re-fold on range change) without rescanning.
  useEffect(() => {
    if (!buckets) return;
    setData(buildLocalSelfView(buckets, range));
  }, [range, buckets]);

  const header = (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <div
          className="text-[16px] font-semibold text-[var(--text-primary)]"
          style={{ letterSpacing: "-0.02em" }}
        >
          {t("settings.yourData.title")}
        </div>
        <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">
          {t("settings.yourData.description")}
          {data?.lastBucketHour
            ? ` · ${t("settings.yourData.asOf", { time: relativeTimeLabel(since(hourAsTs(data.lastBucketHour)), t) ?? "" })}`
            : ""}
        </div>
      </div>
      <div className="flex-1" />
      <RangeSeg
        value={range}
        onChange={setRange}
        options={TEAM_RANGES}
        labels={rangeLabels}
      />
      <GlassButton
        icon={RefreshCw}
        size="sm"
        variant="ghost"
        onClick={() => void scan()}
        disabled={loading}
      >
        {loading ? t("settings.yourData.scanning") : t("settings.yourData.refresh")}
      </GlassButton>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-[10px] border border-[var(--glass-border)] bg-[var(--surface-popover)] p-2.5"
            >
              <Skeleton width={54} height={8} />
              <Skeleton width={78} height={20} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Panel padded={false}>
          <EmptyState
            icon={AlertTriangle}
            title={t("settings.yourData.readError")}
            body={error}
            actions={
              <GlassButton size="sm" onClick={() => void scan()}>
                {t("settings.yourData.tryAgain")}
              </GlassButton>
            }
          />
        </Panel>
      </div>
    );
  }

  if (!data) return null;

  if (data.neverSynced) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Panel padded={false}>
          <EmptyState
            icon={CloudOff}
            title={t("settings.yourData.noActivity.title")}
            body={`${t("settings.yourData.noActivity.description.first")} ${t("settings.yourData.noActivity.description.second")}`}
          />
        </Panel>
        <LocalNote />
      </div>
    );
  }

  if (data.totals.daysWithData === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <Panel padded={false}>
          <EmptyState
            icon={CloudOff}
            title={t("settings.yourData.emptyRange", { range: rangeLabels[range].toLowerCase() })}
            body={t("settings.yourData.emptyRangeDescription")}
            actions={
              <GlassButton size="sm" onClick={() => setRange("90d")}>
                {t("settings.yourData.show90Days")}
              </GlassButton>
            }
          />
        </Panel>
        <LocalNote />
      </div>
    );
  }

  const totals = data.totals;
  const tokens = fmtTokens(totals.tokens);
  const costText = totals.costUsd.toFixed(2);
  const costDot = costText.indexOf(".");
  const cost = {
    value: `$${Number(costText.slice(0, costDot)).toLocaleString(localeTag())}`,
    unit: costText.slice(costDot),
  };
  const sessionCount = totals.sessionsStarted == null
    ? "—"
    : `${totals.sessionsStarted.toLocaleString(localeTag())}${totals.sessionsStartedIncomplete ? "+" : ""}`;

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      <Banner tone="plain" icon={Timer}>
        {t("settings.yourData.localAnalytics")}{" "}
        {t("settings.yourData.uploadOptIn")}
      </Banner>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard icon={Timer} label={t("settings.yourData.active")} value={totals.activeHours.toFixed(1)} unit="h" />
        <StatCard
          icon={Coins}
          label={t("settings.yourData.tokens")}
          value={tokens.value}
          unit={tokens.unit}
          note={t("settings.yourData.cacheCostNote", { percent: fmtPct(totals.cacheHitRate), amount: cost.value, unit: cost.unit })}
        />
        <StatCard
          icon={MessageSquare}
          label={t(totals.sessionsStartedIncomplete ? "settings.yourData.sessionsPartial" : "settings.yourData.sessions")}
          help={`${t(totals.sessionsStartedIncomplete ? "settings.yourData.sessionsPartialHelp.first" : "settings.yourData.sessionsHelp.first")} ${t(totals.sessionsStartedIncomplete ? "settings.yourData.sessionsPartialHelp.second" : "settings.yourData.sessionsHelp.second")}`}
          value={sessionCount}
          note={`${t("settings.yourData.turns", { count: totals.turns, number: totals.turns.toLocaleString(localeTag()) })} · ${t("settings.yourData.tools", { count: totals.toolCalls, number: totals.toolCalls.toLocaleString(localeTag()) })}`}
        />
        <StatCard icon={Layers} label={t("settings.yourData.peakConcurrency")} value={String(totals.peakConcurrent)} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[2fr_1fr]">
        <Panel title={t("settings.yourData.dailyTrends")} sub={t("settings.yourData.dailyTrendsSubtitle")}>
          <DailyTrends days={data.daily} />
          <div className="mt-2">
            <Sparkline values={data.daily.map((d) => d.activeHours)} />
          </div>
        </Panel>
        <Panel title={t("settings.yourData.providerModelMix")}>
          <div className="flex flex-col gap-2.5">
            <MixBars slices={data.providerMix} />
            {data.modelMix?.length ? (
              <>
                <hr className="my-1 border-0 border-t border-white/[0.06]" />
                <div className="ui-eyebrow text-[var(--text-muted)]">
                  {t("settings.yourData.topModels")}
                </div>
                <MixBars slices={data.modelMix.slice(0, 5)} mono />
              </>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        <Panel
          title={t("settings.yourData.agentsActivity")}
          right={
            <span className="font-mono text-[11.5px] text-[var(--text-muted)]">
              {t("settings.yourData.toolCalls", { count: totals.toolCalls, number: totals.toolCalls.toLocaleString(localeTag()) })}
            </span>
          }
        >
          <ToolMix totals={data.totals} />
        </Panel>
        <Panel title={t("settings.yourData.outputReliability")} sub={t("settings.yourData.outputReliabilitySubtitle")}>
          <OutputPanel totals={data.totals} />
        </Panel>
      </div>

      {data.projects.length > 0 ? (
        <Panel title={t("settings.yourData.projects")} sub={t("settings.yourData.projectsSubtitle")} padded={false}>
          <div className="divide-y divide-white/[0.06]">
            {data.projects.slice(0, 8).map((p) => {
              const tok = fmtTokens(p.tokens);
              const projectSessionCount = p.sessionsStarted == null
                ? "—"
                : `${p.sessionsStarted.toLocaleString(localeTag())}${p.sessionsStartedIncomplete ? "+" : ""}`;
              return (
                <div
                  key={p.projectKey}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3.5 py-2 text-[12px]"
                >
                  <span className="truncate font-mono text-[11.5px] text-[var(--text-secondary)]">
                    {p.projectKey}
                  </span>
                  <span className="ui-meta text-[11.5px] text-[var(--text-tertiary)]">
                    {p.activeHours.toFixed(1)}h
                  </span>
                  <span className="ui-meta text-[11.5px] text-[var(--text-tertiary)]">
                    {tok.value}
                    {tok.unit}
                  </span>
                  <span className="ui-meta text-[11.5px] text-[var(--text-muted)]">
                    {p.sessionsStarted == null
                      ? projectSessionCount
                      : t("settings.yourData.sessionsShort", { count: p.sessionsStarted, value: projectSessionCount })}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <LocalNote />
    </div>
  );
}

function LocalNote() {
  const t = useT();
  return (
    <Panel title={t("settings.yourData.about.title")}>
      <p className="m-0 text-[11.5px] leading-relaxed text-[var(--text-tertiary)]">
        {t("settings.yourData.about.aggregates")}{" "}
        {t("settings.yourData.about.privacy")}{" "}
        {tx("settings.yourData.about.share", {
          section: <span className="text-[var(--text-secondary)]">{t("settings.dialog.title")} → {t("settings.nav.teams")}</span>,
        })}
      </p>
    </Panel>
  );
}
