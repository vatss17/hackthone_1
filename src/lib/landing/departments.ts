/**
 * The six departments shown in the public header menu and in the "Services by department" section.
 * Every sub-service is a real capability of the app. Text here is English source: it is translated when it is shown, via t(...),
 * and tests/i18n/site-data.test.mjs checks each string has a Hindi and a Gujarati entry.
 * "draft" marks services whose content is researched and must be confirmed by people (market data, regulatory facts, scheme rules).
 */
export type DeptId = "discover" | "economics" | "compliance" | "schemes" | "documents" | "execution";

export interface SubService {
  title: string;
  line: string;
  tag: "live" | "draft";
  /** Landing-page anchor the menu item scrolls to. Defaults to the department card. */
  anchor?: string;
}

export interface Department {
  id: DeptId;
  title: string;
  summary: string;
  /** Where "Try it" goes. */
  tryHref: "/sample" | "/signup";
  services: SubService[];
}

export const DEPARTMENTS: Department[] = [
  {
    id: "discover",
    title: "Discover",
    summary: "Find out what your factory could make and where it could sell.",
    tryHref: "/sample",
    services: [
      { title: "Opportunity finder", line: "What else your factory could make, from your processes and materials.", tag: "live" },
      { title: "Factory-to-World map", line: "See how what you can do leads to products and markets.", tag: "live" },
      { title: "Market evidence", line: "Reported destination trade values, always labelled with their source.", tag: "draft" },
      { title: "Machine and product recognition", line: "Upload a photo and Atlas suggests what it shows, for you to confirm.", tag: "live" },
    ],
  },
  {
    id: "economics",
    title: "Economics",
    summary: "Know what a shipment really costs before you quote.",
    tryHref: "/sample",
    services: [
      { title: "Landed-cost calculator", line: "Cost to land your product at the buyer, line by line, with margin.", tag: "live" },
      { title: "AI logistics estimate", line: "Freight, handling and insurance ranges, with the sources they came from.", tag: "draft" },
      { title: "What-If studio", line: "Change cost, freight, quantity or price and watch the result move.", tag: "live" },
      { title: "Scenario comparison", line: "Put two or more versions side by side.", tag: "live" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance",
    summary: "See what to check before the goods leave, in plain language.",
    tryHref: "/sample",
    services: [
      { title: "Requirement screening", line: "Questions to settle for your product family, not rulings.", tag: "draft" },
      { title: "Testing and certification gaps", line: "Which evidence a buyer or authority may ask for, and what you hold.", tag: "draft" },
      { title: "HS code helper", line: "A rule-based starting point, not an official classification.", tag: "live" },
      { title: "AI research answers", line: "Drafted answers with sources and what to confirm.", tag: "draft" },
    ],
  },
  {
    id: "schemes",
    title: "Schemes & benefits",
    summary: "AI reads your product and destination and shows the schemes worth checking.",
    tryHref: "/signup",
    services: [
      { title: "AI scheme finder", line: "Reads your product and destination, shows the schemes worth checking and why.", tag: "draft", anchor: "schemes-ai" },
      { title: "CEPA origin check", line: "Questions on whether your product could meet the trade-agreement origin rules.", tag: "draft" },
      { title: "RoDTEP and duty drawback", line: "What to ask about refunds of embedded taxes and duties.", tag: "draft" },
      { title: "Advance Authorisation", line: "Whether duty-free imports of inputs against an export obligation could suit you.", tag: "draft" },
      { title: "State incentives", line: "Pointers to the state-level schemes to look up for your location.", tag: "draft" },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    summary: "Drafts of the paperwork, and a check for what is missing.",
    tryHref: "/sample",
    services: [
      { title: "Commercial invoice draft", line: "Filled from your product and shipment details.", tag: "live" },
      { title: "Packing list draft", line: "Cartons, weights and volumes laid out for the shipment.", tag: "live" },
      { title: "Document checklist", line: "The papers a shipment like yours usually needs.", tag: "live" },
      { title: "Missing-document check", line: "What is still not ready before you ship.", tag: "live" },
    ],
  },
  {
    id: "execution",
    title: "Execution",
    summary: "Run the whole journey, with help when you need it.",
    tryHref: "/signup",
    services: [
      { title: "Mission Control", line: "Journey map and task board: every step and what is blocking you.", tag: "live" },
      { title: "Expert assistance briefs", line: "A ready brief to hand to an adviser or broker.", tag: "live" },
      { title: "Atlas AI assistant", line: "Ask questions and have tasks and drafts prepared. You approve before anything is saved.", tag: "live" },
      { title: "Set up by chatting", line: "Answer questions and the form fills itself.", tag: "live" },
    ],
  },
];

export const deptHref = (id: DeptId, anchor?: string) => `/welcome#${anchor ?? `dept-${id}`}`;

/** Every English string this module puts on screen, for the translation test. */
export function departmentStrings(): string[] {
  return DEPARTMENTS.flatMap((d) => [d.title, d.summary, ...d.services.flatMap((s) => [s.title, s.line])]);
}
