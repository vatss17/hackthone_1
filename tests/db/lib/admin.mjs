// PRIVILEGED test setup and cleanup. The ONLY file that reads the secret key.
//
// Rules:
//   * Used for test-user creation/deletion, staff bootstrap and cleanup only.
//     Never use it to make an authorization assertion pass.
//   * Targets the designated development project only (guard in env.mjs).
//   * Creates synthetic, clearly labelled test users. No real data.

import { randomBytes, randomUUID } from "node:crypto";
import { loadConfig } from "./env.mjs";

function privileged() {
  const { url, secretKey } = loadConfig({ privileged: true });
  const call = async (method, path, body, extra = {}) => {
    const headers = { apikey: secretKey, "Content-Type": "application/json", ...extra };
    if (!secretKey.startsWith("sb_")) headers.Authorization = `Bearer ${secretKey}`;
    const res = await fetch(`${url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, body: json };
  };
  return { call };
}

export function newRunId() {
  return randomUUID().slice(0, 8);
}

/** Create a confirmed test user. The password is random and kept in memory only. */
export async function createTestUser(runId, label) {
  const { call } = privileged();
  const email = `m13b2-${runId}-${label}@example.com`;
  const password = `${randomUUID()}${randomBytes(8).toString("hex")}`; // 52 chars, under the 72-char limit
  const r = await call("POST", "/auth/v1/admin/users", {
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_test_user: true },
  });
  if (!r.ok) throw new Error(`createTestUser(${label}) failed with status ${r.status}`);
  return { id: r.body.id, email, password };
}

/** Bootstrap a platform staff row. Production does this with SQL as the owner role. */
export async function grantStaff(userId, role) {
  const { call } = privileged();
  const r = await call("POST", "/rest/v1/platform_staff", { user_id: userId, role }, {
    Prefer: "return=minimal",
  });
  if (!r.ok) throw new Error(`grantStaff failed with status ${r.status}`);
}

/** Archive an organization (needed before its last owner's account can be deleted). */
export async function archiveOrganization(orgId) {
  const { call } = privileged();
  const r = await call(
    "PATCH",
    `/rest/v1/organizations?id=eq.${orgId}`,
    { archived_at: new Date().toISOString() },
    { Prefer: "return=minimal" },
  );
  if (!r.ok) throw new Error(`archiveOrganization failed with status ${r.status}`);
}

export async function deleteUser(userId) {
  const { call } = privileged();
  return call("DELETE", `/auth/v1/admin/users/${userId}`);
}

/** Direct privileged request, for tests that assert what service_role can NOT do. */
export function rawPrivileged(method, path, body) {
  return privileged().call(method, path, body, { Prefer: "return=representation" });
}
