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
  getUserUsage,
  getUsageSummary,
  updateUserUsage,
  incrementSignatureUsage,
  userHasFeature,
  userWithinLimit,
  getRemainingUsage,
  upsertSubscription,
  changePlan,
  cancelSubscription,
  reactivateSubscription,
  validatePromoCode,
  usePromoCode,
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

