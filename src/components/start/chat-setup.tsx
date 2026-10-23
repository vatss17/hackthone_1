"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowUp, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { Btn } from "@/components/ux-preview/wf";
import { VoiceAssist } from "@/components/ai-input/voice-assist";
import { useAiAvailable, useFailureText } from "@/components/ai-input/shared";
import type { VoiceResult, VoiceRow } from "@/lib/ai-input/voice";
import { materialName, processName } from "@/lib/start/capability";
import {
  QUESTIONS, TEMPLATES, clearProductField, describeFactoryDelta, describeMissing, describeProductDelta, fallbackFactoryRows, firstQuestion, groupMachines, isEmptyFactoryDelta,
  isEmptyProductDelta, isFactoryReady, isProductReady, mergeFactory, mergeProduct, nextQuestion, productAiFromRows, progress, removeFactoryItem, setProductName,
  type Chip, type FactoryAnswers, type FactoryDelta, type FactoryItem, type ProductAnswers, type ProductDelta, type QuestionId,
} from "@/lib/start/chat-flow";

// ---- "Chat | Form": remembered for this visit only ---------------------------------------------------------------------

export type SetupMode = "chat" | "form";
const MODE_KEY = "atlas:start-mode:v1";
let memoryMode: SetupMode = "chat";
const modeListeners = new Set<() => void>();
const readMode = (): SetupMode => {
  try {
    const v = window.sessionStorage.getItem(MODE_KEY);
    if (v === "chat" || v === "form") return v;
  } catch {
    /* storage blocked: the choice lasts until the page is reloaded */
  }
  return memoryMode;
};
const writeMode = (m: SetupMode) => {
  memoryMode = m;
  try {
    window.sessionStorage.setItem(MODE_KEY, m);
  } catch {
    /* storage blocked */
  }
  modeListeners.forEach((l) => l());
};
const subscribeMode = (cb: () => void) => {
  modeListeners.add(cb);
  return () => void modeListeners.delete(cb);
};

/** The chosen way to answer, Chat by default. The server renders Chat; a saved "Form" choice applies after the page loads. */
export function useSetupMode(): [SetupMode, (m: SetupMode) => void] {
  const mode = useSyncExternalStore(subscribeMode, readMode, () => "chat" as SetupMode);
  return [mode, writeMode];
}

export function SetupModeSwitch({ mode, onChange }: { mode: SetupMode; onChange: (m: SetupMode) => void }) {
  const { t } = useI18n();
  const opt = (m: SetupMode, label: string) => (
    <button
      key={m}
      type="button"
      aria-pressed={mode === m}
      onClick={() => onChange(m)}
      className={`min-h-9 min-w-20 rounded px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${mode === m ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div role="group" aria-label={t("How would you like to answer?")} className="inline-flex rounded-md border border-input bg-card p-0.5">
        {opt("chat", t("Chat"))}
        {opt("form", t("Form"))}
      </div>
    </div>
  );
}

// ---- the conversation --------------------------------------------------------------------------------------------------

type Note = "ai_off" | "no_consent" | "after_failure";
type FailureCode = Parameters<ReturnType<typeof useFailureText>>[0];
type Understood = { path: "factory"; delta: FactoryDelta } | { path: "product"; delta: ProductDelta };
type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "bot"; kind: "intro" | "nothing" | "edit_prompt" | "summary" }
  | { id: number; role: "bot"; kind: "question"; qid: QuestionId }
  | { id: number; role: "bot"; kind: "understood"; what: Understood }
  | { id: number; role: "bot"; kind: "note"; note: Note }
  | { id: number; role: "bot"; kind: "failure"; code: FailureCode };
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type BotMsg = DistributiveOmit<Extract<Msg, { role: "bot" }>, "id">;
type Phase = { kind: "ask"; qid: QuestionId } | { kind: "summary" } | { kind: "edit" };

type Props = { hidden: boolean; onSwitchToForm: () => void; onDone: () => void } & (
  | { path: "factory"; answers: FactoryAnswers; onAnswers: (a: FactoryAnswers) => void }
  | { path: "product"; answers: ProductAnswers; onAnswers: (a: ProductAnswers) => void }
);

const EMPTY_FACTORY: FactoryAnswers = { processes: [], materials: [], machines: [], products: [] };
const EMPTY_PRODUCT: ProductAnswers = { name: "", desc: "", material: "", use: "", weight: "", size: "" };
const SOFT_FAILURES = new Set(["out_of_credit", "not_configured", "quota", "unauthorized"]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Chat version of the start questions. It asks one thing at a time and adds what it understands to the SAME answers the form
 * keeps (they live in the flow that renders this), so switching between Chat and Form never loses anything. It saves nothing.
 */
export function ChatSetup(props: Props) {
  const { t, locale } = useI18n();
  const failureText = useFailureText();
  const ai = useAiAvailable();
  const reduce = !!useReducedMotion();
  const uid = useId();
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });

  const productAtStart = props.path === "product" ? props.answers : undefined;
  const startQ = firstQuestion(props.path, productAtStart);
  const nextId = useRef(3);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: 1, role: "bot", kind: "intro" },
    { id: 2, role: "bot", kind: "question", qid: startQ },
  ]);
  const [phase, setPhase] = useState<Phase>({ kind: "ask", qid: startQ });
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const noted = useRef<Note | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [msgs.length, busy, reduce]);

  const say = {
    t,
    process: (c: Parameters<typeof processName>[0]) => t(processName(c)),
    material: (c: Parameters<typeof materialName>[0]) => t(materialName(c)),
  };
  const add = (items: BotMsg[]) =>
    setMsgs((cur) => [...cur, ...items.map((m) => ({ ...m, id: nextId.current++ }) as Msg)]);

  /** One call to the existing text endpoint. Never throws: a failure comes back as a code. */
  async function askAi(text: string, target: "factory" | "product"): Promise<{ ok: true; rows: VoiceRow[] } | { ok: false; code: FailureCode }> {
    const form = new FormData();
    form.set("text", text.slice(0, 4000));
    form.set("target", target);
    form.set("consent", "1");
    form.set("locale", locale);
    try {
      const res = await fetch("/api/ai-input/voice", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { ok: boolean; code?: string; result?: VoiceResult } | null;
      if (!body?.ok || !body.result) return { ok: false, code: (body?.code ?? "network") as FailureCode };
      return { ok: true, rows: body.result.rows };
    } catch {
      return { ok: false, code: "network" };
    }
  }

  /** Reads one answer, adds it to the flow's answers and returns what the bot should say. Falls back to word matching on any failure. */
  async function understand(qid: QuestionId | "edit", text: string): Promise<{ out: BotMsg[]; empty: boolean; productNext?: ProductAnswers }> {
    const out: BotMsg[] = [];
    // The AI is used only when the server has it, the person agreed, and it has not already failed for good in this chat.
    // A product name and a plain list of products are read directly: there is nothing for an AI to add.
    const wantsAi = qid !== "name" && qid !== "products";
    let rows: VoiceRow[] | null = null;
    let why: Note | null = null;
    if (wantsAi) {
      if (ai === null) why = null;
      else if (ai === false || aiOff) why = "ai_off";
      else if (!consent) why = "no_consent";
      else {
        const r = await askAi(text, props.path === "factory" ? "factory" : "product");
        if (r.ok) rows = r.rows;
        else {
          if (SOFT_FAILURES.has(r.code)) setAiOff(true);
          out.push({ role: "bot", kind: "failure", code: r.code });
          why = "after_failure";
        }
      }
      if (why && noted.current !== why) {
        noted.current = why;
        out.push({ role: "bot", kind: "note", note: why });
      }
    }
    const p = live.current;
    if (p.path === "factory") {
      const cur = p.answers;
      const use = rows && rows.length ? rows : fallbackFactoryRows(qid, text, cur);
      const { next, delta } = mergeFactory(cur, use);
      const empty = isEmptyFactoryDelta(delta);
      if (!empty) {
        p.onAnswers(next);
        out.push({ role: "bot", kind: "understood", what: { path: "factory", delta } });
      }
      return { out, empty };
    }
    const cur = p.answers;
    const step = qid === "name" ? setProductName(cur, text) : mergeProduct(cur, { text, ai: rows ? productAiFromRows(rows) : undefined, askedUse: qid === "follow_use" || qid === "follow_both" });
    const empty = isEmptyProductDelta(step.delta);
    if (!empty) {
      p.onAnswers(step.next);
      out.push({ role: "bot", kind: "understood", what: { path: "product", delta: step.delta } });
    }
    return { out, empty, productNext: step.next };
  }

  /** `value` is what is read; null means the person skipped the question. */
  async function submit(display: string, value: string | null) {
    if (busy) return;
    const shown = display.trim();
    if (!shown) return;
    const here = phase;
    setMsgs((cur) => [...cur, { id: nextId.current++, role: "user", text: shown }]);
    setInput("");
    setPicked([]);
    setBusy(true);
    try {
      const qid: QuestionId | "edit" = here.kind === "ask" ? here.qid : "edit";
      const r = value === null ? { out: [] as BotMsg[], empty: false, productNext: undefined } : await understand(qid, value);
      if (!reduce) await sleep(350);
      const tail: BotMsg[] = [...r.out];
      const stay = value !== null && r.empty;
      if (stay) {
        tail.push({ role: "bot", kind: "nothing" });
        if (here.kind === "ask") tail.push({ role: "bot", kind: "question", qid: here.qid });
      } else if (here.kind === "ask") {
        const prod = live.current.path === "product" ? (r.productNext ?? live.current.answers) : undefined;
        const nq = nextQuestion(live.current.path, here.qid, prod);
        if (nq) {
          tail.push({ role: "bot", kind: "question", qid: nq });
          setPhase({ kind: "ask", qid: nq });
        } else {
          tail.push({ role: "bot", kind: "summary" });
          setPhase({ kind: "summary" });
        }
      } else {
        tail.push({ role: "bot", kind: "summary" });
        setPhase({ kind: "summary" });
      }
      add(tail);
    } finally {
      setBusy(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  function pickChip(c: Chip) {
    const label = c.plain ? c.label : t(c.label);
    if (c.kind === "toggle") setPicked((cur) => (cur.includes(c.value) ? cur.filter((x) => x !== c.value) : [...cur, c.value]));
    else void submit(label, c.kind === "skip" ? null : c.value);
  }

  function send() {
    const text = [...picked, input.trim()].filter(Boolean).join(", ");
    void submit(text, text);
  }

  function startEdit() {
    setPhase({ kind: "edit" });
    add([{ role: "bot", kind: "edit_prompt" }]);
    inputRef.current?.focus({ preventScroll: true });
  }

  const question = phase.kind === "ask" ? QUESTIONS[phase.qid] : null;
  const pos = phase.kind === "ask" ? progress(props.path, phase.qid) : null;
  const lastSummary = [...msgs].reverse().find((m) => m.role === "bot" && m.kind === "summary")?.id;
  const factory = props.path === "factory" ? props.answers : EMPTY_FACTORY;
  const product = props.path === "product" ? props.answers : EMPTY_PRODUCT;
  const ready = props.path === "factory" ? isFactoryReady(factory) : isProductReady(product);
  const placeholder = question ? t(question.placeholder) : props.path === "factory" ? t("e.g. add 2 extruders and PVC") : t("e.g. the weight is 2 kg");

  const bot = "min-w-0 max-w-[88%] rounded-lg border bg-secondary/40 px-3.5 py-2 text-sm [overflow-wrap:anywhere]";

  const renderBot = (m: Extract<Msg, { role: "bot" }>) => {
    switch (m.kind) {
      case "intro":
        return <p className={bot}>{t("Hi. I will ask a few short questions. What you say fills in the same details as the form, and nothing is saved until you confirm it.")}</p>;
      case "question":
        return <p className={`${bot} font-medium`}>{t(QUESTIONS[m.qid].text)}</p>;
      case "nothing":
        return <p className={bot}>{t(TEMPLATES.nothingNew)}</p>;
      case "edit_prompt":
        return <p className={bot}>{t("Okay. Tell me what to add or change.")}</p>;
      case "understood":
        return <p className={bot}>{(m.what.path === "factory" ? describeFactoryDelta(m.what.delta, say) : describeProductDelta(m.what.delta, say)) ?? ""}</p>;
      case "note":
        return <p className={`${bot} text-muted-foreground`}>{t(m.note === "ai_off" ? TEMPLATES.noteAiOff : m.note === "no_consent" ? TEMPLATES.noteNoConsent : TEMPLATES.noteAfterFailure)}</p>;
      case "failure":
        return <p className={`${bot} text-muted-foreground`}>{failureText(m.code)}</p>;
      case "summary":
        return m.id === lastSummary ? (
          <Summary
            path={props.path}
            factory={factory}
            product={product}
            ready={ready}
            say={say}
            onFactory={props.path === "factory" ? props.onAnswers : undefined}
            onProduct={props.path === "product" ? props.onAnswers : undefined}
            onDone={props.onDone}
            onEdit={startEdit}
            onSwitch={props.onSwitchToForm}
          />
        ) : null;
    }
  };

  return (
    <div hidden={props.hidden}>
      <section aria-label={t("Set up by chatting")} className="min-w-0 overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-3 py-2 sm:px-4">
          <p className="min-w-0 text-sm text-muted-foreground">{pos ? t("Question {n} of {total}", pos) : t("Check what I understood")}</p>
          <button type="button" onClick={props.onSwitchToForm} className="min-h-8 text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {t("Switch to the form")}
          </button>
        </div>

        <div ref={listRef} role="log" aria-live="polite" aria-label={t("Conversation")} tabIndex={0} className="max-h-[min(60vh,30rem)] min-h-48 overflow-y-auto p-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:p-4">
          <ol className="flex flex-col gap-3">
            {msgs.map((m) => {
              const body = m.role === "user" ? <p className="ml-auto w-fit min-w-0 max-w-[85%] rounded-lg bg-primary px-3.5 py-2 text-sm text-primary-foreground [overflow-wrap:anywhere]">{m.text}</p> : renderBot(m);
              return body ? <li key={m.id} className="flex min-w-0">{body}</li> : null;
            })}
            {busy && (
              <li className="flex">
                <p className={`${bot} flex items-center gap-1`}>
                  <span className="sr-only">{t("Atlas is typing")}</span>
                  {[0, 1, 2].map((i) => (
                    <span key={i} aria-hidden className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </p>
              </li>
            )}
          </ol>
        </div>

        <form
          className="border-t p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {question && question.chips.length > 0 && !busy && (
            <div className="mb-3 flex flex-wrap gap-2">
              {question.chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  aria-pressed={c.kind === "toggle" ? picked.includes(c.value) : undefined}
                  onClick={() => pickChip(c)}
                  className={`min-h-9 max-w-full rounded-full border px-3.5 text-sm transition-colors [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${c.kind === "toggle" && picked.includes(c.value) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-secondary"}`}
                >
                  {c.plain ? c.label : t(c.label)}
                </button>
              ))}
            </div>
          )}
          <label htmlFor={`${uid}-in`} className="sr-only">{t("Your answer")}</label>
          <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-1.5 focus-within:outline-2 focus-within:outline-ring">
            <textarea
              id={`${uid}-in`}
              ref={inputRef}
              rows={2}
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={placeholder}
              className="max-h-32 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
            />
            <VoiceAssist compact target="text" onText={(x) => setInput((cur) => (cur.trim() ? `${cur.trim()} ${x}` : x))} />
            <Button type="submit" size="icon-sm" disabled={busy || (!input.trim() && !picked.length)} aria-label={t("Send")}>
              <ArrowUp />
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{t("Enter sends. Shift+Enter starts a new line.")}</p>
          {ai === true && !aiOff && (
            <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 shrink-0 accent-(--brand-teal)" />
              <span className="min-w-0">{t("My answers may be sent to an outside AI service to be understood (the one this server is set up with). Untick to use simple word matching only.")}</span>
            </label>
          )}
        </form>
      </section>
    </div>
  );
}

// ---- "Here is what I understood" ----------------------------------------------------------------------------------------

function Chips({ label, empty, children }: { label: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">{children.length ? children : <span className="text-sm text-muted-foreground">{empty}</span>}</div>
    </div>
  );
}

function Chip1({ text, removeLabel, onRemove }: { text: string; removeLabel?: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex min-h-8 max-w-full min-w-0 items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 text-sm">
      <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
          <X aria-hidden className="size-3.5" />
        </button>
      ) : (
        <span className="w-2" />
      )}
    </span>
  );
}

function Summary({ path, factory, product, ready, say, onFactory, onProduct, onDone, onEdit, onSwitch }: {
  path: "factory" | "product";
  factory: FactoryAnswers;
  product: ProductAnswers;
  ready: boolean;
  say: { t: (s: string, v?: Record<string, string | number>) => string; process: (c: Parameters<typeof processName>[0]) => string; material: (c: Parameters<typeof materialName>[0]) => string };
  onFactory?: (a: FactoryAnswers) => void;
  onProduct?: (a: ProductAnswers) => void;
  onDone: () => void;
  onEdit: () => void;
  onSwitch: () => void;
}) {
  const { t } = say;
  const none = t("Not set");
  const rm = (name: string) => t("Remove {item}", { item: name });
  const dropF = (item: FactoryItem) => onFactory?.(removeFactoryItem(factory, item));
  const missing = describeMissing(path, factory, product, t);
  return (
    <div className="w-full min-w-0 space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <h3 className="text-base font-semibold">{t("Here is what I understood")}</h3>
      {path === "factory" ? (
        <div className="space-y-3">
          <Chips label={t("Processes")} empty={none}>
            {factory.processes.map((c) => <Chip1 key={c} text={say.process(c)} removeLabel={rm(say.process(c))} onRemove={() => dropF({ kind: "process", code: c })} />)}
          </Chips>
          <Chips label={t("Materials")} empty={none}>
            {factory.materials.map((c) => <Chip1 key={c} text={say.material(c)} removeLabel={rm(say.material(c))} onRemove={() => dropF({ kind: "material", code: c })} />)}
          </Chips>
          <Chips label={t("Machines")} empty={none}>
            {groupMachines(factory.machines).map((g) => {
              const text = t(g.size ? (g.count === 1 ? TEMPLATES.machine1Size : TEMPLATES.machineNSize) : g.count === 1 ? TEMPLATES.machine1 : TEMPLATES.machineN, { count: g.count, process: say.process(g.process).toLowerCase(), size: g.size });
              return <Chip1 key={`${g.process}|${g.size}`} text={text} removeLabel={rm(text)} onRemove={() => dropF({ kind: "machines", process: g.process, size: g.size })} />;
            })}
          </Chips>
          <Chips label={t("Current products")} empty={none}>
            {factory.products.map((n) => <Chip1 key={n} text={n} removeLabel={rm(n)} onRemove={() => dropF({ kind: "product", name: n })} />)}
          </Chips>
        </div>
      ) : (
        <div className="space-y-3">
          <Chips label={t("Product")} empty={none}>{product.name ? [<Chip1 key="n" text={product.name} />] : []}</Chips>
          {(["material", "use", "weight", "size"] as const).map((k) => {
            const raw = product[k];
            const label = { material: t("Material"), use: t("Intended use"), weight: t("Weight (kg)"), size: t("Size (mm)") }[k];
            const text = k === "material" || k === "use" ? t(raw) : raw;
            return <Chips key={k} label={label} empty={none}>{raw && raw !== "I don't know" ? [<Chip1 key={k} text={text} removeLabel={rm(text)} onRemove={() => onProduct?.(clearProductField(product, k))} />] : []}</Chips>;
          })}
        </div>
      )}
      {missing && <p className="text-sm text-muted-foreground">{missing}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Btn kind="primary" onClick={onDone} disabled={!ready}>{path === "factory" ? t("Looks right: show my matches") : t("Looks right: continue")}</Btn>
        <Btn onClick={onEdit}>{t("Add or change something")}</Btn>
        <Btn kind="ghost" onClick={onSwitch}>{t("Switch to the form")}</Btn>
      </div>
    </div>
  );
}
