"use client";

import { useRouter } from "next/navigation";
import { OPPORTUNITIES, SCENARIOS } from "@/lib/ux-preview/data.ts";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import type { PreviewState } from "@/lib/ux-preview/store.ts";
import { Box, Btn, H1, P } from "./wf.tsx";

/** Extra fictional state that a scenario needs so the screen actually shows it. */
function seed(key: string): Partial<PreviewState> {
  switch (key) {
    case "not-attractive":
      return { opportunity: "trays", calc: { price: 190, freight: 260000, reference: 5 } };
    case "incomplete-specs":
      return { opportunity: "laundry" };
    case "no-market-evidence":
      return { opportunity: "conduit" };
    case "halfway":
      return { goal: "B", pathB: { step: 2, processes: ["injection"], materials: [], machines: [{ type: "injection", size: "" }], products: "", refine: { tooling: "", capacity: "", utilisation: "" } } };
    case "no-catalogue":
      return { pathA: { step: 1, tab: "describe", name: "", desc: "", material: "", use: "", hs: "", later: [], saved: false } };
    default:
      return {};
  }
}

export function States() {
  const router = useRouter();
  const { set } = usePreview();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H1>Real-world states</H1>
        <P muted>Each button switches on a fictional state and opens the screen where it matters. A strip at the top of that screen says which state you are in and lets you leave it.</P>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {SCENARIOS.map((s) => (
          <li key={s.key}>
            <Box className="h-full">
              <p className="font-semibold">{s.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.what}</p>
              <p className="mt-1 text-xs text-muted-foreground">Opens: <code>{s.where}</code></p>
              <div className="mt-3"><Btn small kind="primary" onClick={() => { set({ ...seed(s.key), scenario: s.key }); router.push(s.where); }}>Open this state</Btn></div>
            </Box>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{OPPORTUNITIES.length} fictional products are available to these states.</p>
    </div>
  );
}
