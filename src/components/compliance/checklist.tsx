"use client";

import { VoiceAssist } from "@/components/ai-input/voice-assist";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StatusBadge, type StatusKind } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAssessment } from "@/components/landed-cost/use-assessment";
import { answerResolved, resolvedMirror } from "@/lib/landed-cost/assessment";
import { SOURCE_BY_ID, type Evidence, type Item } from "@/lib/compliance/content";
import type { Inputs } from "@/lib/landed-cost/types";
import type { AnswerState, ScreeningAnswer } from "@/lib/workspace/types";
import { AiAnswerPanel } from "@/components/compliance/ai-answer";
import { RESEARCH, RESEARCH_AS_OF, hasResearch } from "@/lib/research/answers";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

const BADGE: Record<Evidence, StatusKind> = {
  verified: "verified",
  secondary: "secondary",
  user: "user",
  inferred: "inferred",
  assumption: "assumption",
  unknown: "unknown",
};

const stateLabels = (t: (s: string) => string): Record<AnswerState, string> => ({ answered: t("I have an answer"), not_applicable: t("Does not apply"), unknown: t("I don't know yet") });
const today = () => new Date().toISOString().slice(0, 10);
const blank = (state: AnswerState): ScreeningAnswer => ({ state, answer: "", note: "", source: "", sourceDate: "", reviewer: "", reviewedOn: "", answeredOn: today() });

/**
 * Screening questions with a structured answer each: an answer, "does not apply" with a reason, or "I don't know yet", plus a note, the
 * source you relied on, its date, and who reviewed it. Everything is typed by you and checked by no one. A question being RESOLVED means
 * you have recorded an answer. It never means the product complies.
 */
export function Checklist({ scope, assessmentRef, defaults, items }: { scope: string; assessmentRef: string; defaults: Inputs; items: Item[] }) {
  const t = useT();
  const STATE_LABEL = stateLabels(t);
  const { assessment, update, hydrated } = useAssessment({ scope, assessmentRef, defaults });
  const [stage, setStage] = useState<Record<string, "working" | "ready">>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** The research is prepared, so this only reveals it. A short pause says what is happening; reduced motion skips it. */
  const ask = (ids: string[]) => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const setTo = (v: "working" | "ready") => setStage((cur) => ({ ...cur, ...Object.fromEntries(ids.map((i) => [i, v])) }));
    if (reduced) return setTo("ready");
    setTo("working");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTo("ready"), 900);
  };
  const askable = items.filter((it) => hasResearch(it.id) && stage[it.id] !== "ready");

  const write = (id: string, fn: (cur: ScreeningAnswer | undefined) => ScreeningAnswer | null) =>
    update((a) => {
      const answers = { ...a.answers };
      const next = fn(answers[id]);
      if (next === null) delete answers[id];
      else answers[id] = next;
      return { ...a, answers, checks: resolvedMirror(answers) };
    });

  return (
    <div>
      {askable.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-(--status-ai-border) bg-selected px-4 py-3 text-sm">
          <p className="min-w-0 flex-1">{t("AI can research a draft answer for each open question below, with sources.")}</p>
          <Button type="button" size="sm" onClick={() => ask(askable.map((x) => x.id))}>
            {t("Get AI answers for all {count}", { count: askable.length })}
          </Button>
        </div>
      )}
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((it) => {
        const ans = assessment.answers[it.id];
        const resolved = !!ans && answerResolved(ans);
        const source = it.sourceId ? SOURCE_BY_ID[it.sourceId] : null;
        const id = `q-${it.id}`;
        return (
          <li key={it.id} className="px-4 py-3 sm:px-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p id={`${id}-t`} className="text-sm font-medium">
                  {t(it.text)}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t(it.why)}</p>
                {source && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Source:")} {t(source.publisher)}.{" "}
                    <Link href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {t("Open source")}
                    </Link>
                    , {t("retrieved {date}.", { date: source.retrieved })} {t(source.caveat)}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-labelledby={`${id}-t`}>
                  {(Object.keys(STATE_LABEL) as AnswerState[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!hydrated}
                      aria-pressed={ans?.state === st}
                      onClick={() => write(it.id, (cur) => (cur?.state === st ? null : { ...(cur ?? blank(st)), state: st }))}
                      className={cn("h-7 rounded-md border px-2.5 text-xs font-medium transition-colors", ans?.state === st ? "border-primary bg-mint text-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}
                    >
                      {STATE_LABEL[st]}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    {!ans ? t("Open") : ans.legacy ? t("Resolved (an earlier tick: no answer was recorded)") : resolved ? t("Resolved, not checked by anyone") : ans.state === "unknown" ? t("Not resolved: unknown") : ans.state === "answered" ? t("Write your answer to resolve it") : t("Say why it does not apply to resolve it")}
                  </span>
                </div>
                {hasResearch(it.id) && (
                  <div className="mt-2">
                    {stage[it.id] === "working" ? (
                      <p role="status" className="text-[13px] text-muted-foreground">{t("Reading public sources and drafting an answer…")}</p>
                    ) : stage[it.id] === "ready" ? (
                      <AiAnswerPanel
                        r={RESEARCH[it.id]}
                        used={!!ans?.source?.startsWith("AI research draft")}
                        onHide={() => setStage((cur) => { const { [it.id]: _d, ...rest } = cur; void _d; return rest; })}
                        onUse={() =>
                          write(it.id, (cur) => ({
                            ...blank("answered"),
                            ...(cur ?? {}),
                            state: "answered",
                            legacy: undefined,
                            answer: RESEARCH[it.id].answer.slice(0, 600),
                            note: `AI research draft. Still to confirm: ${RESEARCH[it.id].whatToConfirm}`.slice(0, 600),
                            source: `AI research draft (${RESEARCH[it.id].sources[0]?.publisher || "public sources"})`.slice(0, 200),
                            sourceDate: RESEARCH_AS_OF,
                            answeredOn: today(),
                          }))
                        }
                      />
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled={!hydrated} onClick={() => ask([it.id])}>
                        {t("Get AI answer")}
                      </Button>
                    )}
                  </div>
                )}
                {ans && (
                  <div className="mt-3 grid gap-3 rounded-md bg-muted/50 p-3 sm:grid-cols-2">
                    {ans.state === "answered" && (
                      <div className="grid gap-1 sm:col-span-2">
                        <Label htmlFor={`${id}-a`} className="text-xs">
                          {t("Your answer")}<span className="sr-only"> {t("for:")} {t(it.text)}</span>
                        </Label>
                        <Input id={`${id}-a`} value={ans.answer} maxLength={600} placeholder={ans.legacy ? t("An earlier tick: add the answer if you have one") : t("In your own words")} onChange={(e) => write(it.id, (cur) => ({ ...(cur ?? blank("answered")), answer: e.target.value, legacy: undefined }))} />
                      </div>
                    )}
                    <div className="grid gap-1 sm:col-span-2">
                      <Label htmlFor={`${id}-n`} className="text-xs">
                        {ans.state === "not_applicable" ? t("Why it does not apply (required)") : t("Note (optional)")}
                        <span className="sr-only"> {t("for:")} {t(it.text)}</span>
                      </Label>
                      <Input id={`${id}-n`} value={ans.note} maxLength={600} aria-invalid={ans.state === "not_applicable" && !ans.note.trim() ? true : undefined} onChange={(e) => write(it.id, (cur) => ({ ...(cur ?? blank(ans.state)), note: e.target.value }))} />
                      <VoiceAssist target="text" fieldId={`${id}-n`} compact />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor={`${id}-s`} className="text-xs">
                        {t("Evidence or source you relied on")}<span className="sr-only"> {t("for:")} {t(it.text)}</span>
                      </Label>
                      <Input id={`${id}-s`} value={ans.source} maxLength={200} placeholder={t("A document, page or adviser")} onChange={(e) => write(it.id, (cur) => ({ ...(cur ?? blank(ans.state)), source: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor={`${id}-sd`} className="text-xs">
                        {t("Date of that source")}<span className="sr-only"> {t("for:")} {t(it.text)}</span>
                      </Label>
                      <Input id={`${id}-sd`} type="date" value={ans.sourceDate} onChange={(e) => write(it.id, (cur) => ({ ...(cur ?? blank(ans.state)), sourceDate: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor={`${id}-r`} className="text-xs">
                        {t("Reviewed by (optional)")}<span className="sr-only"> {t("for:")} {t(it.text)}</span>
                      </Label>
                      <Input id={`${id}-r`} value={ans.reviewer} maxLength={80} onChange={(e) => write(it.id, (cur) => ({ ...(cur ?? blank(ans.state)), reviewer: e.target.value }))} />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor={`${id}-rd`} className="text-xs">
                        {t("Reviewed on")}<span className="sr-only"> {t("for:")} {t(it.text)}</span>
                      </Label>
                      <Input id={`${id}-rd`} type="date" value={ans.reviewedOn} onChange={(e) => write(it.id, (cur) => ({ ...(cur ?? blank(ans.state)), reviewedOn: e.target.value }))} />
                    </div>
                    <p className="text-xs text-muted-foreground sm:col-span-2">{t("Recorded {date}. Source and reviewer are what you typed. The platform cannot check them.", { date: ans.answeredOn || t("today") })}</p>
                    <div className="sm:col-span-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => write(it.id, () => null)}>
                        {t("Clear this answer")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <StatusBadge kind={ans?.source?.startsWith("AI research draft") ? "ai" : BADGE[it.evidence]} className="shrink-0" />
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

export function Progress({ scope, assessmentRef, defaults, ids }: { scope: string; assessmentRef: string; defaults: Inputs; ids: string[] }) {
  const t = useT();
  const { assessment, hydrated } = useAssessment({ scope, assessmentRef, defaults });
  const resolved = hydrated ? ids.filter((id) => assessment.checks[id]).length : 0;
  const unknown = hydrated ? ids.filter((id) => assessment.answers[id]?.state === "unknown").length : 0;
  return (
    <p className="text-sm">
      <span className="tnum font-semibold">{t("{resolved} of {total}", { resolved, total: ids.length })}</span>{" "}
      {t("questions resolved")}
      {unknown > 0 ? `, ${t("{count} marked unknown", { count: unknown })}` : ""}. <span className="text-muted-foreground">{t("Resolved means you have recorded an answer. It does not mean the product complies, and nothing is verified. Saved in this browser.")}</span>
    </p>
  );
}
