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
    <header className="pb-2">
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
          {eyebrow}
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 break-words text-3xl font-medium tracking-tight sm:text-4xl sm:leading-[1.15]">
          {title}
        </h1>
        {action}
      </div>
      {description && (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
