// Atlas AI: the intent router, the tools over real engines, approvals and the browser-side plan.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INTENTS, mentionedProduct, routeIntent } from "../../src/lib/atlas/intents.ts";
import { runTool, openTasksInOrder, roadmapFor, findOpportunities, compareOpportunities, landedCost, prepareInvoice, missingDocuments, nextTasks, applySchemes, explainBlockers } from "../../src/lib/atlas/tools.ts";
import { addToPlan, decide, logActivity, parseActivity, parsePlan, removePlanItem, togglePlanItem, ACTIVITY_LIMIT } from "../../src/lib/atlas/plan.ts";
import { parseSelection, selectPrompt, SELECT_SYSTEM } from "../../src/lib/atlas/llm.ts";
import { newAssessment } from "../../src/lib/landed-cost/assessment.ts";
import { sampleInputs } from "../../src/lib/landed-cost/defaults.ts";
import { calculate } from "../../src/lib/landed-cost/calc.ts";
import { RESEARCH } from "../../src/lib/research/answers.ts";
import { familyById, itemsFor } from "../../src/lib/compliance/content.ts";
import { atlas as atlasMessages } from "../../src/lib/i18n/messages/atlas.ts";
import { interpolate } from "../../src/lib/i18n/translate.ts";

const fam = familyById("food-contact");
const schemeIds = itemsFor(fam, "schemes").map((i) => i.id);
const facts = (over = {}) => ({
  ref: "prod-1",
  standalone: false,
  company: { name: "DEMO Co", legalName: null, address: "1 Test Road, Testville, India" },
  product: { name: "Food storage containers", own: true, description: true, category: true, intendedUse: true, specCount: 3, hsCode: "392310", unitWeightG: 95, unitsPerCarton: 24, cartonWeightKg: null, cartonDims: false, linkedFactories: ["Plant 1"], details: { description: "PP containers", category: "Household", intendedUse: "Food storage", specs: [], materials: ["PP"] } },
  fit: { level: "strong", score: 100, gaps: [], missingProcesses: [] },
  profile: { processNames: ["Injection moulding"], materialNames: ["PP"], factories: 1, processes: 1, machines: 5, ratedMachines: 5, materials: 1, capacity: true },
  questions: { family: "food-contact", all: schemeIds, compliance: [], testing: [], hs: [], cepa: [], schemes: schemeIds },
  opportunities: { count: 2, top: [] },
  ...over,
});
const product = (assessment = null) => ({ ref: "prod-1", name: "Food storage containers", facts: facts(), defaults: sampleInputs(), assessment, requests: [] });
const opp = (id, score, fit, gaps = []) => ({ id, name: `Product ${id}`, summary: "", fit, score, reasons: [`Uses your injection moulding (${id})`], gaps, missingProcesses: [], putsToWork: [], demand: "moderate" });
const base = (over = {}) => ({
  company: "DEMO Co",
  profile: { processes: ["Injection moulding"], materials: ["PP"], factories: 1, machines: 5, thin: false },
  catalogueSize: 30,
  yourProducts: [],
  opportunities: [opp("a", 95, "strong"), opp("b", 80, "good", ["Needs a 400 t press"]), opp("c", 50, "possible", ["Check capacity"])],
  stretchCount: 4,
  products: [{ id: "prod-1", name: "Food storage containers" }, { id: "prod-2", name: "Garden planters" }],
  ...over,
});

describe("intent router", () => {
  it("routes every suggested prompt to its own tool", () => {
    for (const i of INTENTS) assert.equal(routeIntent(i.prompt)?.intent.id, i.id, i.prompt);
  });
  it("routes free wording by the longest matching phrase", () => {
    assert.equal(routeIntent("what's blocking my export?")?.intent.id, "explain_blockers");
    assert.equal(routeIntent("Compare opportunities for me")?.intent.id, "compare_opportunities");
    assert.equal(routeIntent("can you work out the landed cost")?.intent.id, "calculate_landed_cost");
    assert.equal(routeIntent("Draft the commercial invoice")?.intent.id, "prepare_invoice");
    assert.equal(routeIntent("Is RoDTEP relevant?")?.intent.id, "apply_schemes");
  });
  it("runs nothing when nothing matches", () => {
    assert.equal(routeIntent("tell me a joke"), null);
    assert.equal(routeIntent("   "), null);
  });
  it("finds a product named in the sentence", () => {
    const ps = base().products;
    assert.equal(mentionedProduct("landed cost for the garden planters", ps)?.id, "prod-2");
    assert.equal(mentionedProduct("landed cost for my containers", ps)?.id, "prod-1");
    assert.equal(mentionedProduct("landed cost", ps), null);
  });
});

describe("intent router in Hindi, Gujarati and romanised speech", () => {
  const cases = [
    ["निर्यात के अवसर दिखाओ", "find_opportunities"],
    ["मेरी फैक्टरी क्या बना सकती है, नए उत्पाद बताओ", "find_opportunities"],
    ["export ke mauke batao", "find_opportunities"],
    ["niryat ke avsar", "find_opportunities"],
    ["નિકાસની તકો બતાવો", "find_opportunities"],
    ["nikas ni tako batavo", "find_opportunities"],
    ["मुझे क्या रोक रहा है", "explain_blockers"],
    ["kya rok raha hai mujhe", "explain_blockers"],
    ["મને શું રોકે છે", "explain_blockers"],
    ["लैंडेड कॉस्ट", "calculate_landed_cost"],
    ["मेरा मार्जिन कितना होगा", "calculate_landed_cost"],
    ["landed cost kitna aayega", "calculate_landed_cost"],
    ["લેન્ડેડ કોસ્ટ કેટલી થશે", "calculate_landed_cost"],
    ["landed cost ketlo thase", "calculate_landed_cost"],
    ["इनवॉइस बनाओ", "prepare_invoice"],
    ["कमर्शियल इन्वॉइस तैयार करो", "prepare_invoice"],
    ["invoice banao", "prepare_invoice"],
    ["ઇનવૉઇસ બનાવો", "prepare_invoice"],
    ["invoice banavo", "prepare_invoice"],
    ["कौन से दस्तावेज़ चाहिए", "missing_documents"],
    ["कौन से दस्तावेज चाहिए", "missing_documents"],
    ["kaun se document chahiye", "missing_documents"],
    ["કયા દસ્તાવેજ જોઈએ", "missing_documents"],
    ["अगले पाँच कार्य बनाओ", "create_next_tasks"],
    ["agle paanch kaam batao", "create_next_tasks"],
    ["આગામી પાંચ કાર્યો બનાવો", "create_next_tasks"],
    ["अवसरों की तुलना करो", "compare_opportunities"],
    ["opportunities ki tulna", "compare_opportunities"],
    ["તકોની સરખામણી કરો", "compare_opportunities"],
    ["सरकारी योजना के बारे में बताओ", "apply_schemes"],
    ["RoDTEP yojana", "apply_schemes"],
    ["સરકારી યોજના શું છે", "apply_schemes"],
  ];
  for (const [text, id] of cases) it(`routes "${text}" to ${id}`, () => assert.equal(routeIntent(text)?.intent.id, id));
  it("routes the suggested prompts exactly as the interface shows them in Hindi and Gujarati", () => {
    for (const lang of ["hi", "gu"]) for (const i of INTENTS) {
      const shown = atlasMessages[lang][i.prompt];
      assert.ok(shown, `${lang} prompt for ${i.id}`);
      assert.equal(routeIntent(shown)?.intent.id, i.id, `${lang}: ${shown}`);
    }
  });
  it("matches a nukta typed either way", () => {
    assert.equal(routeIntent("कौन से दस्तावेज\u093C")?.intent.id, "missing_documents");
    assert.equal(routeIntent("कौन से दस्तावेज\u095B")?.intent.id, "missing_documents");
  });
  it("still finds a product named in English inside a Hindi sentence", () => {
    assert.equal(mentionedProduct("garden planters की लैंडेड कॉस्ट", base().products)?.id, "prod-2");
  });
});

describe("tools in Hindi and Gujarati keep every number and name", () => {
  const translator = (lang) => (source, vars) => interpolate(atlasMessages[lang][source] ?? source, vars);
  const numbers = (r) => (JSON.stringify(r).match(/\d+(?:[.,]\d+)*/g) ?? []).sort();
  const names = ["Food storage containers", "Product a"];
  const a = newAssessment("prod-1", sampleInputs());
  const runs = (t) => ({
    find: findOpportunities(base(), t),
    thin: findOpportunities(base({ opportunities: [], profile: { processes: [], materials: [], factories: 0, machines: 0, thin: true } }), t),
    compare: compareOpportunities(base(), t),
    blockers: explainBlockers(product(), t),
    cost: landedCost(product(a), t),
    invoice: prepareInvoice(product(), t),
    docs: missingDocuments(product(), t),
    tasks: nextTasks(product(), 5, t),
    schemes: applySchemes(product(), t),
    viaRunTool: runTool("calculate_landed_cost", base(), product(a), t),
  });
  const english = runs(undefined);
  for (const [lang, script] of [["hi", /[ऀ-ॿ]/], ["gu", /[઀-૿]/]]) {
    const local = runs(translator(lang));
    for (const k of Object.keys(english)) {
      it(`${lang}: ${k} reports the same numbers and links as English`, () => {
        assert.deepEqual(numbers(local[k]), numbers(english[k]));
        assert.deepEqual(local[k].links.map((l) => l.href), english[k].links.map((l) => l.href));
        assert.equal(local[k].intent, english[k].intent);
        assert.deepEqual(local[k].evidence, english[k].evidence);
      });
      it(`${lang}: ${k} has a translated title, summary and caveat`, () => {
        for (const f of ["title", "summary", "caveat"]) assert.ok(script.test(local[k][f]), `${f}: ${local[k][f]}`);
        assert.doesNotMatch(JSON.stringify(local[k]), /\{\w+\}/, "an unfilled placeholder");
      });
    }
    it(`${lang}: product names survive and the landed cost matches the calculator`, () => {
      const text = JSON.stringify(local);
      for (const n of names) assert.ok(text.includes(n), n);
      const res = calculate(a.inputs);
      assert.ok(local.cost.title.includes(res.landedPerUnitAed.toLocaleString("en-IN", { maximumFractionDigits: 2 })));
      assert.ok(local.cost.title.includes("AED"));
    });
    it(`${lang}: the plan items a person approves keep the English record text`, () => {
      assert.deepEqual(local.tasks.proposal.items, english.tasks.proposal.items);
      assert.deepEqual(local.schemes.proposal.items, english.schemes.proposal.items);
    });
  }
  it("the default translator leaves English and fills placeholders", () => {
    assert.match(english.find.title, /^3 products your factory could make$/);
    assert.match(english.cost.caveat, /not a quote/);
    assert.doesNotMatch(JSON.stringify(english), /\{\w+\}/);
  });
});

describe("tools run real engines", () => {
  it("finds opportunities from the engine's ranking and cites no outside data", () => {
    const r = findOpportunities(base());
    assert.match(r.title, /3 products/);
    assert.equal(r.sections[0].items.length, 3);
    assert.equal(r.citations.length, 0);
    assert.deepEqual(r.evidence, ["inferred"]);
    assert.match(r.caveat, /not market demand/);
  });
  it("asks for a factory profile instead of inventing products", () => {
    const r = findOpportunities(base({ opportunities: [], profile: { processes: [], materials: [], factories: 0, machines: 0, thin: true } }));
    assert.equal(r.sections.length, 0);
    assert.equal(r.links[0].href, "/factories");
  });
  it("compares the top opportunities side by side", () => {
    const r = compareOpportunities(base());
    const table = r.sections.find((s) => s.kind === "table");
    assert.equal(table.rows.length, 3);
    assert.equal(table.rows[0][0], "Product a");
  });
  it("reports the same landed cost as the calculator", () => {
    const a = newAssessment("prod-1", sampleInputs());
    const r = landedCost(product(a));
    const res = calculate(a.inputs);
    assert.ok(r.title.includes(res.landedPerUnitAed.toLocaleString("en-IN", { maximumFractionDigits: 2 })));
    assert.ok(r.evidence.includes("estimate"));
    assert.match(r.caveat, /sample/);
  });
  it("never fills buyer fields when preparing the invoice", () => {
    const r = prepareInvoice(product());
    const rows = r.sections[0].rows;
    const buyer = rows.find((x) => /buyer/i.test(x.label));
    assert.ok(buyer, "a buyer field is listed");
    assert.equal(buyer.value, "Missing");
    assert.ok(r.evidence.includes("draft"));
    assert.match(r.caveat, /files and sends nothing/);
  });
  it("lists unchecked documents as open", () => {
    const r = missingDocuments(product());
    assert.ok(r.sections.some((s) => s.heading === "Not checked yet" && s.items.length > 0));
  });
  it("explains blockers from the roadmap", () => {
    const p = product();
    const r = explainBlockers(p);
    assert.equal(r.sections.length ? r.sections[0].items.length : 0, roadmapFor(p).blockers.length);
  });
  it("proposes the next five open tasks, blockers first, and saves nothing itself", () => {
    const p = product();
    const r = nextTasks(p);
    const open = openTasksInOrder(roadmapFor(p));
    assert.equal(r.proposal.items.length, Math.min(5, open.length));
    assert.equal(r.proposal.items[0].taskId, open[0].id);
    if (open.some((t) => t.blocker)) assert.ok(open[0].blocker);
  });
  it("cites only sources stored with researched scheme answers", () => {
    const r = applySchemes(product());
    const known = new Set(schemeIds.flatMap((id) => (RESEARCH[id]?.sources ?? []).map((s) => s.url)));
    assert.ok(r.citations.length > 0);
    for (const c of r.citations) assert.ok(known.has(c.url), c.url);
    assert.ok(r.proposal.items.length === schemeIds.length);
    assert.match(r.caveat, /not a ruling on eligibility/);
  });
  it("refuses product tools without a product", () => {
    assert.throws(() => runTool("calculate_landed_cost", base(), null));
    assert.equal(runTool("find_opportunities", base(), null).intent, "find_opportunities");
  });
});

describe("approvals and the plan", () => {
  const items = [{ id: "task:a", title: "A", why: "", href: "/a", taskId: "a" }, { id: "task:b", title: "B", why: "", href: "/b", taskId: "b" }];
  it("adds approved items once per product", () => {
    let plan = addToPlan([], "p1", items, "2026-10-22T00:00:00Z");
    plan = addToPlan(plan, "p1", items, "2026-10-22T00:00:00Z");
    plan = addToPlan(plan, "p2", items.slice(0, 1), "2026-10-22T00:00:00Z");
    assert.equal(plan.length, 3);
    plan = togglePlanItem(plan, "p1", "task:a");
    assert.equal(plan.find((p) => p.ref === "p1" && p.id === "task:a").done, true);
    assert.equal(plan.find((p) => p.ref === "p2").done, false);
    assert.equal(removePlanItem(plan, "p1", "task:b").length, 2);
  });
  it("survives damaged storage", () => {
    assert.deepEqual(parsePlan("not json"), []);
    assert.deepEqual(parsePlan(JSON.stringify([{ id: "x" }, 4, { id: "y", ref: "p", title: "T", href: "https://evil.example" }])).map((p) => p.href), ["/"]);
    assert.deepEqual(parseActivity("{"), []);
  });
  it("keeps the activity log newest first and capped", () => {
    let log = [];
    for (let i = 0; i < ACTIVITY_LIMIT + 5; i++) log = logActivity(log, { id: `a${i}`, at: "", prompt: "", intent: "find_opportunities", ref: null, title: "", summary: "", decision: null });
    assert.equal(log.length, ACTIVITY_LIMIT);
    assert.equal(log[0].id, `a${ACTIVITY_LIMIT + 4}`);
    assert.equal(decide(log, log[0].id, "approved")[0].decision, "approved");
  });
});

describe("model tool selection is validated", () => {
  it("accepts only a known tool and a known product id", () => {
    assert.deepEqual(parseSelection('{"tool":"calculate_landed_cost","product":"p1"}', ["p1"]), { intent: "calculate_landed_cost", productId: "p1" });
    assert.deepEqual(parseSelection('Sure! {"tool":"prepare_invoice","product":"made-up"}', ["p1"]), { intent: "prepare_invoice", productId: null });
    assert.equal(parseSelection('{"tool":"delete_everything"}', []), null);
    assert.equal(parseSelection("no json", []), null);
  });
  it("sends only the request and product names", () => {
    const prompt = selectPrompt("cost\nfor planters", [{ id: "p1", name: "Planters" }]);
    assert.ok(!prompt.includes("\ncost\n"));
    assert.match(prompt, /p1: Planters/);
    for (const i of INTENTS) assert.ok(SELECT_SYSTEM.includes(i.id));
  });
});

describe("honesty in the Atlas interface", () => {
  const chat = readFileSync(new URL("../../src/components/atlas/atlas-chat.tsx", import.meta.url), "utf8");
  const tools = readFileSync(new URL("../../src/lib/atlas/tools.ts", import.meta.url), "utf8");
  it("asks before saving a proposal and says nothing is sent", () => {
    assert.match(chat, /Approve and add/);
    assert.match(chat, /Nothing else changes and nothing is sent/);
  });
  it("invents no buyers, approvals or statistics", () => {
    assert.doesNotMatch(tools, /fetch\(/);
    assert.doesNotMatch(tools, /Math\.random/);
  });
});
