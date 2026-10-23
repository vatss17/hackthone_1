"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/auth/notice";
import { AiLogistics, type AiApply } from "@/components/landed-cost/ai-logistics";
import { StatusBadge } from "@/components/status-badge";
import { CostBreakdown, MarginBars, Tornado } from "@/components/landed-cost/charts";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { LINE_LABELS, calculate, freightHeadroomPct, sensitivities, validateInputs } from "@/lib/landed-cost/calc";
import { DEFAULT_SCENARIOS, VERDICT_LABEL, applyScenario, compareScenarios, type ScenarioRow } from "@/lib/landed-cost/scenarios";
import { formatAed, formatInr, formatNumber, formatPct, formatSigned } from "@/lib/landed-cost/format";
import { summariseAssumptions } from "@/lib/landed-cost/assumptions";
import { priceGap } from "@/lib/landed-cost/price-gap";
import { cartonPlan } from "@/lib/cartons/plan";
import type { Assessment } from "@/lib/landed-cost/assessment";
import type { Basis, Inputs, LineKey, Result, Scenario } from "@/lib/landed-cost/types";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { lineNote, priceGapShort, type Tr } from "@/lib/landed-cost/labels";

const basisLabels = (t: Tr): Record<Basis, string> => ({
  per_consignment: t("per consignment"),
  per_unit: t("per unit"),
  per_carton: t("per carton"),
  per_kg: t("per kg (gross)"),
  per_cbm: t("per cubic metre"),
  percent_of_goods: t("% of goods value"),
});

const lineHints = (t: Tr): Partial<Record<LineKey, string>> => ({
  packaging: t("Cartons, inner packs, labels. Counted once here, not inside production cost."),
  internationalFreight: t("Sea, air or road freight from India to the destination market. The usual biggest swing."),
  insurance: t("Cargo insurance. Often a small percentage of goods value."),
  destinationClearing: t("Port, clearing agent and handling charges in the destination market."),
  otherDestination: t("Anything else you pay in the destination market, for example inland delivery to your buyer."),
  otherCharges: t("Any other charge, in India or shared, not listed above."),
});

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
  const t = useT();
  const BASIS_LABEL = basisLabels(t);
  const LINE_HINT = lineHints(t);
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
  const plan = valid && result ? cartonPlan({ units: result.units, unitsPerCarton: i.unitsPerCarton, unitWeightG: null, cartonGrossKg: i.cartonGrossWeightKg, partialGrossKg: i.partialCartonGrossKg }) : { rows: [], totals: { cartons: 0, units: 0, netKg: null, grossKg: null }, hasPartial: false };

  /** Values the AI logistics estimate filled in, kept on this device so the fields can say where they came from. */
  const aiKey = `export-enablement:ai-logistics:v1:${scope}:${assessmentRef}`;
  const [aiValues, setAiValues] = useState<Record<string, number | string>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(aiKey);
      if (raw) setAiValues(JSON.parse(raw));
    } catch {
      /* storage blocked or damaged: nothing is tagged */
    }
  }, [aiKey]);
  const applyAi = (a: AiApply) => {
    const record: Record<string, number | string> = {};
    update((cur) => {
      let inputs = cur.inputs;
      const accepted = new Set(cur.acceptedSamples);
      const drop = new Set<string>();
      for (const p of a.lines) {
        for (const [f, v] of [["amount", p.amount], ["currency", p.currency], ["basis", p.basis], ["confirmed", false]] as const) inputs = setIn(inputs, `lines.${p.key}.${f}`, v);
        record[`lines.${p.key}.amount`] = p.amount;
        // The person accepted an AI estimate: it is not "entered by you", and it is not a quote.
        accepted.add(`lines.${p.key}.amount`);
        drop.add(`lines.${p.key}.amount`);
      }
      if (a.fx) {
        inputs = setIn(setIn(inputs, "inrPerAed", a.fx.inrPerAed), "fxNote", a.fx.note);
        record["inrPerAed"] = a.fx.inrPerAed;
        accepted.add("inrPerAed");
        drop.add("inrPerAed");
      }
      return { ...cur, inputs, acceptedSamples: [...accepted], edited: cur.edited.filter((x) => !drop.has(x)) };
    });
    setAiValues(record);
    try {
      window.localStorage.setItem(aiKey, JSON.stringify(record));
    } catch {
      /* in memory only */
    }
  };

  const change = (path: Path, value: unknown) =>
    update((a) => ({ ...a, inputs: setIn(a.inputs, path, value), edited: a.edited.includes(path) ? a.edited : [...a.edited, path] }));

  const accepted = new Set(assessment.acceptedSamples);
  const summary = summariseAssumptions(assessment, factFields);
  const aiTag = (path: Path) => (aiValues[path] !== undefined && getIn(i, path) === aiValues[path] ? <span className="rounded border border-(--status-ai-border) bg-(--status-ai-bg) px-1 text-xs font-semibold text-(--status-ai-fg)">{t("AI estimate")}</span> : null);
  const tag = (path: Path) =>
    aiTag(path) ?? (edited.has(path) ? null : accepted.has(path) ? (
      <span className="rounded-sm border border-border px-1 text-xs font-medium text-muted-foreground">{t("Accepted as is")}</span>
    ) : (
      <span className="rounded border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1 text-xs font-semibold text-(--status-estimate-fg)">{factFields.includes(path) ? t("From product") : t("Sample")}</span>
    ));
  const acceptRemaining = () => update((a) => ({ ...a, acceptedSamples: [...new Set([...a.acceptedSamples, ...summary.samples.map((x) => x.path)])] }));
  const undoAcceptance = () => update((a) => ({ ...a, acceptedSamples: [] }));

  /** A numeric input. Typing never loses text: the model only changes when the text is a valid number. */
  const num = (path: Path, label: string, opts: { suffix?: string; hint?: string; optional?: boolean; integer?: boolean; ctx?: string } = {}) => {
    const id = `f-${path.replace(/\./g, "-")}`;
    const value = getIn(i, path);
    const draft = drafts[path];
    const err = validation.errors[path] ? t(validation.errors[path]) : bad[path] ? t("Enter a number, for example 12.5") : undefined;
    return (
      <div className="grid gap-1.5" key={path}>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id}>
            {label}
            {opts.ctx && <span className="sr-only"> {t("for {name}", { name: t(opts.ctx) })}</span>}
          </Label>
          {tag(path)}
        </div>
        <div className="flex items-center gap-2">
          <Input
            id={id}
            className="tnum text-right"
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
          {opts.suffix && <span className="w-9 shrink-0 text-xs text-muted-foreground">{opts.suffix}</span>}
        </div>
        {opts.hint && !err && (
          <p id={`${id}-h`} className="text-xs text-muted-foreground">
            {opts.hint}
          </p>
        )}
        {err && (
          <p id={`${id}-e`} role="alert" className="text-xs font-medium text-destructive">
            {err}
          </p>
        )}
      </div>
    );
  };

  const select = (path: Path, label: string, options: { value: string; label: string }[], opts: { hint?: string; ctx?: string } = {}) => {
    const id = `f-${path.replace(/\./g, "-")}`;
    return (
      <div className="grid gap-1.5" key={path}>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id}>
            {label}
            {opts.ctx && <span className="sr-only"> {t("for {name}", { name: t(opts.ctx) })}</span>}
          </Label>
          {tag(path)}
        </div>
        <select
          id={id}
          value={String(getIn(i, path))}
          onChange={(e) => change(path, e.target.value)}
          className="h-11 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-10 md:text-sm"
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
      <div key={key} className="rounded-lg border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{t(LINE_LABELS[key])}</h4>
          <span className="tnum text-xs text-muted-foreground">{total !== undefined ? `= ${formatInr(total)}` : ""}</span>
        </div>
        {LINE_HINT[key] && <p className="mt-0.5 text-xs text-muted-foreground">{LINE_HINT[key]}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_6.5rem_1fr]">
          {num(`${p}.amount`, l.basis === "percent_of_goods" ? t("Percentage") : t("Amount"), { suffix: l.basis === "percent_of_goods" ? "%" : l.currency, ctx: LINE_LABELS[key] })}
          {l.basis === "percent_of_goods" ? <div /> : select(`${p}.currency`, t("Currency"), [{ value: "INR", label: "INR" }, { value: "AED", label: "AED" }], { ctx: LINE_LABELS[key] })}
          {select(`${p}.basis`, t("Charged"), bases.map((b) => ({ value: b, label: BASIS_LABEL[b] })), { ctx: LINE_LABELS[key] })}
        </div>
        {validation.errors[`${p}.basis`] && <p className="mt-1 text-xs font-medium text-destructive">{t(validation.errors[`${p}.basis`])}</p>}
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={l.confirmed} onChange={(e) => change(`${p}.confirmed`, e.target.checked)} />
          {t("I hold a quote or invoice for this charge")}<span className="sr-only"> ({t(LINE_LABELS[key])})</span>
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
    { label: t("Landed cost (AED)"), lowerIsBetter: true, value: (r) => formatAed(r.result.landedPerUnitAed).replace("AED ", ""), diff: (r) => (r.delta.landedPerUnitAed === 0 ? "" : formatSigned(r.delta.landedPerUnitAed)) },
    { label: t("Selling price (AED)"), value: (r) => formatAed(applyScenario(i, r.scenario).sellingPriceAed).replace("AED ", ""), diff: (r) => (r.delta.priceAed === 0 ? "" : formatSigned(r.delta.priceAed)) },
    { label: t("Gross profit per unit (AED)"), value: (r) => formatAed(r.result.profitPerUnitAed).replace("AED ", ""), diff: () => "" },
    { label: t("Gross profit, whole consignment (AED)"), value: (r) => formatAed(r.result.grossProfitAed).replace("AED ", ""), diff: (r) => (r.delta.profitAed === 0 ? "" : formatSigned(r.delta.profitAed)) },
    { label: t("Gross margin"), value: (r) => formatPct(r.result.grossMarginPct), diff: (r) => (r.delta.marginPp === null || r.delta.marginPp === 0 ? "" : formatSigned(r.delta.marginPp, " " + t("pp"))) },
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

  const unitsText = result ? t("{units} units in {cartons} cartons", { units: formatNumber(result.units), cartons: formatNumber(result.cartons) }) : "";

  return (
    <div>
      <nav aria-label={t("On this page")} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {[
          ["inputs", t("1. Inputs")],
          ["results", t("2. Results")],
          ["scenarios", t("3. Compare scenarios")],
          ["sensitivity", t("4. What moves the margin")],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="font-medium text-primary underline-offset-4 hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <details className="group mt-4 rounded-lg border border-(--status-estimate-border) bg-(--status-estimate-bg) px-4 py-3 text-sm text-(--status-estimate-fg)">
        <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{t("Read this first")} <span className="font-normal">· {t("values marked Sample are illustrations, the exchange rate is yours, duty is unverified")}</span></summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>{t("Starting values marked Sample are illustrations, not quotes, rates or advice. Replace them with your own.")}</li>
          <li>{t("The exchange rate is a user-entered rate. No live rate is connected.")}</li>
          <li>{t("The duty rate is an unverified assumption. Preferential duty is hypothetical: eligibility has not been verified.")}</li>
          <li>{t("Assumptions are saved in this browser only ({status}). Use Export to keep or share a copy.", { status: hydrated && !saved ? t("nothing saved yet") : saved ? t("saved") : "…" })}</li>
        </ul>
      </details>

      <section aria-labelledby="assump-h" className={cn("mt-4 rounded-md border px-4 py-3 text-sm", summary.complete ? "border-(--status-verified-border) bg-(--status-verified-bg)" : "border-(--status-estimate-border) bg-card")}>
        <h2 id="assump-h" className="font-medium">
          {summary.complete ? t("No sample values left to examine") : t("{count} of {total} assumptions are still sample values", { count: summary.samples.length, total: summary.total })}
        </h2>
        <p className="mt-0.5 text-muted-foreground">
          {t("{entered} entered by you, {confirmed} confirmed by a quote, {fromProduct} from your product record, {accepted} accepted as they are.", { entered: summary.entered, confirmed: summary.confirmed, fromProduct: summary.fromProduct, accepted: summary.accepted })}
          {!summary.complete && " " + t("Cost preparation is not finished until each is replaced, confirmed or explicitly accepted.")}
        </p>
        {summary.samples.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-primary underline-offset-4 hover:underline">{t("Which ones")}</summary>
            <ul className="mt-1 columns-2 list-disc pl-5 text-muted-foreground">
              {summary.samples.map((x) => (
                <li key={x.path}>{t(x.label)}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {summary.samples.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={acceptRemaining}>
              {t("Accept the remaining samples as they are")}
            </Button>
          )}
          {assessment.acceptedSamples.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={undoAcceptance}>
              {t("Undo acceptance")}
            </Button>
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
        {/* ---------------- inputs ---------------- */}
        <div id="inputs" className="scroll-mt-20 space-y-8">
          <section aria-labelledby="in-consignment">
            <h2 id="in-consignment" className="text-xl font-semibold tracking-[-0.005em]">
              {t("The consignment")}
            </h2>
            <div className="mt-3 grid gap-4 rounded-lg border bg-card p-4 sm:p-5">
              {subjectName === null && (
                <div className="grid gap-1.5">
                  <Label htmlFor="f-productLabel">{t("Product (a name for your own reference)")}</Label>
                  <Input id="f-productLabel" value={i.productLabel} maxLength={120} autoComplete="off" onChange={(e) => change("productLabel", e.target.value)} />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                {num("quantity", t("Quantity"), { integer: true })}
                {select("quantityUnit", t("Quantity is in"), [{ value: "units", label: t("units") }, { value: "cartons", label: t("cartons") }])}
                {num("unitsPerCarton", t("Units per carton"), { integer: true })}
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                {num("cartonGrossWeightKg", t("Carton gross weight"), { suffix: "kg", optional: true })}
                {num("cartonLengthMm", t("Length"), { suffix: "mm", optional: true })}
                {num("cartonWidthMm", t("Width"), { suffix: "mm", optional: true })}
                {num("cartonHeightMm", t("Height"), { suffix: "mm", optional: true })}
              </div>
              {plan.hasPartial && (
                <div className="grid gap-2 rounded-md border border-(--status-estimate-border) px-3 py-3 sm:grid-cols-[1fr_1fr] sm:items-end">
                  <p className="text-sm">
                    <span className="font-medium">
                      {plan.rows[0]?.kind === "full"
                        ? t("{cartons} full cartons ({units} units) plus one partial carton of {partial} units.", { cartons: plan.rows[0].cartons, units: plan.rows[0].units, partial: plan.rows.at(-1)?.units ?? 0 })
                        : t("One partial carton of {partial} units.", { partial: plan.rows.at(-1)?.units ?? 0 })}
                    </span>{" "}
                    <span className="text-muted-foreground">{i.partialCartonGrossKg === null ? t("Its gross weight is an estimate ({kg} kg, scaled from a full carton).", { kg: plan.rows.at(-1)?.grossKg ?? t("unknown") }) : t("Its gross weight is the weight you entered.")}</span>
                  </p>
                  {num("partialCartonGrossKg", t("Partial carton gross weight (optional)"), { suffix: "kg", optional: true, hint: t("Weigh the real partial carton and enter it to replace the estimate.") })}
                </div>
              )}
              {result && (
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  {unitsText}
                  {result.grossWeightKg !== null && ` · ${t("{kg} kg gross", { kg: formatNumber(Math.round(result.grossWeightKg)) })}`}
                  {result.volumeCbm !== null && ` · ${formatNumber(Math.round(result.volumeCbm * 100) / 100)} m³`}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="in-production">
            <h2 id="in-production" className="text-xl font-semibold tracking-[-0.005em]">
              {t("Production")}
            </h2>
            <div className="mt-3 grid gap-4">
              <div className="rounded-lg border bg-card p-4 sm:p-5">{num("unitProductionCostInr", t("Unit production cost (ex-factory, per unit)"), { suffix: "INR", hint: t("Material, labour, overhead and your own margin on the factory side, if any. Do not include packaging, freight or duty: they are added below.") })}</div>
              {lineRow("packaging")}
            </div>
          </section>

          <section aria-labelledby="in-logistics">
            <h2 id="in-logistics" className="text-xl font-semibold tracking-[-0.005em]">
              {t("Logistics and charges")}
            </h2>
            <div className="mt-3">
              <AiLogistics volumeCbm={result?.volumeCbm ?? null} grossKg={result?.grossWeightKg ?? null} applied={Object.keys(aiValues).length > 0} currentFx={i.inrPerAed} onApply={applyAi} />
            </div>
            <div className="mt-4 grid gap-4">{(["inlandFreight", "exportHandling", "internationalFreight", "insurance", "destinationClearing", "otherDestination", "otherCharges"] as LineKey[]).map(lineRow)}</div>
          </section>

          <section aria-labelledby="in-commercial">
            <h2 id="in-commercial" className="text-xl font-semibold tracking-[-0.005em]">
              {t("Commercial")}
            </h2>
            <div className="mt-3 grid gap-4 rounded-lg border bg-card p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {num("sellingPriceAed", t("Proposed destination selling price (per unit)"), { suffix: "AED", hint: t("What your buyer would pay per unit, on the same terms as the costs you include above.") })}
                {num("targetMarginPercent", t("Target gross margin"), { suffix: "%", hint: t("Margin is profit as a share of the selling price. It is not markup.") })}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {num("inrPerAed", t("Exchange rate: INR per 1 AED"), { hint: t("User-entered exchange rate. Use your bank's rate and note its source and date.") })}
                <div className="grid gap-1.5">
                  <Label htmlFor="f-fxNote">{t("Where this rate came from, and its date (optional)")}</Label>
                  <Input id="f-fxNote" value={i.fxNote} maxLength={200} autoComplete="off" placeholder={t("e.g. bank quote, 22 Oct 2026")} onChange={(e) => change("fxNote", e.target.value)} />
                  <p className="text-xs text-muted-foreground">{t("Shown beside the results so the rate is never mistaken for a live one.")}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold">{t("Customs duty and tariff preference")}</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  {num("duty.ratePercent", t("Customs duty assumption"), { suffix: "%", hint: t("An unverified assumption. Confirm the rate for your product's tariff line.") })}
                  {select("duty.basis", t("Duty is charged on"), [{ value: "cif_cost", label: t("goods plus costs to the destination port") }, { value: "selling_price", label: t("your selling price (invoice value)") }])}
                  {num("duty.preferentialRatePercent", t("Hypothetical preferential rate"), { suffix: "%", hint: t("For a what-if only. It does not mean your product qualifies for any preference.") })}
                  <label className="flex items-start gap-2 self-end text-sm">
                    <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={i.duty.applyPreference} onChange={(e) => change("duty.applyPreference", e.target.checked)} />
                    <span>
                      {t("Use the hypothetical preferential rate in the base case")}
                      <span className="block text-xs text-muted-foreground">{t("Eligibility is not verified. Leave off unless you are testing a what-if.")}</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 text-sm sm:p-5" aria-labelledby="keep-h">
            <h2 id="keep-h" className="text-base font-semibold tracking-tight">
              {t("Keep or share this assessment")}
            </h2>
            <p className="mt-1 text-muted-foreground">{t("Saved automatically in this browser only. It is not stored on our servers and is not visible to anyone else. Export a JSON file to keep or share it; importing replaces what is here.")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={download}>
                {t("Export JSON")}
              </Button>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                {t("Import JSON")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(t("Reset to the sample values? Your saved inputs for this product will be discarded."))) {
                    reset();
                    setMessage({ tone: "success", text: t("Reset to the sample values.") });
                  }
                }}
              >
                {t("Reset to samples")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label={t("Import assessment JSON file")}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 200_000) return setMessage({ tone: "error", text: t("That file is too large to be an assessment.") });
                  const ok = importJson(await f.text());
                  setMessage(ok ? { tone: "success", text: t("Imported. Values were checked and anything invalid was replaced by the sample.") } : { tone: "error", text: t("That file is not a valid assessment. Nothing was changed.") });
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
        <aside id="results" aria-labelledby="res-h" className="scroll-mt-20 lg:sticky lg:top-[5rem]">
          <div className="rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 id="res-h" className="text-lg font-semibold tracking-[-0.005em]">
                {t("Results")}
              </h2>
              <StatusBadge kind="estimate" />
            </div>
            {!result ? (
              <div className="p-4 text-sm">
                <Notice tone="error">{t("Fix the highlighted inputs to see results.")}</Notice>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
                  {Object.values(validation.errors).slice(0, 4).map((e, idx) => (
                    <li key={idx}>{t(e)}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="p-4">
                <dl className="grid gap-3">
                  <Stat label={t("Landed cost per unit")} primary value={formatAed(result.landedPerUnitAed)} sub={formatInr(result.landedPerUnitInr)} />
                  <Stat label={t("Selling price per unit")} value={formatAed(i.sellingPriceAed)} sub={formatInr(i.sellingPriceAed * i.inrPerAed)} />
                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      label={t("Gross margin")}
                      primary
                      value={formatPct(result.grossMarginPct)}
                      tone={result.grossProfitInr < 0 ? "bad" : (result.grossMarginPct ?? 0) < i.targetMarginPercent ? "warn" : "good"}
                      sub={`${t("target {pct}%", { pct: i.targetMarginPercent })} · ${result.grossProfitInr < 0 ? t("loss-making") : (result.grossMarginPct ?? 0) < i.targetMarginPercent ? t("below target") : t("meets target")}`}
                    />
                    <Stat label={t("Markup on cost")} value={formatPct(result.markupPct)} sub={t("not the same as margin")} />
                  </div>
                  <Stat label={t("Gross profit")} value={formatAed(result.grossProfitAed)} sub={t("{amount} per unit", { amount: formatAed(result.profitPerUnitAed) })} />
                  <Stat label={t("Break-even selling price")} value={Number.isFinite(result.breakEvenPriceAed) ? formatAed(result.breakEvenPriceAed) : t("not reachable")} sub={t("profit is zero at this price")} />
                  <Stat label={t("Price for {pct}% margin", { pct: i.targetMarginPercent })} value={result.priceForTargetMarginAed === null ? t("not reachable") : formatAed(result.priceForTargetMarginAed)} sub={t("to hit your target")} />
                  <Stat label={t("Total consignment cost")} value={formatInr(result.totalCostInr)} sub={formatAed(result.totalCostAed)} />
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("Exchange rate used:")} <span className="font-medium text-foreground">1 AED = INR {formatNumber(i.inrPerAed)}</span>, {i.fxNote.trim() ? t("a user-entered rate ({note}). Not a live rate.", { note: i.fxNote.trim() }) : t("a user-entered rate with no source noted. Not a live rate.")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("{pct} of the cost is from charges you marked as confirmed. The rest is estimated, and duty is always an assumption.", { pct: formatPct(result.confirmedSharePct) })}
                </p>
                {validation.warnings.map((w) => (
                  <p key={w} className="mt-2 rounded-sm bg-(--status-estimate-bg) px-2 py-1 text-xs text-(--status-estimate-fg)">
                    {t(w)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Phone only: the live result stays in view while you edit inputs. */}
      {result && (
        <a href="#results" className="sticky bottom-0 z-20 -mx-4 mt-6 flex min-h-12 items-center justify-between gap-3 border-t bg-card px-4 py-2 text-sm sm:-mx-6 sm:px-6 lg:hidden">
          <span>
            {t("Landed")} <span className="tnum font-semibold">{formatAed(result.landedPerUnitAed)}</span>
          </span>
          <span>
            {t("Margin")} <span className={cn("tnum font-semibold", result.grossProfitInr < 0 ? "text-destructive" : (result.grossMarginPct ?? 0) < i.targetMarginPercent ? "text-amber-text" : "text-primary")}>{formatPct(result.grossMarginPct)}</span>
          </span>
          <span className="text-xs text-primary underline underline-offset-2">{t("All results")}</span>
        </a>
      )}

      {/* ---------------- breakdown ---------------- */}
      {result && (
        <section className="mt-12" aria-labelledby="bd-h">
          <h2 id="bd-h" className="text-xl font-semibold tracking-[-0.005em]">
            {t("Where the cost goes")}
          </h2>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-4 sm:p-5">
              <CostBreakdown lines={result.lines} totalInr={result.totalCostInr} inrPerAed={i.inrPerAed} />
            </div>
            <div className="rounded-lg border bg-card p-4 sm:p-5">
              <h3 className="text-sm font-semibold">{t("Line by line (whole consignment)")}</h3>
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">{t("Every cost line with its amount and whether it is confirmed")}</caption>
                <tbody className="divide-y">
                  {result.lines
                    .filter((l) => l.totalInr > 0)
                    .map((l) => (
                      <tr key={l.key}>
                        <td className="py-1.5 pr-2">
                          {t(l.label)}
                          <span className="block text-xs text-muted-foreground">{lineNote(t, l.note)}</span>
                        </td>
                        <td className="py-1.5 text-right tnum">{formatInr(l.totalInr).replace("INR ", "")}</td>
                        <td className="py-1.5 pl-2 text-right">
                          <StatusBadge kind={l.confirmed ? "quoted" : "estimate"} />
                        </td>
                      </tr>
                    ))}
                  <tr className="font-semibold">
                    <td className="py-2 pr-2">{t("Total (INR)")}</td>
                    <td className="py-2 text-right tnum">{formatInr(result.totalCostInr).replace("INR ", "")}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <details className="mt-4 rounded-lg border bg-card px-4 py-3 text-sm sm:px-5">
            <summary className="cursor-pointer font-medium">{t("What is included, and what is not")}</summary>
            <div className="mt-2 grid gap-4 text-muted-foreground sm:grid-cols-2">
              <div>
                <p className="font-medium text-foreground">{t("Included (each counted once)")}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>{t("Production cost of the goods")}</li>
                  <li>{t("Packaging, inland freight, export handling")}</li>
                  <li>{t("International freight and insurance")}</li>
                  <li>{t("Destination clearing and other destination costs")}</li>
                  <li>{t("Other charges you enter")}</li>
                  <li>{t("Customs duty, worked out from its base (not added on top of costs that already hold it)")}</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-foreground">{t("Not included")}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  <li>{t("Destination import VAT (normally recoverable by a VAT-registered importer: confirm with an adviser)")}</li>
                  <li>{t("Indian GST treatment and any refunds or export incentives")}</li>
                  <li>{t("Financing, bank charges, currency hedging, income tax")}</li>
                  <li>{t("Any importer or distributor margin beyond your price")}</li>
                  <li>{t("Testing and certification costs (add them under Other charges if you want them in)")}</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-muted-foreground">
              {t("This model treats you as bearing every cost you list up to delivery in the destination market. If you sell on other terms, set the costs you do not bear to zero and compare against your price on that basis. Line totals are rounded to the nearest paisa, so displayed numbers can differ by a paisa.")}
            </p>
          </details>

          <div className="mt-6 rounded-lg border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold">{t("What selling price would make commercial sense?")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("The price per unit needed for each gross margin, on your current cost assumptions.")}</p>
            <table className="mt-3 w-full max-w-lg text-sm">
              <caption className="sr-only">{t("The selling price needed for each gross margin, and how your price compares with it")}</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 font-medium">{t("Gross margin")}</th>
                  <th scope="col" className="py-1 text-right font-medium">{t("Price per unit (AED)")}</th>
                  <th scope="col" className="py-1 text-right font-medium">{t("Your price compared with it")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[0, 10, 15, 20, 25, 30].map((m) => {
                  const p = calculate({ ...i, targetMarginPercent: m }).priceForTargetMarginAed;
                  return (
                    <tr key={m}>
                      <td className="py-1.5">{m === 0 ? t("0% (break-even)") : `${m}%`}</td>
                      <td className="py-1.5 text-right tnum">{p === null ? t("not reachable") : formatAed(p).replace("AED ", "")}</td>
                      <td className="py-1.5 text-right tnum text-muted-foreground">{p === null ? "" : priceGapShort(t, priceGap(i.sellingPriceAed, p))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">{t("Compared with each required price: (your price minus required price) divided by required price. “Above” means your price is higher than needed. These are arithmetic on your inputs, not a view on what the destination market will pay. Market price levels are not connected.")}</p>
          </div>
        </section>
      )}

      {/* ---------------- scenarios ---------------- */}
      <section id="scenarios" className="mt-14 scroll-mt-20" aria-labelledby="sc-h">
        <p className="text-xs font-medium text-primary">{t("Scenario comparison")}</p>
        <h2 id="sc-h" className="text-xl font-semibold tracking-tight">
          {t("Which variables make this viable?")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("Each scenario changes a few assumptions from your base case. Edit the base inputs above and every scenario updates. A preferential-tariff scenario is hypothetical: nothing here says you qualify.")}</p>

        {!valid ? (
          <div className="mt-4">
            <Notice tone="error">{t("Fix the inputs above to compare scenarios.")}</Notice>
          </div>
        ) : (
          <>
            <div className="mt-5 overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">{t("Scenarios side by side, with differences from the base case")}</caption>
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      {t("Per unit unless stated")}
                    </th>
                    {rows.map((r) => (
                      <th key={r.scenario.id} scope="col" className={cn("px-3 py-2.5 text-right text-xs font-semibold", r.scenario.kind === "base" && "bg-muted/60")}>
                        {r.scenario.kind === "custom" ? r.scenario.name : t(r.scenario.name)}
                        {r.scenario.preferentialDuty && !/hypothetical/i.test(r.scenario.name) && <span className="block font-normal text-muted-foreground">{t("hypothetical")}</span>}
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
                        <td key={r.scenario.id} className={cn("px-3 py-2.5 text-right tnum", r.scenario.kind === "base" && "bg-muted/60")}>
                          {r.result && r.delta ? (
                            <>
                              {m.value(r as Row)}
                              {m.diff(r as Row) && <span className={cn("block text-xs", (m.diff(r as Row).startsWith("-") !== !!m.lowerIsBetter) ? "text-amber-text" : "text-primary")}>{m.diff(r as Row)} {t("vs base")}</span>}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("not applicable")}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="px-4 py-2.5 text-left font-medium">
                      {t("Against your {pct}% target", { pct: i.targetMarginPercent })}
                    </th>
                    {rows.map((r) => (
                      <td key={r.scenario.id} className={cn("px-3 py-2.5 text-right text-xs", r.scenario.kind === "base" && "bg-muted/60")}>
                        {r.verdict ? t(VERDICT_LABEL[r.verdict]) : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-lg border bg-card p-4 sm:p-5">
              <h3 className="mb-3 text-sm font-semibold">{t("Gross margin by scenario")}</h3>
              <MarginBars items={rows.filter((r) => r.result).map((r) => ({ name: r.scenario.kind === "custom" ? r.scenario.name : t(r.scenario.name), margin: r.result!.grossMarginPct, hypothetical: r.scenario.preferentialDuty }))} target={i.targetMarginPercent} />
            </div>

            <details className="mt-6 rounded-lg border bg-card px-4 py-3 sm:px-5" open>
              <summary className="cursor-pointer text-sm font-semibold">{t("Edit the scenarios")}</summary>
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
                        <span className="sr-only"> {t("in the scenario {name}", { name: s.kind === "custom" ? s.name : t(s.name) })}</span>
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
                    <div key={s.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        {s.kind === "custom" ? (
                          <Input aria-label={t("Scenario name")} value={s.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} className="h-8 font-semibold" />
                        ) : (
                          <h3 className="text-sm font-semibold">{t(s.name)}</h3>
                        )}
                        {s.kind === "tariff" && <StatusBadge kind="assumption" />}
                        {s.kind === "custom" && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setScenarios((all) => all.filter((x) => x.id !== s.id))}>
                            {t("Remove")}
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        {pct(t("International freight change"), "freightPct")}
                        {pct(t("Selling price change"), "pricePct")}
                        {pct(t("Production cost change"), "costPct")}
                        {pct(t("INR per AED change"), "fxPct")}
                      </div>
                      <label className="mt-3 flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={s.preferentialDuty} onChange={(e) => patch({ preferentialDuty: e.target.checked })} />
                        <span>
                          {t("Apply the hypothetical preferential duty ({rate}%)", { rate: formatNumber(i.duty.preferentialRatePercent) })}
                          <span className="block text-xs text-muted-foreground">{t("Eligibility not verified.")}</span>
                        </span>
                      </label>
                      {row && !row.applicable && <p className="mt-3 rounded-sm bg-muted px-2 py-1.5 text-xs">{row.reason ? t(row.reason) : null}</p>}
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
                onClick={() => setScenarios((all) => [...all, { id: `custom-${Date.now().toString(36)}`, name: t("My scenario"), kind: "custom", freightPct: 0, pricePct: 0, costPct: 0, fxPct: 0, preferentialDuty: false }])}
              >
                {t("Add a scenario")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setScenarios(() => DEFAULT_SCENARIOS.map((s) => ({ ...s })))}>
                {t("Reset scenarios")}
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
            {t("What moves the margin most")}
          </h2>
          <div className="mt-4 grid gap-5 md:grid-cols-[1fr_16rem]">
            <div className="rounded-lg border bg-card p-4 sm:p-5">
              <Tornado rows={sens} />
            </div>
            <div className="space-y-3">
              {headroom !== null && (
                <div className="rounded-lg border bg-card p-4 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">{t("Freight headroom")}</p>
                  <p className="mt-1">
                    {headroom === 0
                      ? t("At these assumptions the export already makes no profit, so there is no freight headroom.")
                      : Number.isFinite(headroom)
                        ? t("International freight could rise by about {pct}% before gross profit reaches zero.", { pct: formatNumber(headroom) })
                        : t("Freight does not push this scenario into a loss.")}
                  </p>
                </div>
              )}
              <div className="rounded-lg border bg-card p-4 text-sm">
                <p className="text-xs font-semibold text-muted-foreground">{t("Margin vs markup")}</p>
                <p className="mt-1">
                  {t("Margin is {margin} of the selling price. Markup is {markup} of cost. The same profit gives two different percentages.", { margin: formatPct(result.grossMarginPct), markup: formatPct(result.markupPct) })}
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
          "tnum flex items-center gap-1.5",
          primary ? "text-xl font-semibold" : "text-base",
          tone === "good" && "text-primary",
          tone === "warn" && "text-amber-text",
          tone === "bad" && "text-destructive",
        )}
      >
        {tone === "bad" && <TriangleAlert aria-hidden className="size-4 shrink-0" />}
        {value}
      </dd>
      {sub && <dd className="tnum text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

