"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreview } from "@/lib/ux-preview/use-preview.ts";
import { Box, Btn, Callout, Choice, Field, H1, inputCls, P, Stepper } from "./wf.tsx";

export function Signup() {
  const router = useRouter();
  const { state, set } = usePreview();
  const [stage, setStage] = useState<"account" | "goal">("account");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [err, setErr] = useState("");
  const goal = state.goal;

  function create() {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr("Enter an email address like name@example.com.");
    if (!company.trim()) return setErr("Enter your company name. You can change it later.");
    setErr("");
    setStage("goal");
  }
  function start() {
    if (!goal) return;
    set({ scenario: "default" });
    router.push(goal === "A" ? "/ux-preview/path-a" : "/ux-preview/path-b");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Stepper steps={["Create account", "Choose your starting point"]} current={stage === "account" ? 1 : 2} label="Sign-up progress" />
      {stage === "account" ? (
        <div className="space-y-5">
          <H1>Create your free account</H1>
          <P muted>Keep your results and come back to them. This is a wireframe: nothing is created and your input is not stored.</P>
          <Box>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create(); }} noValidate>
              <Field id="su-company" label="Company name"><input id="su-company" className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" /></Field>
              <Field id="su-email" label="Work email" hint="We use it to sign you in. Never shown to anyone."><input id="su-email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
              <Field id="su-pass" label="Password" hint="At least 10 characters (not checked in this wireframe)."><input id="su-pass" type="password" className={inputCls} autoComplete="new-password" /></Field>
              {err && <Callout tone="error" title={err} />}
              <Btn kind="primary" type="submit">Create account and continue</Btn>
            </form>
          </Box>
          <p className="text-sm text-muted-foreground">Already have an account? <a className="underline" href="/ux-preview/app/home">Sign in</a>. Just looking? <a className="underline" href="/ux-preview/sample">Explore the sample</a>.</p>
          <Btn kind="ghost" href="/ux-preview/landing">Back to the homepage</Btn>
        </div>
      ) : (
        <div className="space-y-5">
          <H1>What would you like to do first?</H1>
          <P muted>This only decides where we start. You can do the other one any time.</P>
          <div role="radiogroup" aria-label="Starting point" className="space-y-3">
            <Choice selected={goal === "A"} onSelect={() => set({ goal: "A" })} title="A. Export products I already make">
              You have products or a catalogue. We check whether each could sell in the destination market and what it would take. Start with one product or a file.
            </Choice>
            <Choice selected={goal === "B"} onSelect={() => set({ goal: "B" })} title="B. Discover what else my factory could make">
              You are not sure what to export yet. Tell us your processes, machines and materials. We suggest products your factory is suited to.
            </Choice>
          </div>
          {!goal && <p className="text-sm text-muted-foreground">Choose one to continue.</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
            <Btn onClick={() => setStage("account")}>Back</Btn>
            <Btn kind="primary" disabled={!goal} onClick={start}>{goal === "B" ? "Start with my factory" : "Start with my products"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
