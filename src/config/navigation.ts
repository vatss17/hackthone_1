/**
 * Manufacturer application navigation.
 *
 * This is the single source of truth for the shell's navigation.
 *
 * - `available`: a real page exists. Rendered as a working link.
 * - `planned`: no page exists yet. Rendered as plain, non-interactive text
 *   under "Planned modules". Never rendered as a link and never presented as
 *   implemented.
 *
 * To ship a module: build its route, set `status: "available"`. The `href`
 * values for planned items are intended future paths and may change.
 */

export type NavStatus = "available" | "planned";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  status: NavStatus;
  /** One line describing what the module will do. Documentation only. */
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
    href: "/factory",
    status: "planned",
    description: "Company and factory profile, machinery, materials and capacity.",
  },
  {
    id: "products",
    label: "Products & Capabilities",
    href: "/products",
    status: "planned",
    description: "Existing products, manufacturing capabilities and certifications.",
  },
  {
    id: "opportunities",
    label: "UAE Opportunities",
    href: "/opportunities",
    status: "planned",
    description: "UAE import demand, supplier countries and adjacent products.",
  },
  {
    id: "viability",
    label: "Export Viability",
    href: "/viability",
    status: "planned",
    description: "Landed cost, freight and tariff estimates, pricing scenarios.",
  },
  {
    id: "compliance",
    label: "Compliance & Qualification",
    href: "/compliance",
    status: "planned",
    description: "Product requirement screening, testing and certification gaps.",
  },
  {
    id: "schemes",
    label: "Government Schemes",
    href: "/schemes",
    status: "planned",
    description: "India–UAE CEPA, rules of origin and Indian export incentives.",
  },
  {
    id: "documentation",
    label: "Export Documentation",
    href: "/documentation",
    status: "planned",
    description: "Document checklist, drafts and missing-document tracking.",
  },
  {
    id: "roadmap",
    label: "Export Roadmap",
    href: "/roadmap",
    status: "planned",
    description: "Prioritised action plan, progress and readiness reports.",
  },
  {
    id: "services",
    label: "Assisted Services",
    href: "/services",
    status: "planned",
    description: "Requests for testing, freight quotes and specialist support.",
  },
  {
    id: "evidence",
    label: "Product Evidence",
    href: "/evidence",
    status: "planned",
    description: "Specifications, test reports, certificates and their validity.",
  },
];

export const availableNav = navigation.filter((i) => i.status === "available");
export const plannedNav = navigation.filter((i) => i.status === "planned");
