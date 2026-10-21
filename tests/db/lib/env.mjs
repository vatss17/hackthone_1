// Environment loading and safety guards for the database test harness.
//
// Run with:  npm run test:db   (needs .env.local, see .env.example)
//
// Guards, all fail-closed:
//   * DB_TESTS_ENABLED must be exactly "1".
//   * SUPABASE_URL must be the designated DEVELOPMENT project (hard-coded below).
//   * No value from the environment is ever printed.

export const DEV_PROJECT_REF = "bylxvgtxxaghmceutrjq";

export const enabled = process.env.DB_TESTS_ENABLED === "1";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export function loadConfig({ privileged = false } = {}) {
  const url = required("SUPABASE_URL").replace(/\/+$/, "");
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("SUPABASE_URL is not a valid URL.");
  }
  if (host !== `${DEV_PROJECT_REF}.supabase.co`) {
    throw new Error(
      `Refusing to run: SUPABASE_URL host is not the designated development project (${DEV_PROJECT_REF}).`,
    );
  }
  const config = { url, publishableKey: required("SUPABASE_PUBLISHABLE_KEY") };
  // The privileged key is only read when explicitly requested. Only
  // tests/db/lib/admin.mjs does so; everything else never holds it in memory.
  if (privileged) config.secretKey = required("SUPABASE_SECRET_KEY");
  return config;
}
