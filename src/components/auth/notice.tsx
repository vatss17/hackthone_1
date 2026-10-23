import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  error: "border-(--status-missing-border) bg-(--status-missing-bg) text-(--status-missing-fg)",
  success: "border-(--status-verified-border) bg-(--status-verified-bg) text-(--status-verified-fg)",
  info: "border-border bg-muted text-foreground",
} as const;

const icons = { error: CircleAlert, success: CircleCheck, info: Info } as const;

/** Inline message. An icon accompanies the colour, and errors use role="alert" so screen readers announce them. */
export function Notice({
  tone,
  children,
  ...props
}: { tone: keyof typeof tones } & React.ComponentProps<"div">) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm", tones[tone])}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
