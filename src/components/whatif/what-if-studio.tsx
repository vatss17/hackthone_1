"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RotateCcw, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { calculate, freightHeadroomPct, validateInputs } from "@/lib/landed-cost/calc";
import { applyScenario, scenarioApplicable, verdictFor, VERDICT_LABEL } from "@/lib/landed-cost/scenarios";
import type { Inputs, Result, Scenario } from "@/lib/landed-cost/types";
import type { WorkspaceFacts } from "@/lib/workspace/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import type { Tr } from "@/lib/landed-cost/labels";

const levers = (t: Tr): { key: "pricePct" | "freightPct" | "costPct" | "fxPct"; label: string; min: number; max: number; hint: string }[] => [
  { key: "pricePct", label: t("Selling price"), min: -30, max: 50, hint: t("What the buyer pays per unit") },
  { key: "freightPct", label: t("International freight"), min: -50, max: 150, hint: t("Ocean or air freight for the consignment") },
  { key: "costPct", label: t("Production cost"), min: -30, max: 30, hint: t("Ex-factory cost of one unit") },
  { key: "fxPct", label: t("Exchange rate (INR per AED)"), min: -15, max: 15, hint: t("A weaker rupee is a positive change") },
];

const ZERO = { pricePct: 0, freightPct: 0, costPct: 0, fxPct: 0, preferentialDuty: false };
const aed = (n: number) => `AED ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number | null) => (n === null ? "n/a" : `${n.toFixed(1)}%`);
const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${unit}`;

/** The cost of one unit, split into the parts that move with each lever. */
function stack(r: Result, t: Tr) {
  const per = (g: string[]) => r.lines.filter((l) => g.includes(l.group)).reduce((s, l) => s + l.perUnitInr, 0) / r.inrPerAed;
  return [
    { id: "prod", label: t("Production"), aed: per(["Production"]) },
    { id: "pack", label: t("Packaging and origin"), aed: per(["Packaging", "Origin logistics"]) },
    { id: "intl", label: t("International"), aed: per(["International"]) },
    { id: "dest", label: t("Destination and other"), aed: per(["Destination", "Other"]) },
    { id: "duty", label: t("Duty"), aed: per(["Duty"]) },
  ];
}
const COLORS: Record<string, string> = { prod: "#16233f", pack: "#3b4a6b", intl: "#1f6f6b", dest: "#7fa9a5", duty: "#c08a3e" };

/**
 * What-If Studio. Every change here is a hypothetical over your saved calculator values: nothing is saved until you
 * choose "Save as scenario", and even then only the scenario is added, never a change to your own numbers.
 */
export function WhatIfStudio({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const t = useT();
  const LEVERS = levers(t);
  const { assessment, update, hydrated } = useAssessment({ scope, assessmentRef: facts.ref, defaults });
  const reduce = useReducedMotion();
  const [s, setS] = useState(ZERO);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  const base = assessment.inputs;
  const sample = assessment.edited.length === 0;
  const valid = Object.keys(validateInputs(base).errors).length === 0;
  const scenario: Scenario = { id: "whatif", name: "What-if", kind: "custom", ...s };
  const tried = applyScenario(base, scenario);
  const triedValid = valid && Object.keys(validateInputs(tried).errors).length === 0;
  const dutyOk = scenarioApplicable(base, { ...scenario, preferentialDuty: true }).applicable;

  if (!valid) {
    return (
      <p className="rounded-lg border bg-card p-5 text-sm">
        {t("Your calculator has values it cannot use yet.")}{" "}
        <Link href={`/viability?product=${facts.ref}`} className="font-medium text-link underline underline-offset-2">
          {t("Fix them in Export Economics")}
        </Link>{" "}
        {t("first.")}
      </p>
    );
  }

  const r0 = calculate(base);
  const r1 = triedValid ? calculate(tried) : null;
  const v0 = verdictFor(r0, base.targetMarginPercent);
  const v1 = r1 ? verdictFor(r1, base.targetMarginPercent) : null;
  const headroom = freightHeadroomPct(base);
  const s0 = stack(r0, t);
  const s1 = r1 ? stack(r1, t) : null;
  const top = Math.max(r0.landedPerUnitAed, r1?.landedPerUnitAed ?? 0, base.sellingPriceAed, tried.sellingPriceAed) * 1.08;
  const changed = JSON.stringify(s) !== JSON.stringify(ZERO);

  const saveScenario = () => {
    const label = name.trim() || t("My what-if");
    update((a) => ({ ...a, scenarios: [...a.scenarios, { ...scenario, id: `custom-${Date.now().toString(36)}`, name: label.slice(0, 60) }] }));
    setSaved(label);
    setConfirm(false);
    setName("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" aria-busy={!hydrated}>
      <section aria-labelledby="levers-h" className="rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="levers-h" className="text-[15px] font-semibold">{t("Move the levers")}</h2>
          <button type="button" onClick={() => setS(ZERO)} disabled={!changed} className="inline-flex items-center gap-1 text-xs font-medium text-link disabled:text-muted-foreground">
            <RotateCcw aria-hidden className="size-3" /> {t("Reset")}
          </button>
        </div>
        {sample && <p className="mt-2 rounded bg-(--status-estimate-bg) px-2.5 py-1.5 text-xs text-(--status-estimate-fg)">{t("Your calculator still holds sample values. These what-ifs are illustrations until you enter your own.")}</p>}
        <div className="mt-4 flex flex-col gap-5">
          {LEVERS.map((l) => (
            <label key={l.key} className="block">
              <span className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{l.label}</span>
                <output className={cn("tnum text-sm font-semibold", s[l.key] > 0 ? "text-(--brand-teal)" : s[l.key] < 0 ? "text-(--status-missing-fg)" : "text-muted-foreground")}>{signed(s[l.key], "%")}</output>
              </span>
              <input type="range" min={l.min} max={l.max} step={1} value={s[l.key]} onChange={(e) => setS({ ...s, [l.key]: Number(e.target.value) })} className="mt-2 w-full accent-(--brand-teal)" aria-describedby={`${l.key}-hint`} />
              <span id={`${l.key}-hint`} className="text-xs text-muted-foreground">{l.hint}</span>
            </label>
          ))}
          <label className={cn("flex items-start gap-2 text-sm", !dutyOk && "opacity-60")}>
            <input type="checkbox" checked={s.preferentialDuty} disabled={!dutyOk} onChange={(e) => setS({ ...s, preferentialDuty: e.target.checked })} className="mt-1 accent-(--brand-teal)" />
            <span>
              <span className="font-medium">{t("Use the hypothetical preferential duty rate")}</span>
              <span className="block text-xs text-muted-foreground">{dutyOk ? t("{preferential}% instead of {ordinary}%. A scenario only, never a finding that your product qualifies.", { preferential: base.duty.preferentialRatePercent, ordinary: base.duty.ratePercent }) : t("Your preferential rate is not lower than the ordinary rate, so this would change nothing.")}</span>
            </span>
          </label>
        </div>
        {headroom !== null && (
          <p className="mt-5 rounded-md bg-muted px-3 py-2 text-xs leading-relaxed">
            <span className="font-semibold">{t("Freight headroom:")} </span>
            {headroom === 0 ? t("you are already at or below break-even, before any freight increase.") : Number.isFinite(headroom) ? t("international freight can rise about {pct}% before this consignment makes a loss.", { pct: headroom.toFixed(0) }) : t("freight changes cannot cause a loss with these settings.")}
          </p>
        )}
      </section>

      <section aria-labelledby="out-h" className="flex flex-col gap-5">
        <div className="rounded-lg border bg-card p-5">
          <h2 id="out-h" className="text-[15px] font-semibold">{t("Base case against your what-if")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { id: "base", label: t("Base case"), r: r0, v: v0, price: base.sellingPriceAed },
              { id: "whatif", label: t("What-if"), r: r1, v: v1, price: tried.sellingPriceAed },
            ].map((c) => (
              <div key={c.id} className={cn("rounded-md border p-3", c.id === "whatif" && changed && "border-(--brand-teal) bg-selected/60")}>
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                {c.r ? (
                  <>
                    <p className="mt-1 text-xl font-semibold tnum">{pct(c.r.grossMarginPct)}</p>
                    <p className="text-xs text-muted-foreground">{t("gross margin")}</p>
                    <dl className="mt-2 space-y-0.5 text-xs">
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("Landed / unit")}</dt><dd className="tnum font-medium">{aed(c.r.landedPerUnitAed)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("Price / unit")}</dt><dd className="tnum font-medium">{aed(c.price)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("Profit / unit")}</dt><dd className={cn("tnum font-medium", c.r.profitPerUnitAed < 0 && "text-(--status-missing-fg)")}>{aed(c.r.profitPerUnitAed)}</dd></div>
                    </dl>
                    {c.v && <p className={cn("mt-2 text-xs font-medium", c.v === "loss" ? "text-(--status-missing-fg)" : c.v === "meets_target" ? "text-(--status-verified-fg)" : "text-(--status-estimate-fg)")}>{t(VERDICT_LABEL[c.v])}</p>}
                  </>
                ) : (
                  <p className="mt-2 flex gap-1.5 text-xs text-(--status-missing-fg)"><TriangleAlert aria-hidden className="size-3.5" /> {t("These changes make an input invalid.")}</p>
                )}
              </div>
            ))}
          </div>
          {r1 && changed && (
            <p className="mt-3 text-sm" role="status">
              {t("Margin {margin}, profit {profit} AED on the consignment.", { margin: signed(Number(((r1.grossMarginPct ?? 0) - (r0.grossMarginPct ?? 0)).toFixed(2)), " " + t("points")), profit: signed(Number((r1.grossProfitAed - r0.grossProfitAed).toFixed(0))) })}
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold">{t("Where each AED of a unit goes")}</h3>
          <div className="mt-4 flex flex-col gap-4">
            {[
              { id: "base", label: t("Base"), parts: s0, price: base.sellingPriceAed },
              ...(s1 ? [{ id: "whatif", label: t("What-if"), parts: s1, price: tried.sellingPriceAed }] : []),
            ].map((row) => (
              <div key={row.id}>
                <p className="mb-1 text-xs text-muted-foreground">{row.label}</p>
                <div className="relative h-8 w-full rounded bg-muted">
                  <div className="absolute inset-0 flex overflow-hidden rounded">
                    {row.parts.map((p) => (
                      <motion.span key={p.id} title={`${p.label}: ${aed(p.aed)}`} className="h-full" style={{ background: COLORS[p.id] }} initial={false} animate={{ width: `${(Math.max(0, p.aed) / top) * 100}%` }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 24 }} />
                    ))}
                  </div>
                  <motion.span aria-hidden className="absolute inset-y-[-4px] w-0.5 bg-foreground" initial={false} animate={{ left: `${(row.price / top) * 100}%` }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 160, damping: 24 }} />
                </div>
              </div>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {s0.map((p) => (
              <li key={p.id} className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: COLORS[p.id] }} />{p.label}</li>
            ))}
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-0.5 bg-foreground" />{t("Selling price")}</li>
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-5">
          {confirm ? (
            <div>
              <p className="text-sm font-semibold">{t("Save this what-if as a scenario?")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("It is added to the scenarios in Export Economics. Your own calculator values do not change.")}</p>
              <label className="mt-3 block text-sm">
                <span className="font-medium">{t("Name")}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t("My what-if")} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={saveScenario}>{t("Approve and save")}</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm(false)}>{t("Cancel")}</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{saved ? t("Saved \"{name}\" to your scenarios.", { name: saved }) : t("Nothing here is saved unless you choose to.")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/viability?product=${facts.ref}`}>{t("Open Export Economics")}</Link>
                </Button>
                <Button size="sm" disabled={!changed || !r1} onClick={() => setConfirm(true)}>
                  <Save aria-hidden /> {t("Save as scenario")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
