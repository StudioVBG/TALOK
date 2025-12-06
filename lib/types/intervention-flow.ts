// =====================================================
// Types pour le Flux d'Intervention Complet SOTA 2025
// Cycle: Visite → Devis → Acompte → Travaux → Solde
// =====================================================

/**
 * Statuts possibles d'une intervention
 */
export type WorkOrderStatus =
  // Flux initial
  | 'assigned'           // Assigné, en attente acceptation prestataire
  | 'accepted'           // Accepté, en attente prise de RDV visite
  | 'refused'            // Refusé par le prestataire
  
  // Phase visite
  | 'visit_scheduled'    // RDV visite planifié
  | 'visit_completed'    // Visite effectuée, en attente devis
  
  // Phase devis
  | 'quote_sent'         // Devis envoyé
  | 'quote_accepted'     // Devis accepté, en attente acompte
  | 'quote_refused'      // Devis refusé
  
  // Phase paiement acompte
  | 'deposit_pending'    // Acompte en attente de paiement
  | 'deposit_paid'       // Acompte payé (2/3), fonds en escrow
  
  // Phase travaux
  | 'work_scheduled'     // Travaux planifiés
  | 'in_progress'        // Travaux en cours
  | 'work_completed'     // Travaux terminés
  
  // Phase solde
  | 'balance_pending'    // Solde en attente de paiement
  | 'fully_paid'         // Entièrement payé
  
  // Clôture
  | 'pending_review'     // En attente d'avis
  | 'closed'             // Clôturé
  
  // Cas particuliers
  | 'cancelled'          // Annulé
  | 'disputed';          // Litige en cours

/**
 * Type de paiement
 */
export type PaymentType = 'deposit' | 'balance' | 'full' | 'refund';

/**
 * Statut d'escrow
 */
export type EscrowStatus = 'none' | 'pending' | 'held' | 'released' | 'refunded' | 'disputed';

/**
 * Statut de paiement
 */
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'disputed';

/**
 * Méthode de paiement
 */
export type PaymentMethod = 'card' | 'sepa_debit' | 'bank_transfer' | 'direct';

/**
 * Configuration des frais de paiement
 */
export interface PaymentFeeConfig {
  id: string;
  config_key: string;
  stripe_percent: number;    // 0.014 = 1.4%
  stripe_fixed: number;      // 0.25€
  platform_percent: number;  // 0.01 = 1%
  platform_fixed: number;    // 0.50€
  fee_payer: 'provider' | 'owner' | 'split';
  deposit_percent: number;   // 66.67
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
}

/**
 * Calcul des frais pour un paiement
 */
export interface PaymentFees {
  gross_amount: number;      // Montant payé par le propriétaire
  stripe_fee: number;        // Frais Stripe
  platform_fee: number;      // Marge plateforme
  total_fees: number;        // Total des frais
  net_amount: number;        // Net pour le prestataire
  effective_rate: number;    // Taux effectif en %
}

/**
 * Calcul acompte + solde
 */
export interface DepositBalanceCalculation {
  total_amount: number;
  deposit_percent: number;
  deposit_amount: number;
  deposit_fees: number;
  deposit_net: number;
  balance_percent: number;
  balance_amount: number;
  balance_fees: number;
  balance_net: number;
  total_fees: number;
  total_net: number;
}

/**
 * Paiement d'intervention
 */
export interface WorkOrderPayment {
  id: string;
  work_order_id: string;
  quote_id: string | null;
  payer_profile_id: string;
  payee_profile_id: string;
  payment_type: PaymentType;
  gross_amount: number;
  percentage_of_total: number | null;
  stripe_fee: number;
  platform_fee: number;
  total_fees: number;
  net_amount: number;
  payment_method: PaymentMethod | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  escrow_status: EscrowStatus;
  escrow_held_at: string | null;
  escrow_released_at: string | null;
  escrow_release_reason: string | null;
  status: PaymentStatus;
  initiated_at: string;
  paid_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  failure_code: string | null;
  fee_invoice_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Types d'événements du timeline
 */
export type TimelineEventType =
  // Création et assignation
  | 'created' | 'assigned' | 'accepted' | 'refused'
  // Visite
  | 'visit_proposed' | 'visit_scheduled' | 'visit_rescheduled' | 'visit_completed' | 'visit_cancelled'
  // Devis
  | 'quote_created' | 'quote_sent' | 'quote_viewed' | 'quote_accepted' | 'quote_refused' | 'quote_expired'
  // Paiements
  | 'deposit_requested' | 'deposit_paid' | 'deposit_failed'
  | 'balance_requested' | 'balance_paid' | 'balance_failed'
  | 'payment_refunded'
  // Travaux
  | 'work_scheduled' | 'work_started' | 'work_paused' | 'work_resumed' | 'work_completed'
  // Clôture
  | 'review_requested' | 'review_submitted' | 'review_responded' | 'closed'
  // Incidents
  | 'cancelled' | 'dispute_opened' | 'dispute_resolved'
  // Communication
  | 'message_sent' | 'photo_added' | 'document_added'
  // Système
  | 'reminder_sent' | 'status_changed' | 'auto_action';

/**
 * Événement du timeline
 */
export interface WorkOrderTimelineEvent {
  id: string;
  work_order_id: string;
  event_type: TimelineEventType;
  actor_profile_id: string | null;
  actor_role: 'owner' | 'provider' | 'tenant' | 'admin' | 'system';
  old_status: WorkOrderStatus | null;
  new_status: WorkOrderStatus | null;
  event_data: Record<string, unknown>;
  description: string | null;
  is_internal: boolean;
  created_at: string;
}

/**
 * Work Order étendu avec informations de paiement
 */
export interface WorkOrderWithPayments {
  id: string;
  ticket_id: string;
  provider_id: string;
  statut: WorkOrderStatus;
  
  // Dates clés
  created_at: string;
  accepted_at: string | null;
  refused_at: string | null;
  refusal_reason: string | null;
  visit_scheduled_at: string | null;
  visit_completed_at: string | null;
  visit_notes: string | null;
  work_started_at: string | null;
  work_completed_at: string | null;
  completion_report: string | null;
  closed_at: string | null;
  
  // Coûts
  cout_estime: number | null;
  cout_final: number | null;
  
  // Devis accepté
  accepted_quote_id: string | null;
  accepted_quote?: {
    id: string;
    total_amount: number;
    deposit_percent: number;
    deposit_amount: number;
    balance_amount: number;
  };
  
  // Paiements
  deposit_payment?: WorkOrderPayment | null;
  balance_payment?: WorkOrderPayment | null;
  
  // Photos
  visit_photos: string[];
  before_photos: string[];
  after_photos: string[];
  
  // Timeline
  timeline?: WorkOrderTimelineEvent[];
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Configuration par défaut des frais
 */
export const DEFAULT_FEE_CONFIG: Omit<PaymentFeeConfig, 'id' | 'effective_from' | 'effective_until'> = {
  config_key: 'default',
  stripe_percent: 0.014,    // 1.4% (Stripe)
  stripe_fixed: 0.25,       // 0.25€ (Stripe)
  platform_percent: 0.02,   // 2.0% (Commission plateforme)
  platform_fixed: 0.75,     // 0.75€ (Commission plateforme)
  fee_payer: 'provider',
  deposit_percent: 66.67,   // 2/3
  is_active: true,
};

/**
 * Calcule les frais de paiement côté client
 */
export function calculatePaymentFees(
  amount: number,
  config: Partial<PaymentFeeConfig> = DEFAULT_FEE_CONFIG
): PaymentFees {
  const stripePercent = config.stripe_percent ?? 0.014;
  const stripeFixed = config.stripe_fixed ?? 0.25;
  const platformPercent = config.platform_percent ?? 0.01;
  const platformFixed = config.platform_fixed ?? 0.50;

  const stripeFee = Math.round((amount * stripePercent + stripeFixed) * 100) / 100;
  const platformFee = Math.round((amount * platformPercent + platformFixed) * 100) / 100;
  const totalFees = Math.round((stripeFee + platformFee) * 100) / 100;
  const netAmount = Math.round((amount - totalFees) * 100) / 100;
  const effectiveRate = Math.round((totalFees / amount) * 10000) / 100;

  return {
    gross_amount: amount,
    stripe_fee: stripeFee,
    platform_fee: platformFee,
    total_fees: totalFees,
    net_amount: netAmount,
    effective_rate: effectiveRate,
  };
}

/**
 * Calcule l'acompte et le solde avec frais
 */
export function calculateDepositAndBalance(
  totalAmount: number,
  config: Partial<PaymentFeeConfig> = DEFAULT_FEE_CONFIG
): DepositBalanceCalculation {
  const depositPercent = config.deposit_percent ?? 66.67;
  const depositAmount = Math.round((totalAmount * depositPercent / 100) * 100) / 100;
  const balanceAmount = Math.round((totalAmount - depositAmount) * 100) / 100;

  const depositFees = calculatePaymentFees(depositAmount, config);
  const balanceFees = calculatePaymentFees(balanceAmount, config);

  return {
    total_amount: totalAmount,
    deposit_percent: depositPercent,
    deposit_amount: depositAmount,
    deposit_fees: depositFees.total_fees,
    deposit_net: depositFees.net_amount,
    balance_percent: Math.round((100 - depositPercent) * 100) / 100,
    balance_amount: balanceAmount,
    balance_fees: balanceFees.total_fees,
    balance_net: balanceFees.net_amount,
    total_fees: Math.round((depositFees.total_fees + balanceFees.total_fees) * 100) / 100,
    total_net: Math.round((depositFees.net_amount + balanceFees.net_amount) * 100) / 100,
  };
}

/**
 * Formate un montant en euros
 */
export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Labels des statuts
 */
export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  assigned: 'Assigné',
  accepted: 'Accepté',
  refused: 'Refusé',
  visit_scheduled: 'Visite planifiée',
  visit_completed: 'Visite effectuée',
  quote_sent: 'Devis envoyé',
  quote_accepted: 'Devis accepté',
  quote_refused: 'Devis refusé',
  deposit_pending: 'Acompte en attente',
  deposit_paid: 'Acompte payé',
  work_scheduled: 'Travaux planifiés',
  in_progress: 'En cours',
  work_completed: 'Travaux terminés',
  balance_pending: 'Solde en attente',
  fully_paid: 'Payé intégralement',
  pending_review: 'En attente d\'avis',
  closed: 'Clôturé',
  cancelled: 'Annulé',
  disputed: 'Litige',
};

/**
 * Couleurs des statuts (Tailwind)
 */
export const STATUS_COLORS: Record<WorkOrderStatus, { bg: string; text: string }> = {
  assigned: { bg: 'bg-amber-100', text: 'text-amber-700' },
  accepted: { bg: 'bg-blue-100', text: 'text-blue-700' },
  refused: { bg: 'bg-red-100', text: 'text-red-700' },
  visit_scheduled: { bg: 'bg-purple-100', text: 'text-purple-700' },
  visit_completed: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  quote_sent: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  quote_accepted: { bg: 'bg-teal-100', text: 'text-teal-700' },
  quote_refused: { bg: 'bg-red-100', text: 'text-red-700' },
  deposit_pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  deposit_paid: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  work_scheduled: { bg: 'bg-violet-100', text: 'text-violet-700' },
  in_progress: { bg: 'bg-orange-100', text: 'text-orange-700' },
  work_completed: { bg: 'bg-green-100', text: 'text-green-700' },
  balance_pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  fully_paid: { bg: 'bg-green-100', text: 'text-green-700' },
  pending_review: { bg: 'bg-pink-100', text: 'text-pink-700' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600' },
  disputed: { bg: 'bg-red-100', text: 'text-red-700' },
};

/**
 * Labels des types de paiement
 */
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  deposit: 'Acompte (2/3)',
  balance: 'Solde (1/3)',
  full: 'Paiement intégral',
  refund: 'Remboursement',
};

/**
 * Labels des événements timeline
 */
export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  created: 'Ticket créé',
  assigned: 'Prestataire assigné',
  accepted: 'Mission acceptée',
  refused: 'Mission refusée',
  visit_proposed: 'Créneaux proposés',
  visit_scheduled: 'Visite planifiée',
  visit_rescheduled: 'Visite reportée',
  visit_completed: 'Visite effectuée',
  visit_cancelled: 'Visite annulée',
  quote_created: 'Devis créé',
  quote_sent: 'Devis envoyé',
  quote_viewed: 'Devis consulté',
  quote_accepted: 'Devis accepté',
  quote_refused: 'Devis refusé',
  quote_expired: 'Devis expiré',
  deposit_requested: 'Acompte demandé',
  deposit_paid: 'Acompte payé',
  deposit_failed: 'Paiement acompte échoué',
  balance_requested: 'Solde demandé',
  balance_paid: 'Solde payé',
  balance_failed: 'Paiement solde échoué',
  payment_refunded: 'Paiement remboursé',
  work_scheduled: 'Travaux planifiés',
  work_started: 'Travaux commencés',
  work_paused: 'Travaux en pause',
  work_resumed: 'Travaux repris',
  work_completed: 'Travaux terminés',
  review_requested: 'Avis demandé',
  review_submitted: 'Avis laissé',
  review_responded: 'Réponse à l\'avis',
  closed: 'Intervention clôturée',
  cancelled: 'Intervention annulée',
  dispute_opened: 'Litige ouvert',
  dispute_resolved: 'Litige résolu',
  message_sent: 'Message envoyé',
  photo_added: 'Photo ajoutée',
  document_added: 'Document ajouté',
  reminder_sent: 'Rappel envoyé',
  status_changed: 'Statut modifié',
  auto_action: 'Action automatique',
};

