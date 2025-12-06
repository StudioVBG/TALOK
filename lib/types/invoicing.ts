// =====================================================
// Types pour la Facturation Professionnelle SOTA 2025
// =====================================================

/**
 * Type de document
 */
export type InvoiceDocumentType = 'invoice' | 'quote' | 'credit_note';

/**
 * Statut de facture
 */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'cancelled'
  | 'credited';

/**
 * Type de paiement
 */
export type PaymentType = 'deposit' | 'partial' | 'final' | 'refund';

/**
 * Méthode de paiement
 */
export type PaymentMethod = 'card' | 'transfer' | 'check' | 'cash' | 'platform';

/**
 * Facture prestataire
 */
export interface ProviderInvoice {
  id: string;
  invoice_number: string;
  provider_profile_id: string;
  owner_profile_id: string | null;
  property_id: string | null;
  work_order_id: string | null;
  document_type: InvoiceDocumentType;
  related_invoice_id: string | null;
  title: string;
  description: string | null;
  invoice_date: string;
  due_date: string | null;
  paid_date: string | null;
  payment_terms_days: number;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  late_payment_rate: number;
  fixed_recovery_fee: number;
  late_fees_amount: number;
  early_payment_discount_rate: number | null;
  early_payment_discount_days: number | null;
  status: InvoiceStatus;
  sent_at: string | null;
  sent_to_email: string | null;
  viewed_at: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  custom_legal_mentions: string | null;
  custom_payment_info: string | null;
  internal_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Ligne de facture
 */
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  discount_percent: number;
  sort_order: number;
  created_at: string;
}

/**
 * Paiement sur facture
 */
export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_type: PaymentType;
  payment_method: PaymentMethod | null;
  transaction_id: string | null;
  stripe_payment_intent_id: string | null;
  check_number: string | null;
  paid_at: string;
  notes: string | null;
  receipt_number: string | null;
  receipt_pdf_path: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Formulaire de création de facture
 */
export interface CreateInvoiceData {
  owner_profile_id?: string;
  property_id?: string;
  work_order_id?: string;
  document_type?: InvoiceDocumentType;
  title: string;
  description?: string;
  invoice_date?: string;
  due_date?: string;
  payment_terms_days?: number;
  discount_percent?: number;
  tax_rate?: number;
  late_payment_rate?: number;
  fixed_recovery_fee?: number;
  early_payment_discount_rate?: number;
  early_payment_discount_days?: number;
  custom_legal_mentions?: string;
  custom_payment_info?: string;
  items: CreateInvoiceItemData[];
}

/**
 * Formulaire de création de ligne de facture
 */
export interface CreateInvoiceItemData {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  tax_rate?: number;
  discount_percent?: number;
}

/**
 * Formulaire d'ajout de paiement
 */
export interface CreatePaymentData {
  amount: number;
  payment_type: PaymentType;
  payment_method?: PaymentMethod;
  transaction_id?: string;
  check_number?: string;
  paid_at?: string;
  notes?: string;
}

/**
 * Facture avec relations
 */
export interface InvoiceWithDetails extends ProviderInvoice {
  items: InvoiceItem[];
  payments: InvoicePayment[];
  balance: number;
  provider?: {
    name: string;
    siret: string | null;
    tva_intra: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
  };
  client?: {
    name: string;
    address: string | null;
    city: string | null;
  };
}

/**
 * Données pour génération PDF
 */
export interface InvoicePDFData {
  invoice: {
    number: string;
    date: string;
    due_date: string | null;
    type: InvoiceDocumentType;
    title: string;
    description: string | null;
    subtotal: number;
    discount_percent: number;
    discount_amount: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
    late_payment_rate: number;
    fixed_recovery_fee: number;
    early_payment_discount_rate: number | null;
    custom_legal_mentions: string | null;
    custom_payment_info: string | null;
  };
  provider: {
    name: string;
    siret: string | null;
    tva_intra: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
  };
  client: {
    name: string;
    address: string | null;
    postal_code: string | null;
    city: string | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    tax_rate: number;
    subtotal: number;
    total: number;
  }>;
  payments: Array<{
    amount: number;
    type: PaymentType;
    method: PaymentMethod | null;
    date: string;
  }>;
  balance: number;
  legal_mentions: {
    late_payment_text: string;
    recovery_fee_text: string;
    early_discount_text: string;
  };
}

// =====================================================
// Labels et constantes
// =====================================================

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  viewed: 'Vue',
  partial: 'Partiellement payée',
  paid: 'Payée',
  overdue: 'En retard',
  disputed: 'Contestée',
  cancelled: 'Annulée',
  credited: 'Avoir émis',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { bg: 'bg-blue-100', text: 'text-blue-700' },
  viewed: { bg: 'bg-purple-100', text: 'text-purple-700' },
  partial: { bg: 'bg-amber-100', text: 'text-amber-700' },
  paid: { bg: 'bg-green-100', text: 'text-green-700' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700' },
  disputed: { bg: 'bg-orange-100', text: 'text-orange-700' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
  credited: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
};

export const DOCUMENT_TYPE_LABELS: Record<InvoiceDocumentType, string> = {
  invoice: 'Facture',
  quote: 'Devis',
  credit_note: 'Avoir',
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  deposit: 'Acompte',
  partial: 'Paiement partiel',
  final: 'Solde',
  refund: 'Remboursement',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: 'Carte bancaire',
  transfer: 'Virement',
  check: 'Chèque',
  cash: 'Espèces',
  platform: 'Via la plateforme',
};

export const COMMON_UNITS = [
  { value: 'unité', label: 'Unité' },
  { value: 'heure', label: 'Heure' },
  { value: 'm²', label: 'm²' },
  { value: 'ml', label: 'Mètre linéaire' },
  { value: 'kg', label: 'Kilogramme' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'jour', label: 'Jour' },
];

export const TAX_RATES = [
  { value: 20, label: '20% (TVA normale)' },
  { value: 10, label: '10% (TVA réduite)' },
  { value: 5.5, label: '5.5% (TVA réduite)' },
  { value: 2.1, label: '2.1% (TVA super réduite)' },
  { value: 0, label: '0% (Exonéré)' },
];

// =====================================================
// Helpers
// =====================================================

/**
 * Formater un montant en euros
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Calculer le total d'une ligne
 */
export function calculateItemTotal(item: CreateInvoiceItemData): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
  const taxAmount = subtotal * (item.tax_rate || 20) / 100;
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}

/**
 * Calculer les totaux d'une facture
 */
export function calculateInvoiceTotals(
  items: CreateInvoiceItemData[],
  discountPercent: number = 0
): {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
} {
  let subtotal = 0;
  let taxAmount = 0;

  for (const item of items) {
    const itemTotals = calculateItemTotal(item);
    subtotal += itemTotals.subtotal;
    taxAmount += itemTotals.taxAmount;
  }

  const discountAmount = subtotal * discountPercent / 100;
  subtotal -= discountAmount;
  taxAmount *= (1 - discountPercent / 100);

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: subtotal + taxAmount,
  };
}

/**
 * Générer les mentions légales
 */
export function generateLegalMentions(invoice: {
  late_payment_rate: number;
  fixed_recovery_fee: number;
  early_payment_discount_rate?: number | null;
  early_payment_discount_days?: number | null;
}): string[] {
  const mentions: string[] = [];

  // Pénalités de retard (obligatoire)
  mentions.push(
    `En cas de retard de paiement, une pénalité égale à ${invoice.late_payment_rate}% annuel du montant TTC sera appliquée.`
  );

  // Indemnité forfaitaire (obligatoire depuis 2013)
  mentions.push(
    `Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement: ${invoice.fixed_recovery_fee}€ (Article L441-10 du Code de Commerce).`
  );

  // Escompte
  if (invoice.early_payment_discount_rate) {
    mentions.push(
      `Escompte de ${invoice.early_payment_discount_rate}% pour paiement sous ${invoice.early_payment_discount_days || 10} jours.`
    );
  } else {
    mentions.push('Pas d\'escompte pour paiement anticipé.');
  }

  return mentions;
}

/**
 * Vérifier si une facture est en retard
 */
export function isInvoiceOverdue(invoice: ProviderInvoice): boolean {
  if (!invoice.due_date) return false;
  if (invoice.status === 'paid') return false;
  return new Date(invoice.due_date) < new Date();
}

/**
 * Calculer le nombre de jours de retard
 */
export function getDaysOverdue(invoice: ProviderInvoice): number {
  if (!invoice.due_date) return 0;
  const dueDate = new Date(invoice.due_date);
  const today = new Date();
  const diff = today.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

