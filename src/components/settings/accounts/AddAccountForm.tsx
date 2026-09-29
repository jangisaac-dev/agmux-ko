import { ArrowUpRight } from "lucide-react";
import { useT } from "../../../i18n";
import type { AccountProvider, AccountTeam } from "../../../lib/providerAccounts";
import { ChoiceGroup } from "./ChoiceGroup";
import { input, primaryButton } from "./styles";

export const providerNames: Record<AccountProvider, string> = { claude: "Claude", codex: "Codex", grok: "Grok" };

/** Opened from a section: `team` is null for your own accounts. Claude accounts are personal only. */
export function AddAccountForm({ provider, setProvider, team, label, setLabel, locked, onSignIn, onCancel }: {
  provider: AccountProvider; setProvider: (provider: AccountProvider) => void; team: AccountTeam | null;
  label: string; setLabel: (label: string) => void; locked: boolean; onSignIn: () => void; onCancel: (() => void) | null;
}) {
  const t = useT();
  return (
    <div className="space-y-3 rounded-xl border border-[var(--accent-border)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{team ? t("accounts.add.titleForTeam", { team: team.name }) : t("accounts.add.titleForSelf")}</h4>
        {onCancel && <button className="min-h-8 px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-50" disabled={locked} onClick={onCancel}>{t("accounts.actions.cancel")}</button>}
      </div>
      <p className="text-xs text-[var(--text-tertiary)]">{team
        ? `${t("accounts.add.teamDetail.signInOnce")} ${t("accounts.add.teamDetail.availableToTeam", { team: team.name })} ${t("accounts.add.teamDetail.claudeCannotBeShared")}`
        : `${t("accounts.add.selfDetail.onlyYou")} ${t("accounts.add.selfDetail.automaticSwitching")}`}</p>
      <ChoiceGroup label={t("accounts.add.providerLabel")} value={provider} onChange={setProvider} disabled={locked}
        choices={(["claude", "codex", "grok"] as const).filter(value => !team || value !== "claude").map(value => ({ value, label: providerNames[value] }))} />
      <input aria-label={t("accounts.add.labelAriaLabel")} placeholder={t("accounts.add.namePlaceholder")} maxLength={80} className={`${input} w-full`} value={label} disabled={locked} onChange={event => setLabel(event.target.value)} />
      <button className={primaryButton} disabled={locked} onClick={onSignIn}><ArrowUpRight size={14} />{t("accounts.add.signInWithBrowser")}</button>
    </div>
  );
}
