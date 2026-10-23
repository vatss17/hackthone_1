"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { formatAed, formatInr } from "@/lib/landed-cost/format";
import { estimateLogistics, toLinePatch, type EstimateLine, type Scenario } from "@/lib/logistics/estimate";
import { LANE, LOGISTICS_AS_OF } from "@/lib/logistics/reference";
import { howEstimated, planSummary } from "@/lib/logistics/labels";
import { useT } from "@/lib/i18n/client";

export interface AiApply {
  lines: ReturnType<typeof toLinePatch>;
  fx: { inrPerAed: number; note: string } | null;
  scenario: Scenario;
}

const money = (l: EstimateLine, v: number) => (l.basis === "percent_of_goods" ? `${v}%` : l.currency === "AED" ? formatAed(v) : formatInr(v));

/**
 * "Let AI work out the logistics and charges": the AI plans the shipment from your carton size and weight, prices every logistics line from
 * researched reference rates, explains each figure with its sources, and fills the calculator only when you press Apply. Every figure is
 * an estimate, never a quote, and each line says how reliable its basis is.
 */
export function AiLogistics({ volumeCbm, grossKg, applied, currentFx, onApply }: { volumeCbm: number | null; grossKg: number | null; applied: boolean; currentFx: number; onApply: (a: AiApply) => void }) {
  const t = useT();
  const SCEN: [Scenario, string][] = [["low", t("Low")], ["typical", t("Typical")], ["high", t("High")]];
  const scenarioName: Record<Scenario, string> = { low: t("low"), typical: t("typical"), high: t("high") };
  const [distance, setDistance] = useState("300");
  const [scenario, setScenario] = useState<Scenario>("typical");
  const [stage, setStage] = useState<"idle" | "working" | "ready">("idle");
  const [alsoFx, setAlsoFx] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const est = estimateLogistics({ volumeCbm, grossKg, distanceKm: distance.trim() === "" ? NaN : Number(distance) });

  const run = () => {
    if (!est.ok) return setStage("ready");
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return setStage("ready");
    setStage("working");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStage("ready"), 1100);
  };

  const fxDiffers = Math.abs(est.inrPerAed - currentFx) > 0.005;

  return (
    <div className="rounded-lg border border-(--status-ai-border) bg-selected p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="ai" />
        <h3 className="font-semibold">{t("AI logistics estimate")}</h3>
      </div>
      <p className="mt-1 max-w-2xl text-muted-foreground">{t("AI plans the shipment from your carton size and weight, then estimates freight, handling, insurance and clearing from researched rates. You review it before it fills anything.")}</p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="ai-dist" className="text-xs">{t("Road distance, factory to departure port (km)")}</Label>
          <Input id="ai-dist" className="tnum w-40 text-right" inputMode="numeric" value={distance} onChange={(e) => { setDistance(e.target.value); if (stage === "ready") setStage("idle"); }} />
        </div>
        <Button type="button" onClick={run} disabled={stage === "working"}>
          {stage === "ready" ? t("Estimate again") : t("Estimate with AI")}
        </Button>
      </div>

      {stage === "working" && <p role="status" className="mt-3 text-[13px] text-muted-foreground">{t("Planning the shipment, then pricing each charge from the reference rates…")}</p>}

      {stage === "ready" && !est.ok && (
        <p role="alert" className="mt-3 rounded-md border border-(--status-missing-border) bg-(--status-missing-bg) px-3 py-2 text-(--status-missing-fg)">{est.problem ? t(est.problem) : null}</p>
      )}

      {stage === "ready" && est.ok && (
        <div className="mt-4 space-y-4" aria-live="polite">
          <p><span className="font-medium">{t("Shipment plan:")} </span>{planSummary(t, est.plan.summary)}</p>

          <div className="overflow-x-auto rounded-lg border bg-card" role="region" aria-label={t("AI logistics estimate by charge")} tabIndex={0}>
            <table className="tnum w-full text-sm">
              <caption className="sr-only">{t("Estimated logistics charges: low, typical and high. Confidence and basis are under each charge name")}</caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="px-3 py-2 font-medium">{t("Charge")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("Low")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("Typical")}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t("High")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {est.lines.map((l) => (
                  <tr key={l.key} className="align-top">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {t(l.label)}
                      <span className="block text-xs font-normal text-muted-foreground">{l.confidence === "medium" ? t("Medium confidence") : t("Low confidence")} · {t(l.quality)}</span>
                    </th>
                    <td className="px-3 py-2 text-right">{money(l, l.low)}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(l, l.typical)}</td>
                    <td className="px-3 py-2 text-right">{money(l, l.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details className="rounded-lg border bg-card px-3 py-2">
            <summary className="cursor-pointer font-medium">{t("How each figure was estimated, and the sources")}</summary>
            <ul className="mt-2 space-y-3">
              {est.lines.map((l) => (
                <li key={l.key}>
                  <p className="font-medium">{t(l.label)}</p>
                  <p className="text-muted-foreground">{howEstimated(t, l.how)}</p>
                  {l.sources.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-[13px]">
                      {l.sources.map((s) => (
                        <li key={s.url}>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
                            {s.title}
                            <ExternalLink aria-hidden className="size-3" />
                          </a>
                          {s.publisher && <span className="text-muted-foreground"> · {s.publisher}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">{t("No published figure was found for this charge, so it is a planning assumption.")}</p>
                  )}
                </li>
              ))}
            </ul>
          </details>

          <fieldset>
            <legend className="text-[13px] font-medium">{t("Which figures should it fill in?")}</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {SCEN.map(([v, label]) => (
                <label key={v} className="flex min-h-11 items-center gap-2 md:min-h-8">
                  <input type="radio" name="ai-scen" className="size-4 accent-primary" checked={scenario === v} onChange={() => setScenario(v)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {fxDiffers && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={alsoFx} onChange={(e) => setAlsoFx(e.target.checked)} />
              <span>
                {t("Also set the exchange rate to")} <span className="tnum font-medium">1 AED = INR {est.inrPerAed.toFixed(2)}</span>, {t("the market rate on {date} (you have INR {current}).", { date: est.asOf, current: currentFx.toFixed(2) })}
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => onApply({ lines: toLinePatch(est, scenario), fx: fxDiffers && alsoFx ? { inrPerAed: est.inrPerAed, note: t("Market rate on {date}, from public sources (AI estimate). Not a quote.", { date: est.asOf }) } : null, scenario })}
            >
              {t("Fill the calculator with the {scenario} estimates", { scenario: scenarioName[scenario] })}
            </Button>
            {applied && <span role="status" className="text-[13px] font-medium text-success">{t("Filled in as estimates. Replace each with a real quote when you have one.")}</span>}
          </div>

          <p className="text-[13px] text-muted-foreground">
            {t("Reference rates researched {date} for {lane}. Ocean freight is volatile and some figures come from older or secondary sources. These are planning estimates, not quotes from a carrier, forwarder, broker or insurer, and none is marked confirmed.", { date: LOGISTICS_AS_OF, lane: t(LANE) })}
          </p>
        </div>
      )}
    </div>
  );
}
