import type { FactoryField, FactoryFormValues } from "./factory-types";

/** The 28 states and 8 union territories of India. The country is fixed to India for the MVP. */
export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

// Mirror the CHECK constraints on public.factories (the database stays the final authority).
export const FACTORY_NAME_MIN = 2;
export const FACTORY_NAME_MAX = 200;
export const ADDRESS_MAX = 200;
export const CITY_MAX = 100;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HAS_LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const INDIAN_PIN = /^[1-9][0-9]{5}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalise(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

type Checked =
  | { ok: true; values: FactoryFormValues }
  | { ok: false; values: FactoryFormValues; fieldErrors: Partial<Record<FactoryField, string>> };

/**
 * Validates the factory fields and returns cleaned values. Only these six fields are
 * ever read; the country is not a field (it is fixed to India by the database).
 */
export function validateFactory(input: Partial<Record<FactoryField, unknown>>): Checked {
  const values: FactoryFormValues = {
    factoryName: normalise(input.factoryName),
    addressLine1: normalise(input.addressLine1),
    addressLine2: normalise(input.addressLine2),
    city: normalise(input.city),
    state: normalise(input.state),
    postalCode: normalise(input.postalCode).replace(/\s/g, ""),
  };
  const errors: Partial<Record<FactoryField, string>> = {};

  // Messages are fixed English sentences: the form translates them where they are shown (see factory-form.tsx).
  const text = (field: FactoryField, missing: string, opts: { required: boolean; min?: number; max: number }) => {
    const v = values[field];
    if (v.length === 0) {
      if (opts.required) errors[field] = missing;
      return;
    }
    if (CONTROL_CHARS.test(v)) errors[field] = "Remove line breaks and control characters.";
    else if (opts.min && v.length < opts.min) errors[field] = `Use at least ${opts.min} characters.`;
    else if (v.length > opts.max) errors[field] = `Use at most ${opts.max} characters.`;
    else if (!HAS_LETTER_OR_NUMBER.test(v)) errors[field] = "Include at least one letter or number.";
  };

  text("factoryName", "Enter the factory name.", { required: true, min: FACTORY_NAME_MIN, max: FACTORY_NAME_MAX });
  text("addressLine1", "Enter the address.", { required: true, max: ADDRESS_MAX });
  text("addressLine2", "Enter the address.", { required: false, max: ADDRESS_MAX });
  text("city", "Enter the city.", { required: true, max: CITY_MAX });

  if (values.state.length === 0) errors.state = "Choose the state or union territory.";
  else if (!(INDIAN_STATES as readonly string[]).includes(values.state)) errors.state = "Choose a state or union territory from the list.";

  if (values.postalCode.length === 0) errors.postalCode = "Enter the PIN code.";
  else if (!INDIAN_PIN.test(values.postalCode)) errors.postalCode = "Enter a 6-digit PIN code that does not start with 0.";

  return Object.keys(errors).length > 0 ? { ok: false, values, fieldErrors: errors } : { ok: true, values };
}
