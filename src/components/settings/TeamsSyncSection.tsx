/**
 * Design screen 11 — Settings → Organization → Sync.
 *
 * Status, backoff position, queued batches, recent uploads, and a payload
 * preview showing exactly what would leave the machine: counters and short
 * labels, nothing else.
 */

import { useCallback, useEffect, useState } from "react";
import { RotateCw, WifiOff } from "lucide-react";
import {
  parseTeamsTs,
  since,
  teamsGetStatus,
  teamsListQueue,
  teamsPreviewPayload,
  teamsSyncNow,
  type HourlyBucket,
  type QueuedBatch,
  type TeamsSyncStatus,
} from "../../lib/teams";
import { GlassButton } from "../ui/GlassButton";
import { Banner, EmptyState, Panel, Pill } from "../teams/primitives";
import { localeTag, useT } from "../../i18n";

const fmtBytes = (n: number): string =>
  n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;

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

export function TeamsSyncSection() {
  const t = useT();
  const [status, setStatus] = useState<TeamsSyncStatus | null>(null);
  const [queue, setQueue] = useState<QueuedBatch[]>([]);
  const [preview, setPreview] = useState<HourlyBucket[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, q] = await Promise.all([teamsGetStatus(), teamsListQueue()]);
      setStatus(s);
      setQueue(q);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const syncNow = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const outcome = await teamsSyncNow();
      if (outcome.lastError) {
        setError(outcome.lastError);
      } else if (outcome.sent > 0) {
        const n = outcome.buckets;
        setNote(
          t("settings.teamsSync.uploaded", { count: outcome.sent }) +
            (n > 0 ? ` · ${t("settings.teamsSync.hourlyBuckets", { count: n })}` : "") +
            (outcome.duplicates > 0 ? ` · ${t("settings.teamsSync.alreadyApplied", { count: outcome.duplicates })}` : ""),
        );
      } else {
        setNote(t("settings.teamsSync.upToDate"));
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadPreview = async () => {
    try {
      setPreview(await teamsPreviewPayload());
    } catch (e) {
      setError(String(e));
    }
  };

  if (!status?.linked) {
    return (
      <div className="flex flex-col gap-2.5">
        <SyncHeader />
        <Panel padded={false}>
          <EmptyState
            icon={WifiOff}
            title={t("settings.teamsSync.notSignedIn")}
            body={t("settings.teamsSync.linkMac")}
          />
        </Panel>
      </div>
    );
  }

  const coverage = status.accountingCoverage;
  const failing = Boolean(status.lastError) || status.backoffStep > 0;
  const lastMs = status.lastUploadAt ? parseTeamsTs(status.lastUploadAt) : NaN;
  const stale =
    !status.lastUploadAt ||
    !Number.isFinite(lastMs) ||
    Date.now() - lastMs > 86_400_000;

  return (
    <div className="flex flex-col gap-2.5">
      <SyncHeader />
      <p className="m-0 text-[11.5px] text-[var(--text-muted)]">
        {t("settings.teamsSync.coverage.explainer.first")} {t("settings.teamsSync.coverage.explainer.second")} {t("settings.teamsSync.coverage.explainer.third")}
      </p>

      {coverage && (coverage.unverifiedLegacyRecords > 0 || coverage.awaitingNativeBinding > 0 || coverage.unrevalidatedCodexSnapshots > 0) ? (
        <Banner tone="plain" icon={RotateCw}>
          <b className="font-medium">{t("settings.teamsSync.coverage.incomplete")}</b>{" "}
          {coverage.unverifiedLegacyRecords > 0 ? `${t("settings.teamsSync.coverage.legacyRecords", { count: coverage.unverifiedLegacyRecords })} ` : ""}
          {coverage.awaitingNativeBinding > 0 ? `${t("settings.teamsSync.coverage.awaitingIdentity", { count: coverage.awaitingNativeBinding })} ` : ""}
          {coverage.unrevalidatedCodexSnapshots > 0 ? `${t("settings.teamsSync.coverage.codexLogs", { count: coverage.unrevalidatedCodexSnapshots })} ` : ""}
          {t("settings.teamsSync.coverage.localHistory")}{" "}
          {t("settings.teamsSync.coverage.missingReports")}
        </Banner>
      ) : null}

      {error || status.lastError ? (
        <Banner
          tone="err"
          icon={WifiOff}
          action={
            <GlassButton
              icon={RotateCw}
              size="sm"
              onClick={() => void syncNow()}
              disabled={busy}
            >
              {t("settings.teamsSync.retryNow")}
            </GlassButton>
          }
        >
          <b className="font-medium">{t("settings.teamsSync.uploadFailed")}</b>{" "}
          {error ?? status.lastError}
          {status.queuedBatches > 0
            ? ` ${t("settings.teamsSync.queuedLocally", { count: status.queuedBatches })}`
            : ""}
        </Banner>
      ) : note ? (
        <Banner tone="plain" icon={RotateCw}>
          {note}
        </Banner>
      ) : null}

      <Panel
        title={t("settings.teamsSync.status.title")}
        right={
          failing ? (
            <Pill tone="err">{t("settings.teamsSync.status.failing")}</Pill>
          ) : stale ? (
            <Pill tone="warn">{t("settings.teamsSync.status.stale")}</Pill>
          ) : (
            <Pill tone="ok">{t("settings.teamsSync.status.healthy")}</Pill>
          )
        }
      >
        <dl
          className="grid gap-y-2 text-[12.5px]"
          style={{ gridTemplateColumns: "170px 1fr", columnGap: 14 }}
        >
          <dt className="text-[var(--text-muted)]">{t("settings.teamsSync.status.lastSuccessfulUpload")}</dt>
          <dd className="m-0 tabular-nums text-[var(--text-secondary)]">
            {status.lastUploadAt ? (
              <>
                {Number.isFinite(lastMs) ? new Date(lastMs).toLocaleString(localeTag()) : null}{" "}
                <span className={stale ? "text-[var(--status-amber)]" : "text-[var(--text-muted)]"}>
                  · {relativeTimeLabel(since(status.lastUploadAt), t)}
                </span>
              </>
            ) : (
              <span className="text-[var(--text-muted)]">{t("settings.teamsSync.status.never")}</span>
            )}
          </dd>

          <dt className="text-[var(--text-muted)]">{t("settings.teamsSync.status.nextAttempt")}</dt>
          <dd className="m-0 tabular-nums text-[var(--text-secondary)]">
            {status.nextAttemptAt ? (
              <>
                {(() => {
                  const attemptTimeMs = parseTeamsTs(status.nextAttemptAt);
                  return Number.isFinite(attemptTimeMs)
                    ? new Date(attemptTimeMs).toLocaleTimeString(localeTag())
                    : status.nextAttemptAt;
                })()}
                {status.backoffStep > 0 ? (
                  <span className="text-[var(--text-muted)]">{t("settings.teamsSync.status.backoff", { step: status.backoffStep })}</span>
                ) : null}
              </>
            ) : (
              t("settings.teamsSync.status.nextFlush")
            )}
          </dd>

          <dt className="text-[var(--text-muted)]">{t("settings.teamsSync.status.queuedBatches")}</dt>
          <dd className="m-0 tabular-nums text-[var(--text-secondary)]">
            {status.queuedBatches}
            {status.queuedBytes > 0 ? (
              <span className="text-[var(--text-muted)]"> · {fmtBytes(status.queuedBytes)}</span>
            ) : null}
          </dd>

          <dt className="text-[var(--text-muted)]">{t("settings.teamsSync.status.teamsReceiving")}</dt>
          <dd className="m-0 text-[var(--text-secondary)]">
            {status.teams.length ? status.teams.map((team) => team.name).join(", ") : t("settings.teamsSync.status.none")}
          </dd>

          <dt className="text-[var(--text-muted)]">{t("settings.teamsSync.status.linkedAccount")}</dt>
          <dd className="m-0 text-[var(--text-secondary)]">
            {status.account?.handle ? `@${status.account.handle}` : (status.account?.email ?? "—")}
          </dd>

          <dt className="text-[var(--text-muted)]">{t("settings.teamsSync.status.payload")}</dt>
          <dd className="m-0 text-[var(--text-secondary)]">
            {t("settings.teamsSync.payload.summary")} {" "}
            <button
              onClick={loadPreview}
              className="text-[var(--status-blue)] underline-offset-2 hover:underline"
            >
              {t("settings.teamsSync.payload.previewAction")}
            </button>
          </dd>
        </dl>

        <div className="mt-3.5">
          <GlassButton
            icon={RotateCw}
            size="sm"
            onClick={() => void syncNow()}
            disabled={busy}
          >
            {busy ? t("settings.teamsSync.syncing") : t("settings.teamsSync.syncNow")}
          </GlassButton>
        </div>
      </Panel>

      {preview ? (
        <Panel
          title={t("settings.teamsSync.payload.previewTitle")}
          sub={t("settings.teamsSync.hourlyBuckets", { count: preview.length })}
          right={
            <GlassButton size="sm" variant="ghost" onClick={() => setPreview(null)}>
              {t("settings.teamsSync.hide")}
            </GlassButton>
          }
          padded={false}
        >
          {preview.length === 0 ? (
            <p className="m-0 px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">
              {t("settings.teamsSync.payload.nothingRecent")}
            </p>
          ) : (
            <div className="max-h-[280px] overflow-auto">
              <table className="w-full border-collapse tabular-nums">
                <thead className="sticky top-0 bg-[var(--surface-code-panel)]">
                  <tr>
                    {["hour", "provider", "project", "tokens", "active", "sessions"].map((column, i) => (
                      <th
                        key={column}
                        className={`border-b border-white/[0.06] px-3 py-[7px] ui-eyebrow ${
                          i < 3 ? "text-left" : "text-right"
                        }`}
                      >
                        {t(`settings.teamsSync.columns.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((b) => (
                    <tr key={`${b.hourUtc}-${b.provider}-${b.model}-${b.projectKey}`} className="h-[30px]">
                      <td className="border-b border-white/[0.035] px-3 text-left font-mono text-[11px] text-[var(--text-tertiary)]">
                        {b.hourUtc}
                      </td>
                      <td className="border-b border-white/[0.035] px-3 text-left text-[11.5px] text-[var(--text-secondary)]">
                        {b.provider}
                      </td>
                      <td className="border-b border-white/[0.035] px-3 text-left font-mono text-[11px] text-[var(--text-muted)]">
                        {b.projectKey || "—"}
                      </td>
                      <td className="border-b border-white/[0.035] px-3 text-right text-[11.5px] text-[var(--text-secondary)]">
                        {(
                          b.tokensIn + b.tokensOut + b.tokensCacheRead + b.tokensCacheWrite
                        ).toLocaleString(localeTag())}
                      </td>
                      <td className="border-b border-white/[0.035] px-3 text-right text-[11.5px] text-[var(--text-muted)]">
                        {(b.activeMs / 3_600_000).toFixed(1)}h
                      </td>
                      <td className="border-b border-white/[0.035] px-3 text-right text-[11.5px] text-[var(--text-muted)]">
                        {b.sessions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : null}

      {queue.length > 0 ? (
        <Panel title={t("settings.teamsSync.queue.title")} sub={t("settings.teamsSync.queue.subtitle")} padded={false}>
          {queue.map((b) => (
            <div
              key={b.batchId}
              className="flex items-center gap-3 border-b border-white/[0.06] px-3.5 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-[var(--text-tertiary)]">{b.batchId.slice(0, 8)}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                  {t("settings.teamsSync.queue.buckets", { count: b.bucketCount })} · {fmtBytes(b.byteSize)}
                  {b.attempts > 0 ? ` · ${t("settings.teamsSync.queue.attempts", { count: b.attempts })}` : ""}
                </div>
              </div>
              {b.lastError ? <Pill tone="err">{t("settings.teamsSync.status.failing")}</Pill> : <Pill tone="warn">{t("settings.teamsSync.status.queued")}</Pill>}
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

function SyncHeader() {
  const t = useT();
  return (
    <div>
      <h2 className="m-0 text-[16px] font-semibold text-[var(--text-primary)]" style={{ letterSpacing: "-0.02em" }}>
        {t("settings.teamsSync.title")}
      </h2>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        {t("settings.teamsSync.description.first")} {t("settings.teamsSync.description.second")}
      </p>
    </div>
  );
}
