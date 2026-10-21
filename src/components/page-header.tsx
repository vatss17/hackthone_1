export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="border-b pb-6">
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      )}
    </header>
  );
}
