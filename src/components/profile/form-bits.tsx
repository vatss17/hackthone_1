import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/auth/notice";
import { ERROR_MESSAGES, NOTICE_MESSAGES } from "@/lib/capability-validation";
import { cn } from "@/lib/utils";

/** Small server-rendered building blocks for the manufacturing-profile forms (no client JS). */

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Shows a fixed message for ?notice= / ?error= codes. Nothing from the URL is ever printed. */
export function Flash({ params }: { params: Record<string, string | string[] | undefined> }) {
  const notice = NOTICE_MESSAGES[pick(params.notice) ?? ""];
  const error = (ERROR_MESSAGES as Record<string, string>)[pick(params.error) ?? ""];
  if (!notice && !error) return null;
  return (
    <div className="mt-6">
      {error ? <Notice tone="error">{error}</Notice> : <Notice tone="success">{notice}</Notice>}
    </div>
  );
}

export function Field({
  id,
  name,
  label,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "id"> & { id: string; name: string; label: string; hint?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Select({
  id,
  name,
  label,
  options,
  placeholder,
  defaultValue,
  required,
  hint,
  className,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string | null;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-10 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:h-9 md:text-sm"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Textarea({ id, name, label, hint, ...props }: Omit<React.ComponentProps<"textarea">, "id"> & { id: string; name: string; label: string; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        name={name}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Collapsible "add / edit" panel. Native <details>: works without JavaScript and by keyboard. */
export function Disclosure({
  summary,
  children,
  variant = "outline",
}: {
  summary: string;
  children: React.ReactNode;
  variant?: "outline" | "link";
}) {
  return (
    <details className="group mt-3">
      <summary
        className={cn(
          "inline-flex cursor-pointer list-none items-center rounded-md text-sm font-medium [&::-webkit-details-marker]:hidden",
          variant === "outline"
            ? "h-8 border border-border bg-background px-3 hover:bg-muted"
            : "text-primary underline-offset-4 hover:underline",
        )}
      >
        {summary}
      </summary>
      <div className="mt-3 rounded-md border bg-card p-4 sm:p-5">{children}</div>
    </details>
  );
}

export function SubmitButton({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "outline" | "destructive" }) {
  return (
    <Button type="submit" variant={variant} size="lg" className="h-10 md:h-9">
      {children}
    </Button>
  );
}

/** A one-button POST form (remove, unlink, archive) with the ids the action needs. */
export function ActionButton({
  action,
  hidden,
  children,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <form action={action}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant="ghost" size="sm" aria-label={label} className="text-muted-foreground hover:text-destructive">
        {children}
      </Button>
    </form>
  );
}
