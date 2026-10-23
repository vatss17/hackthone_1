import { INTENTS, INTENT_BY_ID, type IntentId } from "./intents.ts";

/**
 * Optional model-based tool selection. When an AI provider is configured on the server, Atlas may ask the
 * model which ONE of its tools fits a free-text request. The model only chooses: it never computes a figure
 * or writes an answer, and its choice is validated against the fixed tool list and the company's own
 * product ids. Anything else is discarded and the deterministic router is used instead.
 */

export const SELECT_SYSTEM = [
  "You route requests for Atlas, an export operating system for Indian manufacturers.",
  "Choose exactly one tool for the request, or none if no tool fits.",
  "Reply with JSON only: {\"tool\": <tool id or null>, \"product\": <product id or null>}.",
  "Only use a product id from the list given. Never invent ids.",
  "Tools:",
  ...INTENTS.map((i) => `- ${i.id}: ${i.does}${i.needsProduct ? " (needs a product)" : ""}`),
].join("\n");

export function selectPrompt(text: string, products: { id: string; name: string }[]): string {
  const list = products.slice(0, 40).map((p) => `- ${p.id}: ${p.name.replace(/[\r\n]+/g, " ").slice(0, 80)}`);
  return [`Request: ${text.replace(/[\r\n]+/g, " ").slice(0, 500)}`, "Products:", ...(list.length ? list : ["(none)"])].join("\n");
}

/** Reads the model's reply. Returns null unless it names a real tool and, if any, one of the given product ids. */
export function parseSelection(reply: string, productIds: string[]): { intent: IntentId; productId: string | null } | null {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let v: unknown;
  try {
    v = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const { tool, product } = v as { tool?: unknown; product?: unknown };
  if (typeof tool !== "string" || !(tool in INTENT_BY_ID)) return null;
  const productId = typeof product === "string" && productIds.includes(product) ? product : null;
  return { intent: tool as IntentId, productId };
}
