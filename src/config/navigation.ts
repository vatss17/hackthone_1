/**
 * Manufacturer application navigation.
 *
 * This is the single source of truth for the shell's navigation.
 *
 * - `available`: a working module. Rendered as a normal link.
 * - `preview`: a real page that honestly shows what the module will do, what it needs and what
 *   is not yet connected. Rendered as a link with a "Preview" tag. Never presented as working.
 * - `planned`: no page exists yet. Rendered as plain, non-interactive text.
 */

export type NavStatus = "available" | "preview" | "planned";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  status: NavStatus;
  /** Where it sits in the sidebar. */
  group: "workspace" | "journey";
  /** One line describing what the module does. Documentation only. */
  description: string;
}

export const navigation: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/",
    status: "available",
    group: "workspace",
    description: "Where the export journey starts and what comes next.",
  },
  {
    id: "workspace",
    label: "Export Workspace",
    href: "/workspace",
    status: "available",
    group: "workspace",
    description: "The next best action, feasibility, roadmap, documents and expert requests for one product.",
  },
  {
    id: "factory",
    label: "My Factory",
    href: "/factories",
    status: "available",
    group: "workspace",
    description: "Factories, processes, capacity, machinery and materials.",
  },
  {
    id: "products",
    label: "Products & Catalogue",
    href: "/products",
    status: "available",
    group: "workspace",
    description: "The finished products you make, with specifications and where they are made.",
  },
  {
    id: "opportunities",
    label: "Export Opportunities",
    href: "/opportunities",
    status: "available",
    group: "journey",
    description: "Opportunities for your products, and what else your factory could make.",
  },
  {
    id: "viability",
    label: "Landed Cost & Viability",
    href: "/viability",
    status: "available",
    group: "journey",
    description: "Landed cost, freight and tariff estimates, pricing scenarios.",
  },
  {
    id: "feasibility",
    label: "Export Feasibility",
    href: "/feasibility",
    status: "available",
    group: "journey",
    description: "A first-pass assessment per product: fit, cost, margin, gaps and open questions.",
  },
  {
    id: "compliance",
    label: "Compliance & Testing",
    href: "/compliance",
    status: "available",
    group: "journey",
    description: "Product requirement screening, testing and certification gaps.",
  },
  {
    id: "schemes",
    label: "CEPA & Incentives",
    href: "/schemes",
    status: "available",
    group: "journey",
    description: "India–UAE CEPA, rules of origin and Indian export incentives.",
  },
  {
    id: "documentation",
    label: "Export Documents",
    href: "/documentation",
    status: "available",
    group: "journey",
    description: "Document checklist, drafts and missing-document tracking.",
  },
  {
    id: "roadmap",
    label: "Export Readiness Roadmap",
    href: "/roadmap",
    status: "available",
    group: "journey",
    description: "Prioritised action plan, progress and readiness reports.",
  },
  {
    id: "services",
    label: "Expert Assistance",
    href: "/services",
    status: "available",
    group: "journey",
    description: "Requests for testing, freight quotes and specialist support.",
  },
];

export const workspaceNav = navigation.filter((i) => i.group === "workspace");
export const journeyNav = navigation.filter((i) => i.group === "journey");
export const availableNav = navigation.filter((i) => i.status === "available");
export const previewNav = navigation.filter((i) => i.status === "preview");
export const plannedNav = navigation.filter((i) => i.status === "planned");
