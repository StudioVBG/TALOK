/**
 * Centralized E2E test credentials.
 *
 * Single source of truth: all specs and fixtures must read creds from here.
 * Never hardcode emails or passwords in spec files.
 *
 * Resolution order for each role:
 *   1. Role-specific env var (E2E_<ROLE>_EMAIL / E2E_<ROLE>_PASSWORD)
 *   2. Throw at fixture/spec load time if missing — we refuse to fall back
 *      to a hardcoded default to avoid leaking real creds in CI logs and
 *      to keep prod accounts out of test runs.
 *
 * To run E2E locally, define in `.env.local` (or `.env.test`):
 *   E2E_OWNER_EMAIL=...
 *   E2E_OWNER_PASSWORD=...
 *   E2E_TENANT_EMAIL=...
 *   E2E_TENANT_PASSWORD=...
 *   E2E_ADMIN_EMAIL=...
 *   E2E_ADMIN_PASSWORD=...
 */

export type TestRole = "owner" | "tenant" | "admin";

export interface TestCredentials {
  email: string;
  password: string;
}

function readEnv(role: TestRole): TestCredentials {
  const upper = role.toUpperCase();
  const email = process.env[`E2E_${upper}_EMAIL`];
  const password = process.env[`E2E_${upper}_PASSWORD`];

  if (!email || !password) {
    throw new Error(
      `Missing E2E credentials for role "${role}". ` +
        `Set E2E_${upper}_EMAIL and E2E_${upper}_PASSWORD in your test environment.`,
    );
  }

  return { email, password };
}

export function getCredentials(role: TestRole): TestCredentials {
  return readEnv(role);
}
