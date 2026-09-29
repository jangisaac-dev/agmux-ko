/** Design screen 13 — employee self-view plus leave-team. */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CloudOff,
  Coins,
  Receipt,
  Layers,
  LogOut,
  MessageSquare,
  Timer,
} from "lucide-react";
import {
  fmtMoney,
  fmtPct,
  fmtTokens,
  parseTeamsTs,
  teamsLeave,
  teamsSelfView,
  TEAM_RANGES,
  type MemberDetail,
  type TeamMembership,
  type TeamRange,
} from "../../lib/teams";
import { localeTag, useT, tx } from "../../i18n";
import { GlassButton } from "../ui/GlassButton";
import { DailyTrends, MixBars, Sparkline } from "./charts";
import { OutputPanel, ToolMix } from "./TeamDashboard";
import {
  Banner,
  DisclosureBlock,
  EmptyState,
  fmtTeamSessions,
  Panel,
  Pill,
  RangeSeg,
  RoleBadge,
  Skeleton,
  StatCard,
  teamAgoLabel,
} from "./primitives";

export function TeamSelfView({
  team,
  onLeft,
  onOpenPrivacy,
}: {
  team: TeamMembership;
  onLeft?: () => void;
  onOpenPrivacy?: () => void;
}) {
  const t = useT();
  const [range, setRange] = useState<TeamRange>("30d");
  const [data, setData] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await teamsSelfView(team.slug, range));
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

  const leave = async () => {
    if (
      !window.confirm(
        t("teams.self.leaveConfirmation", { name: team.name }),
      )
    ) {
      return;
    }
    setLeaving(true);
    try {
      await teamsLeave(team.slug);
      onLeft?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setLeaving(false);
    }
  };

  const header = (
    <div className="flex items-end gap-3">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-[16px] font-semibold text-[var(--text-primary)]" style={{ letterSpacing: "-0.02em" }}>
            {team.name}
          </span>
          <RoleBadge role={team.role} />
        </div>
        <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">
          {t("teams.self.ownStatsOnly")}
        </div>
      </div>
      <div className="flex-1" />
      <RangeSeg value={range} onChange={setRange} options={TEAM_RANGES} />
    </div>
  );

  const membershipPanel = (
    <Panel title={t("teams.panels.membership")} padded={false}>
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-3.5 py-[11px]">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{t("teams.self.metricsUpload")}</div>
          <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
            {t("teams.self.metricsUploadExplanation")} {" "}
            {onOpenPrivacy ? (
              <button
                onClick={onOpenPrivacy}
                className="text-[var(--status-blue)] underline-offset-2 hover:underline"
              >
                {t("teams.actions.seeTheList")}
              </button>
            ) : null}
          </div>
        </div>
        <Pill tone="ok">{t("teams.self.on")}</Pill>
      </div>
      <div className="flex items-center gap-3 px-3.5 py-[11px]">
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{t("teams.self.leaveTeamTitle", { name: team.name })}</div>
          <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
            {t("teams.self.leaveTeamExplanation")}
          </div>
        </div>
        <GlassButton icon={LogOut} size="sm" variant="destructive" onClick={leave} disabled={leaving}>
          {leaving ? t("teams.self.leaving") : t("teams.self.leaveTeam")}
        </GlassButton>
      </div>
    </Panel>
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
            title={t("teams.self.loadErrorTitle")}
            body={error}
            actions={
              <GlassButton size="sm" onClick={() => void load()}>
                {t("teams.actions.tryAgain")}
              </GlassButton>
            }
          />
        </Panel>
        {membershipPanel}
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
            title={t("teams.self.nothingUploadedTitle")}
            body={t("teams.self.nothingUploadedBody")}
          />
        </Panel>
        {membershipPanel}
      </div>
    );
  }

  const totals = data.totals;
  const tokens = fmtTokens(totals.tokens);
  const cost = fmtMoney(totals.costUsd);
  const stale =
    data.member.last_upload_at &&
    Date.now() - parseTeamsTs(data.member.last_upload_at) > 86_400_000;

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      {stale ? (
        <Banner tone="warn" icon={AlertTriangle}>
          {tx("teams.self.partialDataMessage", {
            label: <b className="font-medium">{t("teams.self.partialDataLabel")}</b>,
            time: String(teamAgoLabel(data.member.last_upload_at, t)),
          })}
        </Banner>
      ) : null}

      <div className="grid grid-cols-5 gap-2">
        <StatCard icon={Timer} label={t("teams.stats.active")} value={totals.activeHours.toFixed(1)} unit="h" />
        <StatCard
          icon={Coins}
          label={t("teams.stats.reportedTokens")} help={t("teams.stats.reportedTokensHelp")}
          value={tokens.value}
          unit={tokens.unit}
          note={t("teams.self.cacheHitRate", { rate: fmtPct(totals.cacheHitRate) })}
        />
        <StatCard
          icon={MessageSquare}
          label={totals.sessionsStartedIncomplete ? t("teams.stats.partialSessions") : t("teams.stats.sessions")}
          help={totals.sessionsStartedIncomplete ? t("teams.stats.partialSessionsHelp") : t("teams.stats.sessionsHelp")}
          value={fmtTeamSessions(totals)}
          note={`${t("teams.stats.turnCount", { count: totals.turns, countDisplay: totals.turns.toLocaleString(localeTag()) })} · ${t("teams.stats.toolCount", { count: totals.toolCalls, countDisplay: totals.toolCalls.toLocaleString(localeTag()) })}`}
        />
        <StatCard icon={Receipt} label={totals.costIncomplete === false ? t("teams.stats.estimatedCost") : t("teams.stats.partialEstimatedCost")} value={cost.value} unit={cost.unit} help={t("teams.stats.costHelp")} />
        <StatCard icon={Layers} label={t("teams.stats.peakConcurrency")} value={String(totals.peakConcurrent)} />
      </div>

      <div className="grid grid-cols-[2fr_1fr] items-start gap-3">
        <Panel title={t("teams.panels.dailyTrends")} sub={t("teams.self.dailyTrendsSubtitle")}>
          <DailyTrends days={data.daily} />
          <div className="mt-2">
            <Sparkline values={data.daily.map((d) => d.activeHours)} />
          </div>
        </Panel>
        <Panel title={t("teams.panels.providerAndModelMix")}>
          <div className="flex flex-col gap-2.5">
            <MixBars slices={data.providerMix} />
            {data.modelMix?.length ? (
              <>
                <hr className="my-1 border-0 border-t border-white/[0.06]" />
                <div className="ui-eyebrow text-[var(--text-muted)]">{t("teams.panels.topModels")}</div>
                <MixBars slices={data.modelMix.slice(0, 5)} mono />
              </>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <Panel
          title={t("teams.panels.whatAgentsDid")}
          right={
            <span className="tabular-nums text-[11.5px] text-[var(--text-muted)]">
              {t("teams.stats.toolCallCount", { count: data.totals.toolCalls, countDisplay: data.totals.toolCalls.toLocaleString(localeTag()) })}
            </span>
          }
        >
          <ToolMix totals={data.totals} />
        </Panel>
        <Panel title={t("teams.panels.outputAndReliability")} sub={t("teams.panels.codeWrittenCallsFailed")}>
          <OutputPanel totals={data.totals} />
        </Panel>
      </div>

      <Panel title={t("teams.self.whatManagersCanSee")}>
        <DisclosureBlock />
      </Panel>

      {membershipPanel}
    </div>
  );
}
