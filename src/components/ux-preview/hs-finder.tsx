"use client";

import { useState } from "react";
import { PHOTO_TEXT, suggestHs, type HsSuggestion } from "@/lib/ux-preview/ai-sim.ts";
import { Box, Btn, Callout, Field, inputCls, Tag } from "./wf.tsx";

/** Describe or photograph a product, get HS code candidates, confirm one. Simulated: no AI is called. */
export function HsFinder({ seed, hs, onUse }: { seed: string; hs: string; onUse: (code: string) => void }) {
  const [mode, setMode] = useState<"describe" | "photo">("describe");
  const [text, setText] = useState(seed);
  const [photo, setPhoto] = useState("");
  const [found, setFound] = useState<HsSuggestion[] | null>(null);

  const source = mode === "photo" ? (photo ? PHOTO_TEXT : "") : text;

  function find() {
    setFound(suggestHs(source));
  }

  return (
    <Box tone="soft" title="Not sure of the HS code? Let AI suggest some">
      <p className="text-sm text-muted-foreground">The HS code is the customs number for what you sell. Describe the product or show a photo, and the AI suggests likely codes with reasons. You choose; nothing is official.</p>
      <div role="tablist" aria-label="How to describe it" className="mt-3 flex gap-2">
        {([["describe", "Describe it"], ["photo", "Use a photo"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setFound(null); }} className={`min-h-10 rounded border px-4 text-sm ${mode === k ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"}`}>{l}</button>
        ))}
      </div>
      <div className="mt-3 space-y-3">
        {mode === "describe" ? (
          <Field id="hs-text" label="What is it, and what is it used for?">
            <textarea id="hs-text" rows={2} className={`${inputCls} py-2`} value={text} onChange={(e) => { setText(e.target.value); setFound(null); }} placeholder="e.g. stackable plastic storage crate for the home" />
          </Field>
        ) : (
          <div className="space-y-2">
            <Field id="hs-photo" label="Photo of the product" hint="Wireframe: any photo gives the same fictional result. The file never leaves your browser.">
              <input id="hs-photo" type="file" accept="image/*" className="block text-sm" onChange={(e) => { setPhoto(e.target.files?.[0]?.name ?? ""); setFound(null); }} />
            </Field>
            <Btn small onClick={() => { setPhoto("sample-crate.jpg"); setFound(null); }}>Use a sample photo</Btn>
            {photo && <p className="text-sm">Photo chosen: <Tag>{photo}</Tag> The AI reads it as a &ldquo;{PHOTO_TEXT}&rdquo; (fictional).</p>}
          </div>
        )}
        <Btn kind="primary" onClick={find} disabled={source.trim().length < 3}>Suggest HS codes</Btn>
      </div>

      {found && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <ul className="space-y-2">
            {found.map((s) => (
              <li key={s.code} className="rounded border border-border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.code} · {s.label}</p>
                  <Tag>{s.confidence} confidence</Tag>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Why: {s.why}</p>
                <div className="mt-2"><Btn small kind={hs === s.code ? "primary" : "secondary"} onClick={() => onUse(s.code)}>{hs === s.code ? "Confirmed ✓" : "Use this code"}</Btn></div>
              </li>
            ))}
          </ul>
          <Callout title="You confirm the code.">These are suggestions to check with a customs adviser, not an official classification. None fit? <button className="underline" onClick={() => { onUse(""); setFound(null); }}>Leave it for later</button>.</Callout>
        </div>
      )}
      {!found && source.trim().length < 3 && <p className="mt-2 text-xs text-muted-foreground">Add a few words or a photo to get suggestions. You can also skip this.</p>}
    </Box>
  );
}
