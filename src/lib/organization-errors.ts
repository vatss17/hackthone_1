import type { CompanyFormState } from "./organization-types";

/** The parts of a PostgREST / Postgres error this mapping reads. */
export type DbErrorLike = { code?: string | null; message?: string | null };

export type RegisterOutcome =
  | { kind: "signed-out" } // no valid session: send to sign-in
  | { kind: "already-registered" } // this user already has a company: send to the dashboard
  | { kind: "state"; state: CompanyFormState }; // stay on the form with a message

/**
 * Turns a create_organization failure into something safe to show. Raw database
 * text, codes, hints and details are never passed to the user.
 */
export function mapRegisterError(error: DbErrorLike, values: CompanyFormState["values"]): RegisterOutcome {
  const message = error.message ?? "";

  if (error.code === "28000" || /not authenticated/i.test(message)) return { kind: "signed-out" };

  // The one-organization-per-user rule. Also what a duplicate or concurrent
  // submission hits: treat it as "already done", not as a failure.
  if (error.code === "23505" && /already belongs/i.test(message)) return { kind: "already-registered" };

  if (error.code === "42501" && /not confirmed/i.test(message)) {
    return {
      kind: "state",
      state: { values, error: "Confirm your email address first: open the link we emailed you, then try again." },
    };
  }

  if (error.code === "22023") {
    return { kind: "state", state: { values, fieldErrors: { companyName: "That name is not accepted. Check it and try again." } } };
  }

  return {
    kind: "state",
    state: { values, error: "We could not register your company right now. Nothing was saved. Try again in a moment." },
  };
}
