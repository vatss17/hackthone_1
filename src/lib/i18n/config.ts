/**
 * Interface languages. The English text in the source IS the message key (the first argument to t()), so English can never be
 * missing, a missing hi or gu entry falls back to English, and the coverage test can list every key by reading the source.
 * Internal manufacturing data is never translated or stored per language: only what the interface says changes.
 */
export const LOCALES = ["en", "hi", "gu"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "atlas-locale";
export const LOCALE_STORAGE = "atlas:locale:v1";

/** Each language in its own script, so a person who cannot read the current language can still find theirs. */
export const LOCALE_NAMES: Record<Locale, { native: string; english: string; /** BCP 47 tag for speech recognition and lang attributes. */ bcp47: string; geminiName: string }> = {
  en: { native: "English", english: "English", bcp47: "en-IN", geminiName: "English" },
  hi: { native: "हिन्दी", english: "Hindi", bcp47: "hi-IN", geminiName: "Hindi (Devanagari script)" },
  gu: { native: "ગુજરાતી", english: "Gujarati", bcp47: "gu-IN", geminiName: "Gujarati (Gujarati script)" },
};

export const parseLocale = (v: unknown): Locale => (typeof v === "string" && (LOCALES as readonly string[]).includes(v) ? (v as Locale) : DEFAULT_LOCALE);
