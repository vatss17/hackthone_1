import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, type StatusKind } from "@/components/status-badge";

export type PreviewNeed = { label: string; kind: StatusKind; note: string };

/**
 * An honest preview of a module that is not built yet. It never fakes results: it says what the
 * step will do, what it will need, what data is not connected, and where to go in the meantime.
 */
export function FeaturePreview({
  eyebrow,
  title,
  intro,
  does,
  needs,
  sources,
  next,
  topBar,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  does: string[];
  needs: PreviewNeed[];
  sources: string[];
  next: { href: string; label: string; note: string };
  children?: React.ReactNode;
  topBar?: React.ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={intro} action={<StatusBadge kind="planned" />} />
      {topBar}
      <div className="mt-6 rounded-md border border-dashed border-input/60 bg-card px-4 py-3 text-sm sm:px-5">
        <span className="font-medium">Preview.</span> This step is not built yet. Nothing on this page is a result, a quote or advice. It shows what the step will do so you can see where your information leads.
      </div>

      {children}

      <section className="mt-10" aria-labelledby="does-h">
        <h2 id="does-h" className="text-lg font-semibold tracking-tight">
          What this step will do
        </h2>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {does.map((d) => (
            <li key={d} className="px-4 py-3 text-sm sm:px-5">
              {d}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="needs-h">
        <h2 id="needs-h" className="text-lg font-semibold tracking-tight">
          What it will need
        </h2>
        <ul className="mt-3 divide-y rounded-md border bg-card">
          {needs.map((n) => (
            <li key={n.label} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start sm:gap-4 sm:px-5">
              <p className="text-sm font-medium">{n.label}</p>
              <p className="text-sm text-muted-foreground">{n.note}</p>
              <StatusBadge kind={n.kind} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="sources-h">
        <h2 id="sources-h" className="text-lg font-semibold tracking-tight">
          Data that is not connected yet
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-md border bg-card p-4 sm:p-5" aria-labelledby="next-h">
        <h2 id="next-h" className="text-base font-semibold tracking-tight">
          What you can do now
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{next.note}</p>
        <div className="mt-4">
          <Button asChild>
            <Link href={next.href}>{next.label}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
