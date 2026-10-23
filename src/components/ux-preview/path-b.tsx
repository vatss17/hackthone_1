"use client";

import { useRouter } from "next/navigation";
import { MATERIALS, OPPORTUNITIES, PROCESSES } from "@/lib/ux-preview/data.ts";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { MachinePhoto } from "./machine-photo.tsx";
import { Box, Btn, Callout, Choice, Field, H1, inputCls, P, StepNav, Stepper, Tag } from "./wf.tsx";

const STEPS = ["Processes", "Materials", "Machines", "Current products", "First matches", "Chosen product", "Refine"];

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Deterministic rule: show products whose process you selected; rank by material match. */
export function matches(processes: string[], materials: string[]) {
  return OPPORTUNITIES.map((o) => ({ o, p: processes.includes(o.needs.process), m: o.needs.materials.filter((x) => materials.includes(x)).length }))
    .filter((x) => x.p)
    .sort((a, b) => b.m - a.m)
    .slice(0, 5);
}

export function PathB() {
  const router = useRouter();
  const { state, set } = usePreview();
  const b = state.pathB;
  const step = b.step;
  const setB = (p: Partial<typeof b>) => set((s) => ({ pathB: { ...s.pathB, ...p } }));
  const go = (n: number) => setB({ step: Math.max(1, Math.min(STEPS.length, n)) });
  const found = matches(b.processes, b.materials);
  const chosen = OPPORTUNITIES.find((o) => o.id === state.opportunity) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Stepper steps={STEPS} current={step} label="Capability discovery progress" />

      {step === 1 && (
        <div className="space-y-4">
          <H1>How does your factory make things?</H1>
          <P muted>Tick every process you run. Not sure of the name? Read the one-line description.</P>
          <div className="space-y-3">
            {PROCESSES.map((p) => (
              <Choice key={p.id} type="checkbox" selected={b.processes.includes(p.id)} onSelect={() => setB({ processes: toggle(b.processes, p.id) })} title={p.name}>{p.plain}</Choice>
            ))}
          </div>
          <StepNav backHref="/ux-preview/signup" nextLabel="Next: materials" onNext={() => go(2)} nextDisabled={!b.processes.length} />
          {!b.processes.length && <p className="text-sm text-muted-foreground">Choose at least one process to continue.</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <H1>Which plastics do you work with?</H1>
          <div className="space-y-3">
            {MATERIALS.map((m) => (
              <Choice key={m.id} type="checkbox" selected={b.materials.includes(m.id)} onSelect={() => setB({ materials: toggle(b.materials, m.id) })} title={m.name}>{m.plain}</Choice>
            ))}
          </div>
          <StepNav onBack={() => go(1)} nextLabel="Next: machines" onNext={() => go(3)} onSkip={() => go(3)} skipLabel="Not sure, skip" />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <H1>Tell us about your machines</H1>
          <P muted>Rough is fine. If you do not know the exact size, leave it blank. You can add it later.</P>
          <div className="space-y-3">
            {b.machines.map((m, i) => (
              <Box key={i}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id={`pb-mt-${i}`} label="Machine type">
                    <select id={`pb-mt-${i}`} className={inputCls} value={m.type} onChange={(e) => setB({ machines: b.machines.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)) })}>
                      {PROCESSES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field id={`pb-ms-${i}`} label="Size (optional)" hint="e.g. 150 tonnes clamp force, or screw diameter">
                    <input id={`pb-ms-${i}`} className={inputCls} value={m.size} onChange={(e) => setB({ machines: b.machines.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)) })} placeholder="I don't know" />
                  </Field>
                </div>
                {b.machines.length > 1 && <div className="mt-3"><Btn small onClick={() => setB({ machines: b.machines.filter((_, j) => j !== i) })}>Remove this machine</Btn></div>}
              </Box>
            ))}
          </div>
          <Btn onClick={() => setB({ machines: [...b.machines, { type: "injection", size: "" }] })}>Add another machine</Btn>
          <MachinePhoto onAdd={(m) => setB({ machines: [...b.machines.filter((x) => x.size || b.machines.length > 1), m] })} />
          <StepNav onBack={() => go(2)} nextLabel="Next: current products" onNext={() => go(4)} onSkip={() => go(4)} skipLabel="Skip machines for now" />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <H1>What do you make today? (optional)</H1>
          <P muted>This helps us suggest products close to what you already know how to sell.</P>
          <Field id="pb-prod" label="Current products"><textarea id="pb-prod" rows={4} className={`${inputCls} py-2`} value={b.products} onChange={(e) => setB({ products: e.target.value })} placeholder="e.g. storage crates, buckets" /></Field>
          <StepNav onBack={() => go(3)} nextLabel="Show me what fits" onNext={() => go(5)} onSkip={() => go(5)} skipLabel="Skip and show matches" />
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <H1>{found.length ? `${found.length} ${found.length === 1 ? "product" : "products"} your factory could make` : "No matches yet"}</H1>
          <P muted>Based only on the processes, materials and machines you gave us. This is about making the product, not about demand.</P>
          {found.length === 0 ? (
            <Callout tone="empty" title="Nothing matches those processes." actions={<Btn kind="primary" onClick={() => go(1)}>Change my processes</Btn>}>
              Try adding another process, or go back and check the ones you ticked.
            </Callout>
          ) : (
            <div role="radiogroup" aria-label="Choose a product to look at" className="space-y-3">
              {found.map(({ o, m }) => (
                <Choice key={o.id} selected={state.opportunity === o.id} onSelect={() => set({ opportunity: o.id, goal: "B" })} title={o.name}>
                  <Tag>{m > 0 || o.fit === "Strong" ? o.fit : "Partial"} fit</Tag> {o.why}
                </Choice>
              ))}
            </div>
          )}
          <StepNav onBack={() => go(4)} nextLabel="Look closer at this one" onNext={() => go(6)} nextDisabled={!chosen || !found.some((f) => f.o.id === chosen.id)} />
        </div>
      )}

      {step === 6 && chosen && (
        <div className="space-y-4">
          <H1>{chosen.name}</H1>
          <Box title="Why it suits your factory"><P>{chosen.why}</P>{chosen.gaps.map((g) => <p key={g} className="mt-1 text-sm text-muted-foreground">Gap: {g}</p>)}</Box>
          <Callout title="You can stop here.">Open the assessment now, or sharpen the answer first with a few optional details.</Callout>
          <div className="flex flex-wrap gap-3">
            <Btn kind="primary" href="/ux-preview/assessment">Open the assessment</Btn>
            <Btn onClick={() => go(7)}>Refine with tooling and capacity</Btn>
            <Btn kind="ghost" onClick={() => go(5)}>Back to the matches</Btn>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-4">
          <H1>Refine (all optional)</H1>
          <Box>
            <div className="space-y-4">
              <Field id="pb-tool" label="Do you already have a mould or die for this?" hint="Tooling means the metal mould or die that shapes the product."><select id="pb-tool" className={inputCls} value={b.refine.tooling} onChange={(e) => setB({ refine: { ...b.refine, tooling: e.target.value } })}><option value="">Not sure</option><option>Yes</option><option>No, I would need to buy one</option></select></Field>
              <Field id="pb-cap" label="Roughly how many units a month could you spare?" hint="Capacity is how much a machine can make in a month."><input id="pb-cap" inputMode="numeric" className={inputCls} value={b.refine.capacity} onChange={(e) => setB({ refine: { ...b.refine, capacity: e.target.value } })} placeholder="e.g. 20000" /></Field>
              <Field id="pb-util" label="How busy are your machines today?" hint="Utilisation is the share of time a machine is running."><select id="pb-util" className={inputCls} value={b.refine.utilisation} onChange={(e) => setB({ refine: { ...b.refine, utilisation: e.target.value } })}><option value="">Not sure</option><option>Mostly idle</option><option>About half</option><option>Nearly full</option></select></Field>
            </div>
          </Box>
          <StepNav onBack={() => go(6)} nextLabel="Open the assessment" onNext={() => router.push("/ux-preview/assessment")} onSkip={() => go(6)} skipLabel="Skip refining" />
        </div>
      )}
    </div>
  );
}
