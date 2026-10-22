/**
 * The one next step the overview recommends, chosen by plain rules from what the company has already
 * told the platform. Pure and deterministic: no scoring, no AI. It never asks for something that already exists.
 */

export interface NextStepInput {
  factories: { id: string; name: string }[];
  profileTooThin: boolean;
  ownProducts: number;
  /** The best adjacent product, if there is one. */
  topOpportunity: { id: string; name: string; reason: string | null } | null;
}

export interface NextStep {
  kind: "add_factory" | "describe_factory" | "add_products" | "explore" | "workspace";
  title: string;
  why: string;
  cta: { label: string; href: string };
}

export function nextStep(i: NextStepInput): NextStep {
  const first = i.factories[0];
  if (!first) return { kind: "add_factory", title: "Add your factory", why: "Everything starts from what your factory can make. It takes about two minutes to begin.", cta: { label: "Add my factory", href: "/factories/new" } };
  if (i.profileTooThin) return { kind: "describe_factory", title: "Describe how your factory makes things", why: "Name your processes and machines and the platform can start suggesting products. You can add the rest later.", cta: { label: "Describe my factory", href: `/factories/${first.id}/setup` } };
  if (i.ownProducts === 0) return { kind: "add_products", title: "Tell us what you make today", why: "Import your catalogue or add a product. The platform reads it and you review before anything is saved.", cta: { label: "Add my products", href: "/products/import" } };
  if (i.topOpportunity) return { kind: "explore", title: `Take a look at ${i.topOpportunity.name}`, why: i.topOpportunity.reason ?? "It is the strongest match with the machines, processes and materials you declared.", cta: { label: "Explore this opportunity", href: `/opportunities/${i.topOpportunity.id}` } };
  return { kind: "workspace", title: "Continue in your export workspace", why: "Pick a product and the platform shows the next best action for it.", cta: { label: "Open my export workspace", href: "/workspace" } };
}
