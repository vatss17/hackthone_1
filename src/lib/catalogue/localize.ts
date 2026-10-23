/**
 * Shows the catalogue reader's messages (src/lib/catalogue/parse.ts, the import action and the AI errors) in the reader's language.
 *
 * Those modules build their sentences in English, often with a value from the person's own file inside (a weight, a product or column
 * name). They stay as they are, because tests and the server rely on them. At display time each sentence is matched here and
 * translated with the file's own words filled back in untouched. A sentence that is not recognised is looked up as it is, and if there is
 * no translation it simply stays English. Pure: no React, so node can import it.
 */

type Translate = (source: string, vars?: Record<string, string | number>) => string;

/** Splits "{n} value must be…" style fragments for the confidence sentence. */
const CONFIDENCE =
  /^(\d+) of 6 key details were stated in the file(?:, (\d+) suggested by a rule)?(?:, (?:(\d+) values? must be corrected or left out|(\d+) to look at))?(, and the layout of a PDF is lost)?\. This reflects how complete and clean the file was, not whether the facts are right\.$/;

export function localizeMessage(message: string, t: Translate, locale: string): string {
  if (locale === "en" || !message) return message;
  let m: RegExpMatchArray | null;

  if ((m = message.match(/^The weight “(.*)” is not a number\.$/))) return t("The weight “{value}” is not a number.", { value: m[1] });
  if ((m = message.match(/^The weight must be a positive number \(found (.+)\)\.$/))) return t("The weight must be a positive number (found {found}).", { found: m[1] });
  if ((m = message.match(/^The weight unit “(.*)” is not supported\. Use grams \(g\) or kilograms \(kg\)\.$/))) return t("The weight unit “{unit}” is not supported. Use grams (g) or kilograms (kg).", { unit: m[1] });
  if ((m = message.match(/^(.+) must be a positive number \(found (.+)\)\.$/))) return t("{name} must be a positive number (found {found}).", { name: m[1], found: m[2] });
  if ((m = message.match(/^The file is very long, so only the first (.+) characters were read\.$/))) return t("The file is very long, so only the first {chars} characters were read.", { chars: m[1] });
  if ((m = message.match(/^Only the first (\d+) products are shown\. Import the rest in a second file\.$/))) return t("Only the first {count} products are shown. Import the rest in a second file.", { count: m[1] });
  if ((m = message.match(/^(\d+) blocks? of text did not look like products and (?:were|was) left out\.$/))) return m[1] === "1" ? t("{count} block of text did not look like products and was left out.", { count: m[1] }) : t("{count} blocks of text did not look like products and were left out.", { count: m[1] });
  if ((m = message.match(/^AI named (\d+) products? that could not be checked against your text, so (?:it was|they were) discarded\.$/))) return m[1] === "1" ? t("AI named {count} product that could not be checked against your text, so it was discarded.", { count: m[1] }) : t("AI named {count} products that could not be checked against your text, so they were discarded.", { count: m[1] });
  if ((m = message.match(/^Choose between 1 and (\d+) products\.$/))) return t("Choose between 1 and {max} products.", { max: m[1] });
  if ((m = message.match(/^(.+) The rule-based reading is shown instead\.$/))) return `${localizeMessage(m[1], t, locale)} ${t("The rule-based reading is shown instead.")}`;

  // Where in the file: "row 4, column 3 (“Weight”)" and "block 2, line “Weight: -5 kg”".
  if ((m = message.match(/^row (\d+), column (\d+) \((.*)\)$/))) return t("row {row}, column {column} ({header})", { row: m[1], column: m[2], header: m[3] });
  if ((m = message.match(/^block (\d+), line (.*)$/))) return t("block {block}, line {line}", { block: m[1], line: m[2] });

  if ((m = message.match(CONFIDENCE))) {
    const parts = [t("{count} of 6 key details were stated in the file", { count: m[1] })];
    if (m[2]) parts.push(t("{count} suggested by a rule", { count: m[2] }));
    if (m[3]) parts.push(m[3] === "1" ? t("{count} value must be corrected or left out", { count: m[3] }) : t("{count} values must be corrected or left out", { count: m[3] }));
    if (m[4]) parts.push(t("{count} to look at", { count: m[4] }));
    if (m[5]) parts.push(t("the layout of a PDF is lost"));
    return `${parts.join(", ")}${t(". This reflects how complete and clean the file was, not whether the facts are right.")}`;
  }

  return t(message);
}
