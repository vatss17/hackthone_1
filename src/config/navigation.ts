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
  /** In the main navigation. Every other module is reached in context (the journey bar, each product's workspace and the command palette). */
  primary?: boolean;
  /** One line describing what the module does. Documentation only. */
  description: string;
}

export const navigation: NavItem[] = [
  {
    id: "overview",
    primary: true,
    label: "Command Center",
    href: "/",
    status: "available",
    group: "workspace",
    description: "Where the export journey starts and what comes next.",
  },
  {
    id: "workspace",
    primary: true,
    label: "My exports",
    href: "/workspace",
    status: "available",
    group: "workspace",
    description: "The next best action, feasibility, roadmap, documents and expert requests for one product.",
  },
  {
    id: "factory",
    primary: true,
    label: "Factory Intelligence",
    href: "/factories",
    status: "available",
    group: "workspace",
    description: "Factories, processes, capacity, machinery and materials.",
  },
  {
    id: "products",
    label: "My products",
    href: "/products",
    status: "available",
    group: "workspace",
    description: "The finished products you make, with specifications and where they are made.",
  },
  {
    id: "opportunities",
    primary: true,
    label: "Opportunity Studio",
    href: "/opportunities",
    status: "available",
    group: "journey",
    description: "Opportunities for your products, and what else your factory could make.",
  },
  {
    id: "evidence",
    label: "Market Explorer",
    href: "/evidence",
    status: "available",
    group: "journey",
    description: "Reported destination trade values for the plastic product headings behind your opportunities.",
  },
  {
    id: "viability",
    label: "Export Economics",
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
    label: "Compliance Engine",
    href: "/compliance",
    status: "available",
    group: "journey",
    description: "Product requirement screening, testing and certification gaps.",
  },
  {
    id: "schemes",
    label: "Benefits Studio",
    href: "/schemes",
    status: "available",
    group: "journey",
    description: "Trade agreement (CEPA) origin rules and Indian export incentives.",
  },
  {
    id: "documentation",
    label: "Document Studio",
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
    label: "Assistance Hub",
    href: "/services",
    status: "available",
    group: "journey",
    description: "Requests for testing, freight quotes and specialist support.",
  },
  {
    id: "mission",
    primary: true,
    label: "Mission Control",
    href: "/mission",
    status: "available",
    group: "workspace",
    description: "Each export as a mission: the journey map, a task board, dependencies and blockers.",
  },
  {
    id: "world",
    primary: true,
    label: "Factory to World",
    href: "/world",
    status: "available",
    group: "journey",
    description: "How your capabilities become products, and where those products can go.",
  },
  {
    id: "schemefinder",
    primary: true,
    label: "Scheme Finder",
    href: "/schemes/finder",
    status: "available",
    group: "journey",
    description: "Tell Atlas what you export and where: it lists the researched schemes worth checking, with why and sources.",
  },
  {
    id: "whatif",
    primary: true,
    label: "What-If Studio",
    href: "/what-if",
    status: "available",
    group: "journey",
    description: "Try price, freight, exchange-rate and duty changes without touching your saved numbers.",
  },
  {
    id: "workbench",
    primary: true,
    label: "AI Workbench",
    href: "/workbench",
    status: "available",
    group: "workspace",
    description: "Atlas AI: ask in your own words, watch it run real tools, approve what it proposes.",
  },
];

/** The main navigation, in the approved order. */
const PRIMARY_ORDER = ["overview", "workbench", "factory", "opportunities", "world", "schemefinder", "workspace", "mission", "whatif"];
export const primaryNav = PRIMARY_ORDER.map((id) => navigation.find((i) => i.id === id && i.primary)).filter((i): i is NavItem => !!i);
export const moreNav = navigation.filter((i) => !i.primary);
export const workspaceNav = navigation.filter((i) => i.group === "workspace");
export const journeyNav = navigation.filter((i) => i.group === "journey");
export const availableNav = navigation.filter((i) => i.status === "available");
export const previewNav = navigation.filter((i) => i.status === "preview");
export const plannedNav = navigation.filter((i) => i.status === "planned");
