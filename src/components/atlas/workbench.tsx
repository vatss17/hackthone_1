"use client";

import Link from "next/link";
import { useState } from "react";
import { History, ShieldCheck, Wrench } from "lucide-react";
import { AtlasChat } from "@/components/atlas/atlas-chat";
import { useActivity } from "@/components/atlas/use-atlas-store";
import { INTENTS, INTENT_BY_ID } from "@/lib/atlas/intents";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_NAMES } from "@/lib/i18n/config";


/** The AI Action Workbench: the copilot at full width, every tool it can run, and what it has run in this browser. */
export function Workbench({ scope, products }: { scope: string; products: { id: string; name: string }[] }) {
  const { t, locale } = useI18n();
  const when = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : LOCALE_NAMES[locale].bcp47, { dateStyle: "medium", timeStyle: "short" });
  const [log] = useActivity(scope);
  const [seed, setSeed] = useState<{ key: string; prompt: string; ref?: string | null } | null>(null);
  const name = (ref: string | null) => (ref ? products.find((p) => p.id === ref)?.name ?? null : null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label={t("Atlas AI")} className="flex h-[min(78vh,52rem)] min-h-[32rem] flex-col rounded-lg border bg-card p-4 sm:p-5">
        <AtlasChat scope={scope} products={products} contextRef={null} seed={seed} />
      </section>

      <aside className="flex flex-col gap-5">
        <section aria-labelledby="tools-h" className="rounded-lg border bg-card p-4">
          <h2 id="tools-h" className="flex items-center gap-2 text-sm font-semibold">
            <Wrench aria-hidden className="size-4 text-(--brand-teal)" /> {t("Tools Atlas can run")}
          </h2>
          <ul className="mt-2 flex flex-col divide-y">
            {INTENTS.map((i) => (
              <li key={i.id} className="py-2">
                <button type="button" onClick={() => setSeed({ key: `${Date.now()}`, prompt: t(i.prompt) })} className="text-left text-[13px] font-medium text-link underline-offset-2 hover:underline">
                  {t(i.prompt)}
                </button>
                <p className="text-xs text-muted-foreground">{t(i.does)}</p>
                {i.proposesChange && <p className="mt-0.5 text-[11px] font-medium text-(--status-ai-fg)">{t("Asks for your approval")}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="hist-h" className="rounded-lg border bg-card p-4">
          <h2 id="hist-h" className="flex items-center gap-2 text-sm font-semibold">
            <History aria-hidden className="size-4 text-(--brand-teal)" /> {t("History")}
          </h2>
          {log.length ? (
            <ol className="mt-2 flex max-h-96 flex-col divide-y overflow-y-auto">
              {log.map((a) => (
                <li key={a.id} className="py-2 text-[13px]">
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {INTENT_BY_ID[a.intent] ? t(INTENT_BY_ID[a.intent].prompt) : a.intent}
                    {name(a.ref) ? ` · ${name(a.ref)}` : ""} · {a.at ? when.format(new Date(a.at)) : ""}
                  </p>
                  {INTENT_BY_ID[a.intent]?.proposesChange && (
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{a.decision === "approved" ? t("Approved") : a.decision === "declined" ? t("Declined") : t("Not answered")}</p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">{t("Nothing yet. What Atlas runs is listed here, in this browser only.")}</p>
          )}
        </section>

        <section aria-labelledby="rules-h" className="rounded-lg border bg-card p-4 text-[13px]">
          <h2 id="rules-h" className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck aria-hidden className="size-4 text-(--brand-teal)" /> {t("How Atlas AI works")}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
            <li>{t("Every figure comes from an Atlas engine run on your own data. The AI never makes up a number.")}</li>
            <li>{t("Sources are shown only where a researched answer has them, with the date it was researched.")}</li>
            <li>{t("Atlas never submits, files, sends or buys anything. Changes wait for your approval.")}</li>
            <li>{t("It invents no buyers, approvals or trade statistics.")}</li>
          </ul>
          <Link href="/mission" className="mt-3 inline-block font-medium text-link underline-offset-2 hover:underline">
            {t("See your plan in Mission Control")}
          </Link>
        </section>
      </aside>
    </div>
  );
}
