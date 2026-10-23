"use client";

import { useState } from "react";
import Link from "next/link";
import { startProduct } from "@/lib/actions/start";
import { findCandidates, CONFIRM_TEXT, type CandidateResult } from "@/lib/classification/candidates";
import { readProduct, type ReadRow } from "@/lib/start/read-product";
import { useT } from "@/lib/i18n/client";
import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { ImageAssist, type AppliedField } from "@/components/ai-input/image-assist";
import { fillById } from "@/lib/ai-input/fill";
import { toProductForm } from "@/lib/ai-input/mappings";
import type { VoiceRow } from "@/lib/ai-input/voice";
import { ChatSetup, SetupModeSwitch, useSetupMode } from "@/components/start/chat-setup";
import { productRows, type ProductAnswers } from "@/lib/start/chat-flow";
import { Box, Btn, Callout, Field, H1, inputCls, P, Row, StepNav, Stepper, Tag } from "@/components/ux-preview/wf";

// The material names are stored as written (they are saved with the product), so they stay English here and are translated where shown.
const MATERIALS = ["PP", "HDPE", "LDPE", "PET", "Another material", "I don't know"];

/**
 * Path A: start from one product you already make. No factory is needed for a first look.
 * Reading is by plain rules in the browser; the HS helper is the platform's own rule-based classifier. No AI is used.
 */
export function StartProductFlow({ error }: { error?: string }) {
  const t = useT();
  const STEPS = [t("Add a product"), t("Review what we read"), t("Confirm details"), t("First look"), t("What comes next"), t("Save")];
  const STATUS = { found: t("Found in your text"), guess: t("Our guess, please check"), missing: t("Missing") } as const;
  const LABELS: Record<ReadRow["key"], string> = { name: t("Product"), material: t("Material"), use: t("Intended use"), weightKg: t("Weight (kg)"), size: t("Size (mm)") };
  const [step, setStep] = useState(1);
  // Confirmed voice or photo values go into the same two fields the person can type in. Text already there is kept; new text is added after it.
  const fromPhoto = (fields: AppliedField[]) => {
    const m = toProductForm(fields);
    if (m.values.name) fillById("sp-name", m.values.name, "set-if-empty");
    const extra = [m.values.description, ...m.specs.map((x) => `${x.name}: ${x.value}${x.unit ? ` ${x.unit}` : ""}`)].filter(Boolean).join(". ");
    if (extra) fillById("sp-desc", extra, "append");
  };
  const fromVoice = (rows: VoiceRow[]) => {
    for (const r of rows) {
      if (r.kind !== "field") continue;
      if (r.key === "name") fillById("sp-name", r.value, "set-if-empty");
      else fillById("sp-desc", `${r.label}: ${r.value}`, "append");
    }
  };
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [rows, setRows] = useState<ReadRow[]>([]);
  const [material, setMaterial] = useState("");
  const [use, setUse] = useState("");
  const [weight, setWeight] = useState("");
  const [size, setSize] = useState("");
  const [hs, setHs] = useState("");
  const [cands, setCands] = useState<CandidateResult | null>(null);
  const go = (n: number) => setStep(Math.max(1, Math.min(STEPS.length, n)));
  // Chat and Form share the answers above, so switching between them never loses anything.
  const [mode, setMode] = useSetupMode();
  const chatAnswers: ProductAnswers = { name, desc, material, use, weight, size };
  const setChatAnswers = (a: ProductAnswers) => {
    setName(a.name);
    setDesc(a.desc);
    setMaterial(a.material);
    setUse(a.use);
    setWeight(a.weight);
    setSize(a.size);
  };

  /** The HS helper's sentence that lists the other headings is built at runtime, so it is translated with its list as a placeholder. */
  const translateAmbiguity = (text: string) => {
    const m = text.match(/^Other headings may also fit \(([^)]*)\)\. Which one applies depends on the exact product and how it is mainly used\.$/);
    return m ? t("Other headings may also fit ({headings}). Which one applies depends on the exact product and how it is mainly used.", { headings: m[1] }) : t(text);
  };

  function read() {
    const r = readProduct(name, desc);
    setRows(r);
    const v = (k: ReadRow["key"]) => r.find((x) => x.key === k)?.value ?? "";
    // Details already filled in (for example by the chat) are kept when the reader finds nothing new.
    setMaterial(MATERIALS.includes(v("material")) ? v("material") : material);
    setUse(v("use") || use);
    setWeight(v("weightKg") || weight);
    setSize(v("size") || size);
    go(2);
  }

  const missing = [!material || material === "I don't know" ? t("Material") : "", !weight ? t("Weight") : "", !size ? t("Size") : "", !hs ? t("HS code") : ""].filter(Boolean);
  const errorText = error === "invalid_hs" ? t("The HS code must be 4 to 10 digits.") : error ? t("That could not be saved. Check the details and try again.") : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SetupModeSwitch mode={mode} onChange={setMode} />
      {errorText && <Callout tone="error" title={errorText} />}
      <ChatSetup
        path="product"
        hidden={mode !== "chat"}
        answers={chatAnswers}
        onAnswers={setChatAnswers}
        onDone={() => { setRows(productRows(chatAnswers)); go(2); setMode("form"); }}
        onSwitchToForm={() => { go(1); setMode("form"); }}
      />
      {mode === "form" && <div className="space-y-6">
      <Stepper steps={STEPS} current={step} label={t("Existing product progress")} />

      {step === 1 && (
        <div className="space-y-4">
          <H1>{t("Add a product you already make")}</H1>
          <P muted>{t("One product is enough to start. You do not need to register your whole factory first.")}</P>
          <Box>
            <div className="space-y-4">
              <Field id="sp-name" label={t("Product name")}><input id="sp-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Stackable storage crate 40 L")} maxLength={200} /></Field>
              <Field id="sp-desc" label={t("Anything else you know (optional)")} hint={t("Material, weight, size, what it is used for. Skip anything you are unsure about.")}>
                <textarea id="sp-desc" rows={4} className={`${inputCls} py-2`} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} placeholder={t("e.g. PP crate, 1.9 kg, 600 x 400 x 250 mm, for household storage")} />
              </Field>
              <div className="flex flex-wrap items-start gap-2">
                <VoiceAssist target="product" onRows={fromVoice} fieldId="sp-desc" />
                <ImageAssist kind="product_photo" onApply={fromPhoto} />
                <ImageAssist kind="drawing" onApply={fromPhoto} label={t("Read a drawing or specification sheet")} />
              </div>
            </div>
          </Box>
          <P muted>{t("Have a whole catalogue?")} <Link className="underline" href="/products/import">{t("Import it instead")}</Link>. {t("It is read in your browser and you review everything before saving.")}</P>
          <StepNav backHref="/start" nextLabel={t("Read my product")} onNext={read} nextDisabled={name.trim().length < 2} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <H1>{t("Here is what we found")}</H1>
          <P muted>{t("Nothing is saved yet. Fix anything that is wrong on the next screen.")}</P>
          <Box><dl>{rows.map((r) => <Row key={r.key} label={LABELS[r.key]} value={r.value ? (r.key === "use" ? t(r.value) : r.value) : t("Not found")} tag={STATUS[r.status]} />)}</dl></Box>
          {rows.some((r) => r.status === "missing") && <Callout title={t("A few details are missing.")}>{t("That is okay. Fill them in next, say “I don’t know”, or leave them for later.")}</Callout>}
          <StepNav onBack={() => go(1)} nextLabel={t("Next: confirm details")} onNext={() => go(3)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <H1>{t("Check and confirm")}</H1>
          <Box>
            <div className="space-y-4">
              <Field id="sp-mat" label={t("Main material")}>
                <select id="sp-mat" className={inputCls} value={material} onChange={(e) => setMaterial(e.target.value)}>
                  <option value="">{t("Choose…")}</option>
                  {MATERIALS.map((m) => <option key={m} value={m}>{t(m)}</option>)}
                </select>
              </Field>
              <Field id="sp-use" label={t("What is it used for?")}><input id="sp-use" className={inputCls} value={use} onChange={(e) => setUse(e.target.value)} maxLength={500} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="sp-w" label={t("Weight (kg)")} hint={t("Leave blank if unsure.")}><input id="sp-w" inputMode="decimal" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
                <Field id="sp-s" label={t("Size (mm)")} hint={t("Length x width x height.")}><input id="sp-s" className={inputCls} value={size} onChange={(e) => setSize(e.target.value)} maxLength={100} /></Field>
              </div>
              <Field id="sp-hs" label={t("HS code you have been told (optional)")} hint={t("A customs product code. If you are not sure, use the finder below. You confirm the code; nothing is checked against an official tariff.")}>
                <input id="sp-hs" inputMode="numeric" className={inputCls} value={hs} onChange={(e) => setHs(e.target.value)} placeholder={t("e.g. 3924")} maxLength={14} />
              </Field>
            </div>
          </Box>
          <Box tone="soft" title={t("Not sure of the HS code? Find candidates")}>
            <p className="text-sm text-muted-foreground">{t("We match words from your description to likely headings and say why. This uses plain rules in your browser: no AI, and nothing is sent anywhere.")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn kind="primary" onClick={() => setCands(findCandidates({ name, description: desc, use }))}>{t("Suggest HS codes")}</Btn>
              <Btn disabled>{t("Use a photo (not available yet)")}</Btn>
            </div>
            {cands && (
              <div className="mt-4 space-y-3" aria-live="polite">
                {cands.candidates.length === 0 ? <Callout tone="empty" title={t("No suggestion.")}>{t(cands.none)}</Callout> : (
                  <ul className="space-y-2">
                    {cands.candidates.map((c) => (
                      <li key={c.heading} className="rounded border border-border bg-card p-3">
                        <p className="font-semibold">{c.heading} · {t(c.label)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{t("Why:")} {t(c.rationale)}</p>
                        {c.ambiguity && <p className="mt-1 text-xs text-muted-foreground">{translateAmbiguity(c.ambiguity)}</p>}
                        <div className="mt-2"><Btn small kind={hs === c.heading ? "primary" : "secondary"} onClick={() => setHs(c.heading)}>{hs === c.heading ? `${t("Chosen")} ✓` : t("Use this code")}</Btn></div>
                      </li>
                    ))}
                  </ul>
                )}
                <Callout title={t("You confirm the code.")}>{t(cands.confirm || CONFIRM_TEXT)}</Callout>
              </div>
            )}
          </Box>
          <StepNav onBack={() => go(2)} nextLabel={t("See a first look")} onNext={() => go(4)} onSkip={() => go(4)} skipLabel={t("Skip, I'll add these later")} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <H1>{name ? t("First look at {name}", { name }) : t("First look at your product")}</H1>
          <P muted>{t("A quick view from what you told us. It sharpens as you add detail.")}</P>
          <div className="grid gap-3 sm:grid-cols-2">
            <Box title={t("Could my factory make it?")}><P>{material && material !== "I don't know" ? t("Add your machines to check they suit {material}. You can do that once this is saved.", { material: t(material) }) : t("We cannot tell yet. Choose a material to improve this.")}</P></Box>
            <Box title={t("Is there a destination market?")}><Callout tone="empty" title={t("No market evidence connected.")}>{t("We will not guess at demand.")}</Callout></Box>
            <Box title={t("Could exporting pay?")}><P>{t("Needs your price. The workspace opens the landed-cost calculator for this product once it is saved.")}</P></Box>
            <Box title={t("What is left?")}><P>{missing.length ? t("{count} open: {items}.", { count: missing.length, items: missing.join(", ") }) : t("Nothing outstanding.")}</P></Box>
          </div>
          <StepNav onBack={() => go(3)} nextLabel={t("Next: what comes next")} onNext={() => go(5)} />
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <H1>{t("What the workspace will ask next")}</H1>
          <P muted>{t("Only when it matters, one at a time. You can leave any of these.")}</P>
          <ul className="space-y-3">
            {[[t("Your ex-factory price"), t("Needed to check your margin.")], [t("Carton size and weight"), t("Needed to work out how many fit in a container.")], [t("Your machines"), t("Needed to check manufacturing fit. You can add them from My factory.")]].map(([k, why]) => (
              <li key={k}><Box><p className="font-medium">{k}</p><p className="text-sm text-muted-foreground">{why}</p></Box></li>
            ))}
          </ul>
          <StepNav onBack={() => go(4)} nextLabel={t("Next: review and save")} onNext={() => go(6)} />
        </div>
      )}

      {step === 6 && (
        <form action={startProduct} className="space-y-4">
          <H1>{t("Review, then save to My exports")}</H1>
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="description" value={desc} />
          <input type="hidden" name="material" value={material} />
          <input type="hidden" name="intendedUse" value={use} />
          <input type="hidden" name="weightKg" value={weight} />
          <input type="hidden" name="size" value={size} />
          <input type="hidden" name="hsCode" value={hs} />
          <Box>
            <dl>
              <Row label={t("Product")} value={name} />
              <Row label={t("Material")} value={material ? t(material) : t("Not set")} />
              <Row label={t("Used for")} value={use || t("Not set")} />
              <Row label={t("Weight")} value={weight ? `${weight} kg` : t("Not set")} />
              <Row label={t("Size")} value={size ? `${size} mm` : t("Not set")} />
              <Row label={t("HS code")} value={hs || t("Not set (add later)")} tag={hs ? t("Unverified") : undefined} />
            </dl>
          </Box>
          <Tag>{t("Saved to your company account. Calculator and checklist progress stay on this device.")}</Tag>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Btn onClick={() => go(5)}>{t("Back")}</Btn>
            <Btn kind="primary" type="submit">{t("Save to My exports")}</Btn>
          </div>
        </form>
      )}
      </div>}
    </div>
  );
}