import { cn } from "@/lib/utils";

const tones = {
  error: "border-(--status-missing-border) bg-(--status-missing-bg) text-(--status-missing-fg)",
  success: "border-(--status-verified-border) bg-(--status-verified-bg) text-(--status-verified-fg)",
  info: "border-border bg-muted text-foreground",
} as const;

/** Inline message. Errors use role="alert" so screen readers announce them. */
export function Notice({
  tone,
  children,
  ...props
}: { tone: keyof typeof tones } & React.ComponentProps<"div">) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-3 py-2.5 text-sm", tones[tone])}
      {...props}
    >
      {children}
    </div>
  );
}
