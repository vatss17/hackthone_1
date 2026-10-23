/** A titled part of a page, set off by a hairline rule instead of a box. */
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
    <section className="mt-10 border-t pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-semibold tracking-[-0.005em]">{title}</h2>
        {aside}
      </div>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
