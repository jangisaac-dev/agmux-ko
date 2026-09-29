import { useState } from "react";
import { useT } from "../../../i18n";
import type { AccountTeam, ProviderAccount } from "../../../lib/providerAccounts";
import { AccountMenu, type MenuAction } from "./AccountMenu";
import { ChoiceGroup } from "./ChoiceGroup";
import { button, input } from "./styles";
import { providerNames } from "./AddAccountForm";
import { UsageBars } from "./UsageBars";

const statusKeys: Record<ProviderAccount["status"], string | null> = { ready: "accounts.status.ready", signing_in: "accounts.status.signingIn", needs_login: "accounts.status.signInNeeded", exhausted: "accounts.status.limitReached", in_use: "accounts.status.inUse", unknown: null };

/** Who is on the account right now, then its state. An old reading needs no "unknown" label. */
function statusText(account: ProviderAccount, t: ReturnType<typeof useT>) {
  if (!account.enabled) return t("accounts.status.paused");
  const use = account.inUse;
  if (use) {
    if (use.self) return use.kind === "cli" ? t("accounts.status.inUseByYourCli") : use.kind === "check" ? t("accounts.status.checkingUsage") : t("accounts.status.inUseByYou");
    const who = use.by ?? t("accounts.status.teammate");
    return use.kind === "cli" ? t("accounts.status.inUseByCli", { who }) : use.kind === "check" ? t("accounts.status.checkingUsageBy", { who }) : t("accounts.status.inUseBy", { who });
  }
  if (account.status === "unknown" && account.remainingPercent === null && !account.usage) return t("accounts.status.notCheckedYet");
  const key = statusKeys[account.status];
  return key ? t(key) : "";
}

// A Claude "Team" plan is a subscription type, not an agmux team.
const planText = (account: ProviderAccount, t: ReturnType<typeof useT>) => account.tier || (account.plan === "Team" ? t("accounts.plan.team") : account.plan);

export type RowPanel = "remove" | "move" | "use" | "rename" | null;
export interface RowActions {
  checkUsage: () => void;
  setEnabled: (enabled: boolean) => void;
  reconnect: () => void;
  remove: () => void;
  move: (team: AccountTeam) => void;
  use: () => void;
  rename: (label: string) => void;
}

export function AccountRow({ account, canEdit, canUse, moveTeams, locked, panel, setPanel, actionError = null, actions }: {
  account: ProviderAccount; canEdit: boolean; canUse: boolean; moveTeams: AccountTeam[]; locked: boolean;
  panel: RowPanel; setPanel: (panel: RowPanel) => void; actionError?: string | null; actions: RowActions;
}) {
  const t = useT();
  const tier = planText(account, t);
  const status = statusText(account, t);
  const sharedCli = account.currentLogin && account.inUse && !account.inUse.self;
  // One person on your own login is just you; on a team account it is worth showing.
  const active = account.activeUsers ?? 0;
  const activeText = active >= (account.teamId ? 1 : 2) ? t("accounts.row.peopleActive", { count: active }) : null;
  const menu: MenuAction[] = [];
  if (canUse) menu.push({ label: t("accounts.actions.useThisAccount"), onSelect: () => setPanel("use") });
  if (!account.teamId || account.enabled) menu.push({ label: t("accounts.actions.checkUsage"), onSelect: actions.checkUsage });
  if (moveTeams.length > 0) menu.push({ label: t("accounts.actions.moveToTeam"), onSelect: () => setPanel("move") });
  if (canEdit) {
    menu.push({ label: t("accounts.actions.rename"), onSelect: () => setPanel("rename") });
    menu.push({ label: account.enabled ? t("accounts.actions.pause") : t("accounts.actions.resume"), onSelect: () => actions.setEnabled(!account.enabled) });
    menu.push({ label: t("accounts.actions.remove"), onSelect: () => setPanel("remove"), danger: true });
  }
  return (
    <article aria-label={account.label} className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="break-words text-sm font-medium">{account.label}</h4>
          {account.email && account.email.trim().toLowerCase() !== account.label.trim().toLowerCase() && <p className="mt-0.5 break-words text-xs text-[var(--text-tertiary)]">{account.email}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-[var(--glass-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">{providerNames[account.provider]}</span>
            {account.currentLogin && <span className="rounded-md bg-[var(--accent-dim)] px-2 py-0.5 text-[11px] text-[var(--accent)]" title={t("accounts.row.currentLoginTitle")}>{t("accounts.row.currentLogin")}</span>}
            {tier && <span className="rounded-md bg-[var(--surface-3)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{tier}</span>}
            {status && <span className={`text-[11px] ${account.enabled && account.status === "ready" ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`}>{status}</span>}
            {activeText && <span className="text-[11px] text-[var(--text-secondary)]" title={t("accounts.row.activeUsersTitle")}>· {activeText}</span>}
          </div>
        </div>
        <AccountMenu label={account.label} actions={menu} disabled={locked} />
      </div>
      {sharedCli && <p className="mt-2 text-xs text-[var(--text-secondary)]">{t("accounts.row.sharedCliWarning")}</p>}
      <UsageBars account={account} />
      {account.error && <p className="mt-2 break-words text-xs text-[var(--text-secondary)]">{account.error}</p>}
      {canEdit && (account.status === "needs_login" || account.error) && <button className="mt-1 min-h-8 text-xs font-medium text-[var(--accent)] disabled:opacity-50" disabled={locked} onClick={actions.reconnect}>{t("accounts.actions.reconnect")}</button>}
      {panel === "use" && canUse && <Confirm locked={locked} confirm={t("accounts.actions.useThisAccount")} onConfirm={actions.use} onCancel={() => setPanel(null)}
        title={t("accounts.confirm.useTitle", { provider: providerNames[account.provider], label: account.label })}
        detail={`${t("accounts.confirm.useDetail.terminal")} ${account.teamId
          ? t("accounts.confirm.useDetail.team")
          : t("accounts.confirm.useDetail.personal")} ${t("accounts.confirm.useDetail.replacedLogin")}`} />}
      {panel === "rename" && canEdit && <RenamePanel account={account} locked={locked} onSave={actions.rename} onCancel={() => setPanel(null)} />}
      {panel === "remove" && <Confirm locked={locked} title={t("accounts.confirm.removeTitle", { label: account.label })} confirm={t("accounts.confirm.remove")} cancel={t("accounts.confirm.keepAccount")} onConfirm={actions.remove} onCancel={() => setPanel(null)} />}
      {panel === "move" && moveTeams.length > 0 && <MovePanel account={account} teams={moveTeams} locked={locked} onCancel={() => setPanel(null)} onConfirm={actions.move} />}
      {actionError && <p role="alert" className="mt-2 break-words rounded-lg border border-[var(--glass-border)] p-2 text-xs">{actionError}</p>}
    </article>
  );
}

function Confirm({ title, detail, confirm, cancel, locked, onConfirm, onCancel }: {
  title: string; detail?: string; confirm: string; cancel?: string; locked: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const t = useT();
  return <div className="mt-3 space-y-2 rounded-lg bg-[var(--surface-3)] p-3">
    <p className="text-xs">{title}</p>
    {detail && <p className="text-xs text-[var(--text-tertiary)]">{detail}</p>}
    <div className="flex gap-2"><button className={button} disabled={locked} onClick={onConfirm}>{confirm}</button><button className={button} disabled={locked} onClick={onCancel}>{cancel ?? t("accounts.actions.cancel")}</button></div>
  </div>;
}

function RenamePanel({ account, locked, onSave, onCancel }: { account: ProviderAccount; locked: boolean; onSave: (label: string) => void; onCancel: () => void }) {
  const t = useT();
  const [label, setLabel] = useState(account.label);
  const trimmed = label.trim();
  return <form className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-3)] p-3" onSubmit={event => { event.preventDefault(); if (trimmed && trimmed !== account.label) onSave(trimmed); }}>
    <input aria-label={t("accounts.rename.ariaLabel", { label: account.label })} autoFocus maxLength={80} className={`${input} min-w-0 flex-1`} value={label} disabled={locked} onChange={event => setLabel(event.target.value)} />
    <button type="submit" className={button} disabled={locked || !trimmed || trimmed === account.label}>{t("accounts.actions.save")}</button>
    <button type="button" className={button} disabled={locked} onClick={onCancel}>{t("accounts.actions.cancel")}</button>
  </form>;
}

function MovePanel({ account, teams, locked, onConfirm, onCancel }: {
  account: ProviderAccount; teams: AccountTeam[]; locked: boolean; onConfirm: (team: AccountTeam) => void; onCancel: () => void;
}) {
  const t = useT();
  const [teamId, setTeamId] = useState(teams[0].id);
  const team = teams.find(item => item.id === teamId);
  const teamName = teams.length === 1 ? teams[0].name : t("accounts.move.aTeam");
  return <div className="mt-3 space-y-2 rounded-lg bg-[var(--surface-3)] p-3">
    <p className="text-xs">{t("accounts.move.title", { label: account.label, team: teamName })}</p>
    <p className="text-xs text-[var(--text-tertiary)]">{account.native
      ? `${t("accounts.move.nativeDetail.teamCanUse")} ${t("accounts.move.nativeDetail.staysSignedIn")}`
      : t("accounts.move.detail")}</p>
    {teams.length > 1 && <ChoiceGroup label={t("accounts.move.teamFor", { label: account.label })} value={teamId} onChange={setTeamId} disabled={locked}
      choices={teams.map(item => ({ value: item.id, label: item.name }))} />}
    <div className="flex gap-2">
      <button className={button} disabled={locked || !team} onClick={() => team && onConfirm(team)}>{t("accounts.move.confirm")}</button>
      <button className={button} disabled={locked} onClick={onCancel}>{t("accounts.actions.cancel")}</button>
    </div>
  </div>;
}
