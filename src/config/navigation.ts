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
  /** One line describing what the module does. Documentation only. */
  description: string;
}

export const navigation: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/",
    status: "available",
    description: "Where the export journey starts and what comes next.",
  },
  {
    id: "factory",
    label: "My Factory",
    href: "/factories",
    status: "available",
    description: "Factories, processes, capacity, machinery and materials.",
  },
  {
    id: "products",
    label: "Products",
    href: "/products",
    status: "available",
    description: "The finished products you make, with specifications and where they are made.",
  },
  {
    id: "opportunities",
    label: "Export Opportunities",
    href: "/opportunities",
    status: "available",
    description: "Opportunities for your products, and what else your factory could make.",
  },
  {
    id: "viability",
    label: "Landed Cost & Viability",
    href: "/viability",
    status: "preview",
    description: "Landed cost, freight and tariff estimates, pricing scenarios.",
  },
  {
    id: "compliance",
    label: "Compliance & Testing",
    href: "/compliance",
    status: "preview",
    description: "Product requirement screening, testing and certification gaps.",
  },
  {
    id: "schemes",
    label: "CEPA & Incentives",
    href: "/schemes",
    status: "preview",
    description: "India–UAE CEPA, rules of origin and Indian export incentives.",
  },
  {
    id: "documentation",
    label: "Export Documents",
    href: "/documentation",
    status: "preview",
    description: "Document checklist, drafts and missing-document tracking.",
  },
  {
    id: "roadmap",
    label: "Export Readiness Roadmap",
    href: "/roadmap",
    status: "preview",
    description: "Prioritised action plan, progress and readiness reports.",
  },
  {
    id: "services",
    label: "Expert Assistance",
    href: "/services",
    status: "preview",
    description: "Requests for testing, freight quotes and specialist support.",
  },
];

export const availableNav = navigation.filter((i) => i.status === "available");
export const previewNav = navigation.filter((i) => i.status === "preview");
export const plannedNav = navigation.filter((i) => i.status === "planned");
