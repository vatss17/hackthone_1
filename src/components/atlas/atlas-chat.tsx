"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Check, CircleAlert, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INTENTS, INTENT_BY_ID, mentionedProduct, routeIntent, type IntentId } from "@/lib/atlas/intents";
import { runTool, type AtlasBase, type Evidence, type Proposal, type Section, type ToolResult } from "@/lib/atlas/tools";
import { addToPlan, decide, logActivity } from "@/lib/atlas/plan";
import { atlasAiAvailable, chooseToolWithAi, loadAtlasBase, loadAtlasProduct } from "@/lib/actions/atlas";
import { useActivity, usePlan, withLocal } from "@/components/atlas/use-atlas-store";
import { useT } from "@/lib/i18n/client";
import { VoiceAssist } from "@/components/ai-input/voice-assist";
import type { Translator } from "@/lib/atlas/tools";

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "atlas"; state: "running"; intent: IntentId; note: string }
  | { id: string; role: "atlas"; state: "done"; result: ToolResult; ref: string | null; decision: "approved" | "declined" | null }
  | { id: string; role: "atlas"; state: "choose_product"; intent: IntentId; prompt: string }
  | { id: string; role: "atlas"; state: "unknown"; text: string }
  | { id: string; role: "atlas"; state: "error"; text: string };

const evidenceLabel = (t: Translator, e: Evidence): string =>
  e === "inferred" ? t("Worked out from your data") : e === "estimate" ? t("Estimate") : e === "ai" ? t("AI research draft") : e === "secondary" ? t("Secondary sources") : e === "user" ? t("Your own figures") : e === "missing" ? t("Information missing") : t("Draft for review");

const uid = () => Math.random().toString(36).slice(2, 10);

export function AtlasChat({
  scope,
  products,
  contextRef,
  seed,
  compact = false,
  onNavigate,
}: {
  scope: string;
  products: { id: string; name: string }[];
  /** The product the current page is about, if any. */
  contextRef: string | null;
  /** A prompt to run as soon as the chat opens. Changing `seed.key` runs it again. */
  seed?: { key: string; prompt: string; ref?: string | null } | null;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ configured: boolean; provider: string | null } | null>(null);
  const [useModel, setUseModel] = useState(false);
  const [, setPlan] = usePlan(scope);
  const [, setLog] = useActivity(scope);
  const baseRef = useRef<AtlasBase | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const seen = useRef<string | null>(null);

  useEffect(() => {
    atlasAiAvailable().then(setAi, () => setAi(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs]);

  const replace = (id: string, m: Msg) => setMsgs((cur) => cur.map((x) => (x.id === id ? m : x)));

  async function execute(intent: IntentId, ref: string | null, prompt: string, id: string) {
    const needs = INTENT_BY_ID[intent].needsProduct;
    replace(id, { id, role: "atlas", state: "running", intent, note: needs ? t("Reading this product's facts and your saved work") : t("Reading your factory profile") });
    try {
      if (!baseRef.current || !needs) baseRef.current = await loadAtlasBase();
      let product = null;
      if (needs && ref) {
        const facts = await loadAtlasProduct(ref);
        if (!facts) throw new Error(t("That product could not be found in your company."));
        product = withLocal(scope, facts.facts.standalone ? { ...facts, name: t("Standalone workspace") } : facts);
      }
      const result = runTool(intent, baseRef.current, product, t);
      replace(id, { id, role: "atlas", state: "done", result, ref, decision: null });
      setLog((log) => logActivity(log, { id, at: new Date().toISOString(), prompt, intent, ref, title: result.title, summary: result.summary, decision: null }));
    } catch (e) {
      replace(id, { id, role: "atlas", state: "error", text: e instanceof Error && e.message.length < 160 ? e.message : t("Atlas could not read your data just now. Nothing was changed. Try again.") });
    }
  }

  async function ask(prompt: string, forcedRef?: string | null) {
    const clean = prompt.trim();
    if (!clean || busy) return;
    setBusy(true);
    setText("");
    const id = uid();
    setMsgs((cur) => [...cur, { id: uid(), role: "user", text: clean }, { id, role: "atlas", state: "running", intent: "find_opportunities", note: t("Choosing a tool") }]);
    try {
      let intent = routeIntent(clean)?.intent.id ?? null;
      let ref = forcedRef ?? mentionedProduct(clean, products)?.id ?? null;
      if (!intent && useModel && ai?.configured) {
        const pick = await chooseToolWithAi(clean, true);
        if (pick) {
          intent = pick.intent;
          ref = ref ?? pick.productId;
        }
      }
      if (!intent) {
        replace(id, { id, role: "atlas", state: "unknown", text: clean });
        return;
      }
      if (INTENT_BY_ID[intent].needsProduct) {
        ref = ref ?? contextRef ?? (products.length === 1 ? products[0].id : null);
        if (!ref) {
          replace(id, products.length ? { id, role: "atlas", state: "choose_product", intent, prompt: clean } : { id, role: "atlas", state: "error", text: t("Add a product first. This tool works on one product at a time.") });
          return;
        }
      }
      await execute(intent, ref, clean, id);
    } finally {
      setBusy(false);
    }
  }

  async function pickProduct(msgId: string, intent: IntentId, prompt: string, ref: string) {
    setBusy(true);
    try {
      await execute(intent, ref, prompt, msgId);
    } finally {
      setBusy(false);
    }
  }

  function answer(msgId: string, proposal: Proposal, decision: "approved" | "declined") {
    if (decision === "approved") setPlan((plan) => addToPlan(plan, proposal.ref, proposal.items, new Date().toISOString()));
    setLog((log) => decide(log, msgId, decision));
    setMsgs((cur) => cur.map((m) => (m.id === msgId && m.role === "atlas" && m.state === "done" ? { ...m, decision } : m)));
  }

  useEffect(() => {
    if (seed && seen.current !== seed.key) {
      seen.current = seed.key;
      void ask(seed.prompt, seed.ref ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.key]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("min-h-0 flex-1 overflow-y-auto", compact ? "px-4 py-4" : "py-2")} aria-live="polite">
        {msgs.length === 0 && <Welcome onPick={(p) => void ask(p)} compact={compact} />}
        <ol className="flex flex-col gap-4">
          {msgs.map((m) => (
            <li key={m.id}>
              {m.role === "user" ? (
                <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary px-3.5 py-2 text-sm text-primary-foreground">{m.text}</p>
              ) : m.state === "running" ? (
                <Running note={m.note} />
              ) : m.state === "done" ? (
                <ResultCard onGrow={() => endRef.current?.scrollIntoView({ block: "end" })} result={m.result} decision={m.decision} onAnswer={(d) => m.result.proposal && answer(m.id, m.result.proposal, d)} onNavigate={onNavigate} />
              ) : m.state === "choose_product" ? (
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm font-medium">{t("Which product should I work on?")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {products.slice(0, 8).map((p) => (
                      <Button key={p.id} size="sm" variant="outline" disabled={busy} onClick={() => void pickProduct(m.id, m.intent, m.prompt, p.id)}>
                        {p.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : m.state === "unknown" ? (
                <div className="rounded-lg border bg-card p-4 text-sm">
                  <p className="font-medium">{t("I can't run anything for that yet.")}</p>
                  <p className="mt-1 text-muted-foreground">{t("Atlas only answers with tools that work on your real data. Try one of these:")}</p>
                  <Suggestions onPick={(p) => void ask(p)} />
                </div>
              ) : (
                <p role="alert" className="flex gap-2 rounded-lg border border-(--status-missing-border) bg-(--status-missing-bg) p-3 text-sm text-(--status-missing-fg)">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {m.text}
                </p>
              )}
            </li>
          ))}
        </ol>
        <div ref={endRef} />
      </div>

      <form
        className={cn("border-t bg-card", compact ? "p-3" : "pt-3")}
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <label htmlFor={`atlas-input-${compact ? "d" : "p"}`} className="sr-only">
          {t("Ask Atlas AI")}
        </label>
        <div className="flex items-end gap-2 rounded-lg border border-input bg-background p-1.5 focus-within:outline-2 focus-within:outline-ring">
          <textarea
            id={`atlas-input-${compact ? "d" : "p"}`}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(text);
              }
            }}
            placeholder={t("Ask Atlas to find, calculate, prepare or plan…")}
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <VoiceAssist compact target="text" onText={(x) => setText((cur) => (cur.trim() ? `${cur.trim()} ${x}` : x))} />
          <Button type="submit" size="icon-sm" disabled={busy || !text.trim()} aria-label={t("Send")}>
            {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
        {ai?.configured ? (
          <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={useModel} onChange={(e) => setUseModel(e.target.checked)} className="mt-0.5 accent-(--brand-teal)" />
            {t("When Atlas does not recognise a request, send it and your product names to the AI model ({provider}) to pick a tool.", { provider: ai.provider ?? "" })}
          </label>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t("Atlas picks a tool from your words and runs it on your own data. No AI model is connected, so nothing leaves this server.")}</p>
        )}
      </form>
    </div>
  );
}

function Welcome({ onPick, compact }: { onPick: (p: string) => void; compact: boolean }) {
  const t = useT();
  return (
    <div className={cn("mb-4", compact ? "" : "rounded-lg border bg-card p-5")}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles aria-hidden className="size-4 text-(--brand-teal)" /> {t("Atlas AI")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t("Ask in your own words. Atlas runs a real tool on your factory, products and saved work, shows every step, and asks before it changes anything.")}</p>
      <Suggestions onPick={onPick} />
    </div>
  );
}

function Suggestions({ onPick }: { onPick: (p: string) => void }) {
  const t = useT();
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {INTENTS.map((i) => (
        <li key={i.id}>
          <button type="button" onClick={() => onPick(t(i.prompt))} className="rounded-full border bg-background px-3 py-1.5 text-left text-[13px] font-medium transition-colors hover:border-(--brand-teal) hover:bg-selected">
            {t(i.prompt)}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Running({ note }: { note: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground" role="status">
      <Loader2 aria-hidden className="size-4 animate-spin text-(--brand-teal)" />
      {note}…
    </div>
  );
}

function ResultCard({ result, decision, onAnswer, onNavigate, onGrow }: { onGrow: () => void; result: ToolResult; decision: "approved" | "declined" | null; onAnswer: (d: "approved" | "declined") => void; onNavigate?: () => void }) {
  const t = useT();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? result.steps.length : 0);
  useEffect(() => {
    if (shown >= result.steps.length) return;
    const timer = setTimeout(() => setShown((n) => n + 1), 260);
    return () => clearTimeout(timer);
  }, [shown, result.steps.length]);
  const ready = shown >= result.steps.length;
  useEffect(() => {
    onGrow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/50 px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">{t("Ran: {prompt}", { prompt: t(INTENT_BY_ID[result.intent].prompt) })}</p>
        <ol className="mt-2 flex flex-col gap-1.5">
          {result.steps.slice(0, shown).map((s) => (
            <motion.li key={s.label} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 text-[13px]">
              <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-(--brand-teal)" />
              <span>
                <span className="font-medium">{s.label}</span> <span className="text-muted-foreground">· {s.detail}</span>
              </span>
            </motion.li>
          ))}
        </ol>
      </div>
      <AnimatePresence>
        {ready && (
          <motion.div initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-4">
            <h3 className="text-[15px] font-semibold leading-snug">{result.title}</h3>
            <p className="mt-1 text-sm text-foreground/80">{result.summary}</p>
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("How this answer was made")}>
              {result.evidence.map((e) => (
                <li key={e} className={cn("rounded px-2 py-0.5 text-[11px] font-medium", e === "missing" ? "bg-(--status-missing-bg) text-(--status-missing-fg)" : e === "estimate" || e === "draft" ? "bg-(--status-estimate-bg) text-(--status-estimate-fg)" : e === "ai" ? "bg-(--status-ai-bg) text-(--status-ai-fg)" : "bg-secondary text-secondary-foreground")}>
                  {evidenceLabel(t, e)}
                </li>
              ))}
            </ul>
            {result.sections.map((s) => (
              <SectionView key={s.heading} section={s} onNavigate={onNavigate} />
            ))}
            {result.citations.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">{t("Sources")}</p>
                <ol className="mt-1.5 flex flex-col gap-1">
                  {result.citations.map((c, i) => (
                    <li key={c.url} className="text-[13px]">
                      <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-baseline gap-1 text-link underline-offset-2 hover:underline">
                        [{i + 1}] {c.title} <span className="text-muted-foreground">· {c.publisher}</span>
                        <ExternalLink aria-hidden className="size-3 self-center" />
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{result.caveat}</p>

            {result.proposal && (
              <div className="mt-4 rounded-md border border-(--brand-teal)/40 bg-selected p-3">
                <p className="text-sm font-semibold">{result.proposal.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("Saved in this browser, in Mission Control. Nothing else changes and nothing is sent.")}</p>
                {decision === null ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => onAnswer("approved")}>
                      {t("Approve and add")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onAnswer("declined")}>
                      {t("Not now")}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium" role="status">
                    {decision === "approved" ? (
                      <>
                        <Check aria-hidden className="size-4 text-(--brand-teal)" /> {t("Added to your plan.")}{" "}
                        <Link href={`/mission/${result.proposal.ref}`} onClick={onNavigate} className="text-link underline underline-offset-2">
                          {t("Open Mission Control")}
                        </Link>
                      </>
                    ) : (
                      t("Not added. Nothing was changed.")
                    )}
                  </p>
                )}
              </div>
            )}

            {result.links.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {result.links.map((l) => (
                  <Button key={l.href + l.label} asChild size="sm" variant="outline">
                    <Link href={l.href} onClick={onNavigate}>
                      {l.label}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

const TONE = { good: "text-(--status-verified-fg)", bad: "text-(--status-missing-fg)", warn: "text-(--status-estimate-fg)" } as const;

function SectionView({ section, onNavigate }: { section: Section; onNavigate?: () => void }) {
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground">{section.heading}</h4>
      {section.kind === "rows" ? (
        <dl className="mt-1.5 divide-y rounded-md border">
          {section.rows.map((r) => (
            <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2 text-[13px]">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className={cn("font-medium tabular-nums", r.tone && TONE[r.tone])}>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : section.kind === "list" ? (
        <ul className="mt-1.5 flex flex-col gap-2">
          {section.items.map((it) => (
            <li key={it.title} className="rounded-md border px-3 py-2.5 text-[13px]">
              {it.href ? (
                <Link href={it.href} onClick={onNavigate} className={cn("font-medium underline-offset-2 hover:underline", it.tone && TONE[it.tone])}>
                  {it.title}
                </Link>
              ) : (
                <p className={cn("font-medium", it.tone && TONE[it.tone])}>{it.title}</p>
              )}
              {it.body && <p className="mt-0.5 leading-relaxed text-muted-foreground">{it.body}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1.5 overflow-x-auto rounded-md border">
          <table className="w-full min-w-[32rem] text-left text-[13px]">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                {section.columns.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {section.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (i === 0 ? <th key={i} scope="row" className="px-3 py-2 font-medium">{cell}</th> : <td key={i} className="px-3 py-2">{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
