/**
 * Feature gates for accounting module
 *
 * Maps accounting sub-features to FeatureKey from plans.ts.
 * All accounting features require at minimum 'bank_reconciliation' (Confort+).
 *
 * Usage in API routes:
 *   import { requireAccountingAccess } from '@/lib/accounting/feature-gates';
 *   const check = await requireAccountingAccess(profile.id, 'entries');
 *   if (check) return check; // Returns 403 Response if not allowed
 */

import { withFeatureAccess, createSubscriptionErrorResponse } from '@/lib/middleware/subscription-check';
import type { FeatureKey } from '@/lib/subscriptions/plans';

/**
 * Accounting sub-feature to FeatureKey mapping.
 * All routes require at least 'bank_reconciliation' (Confort+).
 * Some advanced features require higher-tier features.
 */
const ACCOUNTING_FEATURE_MAP: Record<string, FeatureKey> = {
  // Core accounting (Confort+)
  entries: 'bank_reconciliation',
  balance: 'bank_reconciliation',
  gl: 'bank_reconciliation',
  fec: 'bank_reconciliation',
  exports: 'bank_reconciliation',
  deposits: 'bank_reconciliation',
  charges: 'bank_reconciliation',
  crg: 'bank_reconciliation',
  fiscal: 'bank_reconciliation',
  situation: 'bank_reconciliation',
  // Bank reconciliation (Confort+)
  reconciliation: 'bank_reconciliation',
  // Open banking auto-sync (Pro+)
  open_banking: 'open_banking',
  // Scoring / AI (Pro+)
  scoring: 'scoring_tenant',
  // TALO accounting agent (Pro+) — same gate as scoring for now
  agent: 'scoring_tenant',
} as const;

/**
 * Check if the current user's plan allows access to an accounting feature.
 * Returns a 403 Response if not allowed, or null if access is granted.
 *
 * @param ownerId - The profile ID (NOT user_id) of the owner
 * @param subFeature - The accounting sub-feature key (e.g. 'entries', 'fec')
 * @returns null if allowed, Response (403) if blocked
 */
export async function requireAccountingAccess(
  ownerId: string,
  subFeature: keyof typeof ACCOUNTING_FEATURE_MAP,
): Promise<Response | null> {
  const featureKey = ACCOUNTING_FEATURE_MAP[subFeature];
  if (!featureKey) {
    // Unknown feature — default to bank_reconciliation
    const check = await withFeatureAccess(ownerId, 'bank_reconciliation');
    if (!check.allowed) {
      return createSubscriptionErrorResponse(check);
    }
    return null;
  }

  const check = await withFeatureAccess(ownerId, featureKey);
  if (!check.allowed) {
    return createSubscriptionErrorResponse(check);
  }
  return null;
}
