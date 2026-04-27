/**
 * Single canonical login flow for E2E tests.
 *
 * - Spec files MUST NOT inline their own login. Use the auth fixtures from
 *   `tests/e2e/fixtures/auth` for authenticated pages, or call `login()`
 *   directly only when the test is exercising the login flow itself.
 *
 * Selectors target the real form in `features/auth/components/sign-in-form.tsx`:
 *   - email field: `#email` (id) / `input[type="email"]`
 *   - password field: `#password` (id) / `input[type="password"]`
 *   - submit: `button[type="submit"]`
 */

import type { Page } from "@playwright/test";
import { routes, routePatterns } from "./routes";
import { getCredentials, type TestRole } from "./credentials";

export interface LoginOptions {
  /** Where the test expects to land after successful login. */
  expectedUrl?: RegExp;
}

const ROLE_LANDING_PATTERN: Record<TestRole, RegExp> = {
  owner: routePatterns.ownerArea,
  tenant: routePatterns.tenantArea,
  admin: routePatterns.adminArea,
};

export async function login(
  page: Page,
  role: TestRole,
  options: LoginOptions = {},
): Promise<void> {
  const { email, password } = getCredentials(role);
  const expected = options.expectedUrl ?? ROLE_LANDING_PATTERN[role];

  await page.goto(routes.auth.signin);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(expected, { timeout: 20_000 });
}
