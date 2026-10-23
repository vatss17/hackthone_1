"use server";

import { requireOrganization } from "@/lib/organization";
import { aiStatus, AiError, AI_ERROR_MESSAGES, createProvider, withinLimit, type AiErrorCode } from "@/lib/ai/provider";
import { runExplanation, runExtraction } from "@/lib/ai/run";
import { logAiFailure } from "@/lib/ai/diagnostics";
import { buildExplainPayload } from "@/lib/ai/payload";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { matchEntry } from "@/lib/opportunities/engine";
import { loadEngineInput } from "@/lib/capabilities";
import { evidenceForEntry } from "@/lib/trade/evidence";
import type { Commercial } from "@/lib/explain/product";
import type { SuggestedProduct } from "@/lib/catalogue/parse";
import type { Explanation } from "@/lib/ai/schemas";

/**
 * Server Actions for the optional AI features. Each one:
 *   - requires a signed-in company member (owner for anything that leads to saving),
 *   - requires the operator's authorisation in the environment (see lib/ai/provider.ts),
 *   - requires the user's explicit consent for THIS call,
 *   - is rate limited per user, and uses fixed token and time limits,
 *   - sends only the minimum, never logs content, and returns validated suggestions for review.
 * They never write to the database.
 */

export type AiFailure = { ok: false; code: AiErrorCode; error: string };

const fail = (code: AiErrorCode): AiFailure => ({ ok: false, code, error: AI_ERROR_MESSAGES[code] });
const perHour = () => Math.max(1, Math.min(200, Number(process.env.AI_MAX_CALLS_PER_HOUR) || 20));

function prepare(userId: string, consent: boolean): { provider: NonNullable<ReturnType<typeof createProvider>> } | AiFailure {
  if (!aiStatus(process.env).configured) return fail("not_configured");
  if (consent !== true) return fail("consent_required");
  const provider = createProvider(process.env);
  if (!provider) return fail("not_configured");
  if (!withinLimit(userId, perHour())) return fail("quota");
  return { provider };
}

export async function extractWithAi(text: string, consent: boolean): Promise<{ ok: true; products: SuggestedProduct[]; rejected: { name: string; reason: string }[]; provider: string; model: string } | AiFailure> {
  const { user, organization } = await requireOrganization();
  if (organization.role !== "owner") return fail("not_configured");
  if (typeof text !== "string" || text.trim().length < 3) return fail("bad_output");
  const ready = prepare(user.id, consent);
  if ("ok" in ready) return ready;
  const t0 = Date.now();
  try {
    const r = await runExtraction(ready.provider, text);
    return { ok: true, products: r.products, rejected: r.rejected, provider: ready.provider.name, model: ready.provider.model };
  } catch (e) {
    logAiFailure({ op: "extract", provider: ready.provider.name, model: ready.provider.model, ms: Date.now() - t0 }, e);
    return fail(e instanceof AiError ? e.code : "provider_error");
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function explainWithAi(
  ref: string,
  consent: boolean,
  commercialInput: unknown,
): Promise<{ ok: true; explanation: Explanation; dropped: number; provider: string; model: string; at: string } | AiFailure> {
  const { user, organization } = await requireOrganization();
  const ready = prepare(user.id, consent);
  if ("ok" in ready) return ready;
  const t0 = Date.now();
  try {
    // The facts are rebuilt on the server from the user's own company. The browser only supplies the
    // commercial assumptions (numbers), which are validated here.
    const { facts, subject } = await loadWorkspaceFacts(organization, ref);
    const { input } = await loadEngineInput(organization.id);
    const entry = subject?.entry ?? null;
    const match = entry ? matchEntry(entry, input) : null;
    const c = commercialInput as Record<string, unknown> | null;
    const commercial: Commercial | null =
      c && num(c.landedPerUnitAed) !== null && num(c.sellingPriceAed) !== null && num(c.targetMarginPct) !== null
        ? { landedPerUnitAed: num(c.landedPerUnitAed)!, sellingPriceAed: num(c.sellingPriceAed)!, grossMarginPct: num(c.grossMarginPct), targetMarginPct: num(c.targetMarginPct)!, sample: c.sample === true }
        : null;
    const r = await runExplanation(ready.provider, buildExplainPayload({ facts, entry, match, commercial, evidence: evidenceForEntry(entry?.id) }));
    return { ok: true, explanation: r.value, dropped: r.dropped.length, provider: ready.provider.name, model: ready.provider.model, at: new Date().toISOString() };
  } catch (e) {
    logAiFailure({ op: "explain", provider: ready.provider.name, model: ready.provider.model, ms: Date.now() - t0 }, e);
    return fail(e instanceof AiError ? e.code : "provider_error");
  }
}

/** Non-secret status for pages: whether AI is on, which provider and model, and exactly what is missing. */
export async function getAiStatus() {
  await requireOrganization();
  return aiStatus(process.env);
}
