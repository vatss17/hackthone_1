"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY, OPPORTUNITIES, PROJECTS, SAMPLE_PRODUCT, type Project } from "@/lib/ux-preview/data.ts";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Box, Btn, Callout, H1, H2, P, Row, Tag } from "./wf.tsx";
import { Calculator } from "./calculator.tsx";

function ProjectCard({ p }: { p: Project }) {
  return (
    <li>
      <Box>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{p.name}</p><Tag>{p.status}</Tag></div>
        <div className="mt-2 h-2 rounded-sm border border-input" role="progressbar" aria-label={`${p.name} progress`} aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-primary" style={{ width: `${p.progress}%` }} /></div>
        <p className="mt-3 text-sm"><strong>Next:</strong> {p.next}</p>
        <p className="mt-1 text-sm text-muted-foreground">Still needed: {p.outstanding.join(", ")}.</p>
        <p className="mt-1 text-xs text-muted-foreground">{p.recent}</p>
        <div className="mt-3"><Btn kind="primary" small href={`/ux-preview/app/exports/${p.id}`}>Continue</Btn></div>
      </Box>
    </li>
  );
}

function visibleProjects(saved: string[]) {
  const extra: Project[] = saved.filter((id) => !PROJECTS.some((p) => p.id === id)).map((id) => {
    const o = OPPORTUNITIES.find((x) => x.id === id);
    return { id, name: o?.name ?? id, path: "B", status: "Just saved", next: "Open the assessment and add your price.", outstanding: ["Ex-factory price"], recent: "Saved just now (this browser)", progress: 10 };
  });
  return [...PROJECTS, ...extra];
}

export function Home() {
  const { state } = usePreview();
  const sc = state.scenario;

  if (sc === "empty-account") {
    return (
      <div className="space-y-6">
        <H1>Welcome, {COMPANY.name}</H1>
        <Callout tone="empty" title="You have no export projects yet.">Pick where to start. It takes a couple of minutes to see a first result.</Callout>
        <div className="grid gap-4 md:grid-cols-2">
          <Box title="Export a product I already make"><P muted>Add one product or a catalogue.</P><div className="mt-3"><Btn kind="primary" href="/ux-preview/path-a">Add a product</Btn></div></Box>
          <Box title="Discover what else I could make"><P muted>Tell us about your machines and materials.</P><div className="mt-3"><Btn kind="primary" href="/ux-preview/path-b">Start with my factory</Btn></div></Box>
        </div>
        <P muted>Not ready? <Link className="underline" href="/ux-preview/sample">Replay the sample</Link>.</P>
      </div>
    );
  }
  if (sc === "factory-data") {
    return (
      <div className="space-y-6">
        <H1>Welcome back, {COMPANY.name}</H1>
        <Box title="Your factory (fictional)"><dl><Row label="Processes" value="Injection moulding, extrusion" /><Row label="Machines" value="3 machines" /><Row label="Materials" value="PP, HDPE" /></dl></Box>
        <Box tone="soft" title="Recommended next step"><P>Your factory is set up. See which products it suits.</P><div className="mt-3 flex flex-wrap gap-2"><Btn kind="primary" href="/ux-preview/app/opportunities">See opportunities for my factory</Btn><Btn href="/ux-preview/path-a">Add a product I already make</Btn></div></Box>
      </div>
    );
  }
  const all = visibleProjects(state.savedProjects);
  const top = all[1];
  return (
    <div className="space-y-6">
      <H1>Welcome back, {COMPANY.name}</H1>
      {sc === "halfway" && (
        <Callout title="You stopped partway through setup." actions={<Btn kind="primary" small href={state.goal === "A" ? "/ux-preview/path-a" : "/ux-preview/path-b"}>Continue where you left off</Btn>}>
          You were choosing materials for your factory (step 2 of 7). Your answers so far are kept in this browser.
        </Callout>
      )}
      <Box tone="soft" title="Recommended next action">
        <p className="font-medium">{top.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{top.next}</p>
        <div className="mt-3"><Btn kind="primary" href={`/ux-preview/app/exports/${top.id}`}>Do this now</Btn></div>
      </Box>
      <div className="flex items-center justify-between"><H2>Active export projects</H2><Btn small href="/ux-preview/app/exports">See all</Btn></div>
      <ul className="grid gap-3 md:grid-cols-2">{all.slice(0, 2).map((p) => <ProjectCard key={p.id} p={p} />)}</ul>
    </div>
  );
}

export function FactoryPage() {
  return (
    <div className="space-y-6">
      <H1>My factory</H1>
      <P muted>What you have told us about {COMPANY.name}. Change any of it; results update.</P>
      <div className="grid gap-4 md:grid-cols-2">
        <Box title="Processes and machines"><dl><Row label="Injection moulding" value="2 machines" /><Row label="Extrusion" value="1 line" /></dl></Box>
        <Box title="Materials"><P>PP, HDPE</P></Box>
        <Box title="Capacity (optional)"><P muted>Not added. Adding it makes opportunity matches more realistic.</P><div className="mt-3"><Btn small href="/ux-preview/path-b">Add capacity</Btn></div></Box>
        <Box title="Products you make today"><P>Storage crates, buckets</P><div className="mt-3"><Btn small href="/ux-preview/path-a">Add a product</Btn></div></Box>
      </div>
      <Btn kind="primary" href="/ux-preview/app/opportunities">See opportunities for my factory</Btn>
    </div>
  );
}

export function OpportunitiesPage() {
  const { set } = usePreview();
  return (
    <div className="space-y-6">
      <H1>Opportunities</H1>
      <P muted>Products your factory could make, ranked by manufacturing fit only. This is not demand.</P>
      <ul className="grid gap-3 md:grid-cols-2">
        {OPPORTUNITIES.slice(0, 5).map((o) => (
          <li key={o.id}>
            <Box className="h-full">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{o.name}</p><Tag>{o.fit} fit</Tag></div>
              <p className="mt-1 text-sm text-muted-foreground">{o.why}</p>
              <div className="mt-3"><Btn small href="/ux-preview/assessment" onClick={() => set({ opportunity: o.id })}>Assess this</Btn></div>
            </Box>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExportsPage() {
  const { state } = usePreview();
  if (state.scenario === "empty-account") {
    return (
      <div className="space-y-6">
        <H1>My exports</H1>
        <Callout tone="empty" title="Nothing here yet." actions={<><Btn kind="primary" href="/ux-preview/path-a">Add a product</Btn><Btn href="/ux-preview/path-b">Discover products</Btn></>}>Export projects you save will appear here with the next step for each.</Callout>
      </div>
    );
  }
  const all = visibleProjects(state.savedProjects);
  return (
    <div className="space-y-6">
      <H1>My exports</H1>
      <P muted>Each project has its own next step. Pick one to continue.</P>
      <ul className="grid gap-3 md:grid-cols-2">{all.map((p) => <ProjectCard key={p.id} p={p} />)}</ul>
      <div className="flex flex-wrap gap-2"><Btn href="/ux-preview/path-a">Add a product</Btn><Btn href="/ux-preview/path-b">Discover new products</Btn></div>
    </div>
  );
}

const TABS = ["Overview", "Economics", "Requirements", "Action plan", "Documents", "Expert help"] as const;

export function ProjectPage({ id }: { id: string }) {
  const { state, set } = usePreview();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const project = visibleProjects(state.savedProjects).find((p) => p.id === id) ?? PROJECTS[0];
  const opp = OPPORTUNITIES.find((o) => o.id === id) ?? OPPORTUNITIES[0];
  const incompleteDoc = state.scenario === "incomplete-document";
  const [doc, setDoc] = useState({ buyer: incompleteDoc ? "" : "Sample Trading LLC", hs: incompleteDoc ? "" : "3924", weight: "" });
  const missing = [!doc.buyer && "Buyer name and address", !doc.hs && "HS code", !doc.weight && "Carton weight"].filter(Boolean) as string[];
  const [asked, setAsked] = useState(false);

  return (
    <div className="space-y-5">
      <div><Btn kind="ghost" href="/ux-preview/app/exports" small>← My exports</Btn></div>
      <div className="space-y-1"><H1>{project.name}</H1><Tag>{project.status}</Tag></div>
      <div role="tablist" aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 shrink-0 border-b-4 px-3 text-sm ${tab === t ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      <div role="tabpanel" aria-label={tab} className="space-y-4">
        {tab === "Overview" && (
          <>
            <Box tone="soft" title="Next best step"><p>{project.next}</p><div className="mt-3"><Btn kind="primary" onClick={() => setTab(project.id === "food" ? "Expert help" : "Economics")}>Do this now</Btn></div></Box>
            <Box title="Still needed"><ul className="list-disc space-y-1 pl-5 text-sm">{project.outstanding.map((o) => <li key={o}>{o}</li>)}</ul></Box>
            <Box title="Recent progress"><p className="text-sm">{project.recent}</p></Box>
            <Btn href="/ux-preview/assessment" onClick={() => set({ opportunity: opp.id })}>Open the full assessment</Btn>
          </>
        )}
        {tab === "Economics" && <Box title="Landed cost and margin"><Calculator idPrefix="proj" value={state.calc} onChange={(c) => set({ calc: c })} /></Box>}
        {tab === "Requirements" && (
          <Box title="Open questions (unverified)">
            <ul className="list-disc space-y-1 pl-5 text-sm">{opp.unknowns.map((u) => <li key={u}>{u}</li>)}</ul>
            <div className="mt-3 flex flex-wrap gap-2"><Btn small onClick={() => setTab("Expert help")}>Ask an expert about these</Btn></div>
          </Box>
        )}
        {tab === "Action plan" && (
          <ol className="space-y-2">{["Confirm product details", "Get a mould quote", "Get a freight quote and recheck the margin", "Settle open requirement questions", "Review draft documents"].map((t, i) => <li key={t}><Box><span className="text-xs font-semibold text-muted-foreground">{i < 1 ? "Done" : i === 1 ? "Next" : "Later"}</span><p className="font-medium">{t}</p></Box></li>)}</ol>
        )}
        {tab === "Documents" && (
          <Box title="Draft commercial invoice">
            <Callout tone={missing.length ? "warn" : "info"} title={missing.length ? `${missing.length} thing${missing.length > 1 ? "s" : ""} missing before this is usable.` : "Ready to review."}>
              {missing.length ? missing.join(", ") + "." : "This is a draft. Check it carefully; nothing is filed for you."}
            </Callout>
            <dl className="mt-3">
              <Row label="Buyer" value={doc.buyer || "Missing"} />
              <Row label="HS code" value={doc.hs || "Missing"} />
              <Row label="Carton weight" value={doc.weight || "Missing"} />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn small onClick={() => setDoc({ buyer: doc.buyer || "Sample Trading LLC", hs: doc.hs || "3924", weight: doc.weight || "2.1 kg" })}>Fill the missing fields (sample)</Btn>
              <Btn small disabled={missing.length > 0}>Print draft</Btn>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">DRAFT — REVIEW REQUIRED. {SAMPLE_PRODUCT.name} example.</p>
          </Box>
        )}
        {tab === "Expert help" && (
          <Box title="Prepare a question for an expert">
            <Callout tone="warn" title="No expert is connected yet.">We prepare a clear brief you can send yourself. Nothing is sent from here.</Callout>
            <div className="mt-3 flex flex-wrap gap-2"><Btn onClick={() => setAsked(true)}>Prepare a brief</Btn></div>
            {asked && <p role="status" className="mt-3 rounded border border-border bg-secondary p-3 text-sm">Brief ready (simulated): product, material, destination and your open questions are filled in. Copy it and send it yourself.</p>}
          </Box>
        )}
      </div>
    </div>
  );
}
