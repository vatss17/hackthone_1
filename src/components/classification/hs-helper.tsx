"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { updateProduct } from "@/lib/actions/capabilities";
import { findCandidates, type CandidateResult } from "@/lib/classification/candidates";

/**
 * Step C of product exploration: the manufacturer's own HSN code if they have one, or "Help me find it".
 * The helper uses plain keyword rules in the browser. It sends nothing anywhere and uses no AI.
 * Photographs are a future feature: the control is shown disabled, and nothing is analysed.
 */
export function HsHelper({ defaults, catalogueId, claimedCode, productId }: { defaults: { name: string; category: string; description: string; use: string; specs: string }; catalogueId: string | null; claimedCode: string | null; productId: string | null }) {
  const [code, setCode] = useState(claimedCode ?? "");
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState([defaults.description, defaults.use, defaults.specs].filter(Boolean).join(". "));
  const [result, setResult] = useState<CandidateResult | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <h3 className="text-base font-medium">Your product code (HS/HSN)</h3>
        {claimedCode ? (
          <p className="mt-1 text-sm">
            Saved: <span className="font-mono font-medium">{claimedCode}</span>, as you entered it. <span className="font-medium">Unverified.</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No code saved yet. Enter one if you know it, or use the helper below to find candidates.</p>
        )}
        {productId ? (
          <form action={updateProduct} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="only" value="hs" />
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">HS/HSN code</span>
              <input name="hsCode" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={14} placeholder="e.g. 3923.10 or 39231090" className="h-10 w-56 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:text-sm" />
            </label>
            <Button type="submit" className="h-10 px-4 md:h-9">
              {code.trim() === "" && claimedCode ? "Remove my code" : "Save my code"}
            </Button>
            <p className="basis-full text-xs text-muted-foreground">4 to 10 digits, dots allowed. Saved as your claim and shown as unverified everywhere. Nothing is checked against an official tariff.</p>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">This is a suggested product, not one of yours yet. Add it to your catalogue to save a code for it.</p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-medium">Not sure? Help me find it</h3>
            <p className="mt-1 text-sm text-muted-foreground">Describe the product and its use. We suggest headings to check, with the reason for each.</p>
          </div>
          {!open && (
            <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setOpen(true)}>
              Help me find it
            </Button>
          )}
        </div>
        {open && (
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">What is it, what is it made of, and what is it used for?</span>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={1000} className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm" />
            </label>
            <div>
              <Button type="button" className="h-9 px-4" onClick={() => setResult(findCandidates({ name: defaults.name, category: defaults.category, description: desc, catalogueId }))}>
                Suggest headings to check
              </Button>
            </div>
          </div>
        )}
        {result && (
          <div className="mt-5 space-y-3" aria-live="polite">
            {result.candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">{result.none}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {result.candidates.map((c) => (
                  <li key={c.heading} className="px-4 py-3">
                    <p className="font-medium">
                      <span className="mr-2 font-mono text-primary">HS {c.heading}</span>
                      {c.label}
                    </p>
                    <p className="mt-1 text-sm">{c.rationale}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Pointed to by: {c.basis.join(", ")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{c.ambiguity}</p>
                    {productId && (
                      <button type="button" onClick={() => setCode(c.heading)} className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                        Use {c.heading} as my starting point
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="font-medium">Candidates only, found by simple keyword rules, not AI. </span>
              {result.confirm}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-dashed bg-card/60 p-4 sm:p-5">
        <h3 className="text-base font-medium">Product photographs</h3>
        <p className="mt-1 text-sm text-muted-foreground">Photo-based suggestions are not available. They would need an authorised vision provider and your consent for each photo, and neither is set up, so no photograph is uploaded or analysed.</p>
        <Button type="button" variant="outline" disabled className="mt-3 h-9 px-3">
          Add a photograph (not available yet)
        </Button>
      </div>
    </div>
  );
}
