/** Fictional, hard-coded example data for the wireframes. Nothing here is real. */

export const COMPANY = {
  name: "Sample Polymers Pvt Ltd",
  place: "Vapi, Gujarat",
  note: "Fictional company for wireframes",
};

export type Process = { id: string; name: string; plain: string };
export const PROCESSES: Process[] = [
  { id: "injection", name: "Injection moulding", plain: "Melted plastic is pushed into a metal mould to make shaped items such as crates, buckets and caps." },
  { id: "extrusion", name: "Extrusion", plain: "Melted plastic is pushed through a die to make a continuous shape such as pipe, sheet or profile." },
  { id: "blow", name: "Blow moulding", plain: "Air blows a hot plastic tube against a mould to make hollow items such as bottles and drums." },
  { id: "thermoforming", name: "Thermoforming", plain: "A heated plastic sheet is pulled over a mould to make trays, cups and lids." },
];

export type Material = { id: string; name: string; plain: string };
export const MATERIALS: Material[] = [
  { id: "pp", name: "PP (polypropylene)", plain: "Light and tough. Common in storage boxes and food containers." },
  { id: "hdpe", name: "HDPE (high-density polyethylene)", plain: "Stiff and chemical-resistant. Common in pipes, drums and buckets." },
  { id: "ldpe", name: "LDPE (low-density polyethylene)", plain: "Soft and flexible. Common in films, bags and squeeze bottles." },
  { id: "pet", name: "PET", plain: "Clear and strong. Common in bottles and trays." },
];

export type Opportunity = {
  id: string;
  name: string;
  fit: "Strong" | "Partial";
  needs: { process: string; materials: string[] };
  why: string;
  gaps: string[];
  unknowns: string[];
  hsCandidates: { code: string; label: string; note: string }[];
  defaultCalc: { price: number; freight: number; reference: number };
};

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "laundry",
    name: "Laundry baskets and hangers",
    fit: "Strong",
    needs: { process: "injection", materials: ["pp", "hdpe"] },
    why: "You declared injection moulding and PP. These items use the same machines and material as your crates.",
    gaps: ["A new mould is needed (tooling is bought separately)."],
    unknowns: ["Whether any destination labelling rules apply to household plastic goods."],
    hsCandidates: [
      { code: "3924", label: "Household articles of plastics", note: "Likely heading. Needs your confirmation." },
      { code: "3926", label: "Other articles of plastics", note: "Possible fallback." },
    ],
    defaultCalc: { price: 140, freight: 180000, reference: 10.5 },
  },
  {
    id: "conduit",
    name: "HDPE pipes and conduit",
    fit: "Strong",
    needs: { process: "extrusion", materials: ["hdpe"] },
    why: "You declared an extrusion line and HDPE. Pipe is made on that kind of line.",
    gaps: ["A sizing die and cooling tank may be needed for each pipe diameter."],
    unknowns: ["Which product standards buyers expect for pipe.", "Whether third-party testing is required."],
    hsCandidates: [
      { code: "3917", label: "Tubes, pipes and hoses of plastics", note: "Likely heading. Needs your confirmation." },
    ],
    defaultCalc: { price: 95, freight: 180000, reference: 7.5 },
  },
  {
    id: "food",
    name: "Reusable food containers",
    fit: "Partial",
    needs: { process: "injection", materials: ["pp"] },
    why: "Your injection machines and PP can make these. Food contact adds requirements you have not told us about.",
    gaps: ["Food-grade material evidence is not on file.", "Lids need a second mould."],
    unknowns: ["Food-contact rules for plastics.", "Whether migration testing is required."],
    hsCandidates: [
      { code: "3924", label: "Tableware, kitchenware and household articles", note: "Possible. Needs your confirmation." },
    ],
    defaultCalc: { price: 120, freight: 180000, reference: 9.0 },
  },
  {
    id: "buckets",
    name: "Buckets and mugs",
    fit: "Strong",
    needs: { process: "injection", materials: ["pp", "hdpe"] },
    why: "Simple moulded items on your existing injection machines.",
    gaps: ["Handle and rim moulds may be needed."],
    unknowns: ["Buyer packaging preferences."],
    hsCandidates: [{ code: "3924", label: "Household articles of plastics", note: "Likely heading." }],
    defaultCalc: { price: 80, freight: 180000, reference: 6.5 },
  },
  {
    id: "drums",
    name: "Water storage drums",
    fit: "Partial",
    needs: { process: "blow", materials: ["hdpe"] },
    why: "Needs blow moulding with HDPE. Drum size depends on your machine's capacity.",
    gaps: ["Machine capacity for large volumes is unknown."],
    unknowns: ["Potable-water contact rules.", "UV stabiliser requirements."],
    hsCandidates: [{ code: "3923", label: "Containers and closures of plastics", note: "Likely heading." }],
    defaultCalc: { price: 450, freight: 180000, reference: 30 },
  },
  {
    id: "trays",
    name: "Disposable trays and lids",
    fit: "Partial",
    needs: { process: "thermoforming", materials: ["pp", "pet"] },
    why: "Needs thermoforming, which you have not declared.",
    gaps: ["No thermoforming line declared."],
    unknowns: ["Whether single-use plastic rules apply."],
    hsCandidates: [{ code: "3923", label: "Containers and closures of plastics", note: "Possible." }],
    defaultCalc: { price: 60, freight: 180000, reference: 5 },
  },
];

export const SAMPLE_PRODUCT = {
  name: "Stackable storage crate 40 L",
  material: "PP (polypropylene)",
  use: "Household and light industrial storage",
  weightKg: "1.9",
  dimensionsMm: "600 x 400 x 250",
};

export type Project = {
  id: string;
  name: string;
  path: "A" | "B";
  status: string;
  next: string;
  outstanding: string[];
  recent: string;
  progress: number;
};

export const PROJECTS: Project[] = [
  {
    id: "crate",
    name: "Stackable storage crate 40 L",
    path: "A",
    status: "Ready for a closer look",
    next: "Add your ex-factory price so we can check the margin.",
    outstanding: ["Ex-factory price", "Carton size", "HS code confirmation"],
    recent: "Product details confirmed, 2 days ago",
    progress: 40,
  },
  {
    id: "laundry",
    name: "Laundry baskets and hangers",
    path: "B",
    status: "Margin is thin",
    next: "Check whether a lower freight cost makes the margin healthy.",
    outstanding: ["Mould cost", "Freight quote"],
    recent: "Landed-cost scenario saved, yesterday",
    progress: 65,
  },
  {
    id: "food",
    name: "Reusable food containers",
    path: "B",
    status: "Waiting on requirements",
    next: "Find out which food-contact rules apply. An expert can help.",
    outstanding: ["Food-grade material evidence", "Lid mould plan"],
    recent: "Opportunity selected, 5 days ago",
    progress: 20,
  },
];

export const SCENARIOS = [
  { key: "first-visit", label: "First-time visitor", where: "/ux-preview/landing", what: "Public homepage with no history." },
  { key: "returning-visit", label: "Returning visitor (signed out)", where: "/ux-preview/landing", what: "Homepage with a welcome-back strip and sign in." },
  { key: "empty-account", label: "Empty account", where: "/ux-preview/app/home", what: "Signed up, nothing added yet." },
  { key: "factory-data", label: "Existing manufacturer with factory data", where: "/ux-preview/app/home", what: "Factory saved, no export project yet." },
  { key: "incomplete-specs", label: "Product with incomplete specifications", where: "/ux-preview/assessment", what: "Assessment that says what is missing." },
  { key: "no-catalogue", label: "No catalogue available", where: "/ux-preview/path-a", what: "Add a product without a file." },
  { key: "no-market-evidence", label: "No market evidence available", where: "/ux-preview/assessment", what: "Honest empty state for market evidence." },
  { key: "ai-unavailable", label: "AI unavailable", where: "/ux-preview/path-a", what: "Reading by rules; manual entry is easy." },
  { key: "not-attractive", label: "Opportunity not commercially attractive", where: "/ux-preview/assessment", what: "Negative margin and what to try." },
  { key: "incomplete-document", label: "Incomplete document", where: "/ux-preview/app/exports/crate", what: "Draft invoice with missing fields." },
  { key: "unsaved", label: "Unsaved browser-only changes", where: "/ux-preview/app/exports", what: "Warning that work is on this device only." },
  { key: "halfway", label: "Returning halfway through onboarding", where: "/ux-preview/app/home", what: "Continue where you left off." },
] as const;

export type ScenarioKey = (typeof SCENARIOS)[number]["key"] | "default";
