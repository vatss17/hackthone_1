"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";
import { useAtlas } from "@/components/atlas/atlas-provider";
import { INTENTS, type IntentId } from "@/lib/atlas/intents";
import { useT } from "@/lib/i18n/client";

/** Quick Atlas AI prompts. Each one opens the copilot and runs that tool straight away. */
export function AskPanel({ ids, refFor, title }: { ids?: IntentId[]; refFor?: string | null; title?: string }) {
  const t = useT();
  const { openCopilot } = useAtlas();
  const list = ids ? INTENTS.filter((i) => ids.includes(i.id)) : INTENTS;
  return (
    <section aria-labelledby="ask-h" className="rounded-lg bg-[var(--brand-navy)] p-5 text-white">
      <h2 id="ask-h" className="flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles aria-hidden className="size-4 text-(--brand-teal-light)" /> {title ? t(title) : t("Ask Atlas AI")}
      </h2>
      <p className="mt-1 text-[13px] text-white/70">{t("Runs a real tool on your data and shows each step. Asks before it changes anything.")}</p>
      <ul className="mt-4 flex flex-col gap-1.5">
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => openCopilot(t(i.prompt), refFor)} className="group flex w-full items-center justify-between gap-3 rounded-md bg-white/[0.06] px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-teal-light)">
              {t(i.prompt)}
              <ArrowUpRight aria-hidden className="size-4 shrink-0 text-white/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
