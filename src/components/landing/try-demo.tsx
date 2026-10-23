"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import { discover, FIT_LABEL } from "@/lib/opportunities/engine";
import type { MaterialCode, ProcessCode } from "@/lib/opportunities/types";
import { factoryInputFromAnswers, materialName, processName, START_MATERIALS, START_PROCESSES } from "@/lib/start/capability";
import { calculate } from "@/lib/landed-cost/calc";
import { sampleInputs } from "@/lib/landed-cost/defaults";
import { formatAed } from "@/lib/landed-cost/format";

const toggle = <T,>(xs: T[], v: T) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]);

/** The visitor picks what they manufacture; the real matching engine and the real calculator answer. Nothing is saved. */
export function TryDemo() {
  const t = useT();
  const reduce = !!useReducedMotion();
  const [proc, setProc] = useState<ProcessCode[]>(["injection_moulding"]);
  const [mat, setMat] = useState<MaterialCode[]>(["PP"]);
  const [price, setPrice] = useState(6);
  const [freight, setFreight] = useState(100000);

  const found = useMemo(() => (proc.length ? discover(factoryInputFromAnswers({ processes: proc, materials: mat, machines: proc.map((p) => ({ processCode: p, size: "" })), products: [] })).adjacent.slice(0, 5) : []), [proc, mat]);
  const r = useMemo(() => {
    const i = sampleInputs();
    return calculate({ ...i, sellingPriceAed: price, lines: { ...i.lines, internationalFreight: { ...i.lines.internationalFreight, amount: freight } } });
  }, [price, freight]);
  const margin = r.grossMarginPct ?? 0;

  return (
    <section id="try" aria-labelledby="try-h" className="scroll-mt-20 border-t py-16 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-[15px] font-medium text-brand-teal">{t("Try it now")}</p>
        <h2 id="try-h" className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{t("What do you manufacture?")}</h2>
        <p className="mt-3 text-lg text-muted-foreground">{t("Pick your processes and materials. The same matching engine and cost model the app uses will answer.")}</p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <fieldset>
            <legend className="text-[15px] font-semibold">{t("Processes")}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {START_PROCESSES.map((p) => (
                <button key={p.code} type="button" aria-pressed={proc.includes(p.code)} onClick={() => setProc(toggle(proc, p.code))} className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors md:min-h-10 ${proc.includes(p.code) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}>{t(processName(p.code))}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-5">
            <legend className="text-[15px] font-semibold">{t("Materials")}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {START_MATERIALS.map((m) => (
                <button key={m.code} type="button" aria-pressed={mat.includes(m.code)} onClick={() => setMat(toggle(mat, m.code))} className={`min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors md:min-h-10 ${mat.includes(m.code) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}>{t(materialName(m.code))}</button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 border-t pt-5" aria-live="polite">
            <p className="text-[15px] font-semibold">{found.length ? (found.length === 1 ? t("{count} product your factory could make", { count: 1 }) : t("{count} products your factory could make", { count: found.length })) : t("Choose at least one process")}</p>
            <ul className="mt-2 divide-y">
              {found.map((m, n) => (
                <motion.li key={m.entry.id} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.05 }} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5">
                  <span className="font-medium">{t(m.entry.name)}</span>
                  <span className="text-[13px] text-muted-foreground">{t(FIT_LABEL[m.level])}</span>
                </motion.li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-muted-foreground">{t("Manufacturing fit only, from the rules in the app. It is not demand.")}</p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <p className="text-[15px] font-semibold">{t("What-if: would it pay?")}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("Sample consignment of 20,000 units. Move the sliders; the result is calculated, not animated.")}</p>
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="flex justify-between text-sm"><span>{t("Your selling price per unit")}</span><span className="tnum font-medium">{formatAed(price)}</span></span>
              <input type="range" min={3} max={12} step={0.25} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand-navy)]" />
            </label>
            <label className="block">
              <span className="flex justify-between text-sm"><span>{t("Sea freight for the shipment")}</span><span className="tnum font-medium">INR {freight.toLocaleString("en-IN")}</span></span>
              <input type="range" min={40000} max={1200000} step={10000} value={freight} onChange={(e) => setFreight(Number(e.target.value))} className="mt-2 w-full accent-[var(--brand-navy)]" />
            </label>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
            {[["landed", t("Landed cost"), formatAed(r.landedPerUnitAed)], ["margin", t("Margin"), `${margin.toFixed(1)}%`], ["breakeven", t("Break-even"), formatAed(r.breakEvenPriceAed)]].map(([id, k, v]) => (
              <div key={id} className="min-w-0 bg-background px-3 py-3">
                <dt className="text-[13px] text-muted-foreground">{k}</dt>
                <dd className={`tnum text-lg font-semibold ${id === "margin" && margin < 0 ? "text-error" : ""}`}>{v}{id === "margin" && margin < 0 ? ` ${t("loss")}` : ""}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] text-muted-foreground">{t("Sample costs and an assumed 5% duty. Not a quote.")}</p>
          <div className="mt-5"><Button asChild><Link href="/signup">{t("Run this with your own numbers")}</Link></Button></div>
        </div>
      </div>
    </section>
  );
}
