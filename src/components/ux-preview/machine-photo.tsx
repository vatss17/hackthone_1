"use client";

import { useState } from "react";
import { recogniseMachine } from "@/lib/ux-preview/ai-sim.ts";
import { Box, Btn, Callout, Field, inputCls, Tag } from "./wf.tsx";

/** Photograph a machine, review what the AI read, add it. Simulated: no AI is called. */
export function MachinePhoto({ onAdd }: { onAdd: (m: { type: string; size: string }) => void }) {
  const [photo, setPhoto] = useState("");
  const [result, setResult] = useState<ReturnType<typeof recogniseMachine> | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  function read(name: string) {
    const r = recogniseMachine();
    setPhoto(name);
    setResult(r);
    setVals(Object.fromEntries(r.fields.map((f) => [f.label, f.value])));
    setAdded(false);
  }

  return (
    <Box tone="soft" title="Not sure of the specs? Photograph the machine">
      <p className="text-sm text-muted-foreground">Take a photo of the machine or its nameplate. The AI reads what it can and suggests the type and settings. You check each line before it is added.</p>
      <div className="mt-3 space-y-2">
        <Field id="mp-file" label="Photo of the machine or nameplate" hint="Wireframe: any photo gives the same fictional result. The file never leaves your browser.">
          <input id="mp-file" type="file" accept="image/*" capture="environment" className="block text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f.name); }} />
        </Field>
        <Btn small onClick={() => read("sample-machine.jpg")}>Use a sample photo</Btn>
      </div>
      {result && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className="text-sm">From <Tag>{photo}</Tag> the AI thinks this is an <strong>{result.title.toLowerCase()}</strong>. Check each line.</p>
          <div className="space-y-3">
            {result.fields.map((f) => (
              <div key={f.label} className="rounded border border-border bg-card p-3">
                <Field id={`mp-${f.label}`} label={f.label}>
                  <input id={`mp-${f.label}`} className={inputCls} value={vals[f.label] ?? ""} placeholder="I don't know" onChange={(e) => { setVals({ ...vals, [f.label]: e.target.value }); setAdded(false); }} />
                </Field>
                <div className="mt-1"><Tag>{f.status}</Tag></div>
              </div>
            ))}
          </div>
          {added ? (
            <Callout title="Added to your machines.">It appears in the list above. You can edit or remove it there.</Callout>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Btn kind="primary" onClick={() => { onAdd({ type: result.type, size: [vals["Clamp force"], vals["Screw diameter"] && `screw ${vals["Screw diameter"]}`].filter(Boolean).join(", ") }); setAdded(true); }}>Add this machine</Btn>
              <Btn onClick={() => { setResult(null); setPhoto(""); }}>Discard</Btn>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Suggestions only. Blank lines stay blank until you fill them.</p>
        </div>
      )}
    </Box>
  );
}
