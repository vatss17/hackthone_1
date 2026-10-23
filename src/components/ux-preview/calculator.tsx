"use client";

import { useState } from "react";
import { DEFAULT_CALC, SAMPLE_ASSUMPTIONS, sampleCalc, type SampleCalcInput } from "@/lib/ux-preview/calc.ts";
import { Callout, Field, inputCls, Tag, Btn } from "./wf.tsx";

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Two editable sample inputs, deterministic result, assumptions listed. */
export function Calculator({ value, onChange, idPrefix = "calc" }: { value: SampleCalcInput; onChange: (v: SampleCalcInput) => void; idPrefix?: string }) {
  // Keep the raw text so a half-typed number is not replaced under the user's cursor.
  const [raw, setRaw] = useState({ price: String(value.price), freight: String(value.freight) });
  const result = sampleCalc(value);

  function edit(key: "price" | "freight", text: string) {
    setRaw({ ...raw, [key]: text });
    onChange({ ...value, [key]: text.trim() === "" ? NaN : Number(text) });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${idPrefix}-price`} label="Your price per unit (INR, sample)" hint="Ex-factory price you might quote.">
          <input id={`${idPrefix}-price`} inputMode="decimal" className={inputCls} value={raw.price} onChange={(e) => edit("price", e.target.value)} aria-describedby={`${idPrefix}-price-hint`} aria-invalid={!result.ok && /price/i.test(result.problem ?? "")} />
        </Field>
        <Field id={`${idPrefix}-freight`} label="Sea freight per container (INR, sample)" hint="One 40 ft container to a destination port.">
          <input id={`${idPrefix}-freight`} inputMode="decimal" className={inputCls} value={raw.freight} onChange={(e) => edit("freight", e.target.value)} aria-describedby={`${idPrefix}-freight-hint`} aria-invalid={!result.ok && /freight/i.test(result.problem ?? "")} />
        </Field>
      </div>
      {!result.ok ? (
        <Callout tone="error" title={result.problem ?? "Check the numbers."} actions={<Btn small onClick={() => { setRaw({ price: String(DEFAULT_CALC.price), freight: String(DEFAULT_CALC.freight) }); onChange({ ...DEFAULT_CALC, reference: value.reference }); }}>Reset sample values</Btn>}>
          The result stays hidden until the inputs make sense.
        </Callout>
      ) : (
        <div aria-live="polite" className="rounded border border-border bg-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">Landed cost per unit (sample)</p>
            <p className="text-2xl font-semibold">AED {fmt(result.landedAed)}</p>
          </div>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">How the landed cost is built up, in AED per unit</caption>
            <tbody>
              {result.parts.map((p) => (
                <tr key={p.label} className="border-t border-border">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted-foreground">{p.label}</th>
                  <td className="py-1.5 text-right">{fmt(p.aed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm">
            Against an illustrative selling price of AED {fmt(value.reference)}:{" "}
            <strong>{result.marginAed < 0 ? "loses" : "leaves"} AED {fmt(Math.abs(result.marginAed))} per unit ({result.marginPct}%)</strong>{" "}
            <Tag strong={result.verdict === "loss"}>{result.verdict === "healthy" ? "Looks workable" : result.verdict === "thin" ? "Thin margin" : "Loss-making"}</Tag>
          </p>
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">Assumptions used (all samples, not real rates)</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{SAMPLE_ASSUMPTIONS.unitsPerContainer.toLocaleString("en-IN")} units fit one container.</li>
          <li>1 INR = {SAMPLE_ASSUMPTIONS.inrToAed} AED (not a live rate).</li>
          <li>Insurance {SAMPLE_ASSUMPTIONS.insuranceRate * 100}% and import duty {SAMPLE_ASSUMPTIONS.dutyRate * 100}% are placeholders, not verified tariffs.</li>
          <li>The selling price is a placeholder you would replace. It is not destination market data.</li>
        </ul>
      </details>
    </div>
  );
}
