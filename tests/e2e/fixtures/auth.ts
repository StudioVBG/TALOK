/**
 * Auth fixtures: per-role authenticated pages, ready to use in specs.
 *
 * Usage:
 *   import { test, expect } from "@/tests/e2e/fixtures/auth";
 *
 *   test("owner can see balance", async ({ ownerPage }) => {
 *     await ownerPage.goto(routes.owner.accounting.balance);
 *     ...
 *   });
 *
 * Each fixture returns a fresh `Page` whose browser context was preloaded
 * with the storage state produced by `tests/e2e/global-setup.ts`. This skips
 * the login form for every test (huge speedup, less flake) while still
 * giving each test an isolated context.
 *
 * Tests that exercise the login flow itself MUST NOT use these fixtures —
 * use the raw `test` from `@playwright/test` plus `login()` from
 * `helpers/login.ts`.
 */

import {
  test as base,
  request as playwrightRequest,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";
import path from "node:path";
import type { TestRole } from "../helpers/credentials";

export const STORAGE_STATE_DIR = path.resolve(
  process.cwd(),
  "tests/e2e/.auth",
);

export function storageStatePath(role: TestRole): string {
  return path.join(STORAGE_STATE_DIR, `${role}.json`);
}

interface AuthFixtures {
  ownerPage: Page;
  tenantPage: Page;
  adminPage: Page;
  /** Authenticated APIRequestContext for owner role (cookies preloaded). */
  ownerRequest: APIRequestContext;
}

async function pageForRole(
  browser: Browser,
  role: TestRole,
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    storageState: storageStatePath(role),
  });
  const page = await context.newPage();
  try {
    await use(page);
  } finally {
    await context.close();
  }
}

async function requestForRole(
  baseURL: string | undefined,
  role: TestRole,
  use: (request: APIRequestContext) => Promise<void>,
): Promise<void> {
  const ctx = await playwrightRequest.newContext({
    baseURL,
    storageState: storageStatePath(role),
  });
  try {
    await use(ctx);
  } finally {
    await ctx.dispose();
  }
}

export const test = base.extend<AuthFixtures>({
  ownerPage: async ({ browser }, use) => {
    await pageForRole(browser, "owner", use);
  },
  tenantPage: async ({ browser }, use) => {
    await pageForRole(browser, "tenant", use);
  },
  adminPage: async ({ browser }, use) => {
    await pageForRole(browser, "admin", use);
  },
  ownerRequest: async ({ baseURL }, use) => {
    await requestForRole(baseURL, "owner", use);
  },
});

export { expect } from "@playwright/test";
