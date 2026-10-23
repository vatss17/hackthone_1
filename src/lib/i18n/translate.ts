import { DEFAULT_LOCALE, type Locale } from "./config.ts";

export type Dictionary = Record<string, string>;
export type Vars = Record<string, string | number>;

/** Replaces {name} placeholders. A placeholder with no value is left as written, so a mistake is visible instead of blank. */
export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** The text in a language, else the English source. `dicts` holds one dictionary per non-English language. */
export function translate(dicts: Partial<Record<Locale, Dictionary>>, locale: Locale, source: string, vars?: Vars): string {
  const found = locale === DEFAULT_LOCALE ? undefined : dicts[locale]?.[source];
  return interpolate(found && found.trim() ? found : source, vars);
}

/** Every {placeholder} in a string, sorted, so a translation can be checked against its source. */
export const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
