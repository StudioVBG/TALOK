/**
 * SOTA 2026 Payment System
 * State-of-the-art payment infrastructure for TALOK
 *
 * Features:
 * - Revenue Intelligence: Real-time MRR/ARR analytics, cohort analysis, forecasting
 * - Smart Dunning: AI-powered payment recovery with personalized sequences
 * - Usage-Based Billing: Stripe Meters integration for hybrid pricing
 * - Credit System: Flexible credits for signatures and other billable features
 * - Tenant Rewards: Bilt-style loyalty program for rent payments
 * - Embedded Finance: BNPL, deposit splitting, instant payouts, financing
 */

// Types
export * from './types';

// Revenue Intelligence
export {
  calculateRevenueMetrics,
  generateCohortAnalysis,
  generateRevenueForecast,
  generateMRRWaterfall,
  getSubscriptionAnalytics,
  storeMetricsSnapshot,
  type MRRWaterfallData,
} from './revenue-intelligence';

// Smart Dunning
export {
  startDunningProcess,
  processDunningQueue,
  calculateChurnRisk,
  calculateAllChurnRisks,
  getHighRiskAccounts,
  getOptimalRetryTime,
  DEFAULT_DUNNING_SEQUENCE,
  VIP_DUNNING_SEQUENCE,
} from './smart-dunning';

// Usage-Based Billing
export {
  createUsageMeter,
  getUsageMeters,
  recordUsage,
  recordSignatureUsage,
  recordAPIUsage,
  recordStorageUsage,
  getUsageSummary,
  calculateOverageCharges,
  // Credits
  getCreditBalance,
  addCredits,
  spendCredits,
  getCreditHistory,
  getCreditPackages,
  purchaseCreditPackage,
  handleCreditPurchase,
  allocateMonthlyCredits,
  expireOldCredits,
} from './usage-billing';

// Tenant Rewards
export {
  getRewardsAccount,
  awardRentPaymentPoints,
  awardReferralBonus,
  getRewardPartners,
  redeemPoints,
  getRedemptionHistory,
  getTransactionHistory,
  checkCreditReportingEligibility,
  enrollInCreditReporting,
  getLeaderboard,
  getTenantRank,
  getTenantBadges,
  awardBadge,
  checkAndAwardBadges,
  REWARDS_CONFIG,
  BADGES,
} from './tenant-rewards';

// Embedded Finance
export {
  checkRentAdvanceEligibility,
  checkDepositSplitEligibility,
  checkBNPLEligibility,
  createFinancingOffer,
  getFinancingOffers,
  applyForFinancing,
  checkInstantPayoutEligibility,
  requestInstantPayout,
  getPayoutHistory,
  createDepositSplit,
  createRentBNPL,
  calculateTotalCost,
  generateFinancingOffers,
  FINANCING_CONFIG,
} from './embedded-finance';
