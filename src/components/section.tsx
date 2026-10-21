export function Section({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {aside}
      </div>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
