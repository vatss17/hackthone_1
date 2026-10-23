"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleCheck, FileText, Factory, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T, useT } from "@/lib/i18n/client";

const EASE = [0.22, 1, 0.36, 1] as const;

function Lane({ reduce }: { reduce: boolean }) {
  const t = useT();
  return (
    <svg viewBox="0 0 520 300" className="h-auto w-full" role="img" aria-label={t("A shipping lane from a port in western India to a port in the UAE")}>
      <defs>
        <linearGradient id="lane" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand-navy)" />
          <stop offset="1" stopColor="var(--brand-teal)" />
        </linearGradient>
      </defs>
      {/* Coast hints: two short strokes, not a map. */}
      <path d="M420 250c10-40 6-88 30-126" fill="none" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 80c30 12 52 36 64 72" fill="none" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
      <motion.path
        d="M438 196C360 120 220 92 102 116"
        fill="none"
        stroke="url(#lane)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
      />
      <g>
        <circle cx="438" cy="196" r="6" fill="var(--brand-navy)" />
        <text x="438" y="224" textAnchor="middle" className="fill-foreground text-[13px] font-medium">{t("Mundra · India")}</text>
      </g>
      <g>
        <motion.circle cx="102" cy="116" r="6" fill="var(--brand-teal)" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.7, duration: 0.3 }} />
        <text x="102" y="100" textAnchor="middle" className="fill-foreground text-[13px] font-medium">{t("Jebel Ali · UAE")}</text>
      </g>
      {!reduce && (
        <motion.circle r="4" fill="var(--brand-teal)" initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }} transition={{ duration: 3.2, repeat: Infinity, ease: "linear", delay: 2 }} style={{ offsetPath: "path('M438 196C360 120 220 92 102 116')" }} />
      )}
    </svg>
  );
}

export function Hero() {
  const t = useT();
  /** Three real states of a product's journey, shown in turn in the hero. Sample data, labelled. */
  const STATES = [
    { id: "fit", icon: Factory, k: t("Fit"), title: t("Hangers and laundry products"), line: t("Strong capability fit · you run injection moulding and PP"), meta: t("From your declared machines") },
    { id: "economics", icon: Scale, k: t("Economics"), title: t("Landed cost AED 4.46 per unit"), line: t("Margin 25.7% at AED 6.00 · freight is the biggest swing"), meta: t("Sample inputs") },
    { id: "documents", icon: FileText, k: t("Documents"), title: t("Commercial invoice, draft"), line: t("9 fields left · rows and totals agree"), meta: t("Draft, review required") },
  ];
  const reduce = !!useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((x) => (x + 1) % 3), 3400);
    return () => clearInterval(t);
  }, [reduce]);
  const s = STATES[i];

  return (
    <section className="grid items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14 lg:pb-24 lg:pt-20">
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="min-w-0">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-[13px] text-muted-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-teal" />
          <T>Export operating system for Indian manufacturers</T>
        </p>
        <h1 className="mt-5 max-w-xl text-[2.375rem] font-semibold leading-[1.04] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-[4rem]">
          <T>Your factory.</T>
          <br />
          <T>The world.</T>
          <br />
          <span className="text-brand-teal"><T>One intelligent platform.</T></span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">{t("Atlas maps what your factory can make to where it can sell, works out the economics and the paperwork, and prepares the next steps for you to approve.")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/signup">{t("Start with your factory")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link href="#try">
              {t("Try it with your products")} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground">{t("Live today for finished plastic products, India to the UAE. No account needed to try it.")}</p>
      </motion.div>

      <motion.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.15 }} className="relative min-w-0">
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <Lane reduce={reduce} />
          <div className="-mt-4 rounded-xl border bg-background p-4" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1" role="tablist" aria-label={t("Journey stage shown")}>
                {STATES.map((x, n) => (
                  <button key={x.id} role="tab" aria-selected={n === i} onClick={() => setI(n)} className={`min-h-9 rounded-md px-2.5 text-[13px] font-medium transition-colors ${n === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                    {x.k}
                  </button>
                ))}
              </div>
              <span className="rounded border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1.5 text-xs font-medium text-(--status-estimate-fg)">{t("Sample data")}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={s.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mt-4 flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-selected text-brand-teal"><s.icon aria-hidden className="size-5" /></span>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.line}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground"><CircleCheck aria-hidden className="size-3.5" />{s.meta}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
