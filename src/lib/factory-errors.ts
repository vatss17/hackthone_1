import type { FactoryFormState, FactoryFormValues } from "./factory-types";

/** The parts of a PostgREST / Postgres error this mapping reads. */
export type DbErrorLike = { code?: string | null; message?: string | null };

/**
 * Turns a factories write failure into something safe to show. Raw database text,
 * codes, constraint names and hints are never passed to the user.
 */
export function mapFactoryWriteError(error: DbErrorLike, values: FactoryFormValues): FactoryFormState {
  // Unique index on (organization, lower(name)) among active factories.
  if (error.code === "23505") {
    return {
      values,
      fieldErrors: { factoryName: "You already have an active factory with this name. Use a different name." },
    };
  }
  // Row Level Security / missing privilege: only company owners may write factories.
  if (error.code === "42501" || /row-level security/i.test(error.message ?? "")) {
    return { values, error: "Only company owners can add or change factories." };
  }
  return { values, error: "We could not save the factory right now. Nothing was changed. Try again in a moment." };
}
