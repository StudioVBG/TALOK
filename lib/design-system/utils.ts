/**
 * Design System Utilities - SOTA 2026
 * Fonctions utilitaires pour le design system
 *
 * Les fonctions de formatage de base sont réexportées depuis @/lib/helpers/format
 * pour éviter les duplications
 */

import {
  invoiceStatusStyles,
  leaseStatusStyles,
  ticketStatusStyles,
  priorityStyles,
  type InvoiceStatus,
  type LeaseStatus,
  type TicketStatus,
  type PriorityVariant,
} from './tokens';

// ============================================================================
// RE-EXPORT DES FONCTIONS DE FORMATAGE COMMUNES
// ============================================================================
export {
  formatCurrency,
  formatDate,
  formatDateShort,
  formatPeriod as formatPeriodShort,
  formatPhoneNumber,
  formatFullName,
  buildAvatarUrl,
  numberToWords,
} from '@/lib/helpers/format';

// ============================================================================
// STATUS LABELS (French)
// ============================================================================

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  late: 'En retard',
  cancelled: 'Annulée',
};

export const leaseStatusLabels: Record<LeaseStatus, string> = {
  draft: 'Brouillon',
  pending_signature: 'En attente de signature',
  active: 'Actif',
  terminated: 'Résilié',
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

export const priorityLabels: Record<PriorityVariant, string> = {
  low: 'Basse',
  medium: 'Normale',
  high: 'Haute',
  urgent: 'Urgente',
};

// ============================================================================
// FORMATTERS ADDITIONNELS
// ============================================================================

/**
 * Formate une date relative (il y a X jours)
 */
export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '-';

  const now = new Date();
  const target = new Date(date);
  const diffTime = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaine(s)`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return `Il y a ${Math.floor(diffDays / 365)} an(s)`;
}

/**
 * Formate une période (ex: "2025-11" -> "Novembre 2025")
 */
export function formatPeriod(period: string | null | undefined): string {
  if (!period) return '-';

  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);

  return new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Formate un pourcentage
 */
export function formatPercent(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formate une surface en m²
 */
export function formatSurface(surface: number | null | undefined): string {
  if (!surface) return '-';
  return `${surface} m²`;
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Récupère les styles d'un statut de facture
 */
export function getInvoiceStatusStyle(status: string): string {
  return invoiceStatusStyles[status as InvoiceStatus] || invoiceStatusStyles.draft;
}

/**
 * Récupère les styles d'un statut de bail
 */
export function getLeaseStatusStyle(status: string): string {
  return leaseStatusStyles[status as LeaseStatus] || leaseStatusStyles.draft;
}

/**
 * Récupère les styles d'un statut de ticket
 */
export function getTicketStatusStyle(status: string): string {
  return ticketStatusStyles[status as TicketStatus] || ticketStatusStyles.open;
}

/**
 * Récupère les styles d'une priorité
 */
export function getPriorityStyle(priority: string): string {
  return priorityStyles[priority as PriorityVariant] || priorityStyles.medium;
}

/**
 * Récupère le label d'un statut de facture
 */
export function getInvoiceStatusLabel(status: string): string {
  return invoiceStatusLabels[status as InvoiceStatus] || status;
}

/**
 * Récupère le label d'un statut de bail
 */
export function getLeaseStatusLabel(status: string): string {
  return leaseStatusLabels[status as LeaseStatus] || status;
}

/**
 * Récupère le label d'un statut de ticket
 */
export function getTicketStatusLabel(status: string): string {
  return ticketStatusLabels[status as TicketStatus] || status;
}

/**
 * Récupère le label d'une priorité
 */
export function getPriorityLabel(priority: string): string {
  return priorityLabels[priority as PriorityVariant] || priority;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Génère les initiales d'un nom
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return first + last || '?';
}

/**
 * Tronque un texte avec ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Génère un ID unique
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calcule le nombre de jours entre deux dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Vérifie si une date est dans le passé
 */
export function isPast(date: string | Date): boolean {
  return new Date(date) < new Date();
}

/**
 * Vérifie si une date est aujourd'hui
 */
export function isToday(date: string | Date): boolean {
  const today = new Date();
  const target = new Date(date);
  return (
    target.getDate() === today.getDate() &&
    target.getMonth() === today.getMonth() &&
    target.getFullYear() === today.getFullYear()
  );
}

