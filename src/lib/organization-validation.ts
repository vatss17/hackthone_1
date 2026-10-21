import type { CompanyFormState } from "./organization-types";

// Mirror the CHECK constraints on public.organizations.
export const COMPANY_NAME_MIN = 2;
export const COMPANY_NAME_MAX = 200;
export const LEGAL_NAME_MAX = 300;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HAS_LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

/** Trim and collapse runs of whitespace; non-strings become empty. */
function normalise(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function checkName(raw: string, label: string, max: number, required: boolean): string | undefined {
  if (raw.length === 0) return required ? `Enter your ${label}.` : undefined;
  if (CONTROL_CHARS.test(raw)) return "Remove line breaks and control characters.";
  if (raw.length < COMPANY_NAME_MIN) return `Use at least ${COMPANY_NAME_MIN} characters.`;
  if (raw.length > max) return `Use at most ${max} characters.`;
  if (!HAS_LETTER_OR_NUMBER.test(raw)) return "Include at least one letter or number.";
  return undefined;
}

/**
 * Validates the two company fields. Mirrors the database CHECK constraints so the
 * user gets a clear message instead of a database error; the database remains the
 * final authority. Returns the cleaned values to send to create_organization.
 */
export function validateCompany(companyName: unknown, legalName: unknown) {
  const name = normalise(companyName);
  const legal = normalise(legalName);
  const fieldErrors: NonNullable<CompanyFormState["fieldErrors"]> = {};

  const nameError = checkName(name, "company name", COMPANY_NAME_MAX, true);
  const legalError = checkName(legal, "legal name", LEGAL_NAME_MAX, false);
  if (nameError) fieldErrors.companyName = nameError;
  if (legalError) fieldErrors.legalName = legalError;

  const values = { companyName: name, legalName: legal };
  if (fieldErrors.companyName || fieldErrors.legalName) return { ok: false as const, fieldErrors, values };
  return { ok: true as const, name, legalName: legal.length > 0 ? legal : null, values };
}
