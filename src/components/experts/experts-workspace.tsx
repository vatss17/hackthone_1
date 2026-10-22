"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/auth/notice";
import { StatusBadge } from "@/components/status-badge";
import { useWorkspace } from "@/components/workspace/use-workspace";
import { LOCAL_NOTICE, STATUS_LABEL, TOPICS, TOPIC_BY_ID, composeBrief } from "@/lib/experts/brief";
import { familyById, itemsFor } from "@/lib/compliance/content";
import type { ExpertRequest, RequestStatus, RequestTopic, WorkspaceFacts } from "@/lib/workspace/types";
import type { Inputs } from "@/lib/landed-cost/types";
import { cn } from "@/lib/utils";

const NEXT: Record<RequestStatus, { to: RequestStatus; label: string } | null> = {
  draft: { to: "ready", label: "Mark ready to share" },
  ready: { to: "sent", label: "I shared it" },
  sent: { to: "answered", label: "Record an answer" },
  answered: { to: "closed", label: "Close" },
  closed: null,
};

const newId = () => `req-${(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-z0-9]/gi, "").slice(0, 14)}`;

export function ExpertsWorkspace({
  scope,
  facts,
  defaults,
  initialTopic,
  products,
}: {
  scope: string;
  facts: WorkspaceFacts;
  defaults: Inputs;
  initialTopic: RequestTopic;
  products: { ref: string; name: string }[];
}) {
  const router = useRouter();
  const w = useWorkspace({ scope, facts, defaults });
  const [topic, setTopic] = useState<RequestTopic>(initialTopic);
  const [edited, setEdited] = useState<string | null>(null);
  const [shareOk, setShareOk] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const open = useMemo(() => {
    const fam = familyById(facts.questions.family);
    if (!fam) return [] as string[];
    const expand = (s: string) => (s === "compliance" ? (["indianExport", "uaeImport", "packaging"] as const) : ([s] as ("testing" | "hs" | "cepa" | "schemes")[]));
    return TOPIC_BY_ID[topic].sections.flatMap(expand).flatMap((s) => itemsFor(fam, s)).filter((i) => !w.assessment.checks[i.id]).map((i) => i.text);
  }, [facts.questions.family, topic, w.assessment.checks]);

  const composed = useMemo(
    () => composeBrief({ topic, facts, assessment: w.assessment, docs: w.docs, openQuestions: open, preparedOn: new Date().toISOString().slice(0, 10) }),
    [topic, facts, w.assessment, w.docs, open],
  );
  const text = edited ?? composed.summary;

  const goProduct = (ref: string) => router.push(`/services?topic=${topic}${ref ? `&product=${ref}` : ""}`);

  const save = (status: RequestStatus) => {
    const now = new Date().toISOString();
    const r: ExpertRequest = {
      id: newId(),
      topic,
      productRef: facts.standalone ? null : facts.ref,
      productName: facts.product?.name ?? null,
      title: composed.title,
      summary: text.slice(0, 8000),
      status,
      reply: "",
      createdAt: now,
      updatedAt: now,
    };
    w.saveRequests([r, ...w.requests]);
    setEdited(null);
    setMessage({ tone: "success", text: "Brief saved in this browser. Nothing has been sent to anyone." });
  };

  const patchRequest = (id: string, p: Partial<ExpertRequest>) => w.saveRequests(w.requests.map((r) => (r.id === id ? { ...r, ...p, updatedAt: new Date().toISOString() } : r)));

  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      setMessage({ tone: "success", text: "Copied. Paste it into an email or message to an expert you choose." });
    } catch {
      setMessage({ tone: "error", text: "Copying was blocked by the browser. Use Download instead." });
    }
  };
  const download = (name: string, s: string) => {
    const url = URL.createObjectURL(new Blob([s], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "expert-brief"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!w.hydrated) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-6 space-y-10">
      <div className="rounded-md border border-(--status-estimate-border) bg-(--status-estimate-bg) px-4 py-3 text-sm text-(--status-estimate-fg) sm:px-5">
        <p className="font-medium">No expert is connected yet.</p>
        <p className="mt-0.5">This page prepares a brief with your context filled in. {LOCAL_NOTICE}</p>
      </div>

      <section aria-labelledby="t-h">
        <h2 id="t-h" className="text-lg font-semibold tracking-tight">
          1. What do you need help with?
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((t) => (
            <li key={t.id}>
              <label className={cn("flex h-full cursor-pointer gap-3 rounded-md border bg-card p-3.5 text-sm transition-colors", topic === t.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50")}>
                <input type="radio" name="topic" className="mt-1 size-4 accent-primary" checked={topic === t.id} onChange={() => { setTopic(t.id); setEdited(null); }} />
                <span>
                  <span className="block font-semibold">{t.label}</span>
                  <span className="mt-0.5 block text-muted-foreground">{t.blurb}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="b-h">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="b-h" className="text-lg font-semibold tracking-tight">
              2. Review the brief
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Built from your factory profile, product record, landed-cost assessment and open screening questions. Edit anything before you use it.</p>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="brief-product" className="text-xs">
              About
            </Label>
            <select id="brief-product" value={facts.standalone ? "" : facts.ref} onChange={(e) => goProduct(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
              <option value="">A general question (no product)</option>
              {products.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label htmlFor="brief" className="sr-only">
          Expert brief
        </label>
        <textarea
          id="brief"
          value={text}
          onChange={(e) => setEdited(e.target.value)}
          maxLength={8000}
          className="mt-3 min-h-96 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-[13px] leading-5 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <StatusBadge kind="inferred" />
          <span>Assembled by rules from your own records. {edited !== null ? "You have edited it." : ""}</span>
          {edited !== null && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEdited(null)}>
              Rebuild from my data
            </Button>
          )}
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={shareOk} onChange={(e) => setShareOk(e.target.checked)} />
          <span>I understand this brief contains my business information and that I will decide who receives it. The platform does not send it.</span>
        </label>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button type="button" disabled={!shareOk} onClick={() => copy(text)}>
            Copy the brief
          </Button>
          <Button type="button" variant="outline" disabled={!shareOk} onClick={() => download(composed.title, text)}>
            Download as text
          </Button>
          <Button type="button" variant="outline" onClick={() => save("draft")}>
            Save as a draft request
          </Button>
          <Button type="button" variant="outline" onClick={() => save("ready")}>
            Save as ready to share
          </Button>
        </div>
        {message && (
          <div className="mt-3">
            <Notice tone={message.tone}>{message.text}</Notice>
          </div>
        )}
      </section>

      <section aria-labelledby="r-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="r-h" className="text-lg font-semibold tracking-tight">
            3. Your requests
          </h2>
          <StatusBadge kind="user" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">You keep the status by hand: the platform cannot see whether you sent a brief or what came back.</p>
        {w.requests.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-input/60 bg-card px-4 py-5 text-sm text-muted-foreground">No requests yet. Save a brief above to start one.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-md border bg-card">
            {w.requests.map((r) => {
              const step = NEXT[r.status];
              return (
                <li key={r.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-[15px] font-semibold">{r.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {TOPIC_BY_ID[r.topic].label} · saved {r.createdAt.slice(0, 10)}
                      </p>
                    </div>
                    <span className="inline-flex h-5 items-center rounded-sm border border-(--status-ai-border) bg-(--status-ai-bg) px-1.5 text-xs font-medium text-(--status-ai-fg)">{STATUS_LABEL[r.status]}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step && (
                      <Button type="button" size="sm" onClick={() => patchRequest(r.id, { status: step.to })}>
                        {step.label}
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" disabled={!shareOk} onClick={() => copy(r.summary)}>
                      Copy
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={!shareOk} onClick={() => download(r.title, r.summary)}>
                      Download
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => window.confirm("Delete this saved request from this browser?") && w.saveRequests(w.requests.filter((x) => x.id !== r.id))}>
                      Delete
                    </Button>
                  </div>
                  {(r.status === "answered" || r.status === "closed" || r.reply) && (
                    <div className="mt-3 grid gap-1">
                      <Label htmlFor={`reply-${r.id}`} className="text-xs">
                        The answer you received (typed by you)
                      </Label>
                      <textarea
                        id={`reply-${r.id}`}
                        defaultValue={r.reply}
                        maxLength={4000}
                        onBlur={(e) => e.target.value !== r.reply && patchRequest(r.id, { reply: e.target.value })}
                        className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                      />
                      <p className="text-xs text-muted-foreground">Recorded by you. It is not verified by the platform and is not an approval.</p>
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Show the brief</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-5">{r.summary}</pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
