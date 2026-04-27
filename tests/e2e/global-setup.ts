/**
 * Playwright global setup: pre-authenticates each role once and saves the
 * resulting browser storage to `tests/e2e/.auth/<role>.json`. Specs that use
 * the auth fixtures load these files instead of replaying the login form.
 *
 * Roles for which env credentials are missing are skipped (the corresponding
 * fixture will then fail loudly on first use, which is the desired behavior:
 * we don't want silent fallbacks to hardcoded prod accounts).
 */

import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import { login } from "./helpers/login";
import { storageStatePath, STORAGE_STATE_DIR } from "./fixtures/auth";
import type { TestRole } from "./helpers/credentials";

const ROLES: TestRole[] = ["owner", "tenant", "admin"];

function hasCredentials(role: TestRole): boolean {
  const upper = role.toUpperCase();
  return Boolean(
    process.env[`E2E_${upper}_EMAIL`] && process.env[`E2E_${upper}_PASSWORD`],
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });

  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    "http://127.0.0.1:3000";

  const browser = await chromium.launch();
  try {
    for (const role of ROLES) {
      if (!hasCredentials(role)) {
        console.warn(
          `[global-setup] Skipping "${role}" — no E2E_${role.toUpperCase()}_EMAIL/PASSWORD set.`,
        );
        continue;
      }

      const context = await browser.newContext({ baseURL });
      const page = await context.newPage();
      try {
        await login(page, role);
        await context.storageState({ path: storageStatePath(role) });
        console.log(`[global-setup] Stored auth state for "${role}".`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
