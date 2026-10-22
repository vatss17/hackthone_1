"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/auth/notice";
import { StatusBadge } from "@/components/status-badge";
import { CostBreakdown, MarginBars, Tornado } from "@/components/landed-cost/charts";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { LINE_LABELS, calculate, freightHeadroomPct, sensitivities, validateInputs } from "@/lib/landed-cost/calc";
import { DEFAULT_SCENARIOS, VERDICT_LABEL, applyScenario, compareScenarios, type ScenarioRow } from "@/lib/landed-cost/scenarios";
import { formatAed, formatInr, formatNumber, formatPct, formatSigned } from "@/lib/landed-cost/format";
import type { Assessment } from "@/lib/landed-cost/assessment";
import type { Basis, Inputs, LineKey, Result, Scenario } from "@/lib/landed-cost/types";
import { cn } from "@/lib/utils";

const BASIS_LABEL: Record<Basis, string> = {
  per_consignment: "per consignment",
  per_unit: "per unit",
  per_carton: "per carton",
  per_kg: "per kg (gross)",
  per_cbm: "per cubic metre",
  percent_of_goods: "% of goods value",
};

const LINE_HINT: Partial<Record<LineKey, string>> = {
  packaging: "Cartons, inner packs, labels. Counted once here, not inside production cost.",
  internationalFreight: "Sea, air or road freight from India to the UAE. The usual biggest swing.",
  insurance: "Cargo insurance. Often a small percentage of goods value.",
  destinationClearing: "Port, clearing agent and handling charges in the UAE.",
  otherDestination: "Anything else you pay in the UAE, for example inland delivery to your buyer.",
  otherCharges: "Any other charge, in India or shared, not listed above.",
};

type Path = string;

function getIn(obj: unknown, path: Path): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | null)?.[k], obj);
}

function setIn<T>(obj: T, path: Path, value: unknown): T {
  const [head, ...rest] = path.split(".");
  const o = obj as Record<string, unknown>;
  return { ...o, [head]: rest.length === 0 ? value : setIn(o[head], rest.join("."), value) } as T;
}

/** Parses what a person typed. Commas are allowed as thousands separators. */
function parseNumber(s: string): number | null {
  const t = s.replace(/[,\s]/g, "");
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const inputText = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function LandedCostWorkspace({
  scope,
  assessmentRef,
  defaults,
  factFields,
  subjectName,
}: {
  scope: string;
  assessmentRef: string;
  defaults: Inputs;
  /** Fields whose starting value came from the user's own product record. */
  factFields: string[];
  subjectName: string | null;
}) {
  const { assessment, hydrated, saved, update, reset, importJson } = useAssessment({ scope, assessmentRef, defaults });
  const [drafts, setDrafts] = useState<Record<Path, string>>({});
  const [bad, setBad] = useState<Record<Path, boolean>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const i = assessment.inputs;
  const edited = new Set(assessment.edited);
  const validation = validateInputs(i);
  const valid = Object.keys(validation.errors).length === 0;
  const result = valid ? calculate(i) : null;

  const change = (path: Path, value: unknown) =>
    update((a) => ({ ...a, inputs: setIn(a.inputs, path, value), edited: a.edited.includes(path) ? a.edited : [...a.edited, path] }));

  const tag = (path: Path) =>
    edited.has(path) ? null : (
      <span className="rounded-sm border border-dashed border-amber/60 px-1 text-[10px] font-medium uppercase tracking-wide text-amber-text">{factFields.includes(path) ? "From product" : "Sample"}</span>
    );

  /** A numeric input. Typing never loses text: the model only changes when the text is a valid number. */
  const num = (path: Path, label: string, opts: { suffix?: string; hint?: string; optional?: boolean; integer?: boolean } = {}) => {
    const id = `f-${path.replace(/\./g, "-")}`;
    const value = getIn(i, path);
    const draft = drafts[path];
    const err = validation.errors[path] ?? (bad[path] ? "Enter a number, for example 12.5" : undefined);
    return (
      <div className="grid gap-1.5" key={path}>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          {tag(path)}
        </div>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            inputMode={opts.integer ? "numeric" : "decimal"}
            autoComplete="off"
            value={draft ?? inputText(value)}
            aria-invalid={err ? true : undefined}
            aria-describedby={[opts.hint ? `${id}-h` : "", err ? `${id}-e` : ""].filter(Boolean).join(" ") || undefined}
            onChange={(e) => {
              const text = e.target.value;
              setDrafts((d) => ({ ...d, [path]: text }));
              if (text.trim() === "" && opts.optional) {
                setBad((b) => ({ ...b, [path]: false }));
                change(path, null);
                return;
              }
              const n = parseNumber(text);
              if (n === null) {
                setBad((b) => ({ ...b, [path]: true }));
                return;
              }
              setBad((b) => ({ ...b, [path]: false }));
              change(path, n);
            }}
            onBlur={() => {
              setDrafts((d) => {
                const { [path]: _drop, ...rest } = d;
                void _drop;
                return rest;
              });
              setBad((b) => ({ ...b, [path]: false }));
            }}
          />
          {opts.suffix && <span className="shrink-0 text-xs text-muted-foreground">{opts.suffix}</span>}
        </div>
        {opts.hint && !err && (
          <p id={`${id}-h`} className="text-xs text-muted-foreground">
            {opts.hint}
          </p>
        )}
        {err && (
          <p id={`${id}-e`} className="text-xs font-medium text-destructive">
            {err}
          </p>
        )}
      </div>
    );
  };

  const select = (path: Path, label: string, options: { value: string; label: string }[], opts: { hint?: string } = {}) => {
    const id = `f-${path.replace(/\./g, "-")}`;
    return (
      <div className="grid gap-1.5" key={path}>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          {tag(path)}
        </div>
        <select
          id={id}
          value={String(getIn(i, path))}
          onChange={(e) => change(path, e.target.value)}
          className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:text-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {opts.hint && <p className="text-xs text-muted-foreground">{opts.hint}</p>}
      </div>
    );
  };

  const lineRow = (key: LineKey) => {
    const p = `lines.${key}`;
    const l = i.lines[key];
    const total = result?.lines.find((x) => x.key === key)?.totalInr;
    const bases = (Object.keys(BASIS_LABEL) as Basis[]).filter((b) => b !== "percent_of_goods" || key === "insurance");
    return (
      <div key={key} className="rounded-md border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{LINE_LABELS[key]}</h4>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{total !== undefined ? `= ${formatInr(total)}` : ""}</span>
        </div>
        {LINE_HINT[key] && <p className="mt-0.5 text-xs text-muted-foreground">{LINE_HINT[key]}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_6.5rem_1fr]">
          {num(`${p}.amount`, l.basis === "percent_of_goods" ? "Percentage" : "Amount", { suffix: l.basis === "percent_of_goods" ? "%" : l.currency })}
          {l.basis === "percent_of_goods" ? <div /> : select(`${p}.currency`, "Currency", [{ value: "INR", label: "INR" }, { value: "AED", label: "AED" }])}
          {select(`${p}.basis`, "Charged", bases.map((b) => ({ value: b, label: BASIS_LABEL[b] })))}
        </div>
        {validation.errors[`${p}.basis`] && <p className="mt-1 text-xs font-medium text-destructive">{validation.errors[`${p}.basis`]}</p>}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={l.confirmed} onChange={(e) => change(`${p}.confirmed`, e.target.checked)} />
          I hold a quote or invoice for this charge
          <StatusBadge kind={l.confirmed ? "quoted" : "estimate"} className="ml-auto" />
        </label>
      </div>
    );
  };

  const sens = valid ? sensitivities(i, 10) : [];
  const headroom = valid ? freightHeadroomPct(i) : null;
  const rows = valid ? compareScenarios(i, assessment.scenarios) : [];

  const setScenarios = (fn: (s: Scenario[]) => Scenario[]) => update((a: Assessment) => ({ ...a, scenarios: fn(a.scenarios) }));

  type Row = ScenarioRow & { result: Result; delta: NonNullable<ScenarioRow["delta"]> };
  const metricRows: { label: string; lowerIsBetter?: boolean; value: (r: Row) => string; diff: (r: Row) => string }[] = [
    { label: "Landed cost (AED)", lowerIsBetter: true, value: (r) => formatAed(r.result.landedPerUnitAed).replace("AED ", ""), diff: (r) => (r.delta.landedPerUnitAed === 0 ? "" : formatSigned(r.delta.landedPerUnitAed)) },
    { label: "Selling price (AED)", value: (r) => formatAed(applyScenario(i, r.scenario).sellingPriceAed).replace("AED ", ""), diff: (r) => (r.delta.priceAed === 0 ? "" : formatSigned(r.delta.priceAed)) },
    { label: "Gross profit per unit (AED)", value: (r) => formatAed(r.result.profitPerUnitAed).replace("AED ", ""), diff: () => "" },
    { label: "Gross profit, whole consignment (AED)", value: (r) => formatAed(r.result.grossProfitAed).replace("AED ", ""), diff: (r) => (r.delta.profitAed === 0 ? "" : formatSigned(r.delta.profitAed)) },
    { label: "Gross margin", value: (r) => formatPct(r.result.grossMarginPct), diff: (r) => (r.delta.marginPp === null || r.delta.marginPp === 0 ? "" : formatSigned(r.delta.marginPp, " pp")) },
  ];

  const download = () => {
    const blob = new Blob([JSON.stringify(assessment, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export-assessment-${assessmentRef.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unitsText = result ? `${formatNumber(result.units)} units in ${formatNumber(result.cartons)} cartons` : "";

  return (
    <div>
      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {[
          ["inputs", "1. Inputs"],
          ["results", "2. Results"],
          ["scenarios", "3. Compare scenarios"],
          ["sensitivity", "4. What moves the margin"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-4 rounded-md border border-dashed border-amber/60 bg-(--status-estimate-bg) px-4 py-3 text-sm text-(--status-estimate-fg)">
        <p className="font-medium">Read this first</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Starting values marked <span className="font-medium">Sample</span> are illustrations, not quotes, rates or advice. Replace them with your own.</li>
          <li>The exchange rate is a <span className="font-medium">user-entered</span> rate. No live rate is connected.</li>
          <li>The duty rate is an unverified assumption. Preferential duty is hypothetical: eligibility has not been verified.</li>
          <li>Assumptions are saved in this browser only ({hydrated && !saved ? "nothing saved yet" : saved ? "saved" : "…"}). Use Export to keep or share a copy.</li>
        </ul>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* ---------------- inputs ---------------- */}
        <div id="inputs" className="scroll-mt-20 space-y-8">
          <section aria-labelledby="in-consignment">
            <h2 id="in-consignment" className="text-lg font-semibold tracking-tight">
              The consignment
            </h2>
            <div className="mt-3 grid gap-4 rounded-md border bg-card p-4 sm:p-5">
              {subjectName === null && (
                <div className="grid gap-1.5">
                  <Label htmlFor="f-productLabel">Product (a name for your own reference)</Label>
                  <Input id="f-productLabel" value={i.productLabel} maxLength={120} autoComplete="off" onChange={(e) => change("productLabel", e.target.value)} />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                {num("quantity", "Quantity", { integer: true })}
                {select("quantityUnit", "Quantity is in", [{ value: "units", label: "units" }, { value: "cartons", label: "cartons" }])}
                {num("unitsPerCarton", "Units per carton", { integer: true })}
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                {num("cartonGrossWeightKg", "Carton gross weight", { suffix: "kg", optional: true })}
                {num("cartonLengthMm", "Length", { suffix: "mm", optional: true })}
                {num("cartonWidthMm", "Width", { suffix: "mm", optional: true })}
                {num("cartonHeightMm", "Height", { suffix: "mm", optional: true })}
              </div>
              {result && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  {unitsText}
                  {result.grossWeightKg !== null && ` · ${formatNumber(Math.round(result.grossWeightKg))} kg gross`}
                  {result.volumeCbm !== null && ` · ${formatNumber(Math.round(result.volumeCbm * 100) / 100)} m³`}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="in-production">
            <h2 id="in-production" className="text-lg font-semibold tracking-tight">
              Production
            </h2>
            <div className="mt-3 grid gap-4">
              <div className="rounded-md border bg-card p-4 sm:p-5">{num("unitProductionCostInr", "Unit production cost (ex-factory, per unit)", { suffix: "INR", hint: "Material, labour, overhead and your own margin on the factory side, if any. Do not include packaging, freight or duty: they are added below." })}</div>
              {lineRow("packaging")}
            </div>
          </section>

          <section aria-labelledby="in-logistics">
            <h2 id="in-logistics" className="text-lg font-semibold tracking-tight">
              Logistics and charges
            </h2>
            <div className="mt-3 grid gap-4">{(["inlandFreight", "exportHandling", "internationalFreight", "insurance", "destinationClearing", "otherDestination", "otherCharges"] as LineKey[]).map(lineRow)}</div>
          </section>

          <section aria-labelledby="in-commercial">
            <h2 id="in-commercial" className="text-lg font-semibold tracking-tight">
              Commercial
            </h2>
            <div className="mt-3 grid gap-4 rounded-md border bg-card p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {num("sellingPriceAed", "Proposed UAE selling price (per unit)", { suffix: "AED", hint: "What your UAE buyer would pay per unit, on the same terms as the costs you include above." })}
                {num("targetMarginPercent", "Target gross margin", { suffix: "%", hint: "Margin is profit as a share of the selling price. It is not markup." })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {num("inrPerAed", "Exchange rate: INR per 1 AED", { hint: "User-entered exchange rate. Use your bank's rate and note its source and date." })}
                <div className="grid gap-1.5">
                  <Label htmlFor="f-fxNote">Where this rate came from, and its date (optional)</Label>
                  <Input id="f-fxNote" value={i.fxNote} maxLength={200} autoComplete="off" placeholder="e.g. bank quote, 22 Oct 2026" onChange={(e) => change("fxNote", e.target.value)} />
                  <p className="text-xs text-muted-foreground">Shown beside the results so the rate is never mistaken for a live one.</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold">Customs duty and tariff preference</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {num("duty.ratePercent", "Customs duty assumption", { suffix: "%", hint: "An unverified assumption. Confirm the rate for your product's tariff line." })}
                  {select("duty.basis", "Duty is charged on", [{ value: "cif_cost", label: "goods plus costs to the destination port" }, { value: "selling_price", label: "your selling price (invoice value)" }])}
                  {num("duty.preferentialRatePercent", "Hypothetical preferential rate", { suffix: "%", hint: "For a what-if only. It does not mean your product qualifies for any preference." })}
                  <label className="flex items-start gap-2 self-end text-sm">
                    <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={i.duty.applyPreference} onChange={(e) => change("duty.applyPreference", e.target.checked)} />
                    <span>
                      Use the hypothetical preferential rate in the base case
                      <span className="block text-xs text-muted-foreground">Eligibility is not verified. Leave off unless you are testing a what-if.</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-md border bg-card p-4 text-sm sm:p-5" aria-labelledby="keep-h">
            <h2 id="keep-h" className="text-base font-semibold tracking-tight">
              Keep or share this assessment
            </h2>
            <p className="mt-1 text-muted-foreground">Saved automatically in this browser only. It is not stored on our servers and is not visible to anyone else. Export a JSON file to keep or share it; importing replaces what is here.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={download}>
                Export JSON
              </Button>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                Import JSON
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (window.confirm("Reset to the sample values? Your saved inputs for this product will be discarded.")) {
                    reset();
                    setMessage({ tone: "success", text: "Reset to the sample values." });
                  }
                }}
              >
                Reset to samples
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="Import assessment JSON file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 200_000) return setMessage({ tone: "error", text: "That file is too large to be an assessment." });
                  const ok = importJson(await f.text());
                  setMessage(ok ? { tone: "success", text: "Imported. Values were checked and anything invalid was replaced by the sample." } : { tone: "error", text: "That file is not a valid assessment. Nothing was changed." });
                }}
              />
            </div>
            {message && (
              <div className="mt-3">
                <Notice tone={message.tone}>{message.text}</Notice>
              </div>
            )}
          </section>
        </div>

        {/* ---------------- live results ---------------- */}
        <aside id="results" aria-labelledby="res-h" className="scroll-mt-20 lg:sticky lg:top-20">
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 id="res-h" className="text-base font-semibold tracking-tight">
                Results
              </h2>
              <StatusBadge kind="estimate" />
            </div>
            {!result ? (
              <div className="p-4 text-sm">
                <Notice tone="error">Fix the highlighted inputs to see results.</Notice>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                  {Object.values(validation.errors).slice(0, 4).map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-4">
                <dl className="grid gap-3">
                  <Stat label="Landed cost per unit" primary value={formatAed(result.landedPerUnitAed)} sub={formatInr(result.landedPerUnitInr)} />
                  <Stat label="Selling price per unit" value={formatAed(i.sellingPriceAed)} sub={formatInr(i.sellingPriceAed * i.inrPerAed)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      label="Gross margin"
                      primary
                      value={formatPct(result.grossMarginPct)}
                      tone={result.grossProfitInr < 0 ? "bad" : (result.grossMarginPct ?? 0) < i.targetMarginPercent ? "warn" : "good"}
                      sub={`target ${i.targetMarginPercent}%`}
                    />
                    <Stat label="Markup on cost" value={formatPct(result.markupPct)} sub="not the same as margin" />
                  </div>
                  <Stat label="Gross profit" value={formatAed(result.grossProfitAed)} sub={`${formatAed(result.profitPerUnitAed)} per unit`} />
                  <Stat label="Break-even selling price" value={Number.isFinite(result.breakEvenPriceAed) ? formatAed(result.breakEvenPriceAed) : "not reachable"} sub="profit is zero at this price" />
                  <Stat label={`Price for ${i.targetMarginPercent}% margin`} value={result.priceForTargetMarginAed === null ? "not reachable" : formatAed(result.priceForTargetMarginAed)} sub="to hit your target" />
                  <Stat label="Total consignment cost" value={formatInr(result.totalCostInr)} sub={formatAed(result.totalCostAed)} />
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  Exchange rate used: <span className="font-medium text-foreground">1 AED = INR {formatNumber(i.inrPerAed)}</span>, a user-entered rate{i.fxNote.trim() ? ` (${i.fxNote.trim()})` : " with no source noted"}. Not a live rate.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPct(result.confirmedSharePct)} of the cost is from charges you marked as confirmed. The rest is estimated, and duty is always an assumption.
                </p>
                {validation.warnings.map((w) => (
                  <p key={w} className="mt-2 rounded-sm bg-(--status-estimate-bg) px-2 py-1 text-xs text-(--status-estimate-fg)">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Phone only: the live result stays in view while you edit inputs. */}
      {result && (
        <a href="#results" className="sticky bottom-3 z-20 mt-6 flex items-center justify-between gap-3 rounded-md border bg-card px-4 py-2.5 text-sm shadow-md lg:hidden">
          <span>
            Landed <span className="font-mono font-semibold tabular-nums">{formatAed(result.landedPerUnitAed)}</span>
          </span>
          <span>
            Margin <span className={cn("font-mono font-semibold tabular-nums", result.grossProfitInr < 0 ? "text-destructive" : (result.grossMarginPct ?? 0) < i.targetMarginPercent ? "text-amber-text" : "text-primary")}>{formatPct(result.grossMarginPct)}</span>
          </span>
          <span className="text-xs text-primary underline underline-offset-2">All results</span>
        </a>
      )}

      {/* ---------------- breakdown ---------------- */}
      {result && (
        <section className="mt-12" aria-labelledby="bd-h">
          <h2 id="bd-h" className="text-lg font-semibold tracking-tight">
            Where the cost goes
          </h2>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <div className="rounded-md border bg-card p-4 sm:p-5">
              <CostBreakdown lines={result.lines} totalInr={result.totalCostInr} inrPerAed={i.inrPerAed} />
            </div>
            <div className="rounded-md border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold">Line by line (whole consignment)</h3>
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">Every cost line with its amount and whether it is confirmed</caption>
                <tbody className="divide-y">
                  {result.lines
                    .filter((l) => l.totalInr > 0)
                    .map((l) => (
                      <tr key={l.key}>
                        <td className="py-1.5 pr-2">
                          {l.label}
                          <span className="block text-xs text-muted-foreground">{l.note}</span>
                        </td>
                        <td className="py-1.5 text-right font-mono tabular-nums">{formatInr(l.totalInr).replace("INR ", "")}</td>
                        <td className="py-1.5 pl-2 text-right">
                          <StatusBadge kind={l.confirmed ? "quoted" : "estimate"} />
                        </td>
                      </tr>
                    ))}
                  <tr className="font-semibold">
                    <td className="py-2 pr-2">Total (INR)</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatInr(result.totalCostInr).replace("INR ", "")}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <details className="mt-4 rounded-md border bg-card px-4 py-3 text-sm sm:px-5">
            <summary className="cursor-pointer font-medium">What is included, and what is not</summary>
            <div className="mt-2 grid gap-4 text-muted-foreground sm:grid-cols-2">
              <div>
                <p className="font-medium text-foreground">Included (each counted once)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>Production cost of the goods</li>
                  <li>Packaging, inland freight, export handling</li>
                  <li>International freight and insurance</li>
                  <li>Destination clearing and other destination costs</li>
                  <li>Other charges you enter</li>
                  <li>Customs duty, worked out from its base (not added on top of costs that already hold it)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">Not included</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>UAE import VAT (normally recoverable by a VAT-registered importer: confirm with an adviser)</li>
                  <li>Indian GST treatment and any refunds or export incentives</li>
                  <li>Financing, bank charges, currency hedging, income tax</li>
                  <li>Any importer or distributor margin beyond your price</li>
                  <li>Testing and certification costs (add them under Other charges if you want them in)</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-muted-foreground">
              This model treats you as bearing every cost you list up to delivery in the UAE. If you sell on other terms, set the costs you do not bear to zero and compare against your price on that basis. Line totals are rounded to the nearest paisa, so displayed numbers can differ by a paisa.
            </p>
          </details>

          <div className="mt-6 rounded-md border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold">What selling price would make commercial sense?</h3>
            <p className="mt-1 text-sm text-muted-foreground">The price per unit needed for each gross margin, on your current cost assumptions.</p>
            <table className="mt-3 w-full max-w-lg text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Gross margin</th>
                  <th className="py-1 text-right font-medium">Price per unit (AED)</th>
                  <th className="py-1 text-right font-medium">vs your price</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[0, 10, 15, 20, 25, 30].map((m) => {
                  const p = calculate({ ...i, targetMarginPercent: m }).priceForTargetMarginAed;
                  return (
                    <tr key={m}>
                      <td className="py-1.5">{m === 0 ? "0% (break-even)" : `${m}%`}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums">{p === null ? "not reachable" : formatAed(p).replace("AED ", "")}</td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-muted-foreground">{p === null || p === 0 ? "" : formatSigned(Math.round(((i.sellingPriceAed - p) / p) * 1000) / 10, "%")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">These are arithmetic on your inputs, not a view on what the UAE market will pay. Market price levels are not connected.</p>
          </div>
        </section>
      )}

      {/* ---------------- scenarios ---------------- */}
      <section id="scenarios" className="mt-14 scroll-mt-20" aria-labelledby="sc-h">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Scenario comparison</p>
        <h2 id="sc-h" className="text-xl font-semibold tracking-tight">
          Which variables make this viable?
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Each scenario changes a few assumptions from your base case. Edit the base inputs above and every scenario updates. A preferential-tariff scenario is hypothetical: nothing here says you qualify.</p>

        {!valid ? (
          <div className="mt-4">
            <Notice tone="error">Fix the inputs above to compare scenarios.</Notice>
          </div>
        ) : (
          <>
            <div className="mt-5 overflow-x-auto rounded-md border bg-card">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">Scenarios side by side, with differences from the base case</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Per unit unless stated
                    </th>
                    {rows.map((r) => (
                      <th key={r.scenario.id} scope="col" className={cn("px-3 py-2.5 text-right text-xs font-semibold", r.scenario.kind === "base" && "bg-muted/60")}>
                        {r.scenario.name}
                        {r.scenario.preferentialDuty && <span className="block font-normal text-muted-foreground">hypothetical</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {metricRows.map((m) => (
                    <tr key={m.label}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">
                        {m.label}
                      </th>
                      {rows.map((r) => (
                        <td key={r.scenario.id} className={cn("px-3 py-2.5 text-right font-mono tabular-nums", r.scenario.kind === "base" && "bg-muted/60")}>
                          {r.result && r.delta ? (
                            <>
                              {m.value(r as Row)}
                              {m.diff(r as Row) && <span className={cn("block text-xs", (m.diff(r as Row).startsWith("-") !== !!m.lowerIsBetter) ? "text-amber-text" : "text-primary")}>{m.diff(r as Row)} vs base</span>}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">not applicable</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      Against your {i.targetMarginPercent}% target
                    </th>
                    {rows.map((r) => (
                      <td key={r.scenario.id} className={cn("px-3 py-2.5 text-right text-xs", r.scenario.kind === "base" && "bg-muted/60")}>
                        {r.verdict ? VERDICT_LABEL[r.verdict] : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-md border bg-card p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold">Gross margin by scenario</h3>
              <MarginBars items={rows.filter((r) => r.result).map((r) => ({ name: r.scenario.name, margin: r.result!.grossMarginPct, hypothetical: r.scenario.preferentialDuty }))} target={i.targetMarginPercent} />
            </div>

            <details className="mt-6 rounded-md border bg-card px-4 py-3 sm:px-5" open>
              <summary className="cursor-pointer text-sm font-semibold">Edit the scenarios</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {assessment.scenarios
                .filter((s) => s.kind !== "base")
                .map((s) => {
                  const row = rows.find((r) => r.scenario.id === s.id);
                  const patch = (p: Partial<Scenario>) => setScenarios((all) => all.map((x) => (x.id === s.id ? { ...x, ...p } : x)));
                  const pct = (label: string, key: "freightPct" | "pricePct" | "costPct" | "fxPct") => (
                    <div className="grid gap-1" key={key}>
                      <Label htmlFor={`${s.id}-${key}`} className="text-xs">
                        {label}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          id={`${s.id}-${key}`}
                          type="number"
                          step="1"
                          min={-90}
                          max={500}
                          value={s[key]}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (e.target.value !== "" && Number.isFinite(n)) patch({ [key]: Math.max(-90, Math.min(500, n)) });
                          }}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  );
                  return (
                    <div key={s.id} className="rounded-md border bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        {s.kind === "custom" ? (
                          <Input aria-label="Scenario name" value={s.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} className="h-8 font-semibold" />
                        ) : (
                          <h3 className="text-sm font-semibold">{s.name}</h3>
                        )}
                        {s.kind === "tariff" && <StatusBadge kind="assumption" />}
                        {s.kind === "custom" && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setScenarios((all) => all.filter((x) => x.id !== s.id))}>
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {pct("International freight change", "freightPct")}
                        {pct("Selling price change", "pricePct")}
                        {pct("Production cost change", "costPct")}
                        {pct("INR per AED change", "fxPct")}
                      </div>
                      <label className="mt-3 flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={s.preferentialDuty} onChange={(e) => patch({ preferentialDuty: e.target.checked })} />
                        <span>
                          Apply the hypothetical preferential duty ({formatNumber(i.duty.preferentialRatePercent)}%)
                          <span className="block text-xs text-muted-foreground">Eligibility not verified.</span>
                        </span>
                      </label>
                      {row && !row.applicable && <p className="mt-3 rounded-sm bg-muted px-2 py-1.5 text-xs">{row.reason}</p>}
                    </div>
                  );
                })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={assessment.scenarios.length >= 8}
                onClick={() => setScenarios((all) => [...all, { id: `custom-${Date.now().toString(36)}`, name: "My scenario", kind: "custom", freightPct: 0, pricePct: 0, costPct: 0, fxPct: 0, preferentialDuty: false }])}
              >
                Add a scenario
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setScenarios(() => DEFAULT_SCENARIOS.map((s) => ({ ...s })))}>
                Reset scenarios
              </Button>
            </div>

            </details>
          </>
        )}
      </section>

      {/* ---------------- sensitivity ---------------- */}
      {result && (
        <section id="sensitivity" className="mt-14 scroll-mt-20" aria-labelledby="se-h">
          <h2 id="se-h" className="text-xl font-semibold tracking-tight">
            What moves the margin most
          </h2>
          <div className="mt-4 grid gap-5 md:grid-cols-[1fr_16rem]">
            <div className="rounded-md border bg-card p-4 sm:p-5">
              <Tornado rows={sens} />
            </div>
            <div className="space-y-3">
              {headroom !== null && (
                <div className="rounded-md border bg-card p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Freight headroom</p>
                  <p className="mt-1">
                    {headroom === 0
                      ? "At these assumptions the export already makes no profit, so there is no freight headroom."
                      : Number.isFinite(headroom)
                        ? `International freight could rise by about ${formatNumber(headroom)}% before gross profit reaches zero.`
                        : "Freight does not push this scenario into a loss."}
                  </p>
                </div>
              )}
              <div className="rounded-md border bg-card p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margin vs markup</p>
                <p className="mt-1">
                  Margin is {formatPct(result.grossMarginPct)} of the selling price. Markup is {formatPct(result.markupPct)} of cost. The same profit gives two different percentages.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, primary, tone }: { label: string; value: string; sub?: string; primary?: boolean; tone?: "good" | "warn" | "bad" }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono tabular-nums",
          primary ? "text-xl font-semibold" : "text-base",
          tone === "good" && "text-primary",
          tone === "warn" && "text-amber-text",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </dd>
      {sub && <dd className="font-mono text-xs tabular-nums text-muted-foreground">{sub}</dd>}
    </div>
  );
}

