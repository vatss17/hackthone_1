"use client";

import { useState } from "react";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Box, Btn, H1, H2, P } from "./wf.tsx";

const ENTRIES = [
  ["1. Public landing page", "Wireframe 1: what a visitor sees first.", "/ux-preview/landing"],
  ["2. Guest sample demo", "Wireframe 2: seven-step fictional walkthrough, no signup.", "/ux-preview/sample"],
  ["3. Sign-up and goal choice", "Wireframe 3: create account, then choose Path A or B.", "/ux-preview/signup"],
  ["4. New manufacturer, Path A", "Wireframe 4: start from products you already make.", "/ux-preview/path-a"],
  ["5. New manufacturer, Path B", "Wireframe 5: start from machines, processes and materials.", "/ux-preview/path-b"],
  ["6. Shared assessment", "Wireframe 6: where both paths meet.", "/ux-preview/assessment"],
  ["7. Returning manufacturer", "Wireframe 7: Home, My factory, Opportunities, My exports.", "/ux-preview/app/home"],
  ["8. Real-world states", "Twelve situations: empty, incomplete, unavailable, unsaved…", "/ux-preview/states"],
] as const;

export function IndexPage() {
  const { state, reset } = usePreview();
  const [msg, setMsg] = useState("");
  const notes = Object.entries(state.notes).filter(([, v]) => v.trim());

  async function copyAll() {
    const text = notes.map(([k, v]) => `[${k}] ${v}`).join("\n");
    try { await navigator.clipboard.writeText(text); setMsg("All notes copied."); } catch { setMsg("Copy is blocked here. Select the notes below and copy by hand."); }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-3">
        <H1>UX wireframes: version 2 journey</H1>
        <P muted>A clickable, low-fidelity prototype for review. It uses fictional data only: no login, no database, no AI calls, and nothing is written anywhere except this browser. It is not the production app.</P>
      </div>

      <section aria-labelledby="enter" className="space-y-3">
        <H2><span id="enter">Choose where to start</span></H2>
        <ul className="grid gap-3 md:grid-cols-2">
          {ENTRIES.map(([t, d, h]) => (
            <li key={h}><Box className="h-full"><p className="font-semibold">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p><div className="mt-3"><Btn kind="primary" small href={h}>Open</Btn></div></Box></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="map" className="space-y-3">
        <H2><span id="map">Journey map</span></H2>
        <Box>
          <pre className="overflow-x-auto whitespace-pre text-xs leading-relaxed sm:text-sm" aria-label="Journey map as text">{`Landing ──► Guest sample (7 steps, no signup) ──┐
   │                                                │
   └──► Sign up ──► Choose goal ─┬─ A: Existing products (6 steps) ─┐
                                  └─ B: Discover products (7 steps) ─┤
                                                                     ▼
                                              Shared assessment (4 answers,
                                              1 next step, 5 expandable details)
                                                                     │
                                                                     ▼
   Returning sign-in ──► Home ─► My factory · Opportunities · My exports ─► Project:
                         Overview · Economics · Requirements · Action plan · Documents · Expert help`}</pre>
        </Box>
      </section>

      <section aria-labelledby="notes" className="space-y-3">
        <H2><span id="notes">Your notes so far</span></H2>
        {notes.length === 0 ? <P muted>No notes yet. Each screen has a feedback box at the bottom.</P> : (
          <Box><ul className="space-y-1 text-sm">{notes.map(([k, v]) => <li key={k}><code className="text-xs">{k}</code>: {v}</li>)}</ul></Box>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Btn small onClick={copyAll} disabled={!notes.length}>Copy all notes</Btn>
          <Btn small onClick={() => { reset(); setMsg("Prototype data cleared."); }}>Clear all prototype data</Btn>
          <span role="status" className="text-xs">{msg}</span>
        </div>
      </section>
    </main>
  );
}
