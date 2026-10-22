// ONE-OFF snapshot of public UN Comtrade data for the demo. Run by hand, not by the app:
//   node scripts/fetch-trade-evidence.mjs
//
// Why a snapshot and not live calls: the Comtrade licence agreement restricts automated downloading,
// publication and redistribution without written permission from the UN Statistics Division. This script
// makes a small, rate-limited number of requests (one per year and flow) to the PUBLIC PREVIEW API,
// which needs no key, and writes the result with its provenance. The app only ever reads the file and
// always labels it a dated snapshot, never live data. See docs/trade-data-source.md for the full assessment.

import { writeFileSync } from "node:fs";

const HEADINGS = ["3916", "3917", "3923", "3924", "3925", "3926", "9403"];
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
const BASE = "https://comtradeapi.un.org/public/v1/preview/C/A/HS";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(params) {
  const url = `${BASE}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(40_000) });
    if (res.status === 429) {
      await sleep(5000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${params.period}`);
    const body = await res.json();
    if (body.error) throw new Error(`API error: ${String(body.error).slice(0, 120)}`);
    return body.data ?? [];
  }
  throw new Error("rate limited");
}

const pick = (r) => ({
  valueUsd: r.primaryValue ?? null,
  netWeightKg: r.netWgt && r.netWgt > 0 ? r.netWgt : null,
  classification: r.classificationCode,
  isAggregate: r.isAggregate === true,
});

const out = {
  source: {
    name: "UN Comtrade database (public preview API)",
    publisher: "United Nations Statistics Division",
    url: "https://comtradeplus.un.org/",
    api: BASE,
    retrieved: new Date().toISOString().slice(0, 10),
    licence: "Subject to the UN Comtrade licence agreement (https://comtrade.un.org/licenseagreement.html): publication, redistribution and automated downloading need prior written permission from the UN Statistics Division. Permission has NOT been obtained.",
  },
  flows: {
    uaeImportsFromWorld: { reporter: "United Arab Emirates (784)", partner: "World (0)", flow: "Imports (M)", measure: "CIF value, USD; net weight kg", data: {} },
    indiaExportsToUae: { reporter: "India (699)", partner: "United Arab Emirates (784)", flow: "Exports (X)", measure: "FOB value, USD; net weight kg", data: {} },
  },
  missing: { uaeImportsFromWorld: [], indiaExportsToUae: [] },
};

for (const [key, params] of [
  ["uaeImportsFromWorld", { reporterCode: "784", partnerCode: "0", flowCode: "M" }],
  ["indiaExportsToUae", { reporterCode: "699", partnerCode: "784", flowCode: "X" }],
]) {
  for (const year of YEARS) {
    const rows = await get({ ...params, period: String(year), cmdCode: HEADINGS.join(",") });
    if (rows.length === 0) out.missing[key].push(year);
    for (const r of rows) {
      (out.flows[key].data[r.cmdCode] ??= {})[String(year)] = pick(r);
    }
    await sleep(1500);
  }
}

writeFileSync(new URL("../src/data/restricted/uae-trade-comtrade.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log("written. missing years:", JSON.stringify(out.missing));
