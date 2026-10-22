import Link from "next/link";
import { cn } from "@/lib/utils";

export type JourneyStep = "profile" | "opportunities" | "explore" | "cost" | "scenarios" | "feasibility" | "roadmap";

/**
 * The export journey as one strip, so every page in it shows where you are and lets you move on
 * or back with the same product carried along. `reference` is a product id, a catalogue id, or
 * null for a standalone calculation.
 */
export function JourneyBar({ current, reference }: { current: JourneyStep; reference: string | null }) {
  const q = reference && reference !== "standalone" ? reference : null;
  const steps: { id: JourneyStep; label: string; href: string }[] = [
    { id: "profile", label: "Factory profile", href: "/factories" },
    { id: "opportunities", label: "Opportunities", href: "/opportunities" },
    { id: "explore", label: "Explore", href: q ? `/opportunities/${q}` : "/opportunities" },
    { id: "cost", label: "Landed cost", href: q ? `/viability?product=${q}#inputs` : "/viability#inputs" },
    { id: "scenarios", label: "Scenarios", href: q ? `/viability?product=${q}#scenarios` : "/viability#scenarios" },
    { id: "feasibility", label: "Feasibility", href: `/feasibility/${q ?? "standalone"}` },
    { id: "roadmap", label: "Roadmap", href: q ? `/roadmap?product=${q}` : "/roadmap" },
  ];
  const at = steps.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Export journey" className="mt-5 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-sm">
        {steps.map((s, idx) => (
          <li key={s.id} className="flex items-center gap-1">
            <Link
              href={s.href}
              aria-current={s.id === current ? "step" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                s.id === current ? "bg-primary font-medium text-primary-foreground" : idx < at ? "text-primary hover:bg-muted" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="mr-1.5 font-mono text-xs">{idx + 1}</span>
              {s.label}
            </Link>
            {idx < steps.length - 1 && <span aria-hidden className="text-muted-foreground">›</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
