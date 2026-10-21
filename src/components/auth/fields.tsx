"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = Omit<React.ComponentProps<"input">, "id" | "name"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

/** Label, input, optional hint and an accessible error message. */
export function TextField({ name, label, error, hint, className, ...props }: FieldProps) {
  // The hint is only rendered while there is no error, so only then may it be referenced.
  const hintId = hint && !error ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={className}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Password input with a working show / hide control. */
export function PasswordField({ name, label, error, hint, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  // The hint is only rendered while there is no error, so only then may it be referenced.
  const hintId = hint && !error ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className="pr-16"
          autoCapitalize="none"
          spellCheck={false}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-3 text-xs font-medium text-primary hover:text-foreground"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type SelectFieldProps = Omit<React.ComponentProps<"select">, "id" | "name"> & {
  name: string;
  label: string;
  options: readonly string[];
  placeholder: string;
  error?: string;
  hint?: string;
};

/** Native select (works everywhere, including mobile pickers) styled like the text inputs. */
export function SelectField({ name, label, options, placeholder, error, hint, className, ...props }: SelectFieldProps) {
  const hintId = hint && !error ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={
          "h-10 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:h-9 md:text-sm " +
          (className ?? "")
        }
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
