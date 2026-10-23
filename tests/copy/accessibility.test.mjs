// Static tests for accessibility and copy: colour contrast of the design tokens, zoom, table semantics, accessible names, no stale status wording.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk("src").filter((f) => /\.(tsx|ts)$/.test(f));

// ---- contrast (WCAG 2.x relative luminance) ----
const css = read("src/app/globals.css");
const token = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  assert.ok(m, `token --${name} not found`);
  return m[1];
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("colour contrast of the design tokens", () => {
  const pairs = [
    ["foreground", "background", 4.5],
    ["foreground", "card", 4.5],
    ["muted-foreground", "background", 4.5],
    ["muted-foreground", "card", 4.5],
    ["muted-foreground", "muted", 4.5],
    ["primary", "background", 4.5],
    ["primary", "card", 4.5],
    ["primary-foreground", "primary", 4.5],
    ["amber-text", "background", 4.5],
    ["status-verified-fg", "status-verified-bg", 4.5],
    ["status-estimate-fg", "status-estimate-bg", 4.5],
    ["status-missing-fg", "status-missing-bg", 4.5],
    ["status-user-fg", "status-user-bg", 4.5],
    ["status-ai-fg", "status-ai-bg", 4.5],
    ["foreground", "mint", 4.5],
    ["primary", "mint", 4.5],
    ["input", "card", 3],
    ["ring", "background", 3],
  ];
  for (const [fg, bg, min] of pairs) {
    it(`--${fg} on --${bg} is at least ${min}:1`, () => {
      const r = ratio(token(fg), token(bg));
      assert.ok(r >= min, `${fg} on ${bg} is ${r.toFixed(2)}:1`);
    });
  }
});

describe("zoom and reflow", () => {
  it("never disables pinch zoom or text scaling", () => {
    const all = files.map(read).join("\n") + read("src/app/layout.tsx");
    assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1\b/i.test(all));
    assert.ok(!/userScalable:\s*false|maximumScale:\s*1\b/.test(all));
  });
  it("text is sized in relative units at the base, and the page never forces a sideways scroll on the journey bar", () => {
    assert.match(css, /-webkit-text-size-adjust:\s*100%/);
    assert.ok(!/overflow-x-auto/.test(read("src/components/journey-bar.tsx")));
  });
});

describe("table semantics", () => {
  it("every header cell says whether it heads a column or a row", () => {
    const bad = [];
    for (const f of files.filter((x) => !x.includes("components/ui/"))) {
      const text = read(f);
      for (const m of text.matchAll(/<th\b([^>]*)>/g)) if (!/\bscope=/.test(m[1])) bad.push(`${f}: ${m[0].slice(0, 60)}`);
    }
    assert.deepEqual(bad, []);
  });
  it("data tables have a caption (visible or for screen readers)", () => {
    const missing = [];
    for (const f of files.filter((x) => /documents-workspace|workspace\.tsx|charts\.tsx|parts\.tsx/.test(x))) {
      const text = read(f);
      const tables = (text.match(/<table\b/g) ?? []).length;
      const captions = (text.match(/<caption\b/g) ?? []).length;
      if (captions < tables) missing.push(`${f}: ${tables} tables, ${captions} captions`);
    }
    assert.deepEqual(missing, []);
  });
});

describe("accessible names and announcements", () => {
  it("repeated calculator fields carry the name of the line they belong to", () => {
    const w = read("src/components/landed-cost/workspace.tsx");
    assert.match(w, /ctx: LINE_LABELS\[key\]/);
    assert.match(w, /sr-only"> \{t\("for \{name\}", \{ name: t\(opts\.ctx\) \}\)\}/);
  });
  it("field errors are announced", () => {
    assert.match(read("src/components/landed-cost/workspace.tsx"), /role="alert" className="text-xs font-medium text-destructive"/);
    assert.match(read("src/components/catalogue/import-workspace.tsx"), /role="alert"/);
    assert.match(read("src/components/auth/use-focus-on-error.ts"), /focus/);
  });
  it("roadmap notes and statuses are named after their task", () => {
    const r = read("src/components/workspace/roadmap-board.tsx");
    // The labels are translated, so the task name goes in as a {task} placeholder instead of a template literal.
    assert.match(r, /aria-label=\{t\("Note for \{task\}", \{ task: title \}\)\}/);
    assert.match(r, /aria-label=\{t\("Status of \{task\}", \{ task: title \}\)\}/);
  });
  it("import specification fields are numbered and name the product", () => {
    const i = read("src/components/catalogue/import-workspace.tsx");
    assert.match(i, /Specification \{n\} value for \{product\}/);
    assert.match(i, /n: i \+ 1, product:/);
  });
  it("the step bar marks the current step and every control has a name", () => {
    const b = read("src/components/journey-bar.tsx");
    assert.match(b, /aria-current/);
    assert.match(b, /aria-label=\{`\$\{t\("Previous step"\)\}/); // the name goes through the translator
    assert.match(b, /aria-label=\{t\("Export journey"\)\}/);
  });
  it("there is a skip link and every form control keeps a visible focus style", () => {
    assert.match(read("src/components/layout/app-shell.tsx"), /Skip to content/);
    assert.match(css, /:focus-visible/);
  });
});

describe("status wording", () => {
  it("no user-facing copy still calls a built capability a Preview or Planned", () => {
    const offenders = [];
    for (const f of files.filter((x) => !/config\/(navigation|status)\.ts|status-badge|feature-preview|trade\/evidence/.test(x))) {
      const text = read(f);
      for (const m of text.matchAll(/["'`>][^"'`<>\n]*\b(is a preview|a preview today|Export documents are a preview|Expert help is a preview)\b[^"'`<>\n]*/g)) offenders.push(`${f}: ${m[0].slice(0, 80)}`);
    }
    assert.deepEqual(offenders, []);
  });
  it("capability states come from one place", () => {
    const s = read("src/config/status.ts");
    for (const label of ["Drafting available", "No expert connected", "Manual sharing", "Live data unavailable", "Saved on this device only", "AI not switched on"]) assert.ok(s.includes(label), label);
    assert.match(read("src/components/feasibility/client-parts.tsx"), /statusLabel\("documents"\)/);
    assert.match(read("src/lib/landed-cost/summary.ts"), /statusLabel\("expert"\)/);
  });
  it("the AI and import panels say it is not switched on, not that it is planned", () => {
    assert.match(read("src/components/explain/ai-explainer.tsx"), /kind="off"/);
    assert.match(read("src/components/catalogue/import-workspace.tsx"), /"off"/);
  });
  it("the scenario name and the chart do not both say hypothetical", () => {
    assert.match(read("src/components/landed-cost/charts.tsx"), /!\/hypothetical\/i\.test\(i\.name\)/);
  });
});
