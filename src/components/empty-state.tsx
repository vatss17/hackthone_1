import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  /** Only pass an action that works. Omit otherwise. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-dashed border-input/70 bg-card px-4 py-5 sm:px-5">
      <Inbox aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
