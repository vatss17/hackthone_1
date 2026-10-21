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
    <div className="rounded-md border border-dashed border-input/60 bg-card px-5 py-6">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
