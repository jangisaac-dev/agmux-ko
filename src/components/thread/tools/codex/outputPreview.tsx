import { useState } from "react";
import { useT } from "../../../../i18n";

export const OUTPUT_PREVIEW_CHARS = 64_000;

/** Keep the initial DOM bounded; every saved character remains reachable. */
export function CodexTextPreview({ text, label = "output" }: { text: string; label?: "command" | "output" }) {
  const t = useT();
  const [limit, setLimit] = useState(OUTPUT_PREVIEW_CHARS);
  const remaining = Math.max(0, text.length - limit);
  return (
    <>
      {text.slice(0, limit)}
      {remaining > 0 && (
        <span className="mt-1 block text-[var(--text-muted)]">
          <span>{t("tools.codexPreview.moreCharacters", { count: remaining })}</span>{" · "}
          <button
            type="button"
            aria-label={t("tools.codexPreview.showMoreLabel", { label: t(label === "command" ? "tools.codexPreview.command" : "tools.codexPreview.output") })}
            onClick={() => setLimit((previous) => previous + OUTPUT_PREVIEW_CHARS)}
            className="text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]"
          >
            {t("tools.showMore")}
          </button>
        </span>
      )}
    </>
  );
}
