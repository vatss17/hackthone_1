"use server";

import { requireOrganization } from "@/lib/organization";
import { getProductDetail, listProducts } from "@/lib/capabilities";
import { listFactories } from "@/lib/factories";
import { aiStatus, createProvider, withinLimit } from "@/lib/ai/provider";
import { logAiFailure } from "@/lib/ai/diagnostics";
import { parseJsonObject } from "@/lib/ai/schemas";
import { getLocale } from "@/lib/i18n/server";
import { FINDER_MAX_TOKENS, FINDER_TIMEOUT_MS, candidatesFor, finderSystem, finderUser, rulesFallback, validateFinder, type FinderInput, type FinderResult } from "@/lib/schemes/finder";

/** What the finder reads about the company's own products and factory, so the form can be filled in one click. Reads only. */
export async function schemeFinderContext(): Promise<{ products: { id: string; name: string; category: string; description: string; material: string }[]; state: string }> {
  const { organization } = await requireOrganization();
  const [products, { active }] = await Promise.all([listProducts(organization.id), listFactories(organization.id)]);
  const detail = await Promise.all(products.slice(0, 20).map((p) => getProductDetail(organization.id, p.id)));
  return {
    products: products.slice(0, 20).map((p, i) => ({ id: p.id, name: p.name, category: p.category ?? "", description: [p.description, p.intendedUse].filter(Boolean).join(". "), material: detail[i]?.materials.join(", ") ?? "" })),
    state: active[0]?.state ?? "",
  };
}

export type FinderResponse = { ok: true; result: FinderResult; failure: string | null } | { ok: false; code: "invalid" };

/**
 * Finds the schemes worth checking. Uses the AI when it is switched on and the person agreed for this request, and falls back to
 * plain rules otherwise or on any AI failure, so a person always gets an answer. Reads only: nothing is saved.
 */
export async function findSchemes(raw: FinderInput, consent: boolean): Promise<FinderResponse> {
  const { user } = await requireOrganization();
  const t = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const input: FinderInput = {
    productName: t(raw?.productName, 120).trim(),
    category: t(raw?.category, 100),
    description: t(raw?.description, 1500),
    material: t(raw?.material, 100),
    destination: t(raw?.destination, 80).trim(),
    state: t(raw?.state, 60),
    importsInputs: raw?.importsInputs === "yes" || raw?.importsInputs === "no" ? raw.importsInputs : "unknown",
  };
  if (input.productName.length < 2 || input.destination.length < 2) return { ok: false, code: "invalid" };
  const candidates = candidatesFor(input.destination);
  const fallback = rulesFallback(input, candidates);

  if (consent !== true || !aiStatus(process.env).configured) return { ok: true, result: fallback, failure: consent === true ? "not_configured" : null };
  const provider = createProvider(process.env);
  if (!provider) return { ok: true, result: fallback, failure: "not_configured" };
  if (!withinLimit(`schemes:${user.id}`, Math.max(1, Math.min(200, Number(process.env.AI_MAX_CALLS_PER_HOUR) || 20)))) return { ok: true, result: fallback, failure: "quota" };

  const t0 = Date.now();
  try {
    const answer = await provider.complete({ system: finderSystem(await getLocale()), user: finderUser(input, candidates), maxTokens: FINDER_MAX_TOKENS, timeoutMs: FINDER_TIMEOUT_MS });
    const parsed = parseJsonObject(answer);
    const result = parsed ? validateFinder(parsed, candidates) : null;
    if (!result) return { ok: true, result: fallback, failure: "bad_output" };
    return { ok: true, result, failure: null };
  } catch (e) {
    logAiFailure({ op: "explain", provider: provider.name, model: provider.model, ms: Date.now() - t0 }, e);
    const code = (e as { code?: string })?.code;
    return { ok: true, result: fallback, failure: code === "out_of_credit" ? "out_of_credit" : code === "rate_limited" || code === "quota" ? "quota" : "provider_error" };
  }
}
