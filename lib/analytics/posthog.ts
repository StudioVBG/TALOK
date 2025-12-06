/**
 * PostHog Analytics Integration
 * 
 * Configuration et helpers pour le tracking produit avec PostHog.
 * PostHog est recommandé car :
 * - Open source (self-hostable)
 * - RGPD compliant (hébergement EU disponible)
 * - Feature flags intégrés
 * - Session replay
 * - A/B testing
 * 
 * @see https://posthog.com/docs
 */

// Types pour les événements
export interface AnalyticsUser {
  id: string;
  email?: string;
  role?: 'owner' | 'tenant' | 'provider' | 'admin';
  plan?: string;
  properties_count?: number;
  created_at?: string;
}

export interface TrackingEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

// Configuration PostHog
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com';

// État global
let posthogInstance: any = null;
let isInitialized = false;

/**
 * Initialiser PostHog côté client
 */
export async function initPostHog(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isInitialized) return;
  if (!POSTHOG_KEY) {
    console.warn('[PostHog] NEXT_PUBLIC_POSTHOG_KEY non configuré');
    return;
  }

  try {
    const posthog = (await import('posthog-js')).default;
    
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      
      // Conformité RGPD
      persistence: 'localStorage+cookie',
      respect_dnt: true,
      
      // Session replay (désactivé par défaut - activer si consentement)
      disable_session_recording: true,
      
      // Autocapture
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      
      // Performance
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PostHog] Initialisé');
        }
      },
    });
    
    posthogInstance = posthog;
    isInitialized = true;
  } catch (error) {
    console.error('[PostHog] Erreur initialisation:', error);
  }
}

/**
 * Identifier un utilisateur
 */
export function identify(user: AnalyticsUser): void {
  if (!posthogInstance) return;
  
  posthogInstance.identify(user.id, {
    email: user.email,
    role: user.role,
    plan: user.plan,
    properties_count: user.properties_count,
    created_at: user.created_at,
  });
}

/**
 * Réinitialiser l'identité (logout)
 */
export function reset(): void {
  if (!posthogInstance) return;
  posthogInstance.reset();
}

/**
 * Tracker un événement
 */
export function track(event: string, properties?: Record<string, any>): void {
  if (!posthogInstance) {
    // Fallback: log en console en dev
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, properties);
    }
    return;
  }
  
  posthogInstance.capture(event, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Tracker une page vue
 */
export function trackPageView(url: string, properties?: Record<string, any>): void {
  if (!posthogInstance) return;
  
  posthogInstance.capture('$pageview', {
    $current_url: url,
    ...properties,
  });
}

/**
 * Activer/désactiver le session recording (après consentement)
 */
export function setSessionRecording(enabled: boolean): void {
  if (!posthogInstance) return;
  
  if (enabled) {
    posthogInstance.startSessionRecording();
  } else {
    posthogInstance.stopSessionRecording();
  }
}

/**
 * Vérifier si une feature flag est active
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!posthogInstance) return false;
  return posthogInstance.isFeatureEnabled(flagKey);
}

/**
 * Récupérer la valeur d'une feature flag
 */
export function getFeatureFlag(flagKey: string): string | boolean | undefined {
  if (!posthogInstance) return undefined;
  return posthogInstance.getFeatureFlag(flagKey);
}

// ============================================
// ÉVÉNEMENTS PRÉ-DÉFINIS
// ============================================

/**
 * Événements d'acquisition/onboarding
 */
export const AcquisitionEvents = {
  // Signup flow
  signupStarted: () => track('Signup.Started'),
  signupCompleted: (method: 'email' | 'google' | 'magic_link') => 
    track('Signup.Completed', { method }),
  emailVerified: () => track('Email.Verified'),
  
  // Onboarding
  onboardingStarted: (role: string) => track('Onboarding.Started', { role }),
  onboardingStepCompleted: (step: number, stepName: string) => 
    track('Onboarding.StepCompleted', { step, step_name: stepName }),
  onboardingCompleted: (role: string, duration_seconds: number) => 
    track('Onboarding.Completed', { role, duration_seconds }),
  onboardingAbandoned: (step: number, stepName: string) => 
    track('Onboarding.Abandoned', { step, step_name: stepName }),
};

/**
 * Événements propriétaire
 */
export const OwnerEvents = {
  // Propriétés
  propertyCreated: (type: string) => track('Property.Created', { type }),
  propertyPublished: (propertyId: string) => 
    track('Property.Published', { property_id: propertyId }),
  
  // Baux
  leaseCreated: (type: string) => track('Lease.Created', { lease_type: type }),
  leaseSigned: (leaseId: string) => track('Lease.Signed', { lease_id: leaseId }),
  leaseTerminated: (reason: string) => track('Lease.Terminated', { reason }),
  
  // Locataires
  tenantInvited: () => track('Tenant.Invited'),
  tenantAccepted: () => track('Tenant.Accepted'),
  
  // Facturation
  invoiceGenerated: (amount: number) => 
    track('Invoice.Generated', { amount }),
  paymentReceived: (amount: number, method: string) => 
    track('Payment.Received', { amount, method }),
  
  // Documents
  documentGenerated: (type: string) => 
    track('Document.Generated', { document_type: type }),
  documentDownloaded: (type: string) => 
    track('Document.Downloaded', { document_type: type }),
};

/**
 * Événements locataire
 */
export const TenantEvents = {
  applicationStarted: () => track('Application.Started'),
  applicationCompleted: () => track('Application.Completed'),
  paymentMade: (amount: number, method: string) => 
    track('Payment.Made', { amount, method }),
  ticketCreated: (priority: string) => 
    track('Ticket.Created', { priority }),
  documentUploaded: (type: string) => 
    track('Document.Uploaded', { document_type: type }),
};

/**
 * Événements conversion/monétisation
 */
export const ConversionEvents = {
  planViewed: (planSlug: string) => 
    track('Plan.Viewed', { plan: planSlug }),
  planSelected: (planSlug: string, billing: 'monthly' | 'yearly') => 
    track('Plan.Selected', { plan: planSlug, billing }),
  checkoutStarted: (planSlug: string, amount: number) => 
    track('Checkout.Started', { plan: planSlug, amount }),
  checkoutCompleted: (planSlug: string, amount: number) => 
    track('Checkout.Completed', { plan: planSlug, amount }),
  checkoutAbandoned: (planSlug: string, step: string) => 
    track('Checkout.Abandoned', { plan: planSlug, step }),
  subscriptionActivated: (planSlug: string) => 
    track('Subscription.Activated', { plan: planSlug }),
  subscriptionCancelled: (planSlug: string, reason?: string) => 
    track('Subscription.Cancelled', { plan: planSlug, reason }),
  subscriptionUpgraded: (fromPlan: string, toPlan: string) => 
    track('Subscription.Upgraded', { from_plan: fromPlan, to_plan: toPlan }),
};

/**
 * Événements engagement
 */
export const EngagementEvents = {
  featureUsed: (featureName: string) => 
    track('Feature.Used', { feature: featureName }),
  searchPerformed: (query: string, resultsCount: number) => 
    track('Search.Performed', { query_length: query.length, results_count: resultsCount }),
  filterApplied: (filterType: string, value: string) => 
    track('Filter.Applied', { filter_type: filterType, value }),
  exportDownloaded: (format: string, dataType: string) => 
    track('Export.Downloaded', { format, data_type: dataType }),
  helpArticleViewed: (articleId: string) => 
    track('Help.ArticleViewed', { article_id: articleId }),
  supportContacted: (method: string) => 
    track('Support.Contacted', { method }),
};

// Export par défaut
export default {
  init: initPostHog,
  identify,
  reset,
  track,
  trackPageView,
  setSessionRecording,
  isFeatureEnabled,
  getFeatureFlag,
  events: {
    acquisition: AcquisitionEvents,
    owner: OwnerEvents,
    tenant: TenantEvents,
    conversion: ConversionEvents,
    engagement: EngagementEvents,
  },
};

