"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useT } from "@/lib/i18n/client";
import { Bot, Boxes, CircleAlert, CircleCheck, CircleDot, Compass, Factory, FileText, Flag, Scale, ShieldCheck, type LucideIcon } from "lucide-react";

type Stage = { id: string; icon: LucideIcon; title: string; body: string; preview: React.ReactNode };

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <span className="min-w-0 text-[13px] font-medium">{title}</span>
        <span className="shrink-0 rounded border border-(--status-estimate-border) bg-(--status-estimate-bg) px-1.5 text-xs font-medium text-(--status-estimate-fg)">{t("Sample data")}</span>
      </div>
      <div className="p-4 text-sm">{children}</div>
    </div>
  );
}

const Row = ({ a, b, tone }: { a: string; b: string; tone?: "ok" | "warn" | "bad" }) => (
  <div className="flex items-baseline justify-between gap-3 border-b py-2 last:border-0">
    <span className="text-muted-foreground">{a}</span>
    <span className={`tnum text-right font-medium ${tone === "bad" ? "text-error" : tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : ""}`}>{b}</span>
  </div>
);

const Bar = ({ label, v, max, tone = "navy" }: { label: string; v: number; max: number; tone?: "navy" | "teal" }) => (
  <div className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3 py-1">
    <span className="truncate text-[13px] text-muted-foreground">{label}</span>
    <span className="h-2 rounded-full bg-muted"><span className={`block h-2 rounded-full ${tone === "teal" ? "bg-brand-teal" : "bg-primary"}`} style={{ width: `${Math.max(3, (v / max) * 100)}%` }} /></span>
    <span className="tnum text-right text-[13px]">{v.toFixed(2)}</span>
  </div>
);

type Tr = ReturnType<typeof useT>;

const buildStages = (t: Tr): Stage[] => [
  {
    id: "factory", icon: Factory, title: t("Factory"), body: t("Tell Atlas what you run: processes, machines, materials and capacity. Upload a catalogue and it reads the products for you to review."),
    preview: (
      <Frame title={t("Review Plant 1 · capability")}>
        <div className="flex flex-wrap gap-1.5">{[t("Injection moulding · 180 t/month"), t("Extrusion · 90 t/month"), "PP", "HDPE", t("Recycled PP regrind")].map((c) => <span key={c} className="rounded-md border bg-background px-2 py-1 text-[13px]">{c}</span>)}</div>
        <div className="mt-3"><Row a={t("Machines")} b={t("7 (3 rated)")} /><Row a={t("Capacity declared")} b={t("Yes")} tone="ok" /></div>
      </Frame>
    ),
  },
  {
    id: "products", icon: Boxes, title: t("Products"), body: t("Your catalogue becomes structured records: material, use, weight, size and an HS code you confirm. Missing details are marked, never guessed."),
    preview: (
      <Frame title={t("Catalogue")}>
        {[[t("Stackable storage crate 40 L"), t("PP · 1.9 kg · HS 3924 (claimed)")], [t("Bucket 12 L"), t("HDPE · 0.52 kg · HS not set")], [t("Garden planter"), t("PP · 0.7 kg · size missing")]].map(([n, m]) => <div key={n} className="border-b py-2 last:border-0"><p className="font-medium">{n}</p><p className="text-[13px] text-muted-foreground">{m}</p></div>)}
      </Frame>
    ),
  },
  {
    id: "opportunities", icon: Compass, title: t("Global opportunities"), body: t("Atlas matches your capability to products you could make and markets worth testing. Fit is reasoned from your machines; demand is kept separate and never guessed."),
    preview: (
      <Frame title={t("What else your factory could make")}>
        {[[t("Hangers and laundry products"), t("Strong fit")], [t("Plastic pallets and large industrial bins"), t("Strong fit")], [t("Caps, closures and lids"), t("Good fit")]].map(([n, f]) => <Row key={n} a={n} b={f} tone="ok" />)}
        <p className="mt-2 text-[13px] text-muted-foreground">{t("Market demand: no licensed data connected, so none is shown.")}</p>
      </Frame>
    ),
  },
  {
    id: "economics", icon: Scale, title: t("Export economics"), body: t("Landed cost per unit, margin and break-even, from your own prices. AI estimates freight, handling and clearing from researched rates; you replace them with quotes."),
    preview: (
      <Frame title={t("Landed cost per unit (AED)")}>
        <Bar label={t("Product")} v={3.17} max={3.4} />
        <Bar label={t("Freight and handling")} v={0.62} max={3.4} tone="teal" />
        <Bar label={t("Duty (assumption)")} v={0.4} max={3.4} />
        <Bar label={t("Port and clearing")} v={0.25} max={3.4} />
        <div className="mt-2"><Row a={t("Landed cost")} b="AED 4.46" /><Row a={t("Margin at AED 6.00")} b="25.7%" tone="ok" /></div>
      </Frame>
    ),
  },
  {
    id: "compliance", icon: ShieldCheck, title: t("Compliance"), body: t("Screening questions for your product type, with AI-researched draft answers and sources. A draft is never an approval: you confirm, an expert can review."),
    preview: (
      <Frame title={t("Who is the importer of record?")}>
        <p className="text-[13px] font-medium text-brand-teal">{t("AI research draft · medium confidence")}</p>
        <p className="mt-1">{t("The importer needs a trade licence covering the activity and a customs registration. Conformity applications go through an authorised certification body.")}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">{t("Sources: certification body guidance · still to confirm with your buyer")}</p>
      </Frame>
    ),
  },
  {
    id: "documents", icon: FileText, title: t("Documentation"), body: t("Enter details once; the invoice and packing list fill themselves and check each other. Every draft says what is missing before you print."),
    preview: (
      <Frame title={t("Commercial invoice · draft")}>
        <p className="rounded border border-dashed border-foreground/40 px-2 py-1 text-center text-[13px] font-medium">{t("DRAFT: review required")}</p>
        <div className="mt-2"><Row a={t("Fields present")} b={t("9 missing")} tone="warn" /><Row a={t("Formats")} b={t("No errors")} tone="ok" /><Row a={t("Rows and totals")} b={t("Consistent")} tone="ok" /></div>
      </Frame>
    ),
  },
  {
    id: "ai", icon: Bot, title: t("AI execution"), body: t("Ask Atlas AI to find opportunities, cost a shipment or plan your next tasks. It uses the app's own tools, shows its working, and waits for your approval before saving."),
    preview: (
      <Frame title={t("Atlas AI · Create my next five tasks")}>
        {[[t("Replace the sample costs with your own"), true], [t("Confirm the HS code"), true], [t("Answer the importer questions"), false]].map(([label, d]) => <div key={String(label)} className="flex items-center gap-2 border-b py-2 last:border-0">{d ? <CircleCheck aria-hidden className="size-4 text-success" /> : <CircleDot aria-hidden className="size-4 text-muted-foreground" />}<span>{label}</span></div>)}
        <div className="mt-3 flex gap-2"><span className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground">{t("Approve and save")}</span><span className="rounded-md border px-3 py-1.5 text-[13px]">{t("Edit")}</span></div>
      </Frame>
    ),
  },
  {
    id: "ready", icon: Flag, title: t("Export readiness"), body: t("One place that shows what is done, what is blocking you and the single next step, until the first shipment is ready to go."),
    preview: (
      <Frame title={t("Mission control")}>
        <div className="flex gap-1">{Array.from({ length: 12 }).map((_, n) => <span key={n} className={`h-2 flex-1 rounded-full ${n < 5 ? "bg-primary" : n < 7 ? "bg-brand-teal" : "bg-muted"}`} />)}</div>
        <div className="mt-3"><Row a={t("Steps complete")} b={t("5 of 12")} /><Row a={t("Blockers")} b="2" tone="bad" /></div>
        <p className="mt-2 inline-flex items-center gap-1 text-[13px] text-error"><CircleAlert aria-hidden className="size-3.5" />{t("Next: fix the loss at current freight")}</p>
      </Frame>
    ),
  },
];

/** The whole journey in one scroll: the stage list stays put while the product view changes beside it. */
export function Story() {
  const t = useT();
  const STAGES = buildStages(t);
  const reduce = !!useReducedMotion();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i)); }), { rootMargin: "-45% 0px -45% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);
  const s = STAGES[active];

  return (
    <section id="journey" aria-labelledby="journey-h" className="scroll-mt-20 border-t py-16 lg:py-24">
      <div className="max-w-2xl">
        <p className="text-[15px] font-medium text-brand-teal">{t("The complete export journey")}</p>
        <h2 id="journey-h" className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{t("From the machines you run to a shipment that is ready to go.")}</h2>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ol className="space-y-0">
          {STAGES.map((st, n) => (
            <li key={st.id} ref={(el) => { refs.current[n] = el; }} data-i={n} className="lg:min-h-[52vh]">
              <div className={`flex gap-4 border-l-2 py-5 pl-5 transition-colors duration-300 ${n === active ? "border-brand-teal" : "border-border"}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-lg transition-colors ${n === active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"} border`}><st.icon aria-hidden className="size-5" /></span>
                <div>
                  <p className="tnum text-[13px] text-muted-foreground">{String(n + 1).padStart(2, "0")}</p>
                  <h3 className="text-xl font-semibold tracking-[-0.01em]">{st.title}</h3>
                  <p className="mt-1 max-w-md text-[15px] leading-relaxed text-muted-foreground">{st.body}</p>
                  <div className="mt-4 lg:hidden">{st.preview}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-28">
            <AnimatePresence mode="wait">
              <motion.div key={s.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                {s.preview}
              </motion.div>
            </AnimatePresence>
            <p className="mt-3 text-[13px] text-muted-foreground">{t("Step {current} of {total}", { current: active + 1, total: STAGES.length })}: {s.title}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
