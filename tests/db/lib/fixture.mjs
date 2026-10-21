// Shared fixture: creates synthetic users once per test file and cleans up.
// Cleanup order matters: archive organizations (the last-owner trigger blocks
// deleting owners of ACTIVE organizations), then delete users. Organizations and
// audit rows are intentionally left in the dev database; organizations are named
// "M13B2 TEST <runId> ..." so they can be found and removed by hand.

import { client } from "./api.mjs";
import {
  archiveOrganization,
  createTestUser,
  deleteUser,
  grantStaff,
  newRunId,
} from "./admin.mjs";

export async function createFixture(labels, { staff = {} } = {}) {
  const api = client();
  const runId = newRunId();
  const users = {};
  const orgIds = [];

  const cleanupUsers = async () => {
    for (const u of Object.values(created)) await deleteUser(u.id).catch(() => {});
  };
  const created = {};
  try {
    for (const label of labels) {
      const u = await createTestUser(runId, label);
      created[label] = u;
      if (staff[label]) await grantStaff(u.id, staff[label]);
      const session = await api.signIn(u.email, u.password);
      users[label] = { ...u, token: session.token };
    }
  } catch (err) {
    // Setup failed part-way (for example an Auth rate limit): do not leave users behind.
    await cleanupUsers();
    throw err;
  }

  return {
    api,
    runId,
    users,
    orgName: (label) => `M13B2 TEST ${runId} ${label}`,
    /** Create an organization as a user, through the real RPC. */
    async createOrg(label, name = `M13B2 TEST ${runId} ${label}`) {
      const r = await api.rpc(users[label].token, "create_organization", { p_name: name });
      if (r.ok) orgIds.push(r.body);
      return r;
    },
    trackOrg: (id) => orgIds.push(id),
    async cleanup() {
      for (const id of orgIds) {
        try {
          await archiveOrganization(id);
        } catch {
          /* best effort */
        }
      }
      for (const u of Object.values(users)) {
        try {
          await deleteUser(u.id);
        } catch {
          /* best effort */
        }
      }
    },
  };
}

export const factoryBody = (organization_id, name = "Synthetic Plant 1") => ({
  organization_id,
  name,
  address_line1: "1 Test Road",
  city: "Testville",
  state: "Test State",
  postal_code: "400001",
});
