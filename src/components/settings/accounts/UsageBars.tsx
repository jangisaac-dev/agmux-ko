import type { ProviderAccount } from "../../../lib/providerAccounts";
import type { UsageData } from "../../../lib/commands";
import { grokCreditsLabel, usageWindowLabel } from "../../../lib/providerUsageCache";
import { localeTag, tx, useT } from "../../../i18n";

// Order and names of the limits a provider reports; absent ones are never invented.
const windows = [["session", "accounts.usage.window.fiveHour"], ["weekly", "accounts.usage.window.weekly"], ["opus", "accounts.usage.window.opusWeekly"], ["sonnet", "accounts.usage.window.sonnetWeekly"]] as const;

function translateWindowLabel(label: string, t: ReturnType<typeof useT>) {
  if (label === "Weekly") return t("accounts.usage.window.weekly");
  if (label === "Monthly") return t("accounts.usage.window.monthly");
  if (label === "Daily") return t("accounts.usage.window.daily");
  if (label === "Credits") return t("accounts.usage.window.credits");
  const match = /^(\d+)(m|-hour|-day)$/.exec(label);
  if (!match) return label;
  const key = match[2] === "m" ? "minutes" : match[2] === "-hour" ? "hours" : "days";
  return t(`accounts.usage.window.${key}`, { count: Number(match[1]) });
}

export function timestamp(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  // Unix seconds (numbers or digit strings), milliseconds from older adapters, or ISO text.
  const number = typeof value === "number" ? value : /^\d+$/.test(value) ? Number(value) : NaN;
  const date = Number.isFinite(number) ? new Date(number < 1e12 ? number * 1000 : number) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString(localeTag(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Bar({ label, remaining }: { label: string; remaining: number }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining} className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${remaining}%` }} />
  </div>;
}

/** Each reported limit (5-hour, weekly, …) on its own line; otherwise the combined reading. */
export function UsageBars({ account }: { account: ProviderAccount }) {
  const t = useT();
  const checked = account.teamId ? timestamp(account.lastCheckedAt) : null;
  const usage: UsageData | null | undefined = account.usage;
  const reported = windows.flatMap(([key, nameKey]) => {
    const window = usage?.[key];
    if (!window || !Number.isFinite(window.utilization)) return [];
    // Session/weekly are slots; a lone Codex or Grok window can be 30 days long.
    const label = key !== "session" && key !== "weekly" ? t(nameKey)
      : account.provider === "grok" ? translateWindowLabel(grokCreditsLabel(window), t)
        : translateWindowLabel(usageWindowLabel(window, t(nameKey)), t);
    return [{ key, name: label, remaining: Math.max(0, Math.min(100, 100 - window.utilization)), reset: timestamp(window.resetsAt) }];
  });
  if (reported.length > 0) {
    return <div className="mt-3 space-y-2.5">
      {reported.map(window => <div key={window.key}>
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-[var(--text-tertiary)]">
          <span className="tabular-nums">{tx("accounts.usage.windowUsage", {
            window: <span className="text-[var(--text-secondary)]">{window.name}</span>,
            percent: <span className="font-medium text-[var(--text-secondary)]">{Math.round(window.remaining)}%</span>,
          })}</span>
          {window.reset && <span>{t("accounts.usage.resets", { time: window.reset })}</span>}
        </div>
        <Bar label={t("accounts.usage.windowRemainingAria", { account: account.label, window: window.name })} remaining={window.remaining} />
      </div>)}
      {checked && <p className="text-[11px] text-[var(--text-muted)]">{t("accounts.usage.checked", { time: checked })}</p>}
    </div>;
  }
  const remaining = account.remainingPercent !== null && Number.isFinite(account.remainingPercent) ? Math.max(0, Math.min(100, account.remainingPercent)) : null;
  const reset = timestamp(account.resetsAt);
  return <>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-1 text-xs text-[var(--text-tertiary)]">
      <span className="tabular-nums">{remaining === null ? t("accounts.usage.unavailable") : tx("accounts.usage.left", { percent: <span className="font-medium text-[var(--text-secondary)]">{Math.round(remaining)}%</span> })}{checked && <span className="text-[var(--text-muted)]">{t("accounts.usage.checkedInline", { time: checked })}</span>}</span>
      {reset && <span>{t("accounts.usage.resets", { time: reset })}</span>}
    </div>
    {remaining !== null && <Bar label={t("accounts.usage.accountRemainingAria", { account: account.label })} remaining={remaining} />}
  </>;
}
