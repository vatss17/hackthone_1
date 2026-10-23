"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { DEPARTMENTS } from "@/lib/landing/departments";

/** "Services by department": one card per department, listing the sub-services the header menu points to. */
export function Services() {
  const t = useT();
  return (
    <section id="services" aria-labelledby="services-h" className="scroll-mt-20 border-t py-16 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-[15px] font-medium text-brand-teal">{t("What Atlas does")}</p>
        <h2 id="services-h" className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{t("Services by department")}</h2>
        <p className="mt-3 text-lg text-muted-foreground">{t("Six departments, one workspace. Market data, regulatory facts and scheme rules are researched drafts: confirm them with people before you act. Nothing here is an official approval.")}</p>
      </div>
      <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEPARTMENTS.map((d) => (
          <li key={d.id} id={`dept-${d.id}`} className="flex min-w-0 scroll-mt-24 flex-col rounded-xl border bg-card p-5 target:border-primary">
            <h3 className="text-lg font-semibold">{t(d.title)}</h3>
            <p className="mt-1 text-[15px] text-muted-foreground">{t(d.summary)}</p>
            <ul className="mt-4 flex-1 divide-y border-t">
              {d.services.map((s) => (
                <li key={s.title} className="min-w-0 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 text-[15px] font-medium">{t(s.title)}</span>
                    <span className={`shrink-0 text-xs font-medium ${s.tag === "live" ? "text-success" : "text-warning"}`}>{s.tag === "live" ? t("Live now") : t("Researched draft")}</span>
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t(s.line)}</p>
                </li>
              ))}
            </ul>
            <Link href={d.tryHref} className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-primary hover:underline md:min-h-9">
              {t("Try it")}<ArrowRight aria-hidden className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
