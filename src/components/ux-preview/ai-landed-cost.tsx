"use client";

import { useEffect, useRef, useState } from "react";
import { aiLandedEstimate, totalWithOverrides, UNITS_PER_CONTAINER, type AiEstimate } from "@/lib/ux-preview/ai-sim.ts";
import { Btn, Callout, Field, inputCls, Tag } from "./wf.tsx";

const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Showcase: the manufacturer types only the price they quote. The (simulated) AI works out
 * every other charge, explains each one, and the person can override any line.
 */
export function AiLandedCost({ oppId, price, onPrice }: { oppId: string; price: number; onPrice: (n: number) => void }) {
  const [raw, setRaw] = useState(String(price));
  const [phase, setPhase] = useState<"idle" | "working" | "done">("idle");
  const [shown, setShown] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const est: AiEstimate = aiLandedEstimate(price, oppId);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  function run() {
    if (!est.ok) return;
    setOverrides({});
    setEditing(null);
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setShown(est.steps.length); setPhase("done"); return; }
    setPhase("working");
    setShown(0);
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= est.steps.length) { if (timer.current) clearInterval(timer.current); setPhase("done"); }
    }, 450);
  }

  function edit(text: string) {
    setRaw(text);
    onPrice(text.trim() === "" ? NaN : Number(text));
  }

  const total = totalWithOverrides(est.lines, overrides);
  const changed = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      <Field id="ai-price" label="The price you would quote (INR per unit)" hint="This is the only thing you need to type. The AI works out the rest.">
        <input id="ai-price" inputMode="decimal" className={`${inputCls} max-w-xs`} value={raw} onChange={(e) => edit(e.target.value)} aria-invalid={!est.ok} />
      </Field>
      {!est.ok && <Callout tone="error" title={est.problem ?? "Check the number."}>The AI waits for a sensible price before it works anything out.</Callout>}

      <div className="flex flex-wrap items-center gap-3">
        <Btn kind="primary" onClick={run} disabled={!est.ok || phase === "working"}>{phase === "done" ? "Work it out again" : "Let AI work out my landed cost"}</Btn>
        <Tag>Simulated in this wireframe: no AI is called</Tag>
      </div>

      {phase !== "idle" && est.ok && (
        <ol aria-label="What the AI is doing" aria-live="polite" className="space-y-1 rounded border border-border bg-card p-4 text-sm">
          {est.steps.slice(0, shown).map((s, i) => (
            <li key={s} className="flex items-center gap-2"><span aria-hidden>{i + 1 < shown || phase === "done" ? "✓" : "…"}</span>{s}</li>
          ))}
        </ol>
      )}

      {phase === "done" && est.ok && (
        <div className="space-y-4">
          <div className="rounded border border-primary bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted-foreground">Estimated landed cost per unit in the destination market</p>
              <p className="text-2xl font-semibold">AED {fmt(total)}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              For {UNITS_PER_CONTAINER.toLocaleString("en-IN")} units in one container. Likely HS heading {est.hs} (you would confirm this).
              {changed > 0 && ` You changed ${changed} ${changed === 1 ? "line" : "lines"}.`}
            </p>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Each charge the AI added on top of your price, in AED per unit</caption>
              <thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="pb-1 font-medium">Charge</th><th scope="col" className="pb-1 text-right font-medium">AED per unit</th><th scope="col" className="hidden pb-1 pl-4 font-medium sm:table-cell">How the AI got it</th></tr></thead>
              <tbody>
                {est.lines.map((l) => {
                  const ov = overrides[l.label];
                  const isEd = editing === l.label;
                  return (
                    <tr key={l.label} className="border-t border-border align-top">
                      <th scope="row" className="py-2 pr-2 text-left font-normal">
                        {l.label}
                        <div className="mt-1 flex flex-wrap gap-1"><Tag>{ov !== undefined ? "Your number" : `AI estimate · ${l.confidence} confidence`}</Tag></div>
                        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{l.how}</p>
                      </th>
                      <td className="py-2 text-right">
                        {isEd ? (
                          <span className="inline-flex items-center gap-1">
                            <label className="sr-only" htmlFor={`ov-${l.label}`}>Your number for {l.label}</label>
                            <input id={`ov-${l.label}`} inputMode="decimal" className={`${inputCls} !min-h-8 w-20 text-right`} value={draft} onChange={(e) => setDraft(e.target.value)} />
                            <Btn small onClick={() => { const n = Number(draft); if (Number.isFinite(n) && n >= 0) setOverrides({ ...overrides, [l.label]: n }); setEditing(null); }}>Save</Btn>
                          </span>
                        ) : (
                          <>
                            {fmt(ov ?? l.aed)}
                            <div className="mt-1"><Btn small kind="ghost" onClick={() => { setEditing(l.label); setDraft(String(ov ?? l.aed)); }}>Change</Btn>{ov !== undefined && <Btn small kind="ghost" onClick={() => { const { [l.label]: _drop, ...rest } = overrides; void _drop; setOverrides(rest); }}>Use AI number</Btn>}</div>
                          </>
                        )}
                      </td>
                      <td className="hidden py-2 pl-4 text-xs text-muted-foreground sm:table-cell">{l.how}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Callout title={`To keep a 20% margin you would need to sell at about AED ${fmt(Math.round((total / 0.8) * 100) / 100)} per unit.`}>
            Compare that with real destination prices before you decide. We do not show destination prices because no source is connected.
          </Callout>
          <Callout tone="warn" title="These are estimates, not quotes.">Freight and duty are the least certain lines. Confirm them with a forwarder or a customs adviser. If AI is unavailable, the same lines appear with the rates you type in.</Callout>
        </div>
      )}
    </div>
  );
}
