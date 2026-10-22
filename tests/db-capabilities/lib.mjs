// Shared helpers for the capabilities-and-products database tests.
// These run against the designated Supabase DEVELOPMENT project and need the M1.4B migration to be
// applied. Until it is, every test reports itself as SKIPPED (never as passed).
import { rawPrivileged } from "../db/lib/admin.mjs";

export const codeOf = (r) => r.body?.code;
export const rowsOf = (r) => (Array.isArray(r.body) ? r.body : []);

/** True when the new tables exist (probe with a real signed-in session). */
export async function migrationApplied(api, token) {
  const r = await api.rest(token, "GET", "ref_processes?select=id&limit=1");
  return r.ok;
}

export const SKIP_REASON = "M1.4B migration is not applied to this project: tests not run (not a pass)";

export async function auditActions(filter) {
  const r = await rawPrivileged("GET", `/rest/v1/audit_log?${filter}&select=action,actor_id,organization_id,details&order=id.asc&limit=500`);
  return r.body ?? [];
}

export async function referenceIds(api, token) {
  const procs = rowsOf(await api.rest(token, "GET", "ref_processes?select=id,code"));
  const mats = rowsOf(await api.rest(token, "GET", "ref_materials?select=id,code"));
  return {
    proc: Object.fromEntries(procs.map((p) => [p.code, p.id])),
    mat: Object.fromEntries(mats.map((m) => [m.code, m.id])),
  };
}

export const factoryBody = (orgId, name) => ({
  organization_id: orgId, name, address_line1: "1 Test Road", city: "Testville", state: "Gujarat", postal_code: "380001",
});
