import { cn } from "@/lib/utils";

/**
 * Evidence / status labels. Regulatory, tariff and financial information
 * must always carry one of these. Colours are tokens in globals.css.
 */
export type StatusKind =
  | "verified"
  | "secondary"
  | "user"
  | "estimate"
  | "ai"
  | "inferred"
  | "assumption"
  | "quoted"
  | "reported"
  | "unknown"
  | "expert"
  | "missing"
  | "demo"
  | "planned";

const styles: Record<StatusKind, { label: string; className: string }> = {
  verified: {
    label: "Verified source",
    className:
      "bg-(--status-verified-bg) text-(--status-verified-fg) border-(--status-verified-border)",
  },
  secondary: {
    label: "Secondary source",
    className:
      "bg-(--status-secondary-bg) text-(--status-secondary-fg) border-(--status-secondary-border)",
  },
  user: {
    label: "User provided",
    className:
      "bg-(--status-user-bg) text-(--status-user-fg) border-(--status-user-border)",
  },
  estimate: {
    label: "Estimate",
    className:
      "bg-(--status-estimate-bg) text-(--status-estimate-fg) border-(--status-estimate-border)",
  },
  ai: {
    label: "AI suggested",
    className:
      "bg-(--status-ai-bg) text-(--status-ai-fg) border-(--status-ai-border)",
  },
  inferred: {
    label: "Inferred",
    className:
      "bg-(--status-ai-bg) text-(--status-ai-fg) border-(--status-ai-border)",
  },
  reported: {
    label: "Reported data",
    className:
      "bg-(--status-verified-bg) text-(--status-verified-fg) border-(--status-verified-border)",
  },
  quoted: {
    label: "Quote held",
    className:
      "bg-(--status-user-bg) text-(--status-user-fg) border-(--status-user-border)",
  },
  assumption: {
    label: "Assumption",
    className:
      "bg-(--status-estimate-bg) text-(--status-estimate-fg) border-(--status-estimate-border)",
  },
  unknown: {
    label: "Needs expert confirmation",
    className:
      "bg-(--status-missing-bg) text-(--status-missing-fg) border-(--status-missing-border)",
  },
  expert: {
    label: "Expert reviewed",
    className: "bg-primary text-primary-foreground border-primary",
  },
  missing: {
    label: "Missing",
    className:
      "bg-(--status-missing-bg) text-(--status-missing-fg) border-(--status-missing-border)",
  },
  demo: {
    label: "Demo",
    className:
      "border-dashed bg-transparent text-amber-text border-amber",
  },
  planned: {
    label: "Planned",
    className:
      "bg-(--status-planned-bg) text-(--status-planned-fg) border-(--status-planned-border)",
  },
};

export function StatusBadge({
  kind,
  className,
}: {
  kind: StatusKind;
  className?: string;
}) {
  const s = styles[kind];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-sm border px-1.5 text-xs font-medium",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}
