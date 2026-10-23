import type { Locale } from "../config.ts";
import type { Dictionary } from "../translate.ts";
import { core } from "./core.ts";

/**
 * One file per section of the product (see ./sections). Each section file exports `{ hi, gu }`, both keyed by the English source
 * string. They are merged here, so sections can be edited independently.
 */
import { SECTIONS } from "./sections.ts";

const merge = (l: "hi" | "gu"): Dictionary => Object.assign({}, core[l], ...SECTIONS.map((s) => s[l]));

export const DICTIONARIES: Record<Exclude<Locale, "en">, Dictionary> = { hi: merge("hi"), gu: merge("gu") };
