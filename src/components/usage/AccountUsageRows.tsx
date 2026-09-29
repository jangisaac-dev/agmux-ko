import type { AccountTeam, ProviderAccount } from "../../lib/providerAccounts";
import type { UsageWindow } from "../../lib/commands";
import { localeTag, useT } from "../../i18n";

type WindowKey = "session" | "weekly" | "sonnet" | "opus" | "design" | "routines";

function grokWindowKey(window: UsageWindow | null | undefined): "credits" | "weekly" | "monthly" {
  if (!window) return "credits";
  let seconds: number | null = null;
  if (window.windowMinutes != null && window.windowMinutes > 0) {
    seconds = window.windowMinutes * 60;
  } else if (window.resetsAt) {
    const numeric = Number(window.resetsAt);
    const target = Number.isFinite(numeric) && numeric > 1_000_000_000
      ? (numeric < 10_000_000_000 ? numeric * 1000 : numeric)
      : new Date(window.resetsAt).getTime();
    if (Number.isFinite(target)) seconds = Math.max(0, (target - Date.now()) / 1000);
  }
  if (seconds == null || seconds <= 3600) return "credits";
  const days = Math.round(seconds / 86_400);
  if (days >= 4 && days <= 12) return "weekly";
  if (days >= 20 && days <= 45) return "monthly";
  return "credits";
}

function windowLabel(key: WindowKey, window: UsageWindow | null | undefined, provider: ProviderAccount["provider"], t: ReturnType<typeof useT>): string {
  if (key === "sonnet" || key === "opus") return key === "sonnet" ? "Sonnet" : "Opus";
  if (key === "design") return t("usage.window.designs");
  if (key === "routines") return t("usage.window.routines");
  if (provider === "grok") return t(`usage.window.${grokWindowKey(window)}`);

  const minutes = window?.windowMinutes;
  if (minutes == null || minutes <= 0) return t(`usage.window.${key}`);
  if (minutes < 60) return t("usage.window.duration.minutes", { count: Math.max(1, Math.round(minutes)) });
  if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    return t(hours === 1 ? "usage.window.duration.hours_one" : "usage.window.duration.hours_other", { count: hours });
  }
  const days = Math.round(minutes / (24 * 60));
  if (days >= 4 && days <= 12) return t("usage.window.weekly");
  if (days >= 20 && days <= 45) return t("usage.window.monthly");
  if (days === 1) return t("usage.window.daily");
  return t("usage.window.duration.days", { count: days });
}

function resetTime(value: string | number | null): number | null {
  if (value === null || value === "") return null;
  const numeric = Number(value);
  const time = Number.isFinite(numeric) ? numeric * (numeric < 1e12 ? 1000 : 1) : Date.parse(String(value));
  return Number.isFinite(time) && time > 0 ? time : null;
}

function resetCountdown(reset: number, now: number, t: ReturnType<typeof useT>): string {
  const mins = Math.floor((reset - now) / 60_000);
  if (mins < 1) return t("usage.reset.lessThanMinute");
  if (mins < 60) return t("usage.reset.minutes", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return mins % 60 === 0
    ? t("usage.reset.hours", { count: hrs })
    : t("usage.reset.hoursAndMinutes", { count: hrs, hours: hrs, minutes: mins % 60 });
  const days = Math.floor(hrs / 24);
  return hrs % 24 === 0
    ? t("usage.reset.days", { count: days })
    : t("usage.reset.daysAndHours", { count: days, days, hours: hrs % 24 });
}

interface Limit { key: string; label: string; remaining: number | null; reset: number | null }
function limits(account: ProviderAccount, t: ReturnType<typeof useT>): Limit[] {
  const windows = account.provider === "claude"
    ? ["session", "weekly", "sonnet", "opus", "design", "routines"] as const
    : ["session", "weekly"] as const;
  const reported = windows.flatMap(key => {
    const window = account.usage?.[key];
    if (!window) return [];
    const valid = Number.isFinite(window.utilization) && window.utilization >= 0;
    return [{ key, label: windowLabel(key, window, account.provider, t),
    remaining: valid ? Math.max(0, 100 - window.utilization) : null, reset: resetTime(window.resetsAt) }];
  });
  if (reported.length) return reported;
  const remaining = account.remainingPercent;
  return [{ key:"remaining",label:t("usage.window.remaining"),remaining: remaining !== null && Number.isFinite(remaining) && remaining >= 0 && remaining <= 100 ? remaining : null,reset:resetTime(account.resetsAt) }];
}

/** Same named-account limits on Home and Usage; provider totals remain separate. */
export function AccountUsageRows({ accounts, teams, stale = false }: {
  accounts: ProviderAccount[];
  teams: AccountTeam[];
  stale?: boolean;
}) {
  const t = useT();
  const now = Date.now();
  return <div className="divide-y divide-[var(--glass-border)]">
    {accounts.filter(account => account.provider !== "claude" || !account.teamId).map(account => {
      const scope = account.teamId ? teams.find(team => team.id === account.teamId)?.name || t("usage.account.team") : t("usage.account.personal");
      const accountLimits = limits(account, t);
      const hasReading = accountLimits.some(limit => limit.remaining !== null);
      const lastKnown = stale || !!account.error || account.lastCheckedAt === null || now - account.lastCheckedAt * 1000 > 5 * 60_000;
      const status = !account.enabled ? t("usage.account.paused") : account.status === "needs_login" ? t("usage.account.signInNeeded") : account.status === "exhausted" ? t("usage.account.limitReached") : null;
      return <article key={`${account.teamId || "personal"}:${account.id}`} aria-label={t("usage.account.ariaLabel", { account: account.label, scope })} className="space-y-2.5 py-3 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="min-w-0">
            <span className="break-words text-[12px] text-[var(--text-secondary)]">{account.label}</span><span className="ml-2 text-[10px] text-[var(--text-muted)]">{scope}</span>
            {account.email && account.email.trim().toLowerCase() !== account.label.trim().toLowerCase() && <p className="mt-0.5 break-words text-[10.5px] text-[var(--text-muted)]">{account.email}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {account.currentLogin && <span className="app-chip px-2 py-[2px] text-[9.5px]" data-tone="accent">{t("usage.account.currentLogin")}</span>}
            {(account.tier || account.plan) && <span className="app-chip px-2 py-[2px] text-[9.5px]">{account.tier || account.plan}</span>}
            {status && <span className="ui-meta text-[10px] text-[var(--text-muted)]">{status}</span>}
          </div>
        </div>
        {accountLimits.map(limit => {
          const expired = limit.reset !== null && limit.reset <= now;
          const remaining = account.status === "needs_login" || expired ? null : limit.remaining;
          const reset = limit.reset === null || expired ? null : limit.reset;
          return <div key={limit.key} className={lastKnown ? "opacity-60" : undefined}>
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-[12.5px] font-semibold text-[var(--text-secondary)] fx-ink">{limit.label}</span>
              <span className="ui-meta text-[10.5px] tabular-nums text-[var(--text-secondary)]">{remaining === null ? expired ? t("usage.account.awaitingRefresh") : t("usage.account.usageUnavailable") : t("usage.account.percentLeft", { percent: Math.round(remaining) })}</span>
              {reset !== null && <span className="ml-auto ui-meta text-[10px] text-[var(--text-muted)]" title={new Date(reset).toLocaleString(localeTag())}>{t("usage.account.resets", { time: resetCountdown(reset, now, t) })}</span>}
            </div>
            {remaining !== null && <div role="progressbar" aria-label={t("usage.account.progressLabel", { account: account.label, scope, limit: limit.label })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining} className="glass-progress h-[6px] w-full">
              <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out" style={{width:`${remaining}%`, background:"var(--status-blue)"}} />
            </div>}
          </div>;
        })}
        {lastKnown && hasReading && <p className="ui-meta text-[10px] text-[var(--text-muted)]" title={account.lastCheckedAt ? new Date(account.lastCheckedAt * 1000).toLocaleString(localeTag()) : undefined}>{t("usage.account.lastKnownUsage")}</p>}
      </article>;
    })}
  </div>;
}
