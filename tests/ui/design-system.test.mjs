// The design system (Portlane, "a modern trade desk"): tokens, contrast, brand assets, shared components and the rules the redesign relies on.
// Static and computational checks: no browser, no database.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { primaryNav } from "../../src/config/navigation.ts";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const css = read("src/app/globals.css");

function walk(dir) {
  const root = new URL(`../../${dir}`, import.meta.url).pathname;
  const go = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? go(join(d, f)) : [join(d, f)]));
  return go(root).filter((f) => /\.(tsx|ts|css)$/.test(f));
}

const token = (name) => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} is missing`);
  return m[1];
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("contrast (WCAG 2.2 AA)", () => {
  const bg = token("background");
  const card = token("card");
  it("body, muted and brand text meet 4.5:1 on the canvas and on white", () => {
    assert.ok(ratio(token("foreground"), bg) >= 4.5);
    assert.ok(ratio(token("muted-foreground"), bg) >= 4.5, `muted on canvas ${ratio(token("muted-foreground"), bg).toFixed(2)}`);
    assert.ok(ratio(token("muted-foreground"), card) >= 4.5);
    assert.ok(ratio(token("primary"), card) >= 4.5);
    assert.ok(ratio(token("primary-foreground"), token("primary")) >= 4.5);
    assert.ok(ratio(token("destructive"), card) >= 4.5);
    assert.ok(ratio(token("amber-text"), card) >= 4.5);
  });
  it("form control borders meet 3:1 against white", () => {
    assert.ok(ratio(token("input"), card) >= 3, `input border ${ratio(token("input"), card).toFixed(2)}`);
  });
  it("the navigation text, the selected row and the secondary text on it meet 4.5:1", () => {
    assert.ok(ratio(token("sidebar-foreground"), token("sidebar")) >= 4.5);
    assert.ok(ratio(token("sidebar-accent-foreground"), token("sidebar-accent")) >= 4.5);
    assert.ok(ratio(token("sidebar-primary"), token("sidebar-accent")) >= 4.5);
    assert.ok(ratio(token("muted-foreground"), token("selected")) >= 4.5);
  });
  it("every status label pair meets 4.5:1", () => {
    for (const k of ["verified", "secondary", "user", "estimate", "ai", "missing"]) {
      const r = ratio(token(`status-${k}-fg`), token(`status-${k}-bg`));
      assert.ok(r >= 4.5, `${k} ${r.toFixed(2)}`);
    }
  });
});

describe("status is never colour alone", () => {
  const badge = read("src/components/status-badge.tsx");
  const kinds = [...badge.match(/export type StatusKind =([\s\S]*?);/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  it("every status kind has an icon and a text label", () => {
    for (const k of kinds) {
      assert.match(badge, new RegExp(`\\b${k}:\\s*[A-Z]\\w+,`), `no icon for ${k}`);
      assert.match(badge, new RegExp(`${k}:\\s*\\{[\\s\\S]*?label:`), `no label for ${k}`);
    }
    assert.match(badge, /aria-hidden/);
  });
  it("inline messages carry an icon next to the colour, and task pills too", () => {
    assert.match(read("src/components/auth/notice.tsx"), /Icon aria-hidden/);
    assert.match(read("src/components/workspace/roadmap-board.tsx"), /STATUS_ICON/);
  });
  it("a negative margin is shown with text and an icon, not only red", () => {
    const w = read("src/components/landed-cost/workspace.tsx");
    assert.match(w, /loss-making/);
    assert.match(w, /TriangleAlert/);
  });
});

describe("numbers", () => {
  it("compared figures use tabular numerals, not a monospace face", () => {
    assert.match(css, /\.tnum\s*\{[^}]*tabular-nums/);
    for (const f of ["src/components/landed-cost/workspace.tsx", "src/components/landed-cost/charts.tsx", "src/components/workspace/workspace-overview.tsx"]) {
      assert.ok(!/font-mono tabular-nums/.test(read(f)), f);
      assert.match(read(f), /\btnum\b/, f);
    }
    assert.match(read("src/components/ui/table.tsx"), /tnum/);
  });
  it("numeric inputs are right-aligned with a fixed unit column", () => {
    const w = read("src/components/landed-cost/workspace.tsx");
    assert.match(w, /className="tnum text-right"/);
    assert.match(w, /w-9 shrink-0/);
  });
});

describe("one foundation, no stray palette", () => {
  it("no hard-coded Tailwind palette colours in the app (tokens only)", () => {
    const bad = [];
    for (const f of [...walk("src/app"), ...walk("src/components")].filter((x) => /\.tsx$/.test(x))) {
      for (const m of read(f.replace(/^.*\/src\//, "src/")).matchAll(/\b(?:text|bg|border|ring|fill|stroke)-(?:red|green|blue|yellow|orange|emerald|sky|rose|gray|slate|zinc|stone|neutral|amber)-\d+/g)) bad.push(`${f.split("/src/")[1]}: ${m[0]}`);
    }
    // The printed documents and their landing-page preview are deliberately plain black on white.
    assert.deepEqual(bad.filter((b) => !b.includes("documents-workspace") && !b.includes("public/previews")), []);
  });
  it("radii are small and shared inside the app: larger radii only on the marketing landing and overlays", () => {
    const allowed = /components\/(landing|public)\/|command-palette|ai-input\/shared/;
    const bad = [...walk("src/app"), ...walk("src/components")].filter((f) => /\.tsx$/.test(f) && !allowed.test(f) && /rounded-(xl|2xl|3xl)/.test(readFileSync(f, "utf8")));
    assert.deepEqual(bad, []);
  });
  it("reduced motion is honoured globally and by every animated component", () => {
    assert.match(css, /\.rise\s*\{\s*animation:\s*none/);
    assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*transition-duration:\s*0\.01ms/);
    const all = walk("src/components").filter((f) => /\.tsx$/.test(f));
    assert.ok(!/animate-bounce/.test(all.map((f) => readFileSync(f, "utf8")).join("")));
    for (const f of all) {
      const t = readFileSync(f, "utf8");
      if (/from "motion\/react"/.test(t) && /animate=|whileInView|useScroll/.test(t)) assert.match(t, /useReducedMotion/, f.split("/src/")[1]);
      if (/animate-ping/.test(t)) assert.match(t, /!reduce && <span[^>]*animate-ping/, f.split("/src/")[1]);
    }
  });
});

describe("components", () => {
  it("buttons have a visible focus ring, a disabled look, and touch-size defaults", () => {
    const b = read("src/components/ui/button.tsx");
    assert.match(b, /focus-visible:outline-2/);
    // outline-none would set outline-style: none and hide the ring that focus-visible:outline-2 draws.
    assert.ok(!/\boutline-none\b/.test(b), "button must not remove its focus outline");
    assert.match(b, /disabled:bg-muted/);
    assert.match(b, /default: "h-11 px-4 md:h-10"/);
    assert.match(b, /outline:\s*\n?\s*"border-input bg-card/);
  });
  it("tables scroll in a labelled, focusable region", () => {
    const t = read("src/components/ui/table.tsx");
    assert.match(t, /tabIndex=\{0\}/);
    assert.match(t, /role="region"/);
  });
  it("the page header offers breadcrumbs and a single-size title", () => {
    const h = read("src/components/page-header.tsx");
    assert.match(h, /aria-label=\{t\("Breadcrumb"\)\}/); // the name goes through the translator
    assert.match(h, /aria-current/);
  });
  it("loading states announce themselves and do not animate for reduced motion", () => {
    assert.match(read("src/components/ui/skeleton.tsx"), /role="status"/);
    assert.match(read("app/(app)/loading.tsx".replace(/^/, "src/")), /motion-safe:animate-pulse/);
  });
});

describe("application shell and navigation", () => {
  it("the rail has the Atlas modules in three stages, each with an icon, and marks the current page", () => {
    assert.deepEqual(primaryNav.map((i) => i.id), ["overview", "workbench", "factory", "opportunities", "world", "schemefinder", "workspace", "mission", "whatif"]);
    const n = read("src/components/layout/nav-list.tsx");
    for (const id of primaryNav.map((i) => i.id)) assert.match(n, new RegExp(`${id}:\\s*[A-Z]\\w+`));
    for (const st of ["Command", "Discover", "Execute"]) assert.match(n, new RegExp(`label: "${st}"`));
    assert.match(n, /aria-current/);
  });
  it("pages reached from a product keep 'My exports' lit and the catalogue sits under 'My factory'", () => {
    const n = read("src/components/layout/nav-list.tsx");
    assert.match(n, /EXPORT_PATHS = \[[^\]]*"\/viability"[^\]]*"\/documentation"/);
    assert.match(n, /FACTORY_PATHS = \["\/factories", "\/products"\]/);
  });
  it("the product stays in view: name, whose it is, and a way to change it, on every product page", () => {
    const j = read("src/components/journey-bar.tsx");
    assert.match(j, /Working on/);
    assert.match(j, /Change product/);
    assert.match(j, /Your product|Suggested/);
    assert.match(j, /getProductName/);
  });
  it("the journey navigator lists every step and keeps the product sections", () => {
    const j = read("src/components/journey-bar.tsx");
    for (const t of ["Overview", "Mission", "Economics", "What-if", "Requirements", "Action plan", "Documents", "Expert help"]) assert.match(j, new RegExp(`label: "${t}"`));
    assert.match(j, /JOURNEY\.map/);
  });
});

describe("documents and expert help", () => {
  const d = read("src/components/documents/documents-workspace.tsx");
  it("previews sit on a paper sheet apart from the editing controls, and print without the desk", () => {
    assert.match(d, /doc-desk/);
    assert.match(d, /className="no-print/);
    assert.match(css, /\.print-doc \.doc-desk\s*\{[^}]*background:\s*none/);
    assert.match(css, /\.no-print\s*\{\s*display:\s*none/);
  });
  it("draft warnings and missing-data markers stay on the page", () => {
    assert.match(d, /These are drafts for you to review, not finished documents/);
    assert.match(d, /DraftBanner/);
    assert.match(d, /aria-label="Commercial invoice draft preview"/);
  });
  const e = read("src/components/experts/experts-workspace.tsx");
  it("preparing, saving and sharing a brief are three different things, and no expert is implied", () => {
    assert.match(e, /Keep it here/);
    assert.match(e, /Share it yourself/);
    assert.match(e, /No expert is connected yet/);
    assert.match(e, /the platform sends nothing/);
    assert.match(e, /kind="local"/);
    assert.match(e, /kind="manual"/);
  });
});

describe("Atlas: the visual system", () => {
  it("uses the specified semantic values: warm off-white, deep navy, charcoal and a subtle teal", () => {
    const want = { background: "#f7f5f0", card: "#ffffff", foreground: "#1a2132", "muted-foreground": "#5d6372", border: "#e4e0d6", primary: "#16233f", "primary-hover": "#22325a", selected: "#e4f0ee", link: "#1f6f6b", ring: "#1f6f6b", success: "#2c6a4c", warning: "#87591a", error: "#ae3a35" };
    for (const [k, v] of Object.entries(want)) assert.equal(token(k).toLowerCase(), v, k);
  });
  it("success, warning and error text meet 4.5:1 on white and on their tints", () => {
    for (const [fg, bg] of [["success", "status-verified-bg"], ["warning", "status-estimate-bg"], ["error", "status-missing-bg"]]) {
      assert.ok(ratio(token(fg), token("card")) >= 4.5, `${fg} on white`);
      assert.ok(ratio(token(fg), token(bg)) >= 4.5, `${fg} on its tint`);
    }
    assert.ok(ratio(token("link"), token("card")) >= 4.5, "teal links on white");
    assert.ok(ratio(token("link"), token("background")) >= 4.5, "teal links on the canvas");
    assert.ok(ratio(token("primary-foreground"), token("primary-hover")) >= 4.5);
    assert.ok(ratio(token("muted-foreground"), token("background")) >= 4.5);
  });
  it("navy carries the brand and teal is a quiet accent: the canvas is warm, not blue", () => {
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [r, g, b] = rgb(token("background"));
    assert.ok(r >= b && g >= b, "the canvas leans warm");
    const [pr, pg, pb] = rgb(token("primary"));
    assert.ok(pb > pr && pb > pg && pr + pg + pb < 200, "primary is a deep navy");
    const [tr, tg, tb] = rgb(token("brand-teal"));
    assert.ok(tg > tr && tb > tr, "the accent is teal");
  });
  it("no blur or glass in the app; strong shadows only on overlays", () => {
    const bad = [];
    for (const f of [...walk("src/app"), ...walk("src/components")].filter((x) => /\.(tsx|css)$/.test(x))) {
      const t = readFileSync(f, "utf8");
      for (const re of [/backdrop-(blur|filter)/, /\bblur-/, /drop-shadow/]) if (re.test(t) && !f.includes("components/ui/sheet")) bad.push(`${f.split("/src/")[1]}: ${re}`);
      if (/shadow-(lg|xl|2xl)\b/.test(t) && !/components\/(ui\/sheet|atlas\/(atlas-provider|command-palette|header-actions)|ai-input\/shared|layout\/language-select|landing\/|public\/)/.test(f)) bad.push(`${f.split("/src/")[1]}: strong shadow`);
    }
    assert.deepEqual(bad, []);
  });
  it("shadows are limited to overlays and the paper sheet", () => {
    const hits = [...walk("src/app"), ...walk("src/components")].filter((f) => /\.tsx$/.test(f) && /\bshadow-(sm|md)\b/.test(readFileSync(f, "utf8"))).map((f) => f.split("/src/")[1]);
    for (const h of hits) assert.ok(/documents-workspace|landed-cost\/workspace|app-shell|ui\/sheet|landing\/|public\//.test(h), `unexpected shadow in ${h}`);
  });
  it("sentence case: no uppercase eyebrows outside the printed documents", () => {
    const bad = [...walk("src/app"), ...walk("src/components")].filter((f) => /\.tsx$/.test(f) && !f.includes("documents-workspace") && !f.includes("ux-preview") && /\buppercase\b/.test(readFileSync(f, "utf8")));
    assert.deepEqual(bad.map((f) => f.split("/src/")[1]), []);
  });
  it("body copy is 15px at 1.5, and controls are 44px on phones and 40px on wider screens", () => {
    assert.match(css, /text-\[15px\] leading-\[1\.5\]/);
    assert.match(read("src/components/ui/input.tsx"), /h-11[^"]*md:h-10/);
    assert.match(read("src/components/ui/button.tsx"), /"h-11 px-4 md:h-10"/);
  });
  it("IBM Plex Sans is self-hosted by next/font at weights 400, 500 and 600 only", () => {
    const l = read("src/app/layout.tsx");
    assert.match(l, /IBM_Plex_Sans/);
    assert.match(l, /weight:\s*\["400", "500", "600"\]/);
  });
  it("the page heading is 28px at weight 600", () => {
    assert.match(read("src/components/page-header.tsx"), /text-\[1\.75rem\] font-semibold/);
  });
});

describe("Atlas: brand assets", () => {
  const files = ["atlas-logo.svg", "atlas-logo-mono.svg", "atlas-logo-white.svg", "atlas-symbol.svg"];
  it("ships clean vector logos with no bitmap, text dependency or script", () => {
    for (const f of files) {
      const svg = read(`public/brand/${f}`);
      assert.match(svg, /^<svg /);
      assert.ok(!/<image|<text|<script|data:image|<foreignObject/i.test(svg), f);
    }
    const icon = read("src/app/icon.svg");
    assert.ok(!/<image|<text|<script/i.test(icon));
    assert.ok(!existsSync(new URL("../../public/brand/portlane-logo.svg", import.meta.url)), "no old brand file remains");
  });
  it("the full logo is navy and charcoal with a teal arc; the single-colour version has one ink", () => {
    const colours = (f) => [...new Set([...read(`public/brand/${f}`).matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toLowerCase()))];
    const full = colours("atlas-logo.svg");
    for (const c of ["#16233f", "#1a2132", "#7fd3c9"]) assert.ok(full.includes(c), c);
    // One ink colour; the mark's strokes are knocked out in white.
    assert.equal(colours("atlas-logo-mono.svg").filter((c) => c !== "#ffffff").length, 1);
  });
  it("the mark is an A with a horizon arc on a rounded tile, on a 24px grid", () => {
    const b = read("src/components/brand-paths.ts");
    assert.match(b, /MARK_A = "M6\.6 18 12 5\.8 17\.4 18"/);
    assert.match(b, /MARK_ARC = /);
    assert.match(read("public/brand/atlas-symbol.svg"), /viewBox="0 0 24 24"/);
  });
  it("the app uses the brand component and no old name remains in the shell", () => {
    assert.match(read("src/components/layout/app-shell.tsx"), /Atlas, the export operating system/);
    assert.match(read("src/components/layout/brand.tsx"), /aria-label="Atlas"/);
    const shell = read("src/components/layout/app-shell.tsx") + read("src/components/layout/brand.tsx") + read("src/components/public/public-header.tsx");
    assert.ok(!/Export Enablement|portlane/i.test(shell));
  });
  it("there is no favicon.ico left from the template", () => {
    assert.ok(!existsSync(new URL("../../src/app/favicon.ico", import.meta.url)));
  });
});

describe("Atlas: landing page", () => {
  const l = read("src/components/public/landing.tsx");
  const hero = read("src/components/landing/hero.tsx");
  const story = read("src/components/landing/story.tsx");
  const demo = read("src/components/landing/try-demo.tsx");
  const all = l + hero + story + demo;
  it("uses the specified hero headline and real routes for the calls to action", () => {
    assert.match(hero, /Your factory\./);
    assert.match(hero, /The world\./);
    assert.match(hero, /One intelligent platform\./);
    assert.match(all, /href="\/signup"/);
    assert.match(all, /href="\/sample"/);
  });
  it("the demo link points at a page that exists and needs no account", () => {
    assert.ok(existsSync(new URL("../../src/app/(public)/sample/page.tsx", import.meta.url)));
  });
  it("tells the story in the specified order", () => {
    const order = ["Factory", "Products", "Global opportunities", "Export economics", "Compliance", "Documentation", "AI execution", "Export readiness"];
    let at = -1;
    for (const w of order) {
      const i = story.indexOf(`title: t("${w}")`); // the English stays in the source, inside the translator call
      assert.ok(i > at, `${w} in order`);
      at = i;
    }
  });
  it("the interactive demo runs the real engines, not canned numbers", () => {
    assert.match(demo, /discover\(/);
    assert.match(demo, /calculate\(/);
  });
  it("is honest about coverage: one live market, others not yet", () => {
    assert.match(l, /Live now/);
    assert.match(l, /Not yet/);
    assert.match(l, /Always verified by people/);
  });
  it("invents no customers, testimonials, counts, approvals or market coverage", () => {
    assert.ok(!/testimonial|trusted by|customers? (love|choose)|\d[\d,]*\+?\s*(manufacturers|exporters|shipments|businesses)|certified by|approved by|live market data/i.test(all));
  });
  it("every preview is labelled as sample data and is drawn as vector, not as a bitmap", () => {
    assert.match(hero + story, /Sample data/);
    assert.ok(!/<img|next\/image|\.png|\.jpg/i.test(all));
  });
  it("animations respect reduced motion", () => {
    for (const t of [hero, story]) assert.match(t, /useReducedMotion/);
  });
});
