"use client";

import { useMemo, useState } from "react";
import { startFactory } from "@/lib/actions/start";
import { INDIAN_STATES } from "@/lib/factory-validation";
import { discover, FIT_LABEL } from "@/lib/opportunities/engine";
import type { MaterialCode, ProcessCode } from "@/lib/opportunities/types";
import { factoryInputFromAnswers, materialName, processName, START_MATERIALS, START_PROCESSES, type StartMachine } from "@/lib/start/capability";
import { useT } from "@/lib/i18n/client";
import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { ImageAssist, type AppliedField } from "@/components/ai-input/image-assist";
import { labelToMaterial, nameplateToMachine } from "@/lib/ai-input/mappings";
import type { VoiceRow } from "@/lib/ai-input/voice";
import { ChatSetup, SetupModeSwitch, useSetupMode } from "@/components/start/chat-setup";
import type { FactoryAnswers } from "@/lib/start/chat-flow";
import { Box, Btn, Callout, Choice, Field, H1, inputCls, P, StepNav, Stepper, Tag } from "@/components/ux-preview/wf";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Path B: start from what the factory can do. Steps 1 to 5 run the platform's own rules engine on the answers in the browser,
 * so the manufacturer sees potential products before anything is saved. Saving needs the factory's location (a database requirement).
 */
export function StartFactoryFlow({ error }: { error?: string }) {
  const t = useT();
  const STEPS = [t("Processes"), t("Materials"), t("Machines"), t("Current products"), t("First matches"), t("Save")];
  const [step, setStep] = useState(1);
  const [processes, setProcesses] = useState<ProcessCode[]>([]);
  const [materials, setMaterials] = useState<MaterialCode[]>([]);
  const [machines, setMachines] = useState<StartMachine[]>([{ processCode: "injection_moulding", size: "" }]);
  const [products, setProducts] = useState("");
  const [pick, setPick] = useState("");
  const go = (n: number) => setStep(Math.max(1, Math.min(STEPS.length, n)));
  // Chat and Form share the answers above, so switching between them never loses anything.
  const [mode, setMode] = useSetupMode();

  const productNames = useMemo(() => products.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, 20), [products]);
  const found = useMemo(() => {
    if (!processes.length) return [];
    const usable = machines.filter((m) => processes.includes(m.processCode));
    return discover(factoryInputFromAnswers({ processes, materials, machines: usable, products: productNames })).adjacent.slice(0, 5);
  }, [processes, materials, machines, productNames]);
  const chosen = found.find((m) => m.entry.id === pick) ?? null;
  const untouched = machines.length === 1 && machines[0].processCode === "injection_moulding" && machines[0].size === "";

  /** Confirmed spoken facts are ADDED to what is already chosen: nothing is removed or replaced. */
  const applyVoice = (rows: VoiceRow[]) => {
    const addProcesses = rows.flatMap((r) => (r.kind === "process" ? [r.code as ProcessCode] : r.kind === "machine" ? [r.process as ProcessCode] : []));
    const addMaterials = rows.flatMap((r) => (r.kind === "material" ? [r.code as MaterialCode] : []));
    const addMachines: StartMachine[] = rows.flatMap((r) => (r.kind === "machine" ? Array.from({ length: r.count }, () => ({ processCode: r.process as ProcessCode, size: r.size })) : []));
    const names = rows.flatMap((r) => (r.kind === "product" ? [r.name] : []));
    setProcesses((cur) => [...cur, ...addProcesses.filter((c, i) => !cur.includes(c) && addProcesses.indexOf(c) === i)]);
    setMaterials((cur) => [...cur, ...addMaterials.filter((c, i) => !cur.includes(c) && addMaterials.indexOf(c) === i)]);
    if (addMachines.length) setMachines((cur) => [...(untouched ? [] : cur), ...addMachines].slice(0, 30));
    if (names.length) setProducts((cur) => [cur.trim(), ...names].filter(Boolean).join("\n"));
  };

  /** A confirmed nameplate adds one machine; a confirmed label ticks its polymer. Nothing already entered changes. */
  const applyNameplate = (fields: AppliedField[]) => {
    const m = nameplateToMachine(fields);
    const q = m.values.ratingValue && m.values.ratingUnit === "tonnes_clamp_force" ? `${m.values.ratingValue} tonnes` : m.values.ratingValue && m.values.ratingUnit === "kg_per_hour" ? `${m.values.ratingValue} kg/h` : "";
    const code = (m.process ?? "injection_moulding") as ProcessCode;
    setProcesses((cur) => (cur.includes(code) ? cur : [...cur, code]));
    setMachines((cur) => [...(untouched ? [] : cur), { processCode: code, size: q }].slice(0, 30));
  };
  const applyLabel = (fields: AppliedField[]) => {
    const { material } = labelToMaterial(fields);
    if (material) setMaterials((cur) => (cur.includes(material as MaterialCode) ? cur : [...cur, material as MaterialCode]));
  };

  /** The chat only adds to these answers (the person may remove a chip). The one placeholder machine row means "untouched". */
  const chatAnswers: FactoryAnswers = { processes, materials, machines: untouched ? [] : machines, products: productNames };
  const setChatAnswers = (a: FactoryAnswers) => {
    setProcesses(a.processes);
    setMaterials(a.materials);
    setMachines(a.machines.length ? a.machines : [{ processCode: "injection_moulding", size: "" }]);
    setProducts(a.products.join("\n"));
  };

  const errorText = error === "factory_invalid" ? t("Check the factory name and location. Each field needs a value, and the PIN code is six digits.") : error ? t("That could not be saved. Try again.") : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SetupModeSwitch mode={mode} onChange={setMode} />
      {errorText && <Callout tone="error" title={errorText} />}
      <ChatSetup
        path="factory"
        hidden={mode !== "chat"}
        answers={chatAnswers}
        onAnswers={setChatAnswers}
        onDone={() => { go(5); setMode("form"); }}
        onSwitchToForm={() => { go(1); setMode("form"); }}
      />
      {mode === "form" && <div className="space-y-6">
      <Stepper steps={STEPS} current={step} label={t("Capability discovery progress")} />
      <div className="rounded-lg border bg-card p-3">
        <VoiceAssist target="factory" onRows={applyVoice} label={t("Describe your factory by voice")} />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <H1>{t("How does your factory make things?")}</H1>
          <P muted>{t("Tick every process you run. Not sure of the name? Read the one-line description.")}</P>
          <div className="space-y-3">
            {START_PROCESSES.map((p) => (
              <Choice key={p.code} type="checkbox" selected={processes.includes(p.code)} onSelect={() => setProcesses(toggle(processes, p.code))} title={t(processName(p.code))}>{t(p.plain)}</Choice>
            ))}
          </div>
          {!processes.length && <p className="text-sm text-muted-foreground">{t("Choose at least one process to continue.")}</p>}
          <StepNav backHref="/start" nextLabel={t("Next: materials")} onNext={() => go(2)} nextDisabled={!processes.length} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <H1>{t("Which plastics do you work with?")}</H1>
          <div className="space-y-3">
            {START_MATERIALS.map((m) => (
              <Choice key={m.code} type="checkbox" selected={materials.includes(m.code)} onSelect={() => setMaterials(toggle(materials, m.code))} title={t(materialName(m.code))}>{t(m.plain)}</Choice>
            ))}
          </div>
          <ImageAssist kind="material_label" onApply={applyLabel} label={t("Read a raw-material label")} />
          <StepNav onBack={() => go(1)} nextLabel={t("Next: machines")} onNext={() => go(3)} onSkip={() => go(3)} skipLabel={t("Not sure, skip")} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <H1>{t("Tell us about your machines")}</H1>
          <P muted>{t("Rough is fine. If you do not know the size, leave it blank and add it later.")}</P>
          <div className="space-y-3">
            {machines.map((m, i) => (
              <Box key={i}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id={`sf-mt-${i}`} label={t("Machine type")}>
                    <select id={`sf-mt-${i}`} className={inputCls} value={m.processCode} onChange={(e) => setMachines(machines.map((x, j) => (j === i ? { ...x, processCode: e.target.value as ProcessCode } : x)))}>
                      {START_PROCESSES.map((p) => <option key={p.code} value={p.code}>{t(processName(p.code))}</option>)}
                    </select>
                  </Field>
                  <Field id={`sf-ms-${i}`} label={t("Size (optional)")} hint={t("e.g. 150 tonnes (injection) or 80 kg/h (extrusion)")}>
                    <input id={`sf-ms-${i}`} className={inputCls} value={m.size} onChange={(e) => setMachines(machines.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} placeholder={t("I don't know")} maxLength={100} />
                  </Field>
                </div>
                {machines.length > 1 && <div className="mt-3"><Btn small onClick={() => setMachines(machines.filter((_, j) => j !== i))}>{t("Remove this machine")}</Btn></div>}
              </Box>
            ))}
          </div>
          <Btn onClick={() => setMachines([...machines, { processCode: "injection_moulding", size: "" }])}>{t("Add another machine")}</Btn>
          <div className="flex flex-wrap gap-2">
            <ImageAssist kind="nameplate" onApply={applyNameplate} label={t("Read a machine nameplate")} />
            <ImageAssist kind="machine_photo" onApply={applyNameplate} label={t("Recognise a machine from a photo")} />
          </div>
          <Callout title={t("Typing the type and size is enough for a first result.")}>{t("A photo can suggest the kind of machine, but never its capacity or output.")}</Callout>
          <StepNav onBack={() => go(2)} nextLabel={t("Next: current products")} onNext={() => go(4)} onSkip={() => go(4)} skipLabel={t("Skip machines for now")} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <H1>{t("What do you make today? (optional)")}</H1>
          <P muted>{t("One per line, or separated by commas. This helps us suggest products close to what you already sell.")}</P>
          <Field id="sf-prod" label={t("Current products")}><textarea id="sf-prod" rows={4} className={`${inputCls} py-2`} value={products} onChange={(e) => setProducts(e.target.value)} placeholder={t("e.g. storage crates, buckets")} maxLength={1000} /></Field>
          <StepNav onBack={() => go(3)} nextLabel={t("Show me what fits")} onNext={() => go(5)} onSkip={() => go(5)} skipLabel={t("Skip and show matches")} />
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <H1>{found.length ? (found.length === 1 ? t("{count} product your factory could make", { count: 1 }) : t("{count} products your factory could make", { count: found.length })) : t("No matches yet")}</H1>
          <P muted>{t("Worked out by transparent rules from what you told us. This is about making the product, not about demand.")}</P>
          {found.length === 0 ? (
            <Callout tone="empty" title={t("Nothing matches those answers.")} actions={<Btn kind="primary" onClick={() => go(1)}>{t("Change my processes")}</Btn>}>{t("Try another process, or check the ones you ticked.")}</Callout>
          ) : (
            <div role="radiogroup" aria-label={t("Choose a product to look at")} className="space-y-3">
              {found.map((m) => (
                <Choice key={m.entry.id} selected={pick === m.entry.id} onSelect={() => setPick(m.entry.id)} title={t(m.entry.name)}>
                  <Tag>{t(FIT_LABEL[m.level])}</Tag> {m.reasons[0] ?? m.entry.summary}
                </Choice>
              ))}
            </div>
          )}
          <StepNav onBack={() => go(4)} nextLabel={t("Next: save my factory")} onNext={() => go(6)} nextDisabled={!chosen} />
        </div>
      )}

      {step === 6 && (
        <form action={startFactory} className="space-y-4">
          <H1>{t("Save your factory to keep these results")}</H1>
          <P muted>{t("We need the factory’s location to save it. Everything you chose is saved with it, and you can change any of it later in My factory.")}</P>
          {processes.map((c) => <input key={c} type="hidden" name="process" value={c} />)}
          {materials.map((c) => <input key={c} type="hidden" name="material" value={c} />)}
          {machines.filter((m) => processes.includes(m.processCode)).map((m, i) => <input key={i} type="hidden" name="machine" value={`${m.processCode}|${m.size}`} />)}
          <input type="hidden" name="opportunity" value={pick} />
          <Box title={chosen ? t("You chose: {name}", { name: t(chosen.entry.name) }) : t("Your choice")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="sf-fn" label={t("Factory name")}><input id="sf-fn" name="factoryName" className={inputCls} required minLength={2} maxLength={120} autoComplete="organization" /></Field>
              <Field id="sf-ad" label={t("Address")}><input id="sf-ad" name="addressLine1" className={inputCls} required maxLength={200} autoComplete="address-line1" /></Field>
              <Field id="sf-ci" label={t("City")}><input id="sf-ci" name="city" className={inputCls} required maxLength={100} autoComplete="address-level2" /></Field>
              <Field id="sf-st" label={t("State or union territory")}>
                <select id="sf-st" name="state" className={inputCls} required defaultValue="">
                  <option value="" disabled>{t("Choose…")}</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                </select>
              </Field>
              <Field id="sf-pin" label={t("PIN code")} hint={t("Six digits.")}><input id="sf-pin" name="postalCode" className={inputCls} required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" /></Field>
            </div>
          </Box>
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Btn onClick={() => go(5)}>{t("Back")}</Btn>
            <Btn kind="primary" type="submit">{t("Save and open this opportunity")}</Btn>
          </div>
        </form>
      )}
      </div>}
    </div>
  );
}