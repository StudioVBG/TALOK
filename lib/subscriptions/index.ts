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
export async function getUserUsage(_userId: string) { return null; }
export async function updateUserUsage(_userId: string, _resource: string, _count: number) { return; }
export async function incrementSignatureUsage(_userId: string) { return; }
export async function usePromoCode(_code: string, _userId: string) { return null; }
export async function upsertSubscription(_data: Record<string, unknown>) { return null; }

