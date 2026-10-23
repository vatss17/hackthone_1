"use client";

import { OPPORTUNITIES } from "@/lib/ux-preview/data.ts";
import { sampleCalc } from "@/lib/ux-preview/calc.ts";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Box, Btn, Callout, Disclosure, H1, P, Tag } from "./wf.tsx";
import { Calculator } from "./calculator.tsx";

type Answer = { q: string; a: string; tag: string; detail: string };

export function Assessment() {
  const { state, set } = usePreview();
  const sc = state.scenario;
  const opp = OPPORTUNITIES.find((o) => o.id === state.opportunity) ?? OPPORTUNITIES[0];
  const calc = state.calc;
  const r = sampleCalc(calc);
  const incomplete = sc === "incomplete-specs";
  const noMarket = true; // market data is never connected in V1; scenario only changes the explanation
  const unattractive = r.ok && r.verdict === "loss";

  const answers: Answer[] = [
    { q: "Could my factory make it?", a: incomplete ? "We cannot tell yet" : opp.fit === "Strong" ? "Yes, likely" : "Partly", tag: incomplete ? "Needs details" : `${opp.fit} fit`, detail: incomplete ? "Material and size are missing, so we cannot check your machines." : opp.why },
    { q: "Is there evidence of a destination market?", a: "No evidence connected", tag: "Not available", detail: noMarket ? (sc === "no-market-evidence" ? "No source is connected for this product, so we show nothing rather than guess." : "Destination trade data is not connected yet. We never show demand we cannot source.") : "" },
    { q: "Could exporting make financial sense?", a: !r.ok ? "Check your numbers" : unattractive ? "Not at these prices" : r.verdict === "thin" ? "Maybe, margin is thin" : "Looks workable on sample inputs", tag: "Sample inputs", detail: "Based on sample prices and freight you can change below. Not a quote." },
    { q: "What requirements or unknowns remain?", a: `${opp.unknowns.length + (incomplete ? 2 : 0)} open ${opp.unknowns.length + (incomplete ? 2 : 0) === 1 ? "question" : "questions"}`, tag: "Unverified", detail: opp.unknowns.join(" ") },
  ];

  const next = incomplete
    ? { title: "Add the material and size of your product", why: "Without them we cannot check your machines.", cta: "Add product details", href: "/ux-preview/path-a" }
    : unattractive
      ? { title: "Look at what would make the margin work", why: "At these sample inputs the product loses money per unit. Try a lower freight cost, a lower price or a bigger container load.", cta: "Open the cost scenarios", href: "#economics" }
      : { title: "Get a real freight quote and enter it", why: "Freight is the biggest guess in the numbers. A real quote makes the answer more reliable.", cta: "Save to My exports", href: "" };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Tag>Opportunity assessment</Tag>
        <H1>{opp.name}</H1>
        <P muted>One shared view, whether you started from your products or your factory. Fictional example data.</P>
      </div>

      {sc === "ai-unavailable" && <Callout tone="warn" title="AI explanations are not available right now.">Everything below comes from fixed rules. Nothing is lost; the plain explanations still work.</Callout>}
      {incomplete && <Callout tone="warn" title="Some product details are missing." actions={<Btn small href="/ux-preview/path-a">Add them now</Btn>}>This assessment is rough until material and size are known.</Callout>}
      {unattractive && <Callout tone="error" title="At these sample numbers this product would lose money.">That is not the end. See below what could change the result.</Callout>}

      <ul className="grid gap-3 md:grid-cols-2">
        {answers.map((x, i) => (
          <li key={x.q}>
            <Box className="h-full">
              <p className="text-xs font-semibold text-muted-foreground">{i + 1}. {x.q}</p>
              <p className="mt-1 text-lg font-semibold">{x.a}</p>
              <div className="mt-1"><Tag>{x.tag}</Tag></div>
              <p className="mt-2 text-sm text-muted-foreground">{x.detail}</p>
            </Box>
          </li>
        ))}
      </ul>

      <Box tone="soft" title="Your next best step">
        <p className="font-medium">{next.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{next.why}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {next.href ? <Btn kind="primary" href={next.href}>{next.cta}</Btn> : <Btn kind="primary" onClick={() => set((s) => ({ savedProjects: [...new Set([...s.savedProjects, opp.id])] }))}>{state.savedProjects.includes(opp.id) ? "Saved to My exports ✓" : next.cta}</Btn>}
          {state.savedProjects.includes(opp.id) && <Btn href="/ux-preview/app/exports">Go to My exports</Btn>}
          <Btn kind="ghost" href="/ux-preview/app/opportunities">Choose a different opportunity</Btn>
        </div>
      </Box>

      <div className="space-y-3">
        <p className="text-sm font-semibold">More detail, when you want it</p>
        <Disclosure title="Manufacturing rationale" summary="Why your machines and materials fit">
          <P>{opp.why}</P>
          <ul className="list-disc pl-5">{opp.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
          <p className="text-xs text-muted-foreground">Worked out by rules from the processes, machines and materials you declared.</p>
        </Disclosure>
        <Disclosure title="HS classification candidates" summary="Customs product codes to confirm">
          <ul className="space-y-2">{opp.hsCandidates.map((h) => <li key={h.code} className="rounded border border-border p-3"><strong>{h.code}</strong> · {h.label}<br /><span className="text-xs text-muted-foreground">{h.note}</span></li>)}</ul>
          <Callout title="Suggestions only.">A person must confirm the code. Nothing here is an official classification.</Callout>
        </Disclosure>
        <Disclosure title="Market evidence and source status" summary="What data exists and where it comes from" open={sc === "no-market-evidence"}>
          <Callout tone="empty" title="No market data connected.">When a licensed source is connected, this section will show the source, the period and its limits. Until then it stays empty on purpose.</Callout>
        </Disclosure>
        <Disclosure title="Landed cost and scenarios" summary="Change two inputs to see the effect" open={unattractive}>
          <div id="economics"><Calculator idPrefix="assess" value={calc} onChange={(c) => set({ calc: c })} /></div>
        </Disclosure>
        <Disclosure title="Compliance and CEPA screening" summary="Questions to settle before shipping">
          <ul className="list-disc space-y-1 pl-5">{opp.unknowns.map((u) => <li key={u}>{u}</li>)}<li>Whether India to destination trade-agreement origin rules could reduce duty.</li></ul>
          <p className="text-xs text-muted-foreground">All items are unverified questions, not approvals or findings.</p>
        </Disclosure>
      </div>
    </div>
  );
}
