"use client";

import { useState } from "react";
import { COMPANY, OPPORTUNITIES } from "@/lib/ux-preview/data.ts";
import { Box, Btn, Callout, Choice, H1, H2, P, Row, StepNav, Stepper, Tag } from "./wf.tsx";
import { AiLandedCost } from "./ai-landed-cost.tsx";

const STEPS = ["Meet the factory", "Possible products", "Choose one", "Examine it", "AI landed cost", "Action plan", "Your turn"];
const SAMPLE = OPPORTUNITIES.slice(0, 3);

export type SampleLinks = { signup: string; home: string };
export function SampleDemo({ links = { signup: "/ux-preview/signup", home: "/ux-preview/landing" } }: { links?: SampleLinks }) {
  const [step, setStep] = useState(1);
  const [pick, setPick] = useState<string | null>(null);
  const [price, setPrice] = useState(OPPORTUNITIES[0].defaultCalc.price);
  const opp = OPPORTUNITIES.find((o) => o.id === pick) ?? null;

  function choose(id: string) {
    setPick(id);
    setPrice(OPPORTUNITIES.find((o) => o.id === id)!.defaultCalc.price);
  }
  const next = () => setStep((s) => Math.min(STEPS.length, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Callout title="Guided sample. Everything here is fictional.">
        A made-up factory, made-up prices and rules of thumb. No account, nothing saved, no real destination figures.
      </Callout>
      <Stepper steps={STEPS} current={step} label="Sample progress" />

      {step === 1 && (
        <div className="space-y-4">
          <H1>Meet {COMPANY.name}</H1>
          <P muted>A fictional PP and HDPE manufacturer in {COMPANY.place}. It makes storage crates and buckets today and wonders what else its machines could produce.</P>
          <Box title="What the factory has told us (fictional)">
            <dl>
              <Row label="Processes" value="Injection moulding, extrusion" />
              <Row label="Machines" value="2 injection presses, 1 extrusion line" />
              <Row label="Materials" value="PP, HDPE" />
              <Row label="Makes today" value="Storage crates, buckets" />
            </dl>
          </Box>
          <StepNav backHref={links.home} nextLabel="Next: see possible products" onNext={next} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <H1>Three products this factory could also make</H1>
          <P muted>These come from matching the machines and materials above to a product list. This is about what the factory can make, not about demand.</P>
          <ul className="space-y-3">
            {SAMPLE.map((o) => (
              <li key={o.id}>
                <Box>
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{o.name}</p><Tag>{o.fit} fit</Tag></div>
                  <p className="mt-1 text-sm text-muted-foreground">{o.why}</p>
                </Box>
              </li>
            ))}
          </ul>
          <StepNav onBack={back} nextLabel="Next: choose one" onNext={next} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <H1>Pick one to look at closely</H1>
          <div role="radiogroup" aria-label="Choose a sample opportunity" className="space-y-3">
            {SAMPLE.map((o) => (
              <Choice key={o.id} selected={pick === o.id} onSelect={() => choose(o.id)} title={o.name}>{o.fit} fit with the factory</Choice>
            ))}
          </div>
          {!opp && <p className="text-sm text-muted-foreground">Choose one to continue.</p>}
          <StepNav onBack={back} nextLabel="Next: examine it" onNext={next} nextDisabled={!opp} />
        </div>
      )}

      {step === 4 && opp && (
        <div className="space-y-4">
          <H1>{opp.name}: four things to know</H1>
          <Box title="1. Could the factory make it?"><P>{opp.why}</P>{opp.gaps.map((g) => <p key={g} className="mt-1 text-sm text-muted-foreground">Gap: {g}</p>)}</Box>
          <Box title="2. Is there market evidence?"><Callout tone="empty" title="Not connected in this sample.">We do not show destination demand numbers we do not have. In your workspace this section says what source it uses, or that none is connected.</Callout></Box>
          <Box title="3. Commercial assumptions"><P>You type only the price you would quote. On the next step AI works out freight, insurance, duty and clearance on top of it. Those rates are illustrative until verified.</P></Box>
          <Box title="4. Rules still unknown">
            <ul className="list-disc space-y-1 pl-5 text-sm">{opp.unknowns.map((u) => <li key={u}>{u}</li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Marked unverified. Nothing here is a ruling.</p>
          </Box>
          <StepNav onBack={back} nextLabel="Next: AI landed cost" onNext={next} />
        </div>
      )}

      {step === 5 && opp && (
        <div className="space-y-4">
          <H1>Let AI work out the landed cost</H1>
          <P muted>Landed cost is what one unit costs once it is in the destination market: your price plus every charge on top. Normally you would chase a forwarder, an insurer and a customs agent for these. Here the AI does it, shows its working, and you can change any line.</P>
          <AiLandedCost oppId={opp.id} price={price} onPrice={setPrice} />
          <StepNav onBack={back} nextLabel="Next: see an action plan" onNext={next} />
        </div>
      )}

      {step === 6 && opp && (
        <div className="space-y-4">
          <H1>A short sample action plan</H1>
          <ol className="space-y-2">
            {["Confirm the product details and material", "Get a mould quote for " + opp.name.toLowerCase(), "Get a freight quote and recheck the margin", "Settle the open requirement questions", "Prepare draft invoice and packing list to review"].map((t, i) => (
              <li key={t}><Box><span className="text-xs font-semibold text-muted-foreground">Next {i + 1}</span><p className="font-medium">{t}</p></Box></li>
            ))}
          </ol>
          <StepNav onBack={back} nextLabel="Next: what now" onNext={next} />
        </div>
      )}

      {step === 7 && (
        <div className="space-y-4">
          <H1>Now try it with your factory</H1>
          <Box title="What you did, and what the AI did for you (sample)">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-sm font-semibold">You did</p><ul className="mt-1 list-disc pl-5 text-sm"><li>Chose a product</li><li>Typed one price</li></ul></div>
              <div><p className="text-sm font-semibold">The AI did (simulated here)</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm"><li>Matched products to the machines</li><li>Suggested the customs heading to confirm</li><li>Estimated freight, insurance, duty and clearance</li><li>Drafted the action plan and the questions to settle</li></ul></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">You confirm or change every AI suggestion. Nothing is filed or sent for you.</p>
          </Box>
          <P muted>Create a workspace to see this for your own products and machines. It takes a couple of minutes and you can stop at any point.</P>
          <div className="flex flex-wrap gap-3">
            <Btn kind="primary" href={links.signup}>Create my workspace</Btn>
            <Btn onClick={() => { setStep(1); setPick(null); }}>Replay the sample</Btn>
            <Btn kind="ghost" href={links.home}>Back to the homepage</Btn>
          </div>
          <H2>No thanks, just browsing?</H2>
          <P muted>That is fine. The sample stays open and nothing is stored.</P>
          <div className="border-t border-border pt-4"><Btn onClick={back}>Back</Btn></div>
        </div>
      )}
    </div>
  );
}
