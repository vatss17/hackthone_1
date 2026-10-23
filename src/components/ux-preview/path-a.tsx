"use client";

import { useState } from "react";
import { SAMPLE_PRODUCT } from "@/lib/ux-preview/data.ts";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { HsFinder } from "./hs-finder.tsx";
import { Box, Btn, Callout, Field, H1, inputCls, P, Row, StepNav, Stepper, Tag } from "./wf.tsx";

const STEPS = ["Add a product", "Review what we read", "Confirm details", "First look", "More information", "Save"];
const MATERIALS = ["PP (polypropylene)", "HDPE", "LDPE", "Another material", "I don't know"];

type Read = { label: string; value: string; status: "Found in your text" | "Our guess, please check" | "Missing" };

function readProduct(name: string, desc: string, mockFile: boolean): Read[] {
  if (mockFile) {
    return [
      { label: "Product", value: SAMPLE_PRODUCT.name, status: "Found in your text" },
      { label: "Material", value: SAMPLE_PRODUCT.material, status: "Found in your text" },
      { label: "Intended use", value: SAMPLE_PRODUCT.use, status: "Our guess, please check" },
      { label: "Weight", value: `${SAMPLE_PRODUCT.weightKg} kg`, status: "Found in your text" },
      { label: "Size", value: `${SAMPLE_PRODUCT.dimensionsMm} mm`, status: "Found in your text" },
    ];
  }
  const w = desc.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const d = desc.match(/(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)/i);
  const m = /hdpe/i.test(desc) ? "HDPE" : /\bpp\b|polypropylene/i.test(desc) ? "PP (polypropylene)" : "";
  return [
    { label: "Product", value: name.trim(), status: name.trim() ? "Found in your text" : "Missing" },
    { label: "Material", value: m, status: m ? "Found in your text" : "Missing" },
    { label: "Intended use", value: /storage|crate|box/i.test(`${name} ${desc}`) ? "Storage" : "", status: /storage|crate|box/i.test(`${name} ${desc}`) ? "Our guess, please check" : "Missing" },
    { label: "Weight", value: w ? `${w[1]} kg` : "", status: w ? "Found in your text" : "Missing" },
    { label: "Size", value: d ? `${d[1]} x ${d[2]} x ${d[3]} mm` : "", status: d ? "Found in your text" : "Missing" },
  ];
}

export function PathA() {
  const { state, set } = usePreview();
  const a = state.pathA;
  const step = a.step;
  const setA = (p: Partial<typeof a>) => set((s) => ({ pathA: { ...s.pathA, ...p } }));
  const go = (n: number) => setA({ step: Math.max(1, Math.min(STEPS.length, n)) });

  const noCatalogue = state.scenario === "no-catalogue";
  const aiOff = state.scenario === "ai-unavailable";
  const [mock, setMock] = useState(false);
  const [rows, setRows] = useState<Read[]>([]);
  const [weight, setWeight] = useState("");
  const [size, setSize] = useState("");
  const [addNow, setAddNow] = useState<string[]>([]);
  const tab = noCatalogue && a.tab === "upload" ? "describe" : a.tab;

  function readNow() {
    const r = readProduct(a.name, a.desc, mock);
    setRows(r);
    setWeight(r.find((x) => x.label === "Weight")?.value.replace(" kg", "") ?? "");
    setSize(r.find((x) => x.label === "Size")?.value ?? "");
    if (!a.name && mock) setA({ name: SAMPLE_PRODUCT.name, material: SAMPLE_PRODUCT.material, use: SAMPLE_PRODUCT.use });
    else setA({ material: a.material || r.find((x) => x.label === "Material")?.value || "", use: a.use || r.find((x) => x.label === "Intended use")?.value || "" });
    go(2);
  }

  const missing = [
    !a.material || a.material === "I don't know" ? "Material" : "",
    !weight ? "Weight" : "",
    !size ? "Size" : "",
    ...["Ex-factory price", "Carton size", "HS code"].filter((x) => a.later.includes(x)),
  ].filter(Boolean);

  const canRead = tab === "describe" ? a.name.trim().length > 1 : tab === "upload" ? mock : false;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Stepper steps={STEPS} current={step} label="Existing product progress" />

      {step === 1 && (
        <div className="space-y-4">
          <H1>Add a product you already make</H1>
          <P muted>One product is enough to start. You do not need to register your whole factory first.</P>
          {noCatalogue && <Callout title="No catalogue? That is fine." >Describe one product in a sentence or two. You can add more products later.</Callout>}
          {aiOff && <Callout tone="warn" title="AI reading is not available right now.">We will read your text with simple rules instead. It is a little less clever, so please check each detail on the next screen.</Callout>}
          <div role="tablist" aria-label="How do you want to add it?" className="flex flex-wrap gap-2">
            {[["describe", "Describe one product"], ...(noCatalogue ? [] : [["upload", "Upload a catalogue"]])].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setA({ tab: k as typeof a.tab })} className={`min-h-10 rounded border px-4 text-sm ${tab === k ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"}`}>{l}</button>
            ))}
          </div>
          {tab === "describe" ? (
            <Box>
              <div className="space-y-4">
                <Field id="pa-name" label="Product name"><input id="pa-name" className={inputCls} value={a.name} onChange={(e) => setA({ name: e.target.value })} placeholder="e.g. Stackable storage crate 40 L" /></Field>
                <Field id="pa-desc" label="Anything else you know (optional)" hint="Material, weight, size, what it is used for. Skip anything you are unsure about.">
                  <textarea id="pa-desc" rows={4} className={`${inputCls} py-2`} value={a.desc} onChange={(e) => setA({ desc: e.target.value })} placeholder="e.g. PP crate, 1.9 kg, 600 x 400 x 250 mm, for household storage" />
                </Field>
              </div>
            </Box>
          ) : (
            <Box>
              <p className="text-sm text-foreground">PDF, Excel or CSV catalogue. We read it in your browser and show you what we found before anything is saved.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Btn onClick={() => setMock(true)}>{mock ? "Sample catalogue chosen ✓" : "Choose a file (uses a sample file)"}</Btn>
                {mock && <Tag>sample-catalogue.pdf (fictional)</Tag>}
              </div>
            </Box>
          )}
          <StepNav backHref="/ux-preview/signup" nextLabel="Read my product" onNext={readNow} nextDisabled={!canRead} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <H1>Here is what we found</H1>
          <P muted>Nothing is saved yet. Fix anything that is wrong on the next screen.</P>
          <Box>
            <dl>{rows.map((r) => <Row key={r.label} label={r.label} value={r.value || "Not found"} tag={r.status} />)}</dl>
          </Box>
          {rows.some((r) => r.status === "Missing") && <Callout title="A few details are missing.">That is okay. You can fill them in next, say &ldquo;I don&rsquo;t know&rdquo;, or add them later.</Callout>}
          <StepNav onBack={() => go(1)} nextLabel="Next: confirm details" onNext={() => go(3)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <H1>Check and confirm</H1>
          <Box>
            <div className="space-y-4">
              <Field id="pa-mat" label="Main material">
                <select id="pa-mat" className={inputCls} value={a.material} onChange={(e) => setA({ material: e.target.value })}>
                  <option value="">Choose…</option>
                  {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <Field id="pa-use" label="What is it used for?"><input id="pa-use" className={inputCls} value={a.use} onChange={(e) => setA({ use: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="pa-w" label="Weight (kg)" hint="Leave blank if unsure."><input id="pa-w" inputMode="decimal" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
                <Field id="pa-s" label="Size (mm)" hint="Length x width x height."><input id="pa-s" className={inputCls} value={size} onChange={(e) => setSize(e.target.value)} /></Field>
              </div>
              <Field id="pa-hs" label="HS code you have been told (optional)" hint="A customs product code. If you are not sure, leave it. We will help later and you confirm it.">
                <input id="pa-hs" className={inputCls} value={a.hs} onChange={(e) => setA({ hs: e.target.value })} placeholder="e.g. 3923" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Btn small onClick={() => setA({ material: "I don't know" })}>I don&rsquo;t know the material</Btn>
                <Btn small onClick={() => setA({ hs: "" })}>I don&rsquo;t know the HS code</Btn>
              </div>
            </div>
          </Box>
          <HsFinder seed={[a.name, a.desc].filter(Boolean).join(". ")} hs={a.hs} onUse={(code) => setA({ hs: code })} />
          <StepNav onBack={() => go(2)} nextLabel="See a first look" onNext={() => go(4)} onSkip={() => go(4)} skipLabel="Skip, I'll add these later" />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <H1>First look at {a.name || "your product"}</H1>
          <P muted>A quick view from what you told us. It gets sharper as you add detail.</P>
          <div className="grid gap-3 sm:grid-cols-2">
            <Box title="Could my factory make it?"><P>{a.material && a.material !== "I don't know" ? "Likely, if your machines suit " + a.material + ". Add your machines to confirm." : "We cannot tell yet. Choose a material to improve this."}</P></Box>
            <Box title="Is there a destination market?"><Callout tone="empty" title="No market evidence connected.">We will not guess at demand.</Callout></Box>
            <Box title="Could exporting pay?"><P>Needs your price. <a className="underline" href="/ux-preview/assessment">Try the numbers</a> with sample values.</P></Box>
            <Box title="What is left?"><P>{missing.length ? `${missing.length} open: ${missing.join(", ")}.` : "Nothing outstanding."}</P></Box>
          </div>
          <StepNav onBack={() => go(3)} nextLabel="Next: add only what is needed" onNext={() => go(5)} />
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <H1>Add more only if you want a sharper answer</H1>
          <ul className="space-y-3">
            {[["Ex-factory price", "Needed to check your margin."], ["Carton size", "Needed to work out how many fit in a container."], ["HS code", "Needed for duty and rules. We can suggest candidates later."]].map(([k, why]) => (
              <li key={k}>
                <Box>
                  <p className="font-medium">{k}</p>
                  <p className="text-sm text-muted-foreground">{why}</p>
                  {addNow.includes(k) && <div className="mt-3 max-w-xs"><Field id={`pa-x-${k}`} label={k}><input id={`pa-x-${k}`} className={inputCls} /></Field></div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn small onClick={() => { setAddNow([...new Set([...addNow, k])]); setA({ later: a.later.filter((x) => x !== k) }); }}>Add now</Btn>
                    <Btn small onClick={() => { setA({ later: [...new Set([...a.later, k])] }); setAddNow(addNow.filter((x) => x !== k)); }}>{a.later.includes(k) ? "Added to later ✓" : "Add later"}</Btn>
                  </div>
                </Box>
              </li>
            ))}
          </ul>
          <StepNav onBack={() => go(4)} nextLabel="Next: review and save" onNext={() => go(6)} />
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <H1>Review, then save to My exports</H1>
          <Box>
            <dl>
              <Row label="Product" value={a.name || SAMPLE_PRODUCT.name} />
              <Row label="Material" value={a.material || "Not set"} />
              <Row label="Used for" value={a.use || "Not set"} />
              <Row label="HS code" value={a.hs || "Not set (add later)"} />
              <Row label="Still open" value={missing.length ? missing.join(", ") : "Nothing"} />
            </dl>
          </Box>
          {a.saved ? (
            <Callout title="Saved (simulated)." actions={<><Btn kind="primary" href="/ux-preview/app/exports">Go to My exports</Btn><Btn href="/ux-preview/assessment">Open the assessment</Btn></>}>
              In the real product this would be stored on your account. Today the product would keep it in this browser only.
            </Callout>
          ) : (
            <StepNav onBack={() => go(5)} nextLabel="Save to My exports" onNext={() => { setA({ saved: true }); set((s) => ({ goal: "A", opportunity: s.opportunity ?? "laundry", savedProjects: [...new Set([...s.savedProjects, "crate"])] })); }} />
          )}
        </div>
      )}
    </div>
  );
}
