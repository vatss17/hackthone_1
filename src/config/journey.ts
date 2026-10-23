/**
 * The export journey: ONE definition used by the overview's guide, the demo path and the step bar on every page.
 * The order is the order a manufacturer meets the steps. Compliance and CEPA/origin screening are steps of their own.
 *
 * Every link carries what the person has already chosen: the product, or (for screening, where no product was chosen) the screening
 * family, and for expert help the topic. A link must never make someone choose the same product again.
 */

export type JourneyStepId = "catalogue" | "factory" | "opportunities" | "explore" | "evidence" | "cost" | "compliance" | "cepa" | "feasibility" | "roadmap" | "documents" | "expert";

export interface JourneyContext {
  /** A product id, a catalogue id, or null for a general (standalone) view. */
  ref: string | null;
  /** A screening family chosen by hand when no product is selected. */
  family?: string | null;
  /** An expert topic the person already picked. */
  topic?: string | null;
}

export interface JourneyStep {
  id: JourneyStepId;
  /** Short label for the step bar. */
  label: string;
  /** Plain description for the overview and the demo guide. */
  guide: string;
  href: (c: JourneyContext) => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const q = (c: JourneyContext) => (c.ref && c.ref !== "standalone" ? c.ref : null);
const qs = (pairs: [string, string | null | undefined][]) => {
  const parts = pairs.filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

export const JOURNEY: JourneyStep[] = [
  { id: "catalogue", label: "Catalogue", guide: "Import or review your products", href: (c) => (q(c) && UUID.test(q(c)!) ? `/products/${q(c)}` : "/products") },
  { id: "factory", label: "Factory", guide: "Describe your factory", href: () => "/factories" },
  { id: "opportunities", label: "Opportunities", guide: "See what else the factory could make", href: () => "/opportunities" },
  { id: "explore", label: "Explore", guide: "Open a product: why it matches", href: (c) => (q(c) ? `/opportunities/${q(c)}` : "/opportunities") },
  { id: "evidence", label: "Market evidence", guide: "Evidence and its limits", href: (c) => (q(c) ? `/opportunities/${q(c)}?stage=4` : "/evidence") },
  { id: "cost", label: "Landed cost", guide: "Landed-cost scenarios", href: (c) => `/viability${qs([["product", q(c)]])}` },
  { id: "compliance", label: "Compliance", guide: "Compliance screening", href: (c) => `/compliance${qs([["product", q(c)], ["family", q(c) ? null : c.family]])}` },
  { id: "cepa", label: "CEPA & incentives", guide: "CEPA and incentive screening", href: (c) => `/schemes${qs([["product", q(c)], ["family", q(c) ? null : c.family]])}` },
  { id: "feasibility", label: "Feasibility", guide: "The first-pass summary", href: (c) => `/feasibility/${q(c) ?? "standalone"}` },
  { id: "roadmap", label: "Roadmap", guide: "Roadmap and next best action", href: (c) => `/roadmap${qs([["product", q(c)]])}` },
  { id: "documents", label: "Documents", guide: "Draft documents", href: (c) => (q(c) ? `/documentation/${q(c)}` : "/documentation") },
  { id: "expert", label: "Expert help", guide: "Expert brief", href: (c) => `/services${qs([["product", q(c)], ["topic", c.topic]])}` },
];

export const workspaceHref = (c: JourneyContext) => (q(c) ? `/workspace/${q(c)}` : "/workspace");

/** Where the previous and next steps are, for the narrow-screen controls. */
export function neighbours(id: JourneyStepId): { prev: JourneyStep | null; next: JourneyStep | null; index: number } {
  const index = JOURNEY.findIndex((s) => s.id === id);
  return { prev: index > 0 ? JOURNEY[index - 1] : null, next: index >= 0 && index < JOURNEY.length - 1 ? JOURNEY[index + 1] : null, index };
}
