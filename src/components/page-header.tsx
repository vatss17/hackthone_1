export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Optional control (for example a link button) shown beside the title on wide screens. */
  action?: React.ReactNode;
}) {
  return (
    <header className="border-b pb-6">
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {eyebrow}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">
          {title}
        </h1>
        {action}
      </div>
      {description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
