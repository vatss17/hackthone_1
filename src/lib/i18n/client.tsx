"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_NAMES, LOCALE_STORAGE, parseLocale, type Locale } from "./config";
import { DICTIONARIES } from "./messages";
import { translate, type Vars } from "./translate";

const EVENT = "atlas:locale-changed";

/** The saved language: the cookie (which the server also reads), else this browser's storage, else English. */
function readLocale(): Locale {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
    if (m) return parseLocale(decodeURIComponent(m[1]));
  } catch {
    /* cookies blocked */
  }
  try {
    return parseLocale(window.localStorage.getItem(LOCALE_STORAGE));
  } catch {
    return DEFAULT_LOCALE;
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
};

interface Api {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (source: string, vars?: Vars) => string;
}

const Ctx = createContext<Api | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE);

  const setLocale = useCallback(
    (l: Locale) => {
      const next = parseLocale(l);
      try {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        /* the interface still switches for this visit */
      }
      try {
        window.localStorage.setItem(LOCALE_STORAGE, next);
      } catch {
        /* storage blocked */
      }
      window.dispatchEvent(new Event(EVENT));
      // Server-rendered pages read the cookie, so they re-render in the new language. Form state in client components is kept.
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const api = useMemo<Api>(() => ({ locale, setLocale, t: (source, vars) => translate(DICTIONARIES, locale, source, vars) }), [locale, setLocale]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

const FALLBACK: Api = { locale: DEFAULT_LOCALE, setLocale: () => {}, t: (s, v) => translate({}, DEFAULT_LOCALE, s, v) };

/** `const { t, locale } = useI18n()`. Outside the provider it falls back to English instead of throwing. */
export const useI18n = (): Api => useContext(Ctx) ?? FALLBACK;
export const useT = () => useI18n().t;

/** Inline translated text for JSX: `<T>Save draft</T>`. Children must be one plain string. */
export function T({ children, vars }: { children: string; vars?: Vars }) {
  return <>{useT()(children, vars)}</>;
}

export { LOCALE_NAMES };
