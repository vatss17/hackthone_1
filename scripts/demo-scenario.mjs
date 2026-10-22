// DEVELOPMENT-ONLY demo scenario: a synthetic manufacturer you can sign in as.
//
//   npm run demo:create   create the demo user, company, factory, machinery, materials, products
//   npm run demo:reset    delete the demo user (and archive its company), then create it again
//   npm run demo:destroy  delete the demo user and archive its company, create nothing
//   npm run demo:status   say whether the demo scenario exists
//
// Safety:
//   * Works only against the designated development project (guard in tests/db/lib/env.mjs).
//   * Touches ONLY the account whose email is DEMO_EMAIL below AND whose Auth metadata says
//     synthetic_demo_user = true. It never lists, changes or deletes any other account or company.
//   * Everything is written through the demo user's OWN session (the same permissions and checks as
//     the real application). The privileged key is used only to create and delete that one account
//     and to archive its company.
//   * The password is random, kept in the git-ignored file .env.demo.local (mode 600), and never printed.
//   * Every record is clearly sample data: the company name starts with "DEMO" and the app shows a
//     demo banner for it.

import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { client } from "../tests/db/lib/api.mjs";
import { archiveOrganization, deleteUser, rawPrivileged } from "../tests/db/lib/admin.mjs";

const DEMO_EMAIL = "demo.manufacturer@example.com";
const ORG_NAME = "DEMO · Sample Polymers Pvt Ltd (sample data)";
const CREDENTIALS_FILE = resolve(process.cwd(), ".env.demo.local");

if (process.env.NODE_ENV === "production") throw new Error("The demo scenario never runs in production.");

const fail = (msg) => {
  console.error(`demo: ${msg}`);
  process.exit(1);
};

async function findDemoUser() {
  const r = await rawPrivileged("GET", "/auth/v1/admin/users?page=1&per_page=200");
  if (!r.ok) fail(`could not list accounts (status ${r.status}).`);
  const user = (r.body?.users ?? []).find((u) => u.email === DEMO_EMAIL);
  if (!user) return null;
  if (user.user_metadata?.synthetic_demo_user !== true) {
    fail("an account with the demo email exists but is NOT marked as a synthetic demo account. Refusing to touch it.");
  }
  return user;
}

async function destroy(user) {
  // The company must be archived before its last owner can be deleted (database rule).
  const m = await rawPrivileged("GET", `/rest/v1/memberships?user_id=eq.${user.id}&select=organization_id`);
  if (!m.ok) fail(`could not read the demo memberships (status ${m.status}).`);
  for (const row of m.body ?? []) {
    const org = await rawPrivileged("GET", `/rest/v1/organizations?id=eq.${row.organization_id}&select=name`);
    if (!org.ok || !String(org.body?.[0]?.name ?? "").startsWith("DEMO")) {
      fail("the demo account belongs to a company that is not named like a demo company. Refusing to continue.");
    }
    await archiveOrganization(row.organization_id);
  }
  const d = await deleteUser(user.id);
  if (!d.ok) fail(`could not delete the demo account (status ${d.status}). Nothing else was changed.`);
  if (existsSync(CREDENTIALS_FILE)) rmSync(CREDENTIALS_FILE);
}

async function create() {
  const password = `${randomUUID()}${randomBytes(8).toString("hex")}`;
  const made = await rawPrivileged("POST", "/auth/v1/admin/users", {
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { synthetic_demo_user: true },
  });
  if (!made.ok) fail(`could not create the demo account (status ${made.status}).`);
  writeFileSync(CREDENTIALS_FILE, `DEMO_EMAIL=${DEMO_EMAIL}\nDEMO_PASSWORD=${password}\n`, { mode: 0o600 });

  const api = client();
  const { token } = await api.signIn(DEMO_EMAIL, password);
  const asUser = async (method, path, body) => {
    const r = await api.rest(token, method, path, { body });
    if (!r.ok) fail(`${method} ${path.split("?")[0]} failed (status ${r.status}, code ${r.body?.code ?? "none"}).`);
    return Array.isArray(r.body) ? r.body : r.body;
  };

  // PostgREST bulk inserts need identical keys in every row, so rows are posted one at a time.
  const each = async (path, rows) => {
    const out = [];
    for (const row of rows) out.push(...[].concat(await asUser("POST", path, row)));
    return out;
  };

  const org = await api.rpc(token, "create_organization", { p_name: ORG_NAME, p_legal_name: "DEMO Sample Polymers Private Limited" });
  if (!org.ok) fail(`could not create the demo company (status ${org.status}).`);
  const orgId = org.body;

  const procs = Object.fromEntries((await asUser("GET", "ref_processes?select=id,code")).map((p) => [p.code, p.id]));
  const mats = Object.fromEntries((await asUser("GET", "ref_materials?select=id,code")).map((m) => [m.code, m.id]));

  const [factory] = await asUser("POST", "factories", {
    organization_id: orgId,
    name: "DEMO Plant 1 (sample)",
    address_line1: "Plot 00, Sample Industrial Estate",
    city: "Vapi",
    state: "Gujarat",
    postal_code: "396195",
  });
  const F = factory.id;
  const base = { organization_id: orgId, factory_id: F };

  await each("factory_processes", [
    { ...base, process_id: procs.injection_moulding, capacity_quantity: 180, capacity_unit: "tonnes", capacity_period: "month" },
    { ...base, process_id: procs.extrusion, capacity_quantity: 90, capacity_unit: "tonnes", capacity_period: "month" },
    { ...base, scope: "factory_wide", capacity_quantity: 300, capacity_unit: "tonnes", capacity_period: "month" },
  ]);
  await each("machines", [
    { ...base, name: "Injection press 90T", process_id: procs.injection_moulding, quantity: 2, rating_value: 90, rating_unit: "tonnes_clamp_force", year_installed: 2016 },
    { ...base, name: "Injection press 150T", process_id: procs.injection_moulding, quantity: 3, rating_value: 150, rating_unit: "tonnes_clamp_force", year_installed: 2019 },
    { ...base, name: "Injection press 250T", process_id: procs.injection_moulding, quantity: 1, rating_value: 250, rating_unit: "tonnes_clamp_force", year_installed: 2021 },
    { ...base, name: "Single-screw extruder 65mm", process_id: procs.extrusion, quantity: 2, rating_value: 65, rating_unit: "mm_screw_diameter", year_installed: 2018 },
    { ...base, name: "Profile extrusion line", process_id: procs.extrusion, quantity: 1, rating_value: 120, rating_unit: "kg_per_hour" },
  ]);
  await each("factory_materials", [
    { ...base, material_id: mats.PP },
    { ...base, material_id: mats.HDPE },
    { ...base, custom_name: "Recycled PP regrind" },
  ]);

  const products = await each("products", [
    {
      organization_id: orgId,
      name: "Plastic containers",
      category: "Food and household containers",
      intended_use: "Storing and carrying food and household items",
      description: "Sample product: lidded containers in several sizes, injection moulded in polypropylene.",
      unit_weight_g: 95,
    },
    {
      organization_id: orgId,
      name: "Plastic storage products",
      category: "Household storage",
      intended_use: "Home and office storage",
      description: "Sample product: stackable storage boxes and organisers in polypropylene and HDPE.",
      unit_weight_g: 420,
    },
  ]);
  const [containers, storage] = ["Plastic containers", "Plastic storage products"].map((n) => products.find((p) => p.name === n).id);
  await each("product_specifications", [
    { organization_id: orgId, product_id: containers, name: "Material", value_text: "Polypropylene (PP)" },
    { organization_id: orgId, product_id: containers, name: "Capacity", value_number: 750, unit: "ml" },
    { organization_id: orgId, product_id: containers, name: "Colour", value_text: "Natural and white" },
    { organization_id: orgId, product_id: storage, name: "Material", value_text: "PP and HDPE" },
    { organization_id: orgId, product_id: storage, name: "Capacity", value_number: 30, unit: "litres" },
  ]);
  await each("factory_products", [
    { organization_id: orgId, factory_id: F, product_id: containers },
    { organization_id: orgId, factory_id: F, product_id: storage },
  ]);
}

const command = process.argv[2];
if (!["create", "reset", "destroy", "status"].includes(command)) fail("use one of: create, reset, destroy, status.");

const existing = await findDemoUser();
if (command === "status") {
  console.log(existing ? "demo: the demo scenario exists. Sign-in details are in .env.demo.local." : "demo: the demo scenario does not exist. Run: npm run demo:create");
} else if (command === "create") {
  if (existing) fail("the demo scenario already exists. Run: npm run demo:reset");
  await create();
  console.log(`demo: created. Sign in as ${DEMO_EMAIL}. The password is in .env.demo.local (not printed).`);
} else {
  if (existing) await destroy(existing);
  if (command === "reset") {
    await create();
    console.log(`demo: reset. Sign in as ${DEMO_EMAIL}. The password is in .env.demo.local (not printed).`);
  } else {
    console.log("demo: removed (the demo company is archived, not deleted).");
  }
}
