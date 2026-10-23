import { Box, Btn, Callout, H1, H2, P, Placeholder, Tag } from "./wf.tsx";

const STEPS = [
  ["1", "Tell us what you make", "Describe a product, upload a catalogue, or list your machines."],
  ["2", "See where it could go", "We show which destination export opportunities suit your factory, and why."],
  ["3", "Check the numbers", "AI works out every charge on top of your price."],
  ["4", "Know what to do next", "Get a plain action plan and draft documents to review."],
];

const CAPS = [
  ["Find products", "Matches your machines and materials to products you could make."],
  ["Find your HS code", "Describe or photograph a product to get customs code candidates to confirm."],
  ["Work out landed cost", "AI-assisted estimate of every charge on top of your price."],
  ["See requirements", "Questions to settle before you ship, clearly marked unverified."],
  ["Plan the work", "One next step at a time."],
  ["Draft documents", "Invoice and packing list drafts to review. Nothing is filed for you."],
  ["Ask an expert", "Prepare a brief. No expert is connected yet."],
];

export type LandingLinks = { signup: string; signin: string; sample: string; how: string };
export const PREVIEW_LINKS: LandingLinks = { signup: "/ux-preview/signup", signin: "/ux-preview/app/home", sample: "/ux-preview/sample", how: "/ux-preview/landing#how" };

export function Landing({ links = PREVIEW_LINKS, returning = false, placeholder = true }: { links?: LandingLinks; returning?: boolean; placeholder?: boolean }) {
  return (
    <div className="space-y-10">
      {returning && (
        <Callout title="Welcome back." actions={<><Btn kind="primary" small href={links.signin}>Sign in to your workspace</Btn><Btn small href={links.sample}>Replay the sample</Btn></>}>
          You looked at the sample last time. Sign in to pick up your work, or start from the sample again.
        </Callout>
      )}

      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <Tag>For Indian plastic manufacturers · Exporting to the destination market</Tag>
          <H1>Find out what you could export, and whether it would pay.</H1>
          <P muted>Tell us what your factory makes. We show which products could sell in the destination market, what exporting would cost, and exactly what to do next. No account needed to try it.</P>
          <div className="flex flex-wrap gap-3">
            <Btn kind="primary" href={links.sample}>Explore a sample</Btn>
            <Btn href="#how">How it works</Btn>
          </div>
          <p className="text-xs text-muted-foreground">The sample uses a fictional factory. Signing up is optional.</p>
        </div>
        <div aria-label="Product preview" className="space-y-3 rounded border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Product preview (illustration)</p>
          {placeholder && <Placeholder label="Screenshot: assessment overview" h="h-32" />}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border p-2">Can we make it? <strong>Strong fit</strong></div>
            <div className="rounded border border-border p-2">Market evidence? <strong>Not connected</strong></div>
            <div className="rounded border border-border p-2">Worth exporting? <strong>Try the numbers</strong></div>
            <div className="rounded border border-border p-2">What is left? <strong>3 questions</strong></div>
          </div>
        </div>
      </section>

      <section id="how" aria-labelledby="how-h" className="scroll-mt-6 space-y-4">
        <H2><span id="how-h">How it works</span></H2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([n, t, d]) => (
            <li key={n}><Box className="h-full"><p className="text-xs font-semibold text-muted-foreground">Step {n}</p><p className="mt-1 font-semibold">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p></Box></li>
          ))}
        </ol>
        <ul aria-label="What you can do" className="flex flex-wrap gap-2">
          {CAPS.map(([t, d]) => <li key={t} title={d}><Tag>{t}</Tag></li>)}
        </ul>
      </section>

      <section aria-labelledby="paths-h" className="space-y-4">
        <H2><span id="paths-h">Two ways to start</span></H2>
        <div className="grid gap-4 md:grid-cols-2">
          <Box title="Export what you already make"><P muted>Start with a product or a catalogue. See what it would take.</P></Box>
          <Box title="Discover what else you could make"><P muted>Start with your machines and materials. See products they suit.</P></Box>
        </div>
      </section>

      <section id="trust" aria-labelledby="trust-h" className="scroll-mt-6 grid gap-6 rounded border border-primary p-6 md:grid-cols-2 md:p-8">
        <div className="space-y-2">
          <H2><span id="trust-h">Honest about what it is</span></H2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            <li>Guidance from clear rules, not advice or approval.</li>
            <li>No destination demand figures until a licensed source is connected.</li>
            <li>Compliance items are unverified questions. Nothing is filed for you.</li>
            <li>Your work is saved in your browser for now. AI is optional.</li>
          </ul>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <H2>Ready to see it for your factory?</H2>
          <P muted>Create a free account to keep your results, or try the sample first.</P>
          <div className="flex flex-wrap gap-3">
            <Btn kind="primary" href={links.signup}>Create an account</Btn>
            <Btn href={links.sample}>Explore a sample first</Btn>
          </div>
        </div>
      </section>
    </div>
  );
}
