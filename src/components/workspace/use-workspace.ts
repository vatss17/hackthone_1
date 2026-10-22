"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { EVENT, read, subscribe, useAssessment, write } from "@/components/landed-cost/use-assessment";
import { documentStatus, type DocContext } from "@/lib/documents/generate";
import { parseRequests, requestsKey } from "@/lib/experts/brief";
import { buildRoadmap } from "@/lib/roadmap/engine";
import type { Assessment } from "@/lib/landed-cost/assessment";
import type { Inputs } from "@/lib/landed-cost/types";
import type { ExpertRequest, TaskStatus, WorkspaceFacts } from "@/lib/workspace/types";

/**
 * Saved expert briefs for a company, in this browser. They are NOT sent anywhere: the status is one
 * the person keeps by hand. Stored per company so two companies on one browser stay apart.
 */
export function useRequests(scope: string) {
  const key = requestsKey(scope);
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const requests = useMemo(() => parseRequests(raw), [raw]);
  const save = useCallback(
    (next: ExpertRequest[]) => {
      write(key, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return { requests, save };
}

/**
 * Everything the browser-side workspace needs for one product: the server's facts, the saved local
 * assessment (calculator, ticks, task progress, document details) and the saved expert briefs, and
 * the roadmap derived from all of them. One source of truth, so every page agrees.
 */
export function useWorkspace({ scope, facts, defaults }: { scope: string; facts: WorkspaceFacts; defaults: Inputs }) {
  const a = useAssessment({ scope, assessmentRef: facts.ref, defaults });
  const { requests, save: saveRequests } = useRequests(scope);
  const { assessment } = a;

  const ctx: DocContext = useMemo(
    () => ({
      company: facts.company,
      product: facts.product ? { name: facts.product.name, description: facts.product.details.description, hsCode: facts.product.hsCode, unitWeightG: facts.product.unitWeightG } : null,
      inputs: assessment.inputs,
      inputsAreSample: assessment.edited.length === 0,
      details: assessment.docs.details,
    }),
    [facts, assessment],
  );
  const docs = useMemo(() => documentStatus(ctx, facts.questions.family, assessment.docs.checklist), [ctx, facts.questions.family, assessment.docs.checklist]);
  const relevant = useMemo(() => requests.filter((r) => r.productRef === null || r.productRef === (facts.standalone ? null : facts.ref)), [requests, facts]);
  const roadmap = useMemo(() => buildRoadmap({ facts, assessment, docs, requests: relevant }), [facts, assessment, docs, relevant]);

  const setTask = useCallback(
    (id: string, status: TaskStatus | null, note?: string) =>
      a.update((cur: Assessment) => {
        const tasks = { ...cur.tasks };
        if (status === null) delete tasks[id];
        else tasks[id] = { status, note: note ?? tasks[id]?.note ?? "", updatedAt: new Date().toISOString() };
        return { ...cur, tasks };
      }),
    [a],
  );

  return { ...a, ctx, docs, roadmap, requests, relevantRequests: relevant, saveRequests, setTask };
}
