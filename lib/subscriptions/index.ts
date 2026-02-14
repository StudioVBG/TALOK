/**
 * Module Subscriptions - Point d'entrée
 * Exporte tous les types, plans et services
 */

// Plans et configuration
export * from './plans';

// Types
export * from './types';

// Services
export {
  getUserSubscription,
  getUsageSummary,
  userHasFeature,
  userWithinLimit,
  getRemainingUsage,
  changePlan,
  cancelSubscription,
  reactivateSubscription,
  validatePromoCode,
  logSubscriptionEvent,
  getSubscriptionEvents,
  getUserInvoices,
  getSubscriptionStats,
  getPlansDistribution,
  getAdminSubscriptionsList,
  adminOverridePlan,
  adminGiftDays,
  adminSuspendAccount,
  adminUnsuspendAccount,
} from './subscription-service';

// Stubs for planned but not yet implemented functions
// WARNING: These are no-ops. Callers should check for null returns.
export async function getUserUsage(_userId: string) {
  console.warn("[subscriptions] getUserUsage is not yet implemented — returning null");
  return null;
}
export async function updateUserUsage(_userId: string, _resource: string, _count: number) {
  console.warn("[subscriptions] updateUserUsage is not yet implemented — no-op");
  return;
}
export async function incrementSignatureUsage(_userId: string) {
  console.warn("[subscriptions] incrementSignatureUsage is not yet implemented — no-op");
  return;
}
export async function usePromoCode(_code: string, _userId: string) {
  console.warn("[subscriptions] usePromoCode is not yet implemented — returning null");
  return null;
}
export async function upsertSubscription(_data: Record<string, unknown>) {
  console.warn("[subscriptions] upsertSubscription is not yet implemented — returning null");
  return null;
}

