"use server";

import { requireOrganization } from "@/lib/organization";
import { listProducts, loadEngineInput } from "@/lib/capabilities";
import { loadWorkspaceFacts } from "@/lib/workspace-facts";
import { discover, PROCESS_NAMES } from "@/lib/opportunities/engine";
import { CATALOGUE } from "@/lib/opportunities/catalogue";
import { aiStatus, createProvider, withinLimit } from "@/lib/ai/provider";
import { logAiFailure } from "@/lib/ai/diagnostics";
import { parseSelection, selectPrompt, SELECT_SYSTEM } from "@/lib/atlas/llm";
import type { AtlasBase, AtlasProduct } from "@/lib/atlas/tools";
import type { IntentId } from "@/lib/atlas/intents";

/**
 * Server Actions behind Atlas AI. They read the signed-in company's own data through its own session
 * (Row Level Security applies) and never write anything. Tools then run in the browser over this data
 * plus what the browser has saved.
 */

export async function loadAtlasBase(): Promise<AtlasBase> {
  const { organization } = await requireOrganization();
  const [{ input, factories, counts }, products] = await Promise.all([loadEngineInput(organization.id), listProducts(organization.id)]);
  const found = discover(input);
  return {
    company: organization.name,
    profile: { processes: input.processes.map((p) => p.label), materials: input.materials.map((m) => m.label), factories: factories.length, machines: counts.machines, thin: found.profileTooThin },
    catalogueSize: CATALOGUE.length,
    yourProducts: found.yourProducts.map((y) => ({ ref: y.product.id, name: y.product.name, recognisedAs: y.entry?.name ?? null, fit: y.match?.level ?? null, score: y.match?.score ?? null })),
    opportunities: found.adjacent.map((m) => ({
      id: m.entry.id,
      name: m.entry.name,
      summary: m.entry.summary,
      fit: m.level,
      score: m.score,
      reasons: m.reasons,
      gaps: m.gaps,
      missingProcesses: m.missingProcesses.map((c) => PROCESS_NAMES[c]),
      putsToWork: m.putsToWork.map((c) => PROCESS_NAMES[c]),
      demand: m.entry.demandSignal,
    })),
    stretchCount: found.stretch.length,
    products: products.map((p) => ({ id: p.id, name: p.name })),
  };
}

/** The server's facts for one product of this company (or a catalogue product, or "standalone"). Null for anything else. */
export async function loadAtlasProduct(ref: string): Promise<Omit<AtlasProduct, "assessment" | "requests"> | null> {
  const { organization } = await requireOrganization();
  if (typeof ref !== "string" || ref.length > 80) return null;
  const own = await listProducts(organization.id);
  const known = ref === "standalone" || own.some((p) => p.id === ref) || CATALOGUE.some((e) => e.id === ref);
  if (!known) return null;
  const { facts, defaults } = await loadWorkspaceFacts(organization, ref);
  return { ref, name: facts.product?.name ?? "Standalone workspace", facts, defaults };
}

/** Whether model-based tool selection is available on this server. Says nothing secret. */
export async function atlasAiAvailable(): Promise<{ configured: boolean; provider: string | null; model: string | null }> {
  await requireOrganization();
  const s = aiStatus(process.env);
  return { configured: s.configured, provider: s.provider, model: s.model };
}

/**
 * Asks the configured model to pick ONE tool for a free-text request. Only the request and the company's product
 * names and ids are sent. Needs the person's consent for this call; returns null whenever it cannot help.
 */
export async function chooseToolWithAi(text: string, consent: boolean): Promise<{ intent: IntentId; productId: string | null; model: string } | null> {
  const { user, organization } = await requireOrganization();
  if (consent !== true || typeof text !== "string" || text.trim().length < 3) return null;
  const provider = createProvider(process.env);
  if (!provider) return null;
  if (!withinLimit(`atlas:${user.id}`, Math.max(1, Math.min(200, Number(process.env.AI_MAX_CALLS_PER_HOUR) || 20)))) return null;
  const products = (await listProducts(organization.id)).map((p) => ({ id: p.id, name: p.name }));
  const t0 = Date.now();
  try {
    const reply = await provider.complete({ system: SELECT_SYSTEM, user: selectPrompt(text, products), maxTokens: 120, timeoutMs: 15000 });
    const pick = parseSelection(reply, products.map((p) => p.id));
    return pick ? { ...pick, model: provider.model } : null;
  } catch (e) {
    logAiFailure({ op: "atlas-route", provider: provider.name, model: provider.model, ms: Date.now() - t0 }, e);
    return null;
  }
}
