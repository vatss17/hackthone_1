import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, parseLocale, type Locale } from "./config";
import { DICTIONARIES } from "./messages";
import { translate, type Vars } from "./translate";

/** The visitor's language, from the cookie the language selector sets. Reading it makes a page dynamic: use it inside Suspense. */
export async function getLocale(): Promise<Locale> {
  return parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}

/** Server-side translator: `const t = await getT(); t("Save")`. */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: (source: string, vars?: Vars) => translate(DICTIONARIES, locale, source, vars) };
}
