"use client";

import { useState } from "react";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Btn } from "./wf.tsx";

/** Reviewer helper: copyable screen name plus a notes box kept in this browser only. */
export function ReviewerNote({ screen }: { screen: string }) {
  const { state, set } = usePreview();
  const [copied, setCopied] = useState("");
  const note = state.notes[screen] ?? "";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("Copy is blocked in this browser. Select the text and copy it by hand.");
    }
    setTimeout(() => setCopied(""), 2500);
  }

  return (
    <aside aria-label="Reviewer feedback" className="mt-10 rounded border border-dashed border-input bg-secondary p-4 text-sm">
      <p className="font-semibold text-foreground">Reviewer feedback (stays in this browser)</p>
      <p className="mt-1 text-muted-foreground">
        Screen: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{screen}</code>
      </p>
      <label htmlFor="rv-note" className="mt-3 block text-xs font-medium text-muted-foreground">Notes on this screen</label>
      <textarea
        id="rv-note"
        rows={3}
        value={note}
        onChange={(e) => set((s) => ({ notes: { ...s.notes, [screen]: e.target.value } }))}
        className="mt-1 w-full rounded border border-input bg-card p-2 text-sm"
        placeholder="What is confusing, missing or wrong here?"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Btn small onClick={() => copy(screen, "Screen name copied.")}>Copy screen name</Btn>
        <Btn small onClick={() => copy(`[${screen}] ${note}`.trim(), "Note copied with screen name.")}>Copy note</Btn>
        <span role="status" className="text-xs text-muted-foreground">{copied}</span>
      </div>
    </aside>
  );
}
