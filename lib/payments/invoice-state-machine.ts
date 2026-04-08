/**
 * Invoice State Machine — SOTA 2026
 *
 * States:
 *   draft → sent → pending → paid → receipt_generated (terminal)
 *                     ↓
 *                 overdue → reminder_sent → collection → written_off (terminal)
 *
 * Legacy states (late, unpaid, partial) are mapped to new states.
 */

// ============================================
// TYPES
// ============================================

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "pending",
  "paid",
  "receipt_generated",
  "overdue",
  "reminder_sent",
  "collection",
  "written_off",
  // Legacy compat
  "late",
  "unpaid",
  "partial",
  "succeeded",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Canonical statuses (no legacy) */
export type CanonicalInvoiceStatus =
  | "draft"
  | "sent"
  | "pending"
  | "paid"
  | "receipt_generated"
  | "overdue"
  | "reminder_sent"
  | "collection"
  | "written_off";

/** Statuses where tenant can pay */
export const PAYABLE_STATUSES: InvoiceStatus[] = [
  "sent",
  "pending",
  "overdue",
  "reminder_sent",
  // Legacy
  "late",
  "unpaid",
];

/** Terminal statuses — no further transitions */
export const TERMINAL_STATUSES: InvoiceStatus[] = [
  "receipt_generated",
  "written_off",
];

// ============================================
// VALID TRANSITIONS
// ============================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["pending", "paid", "overdue"],
  pending: ["paid", "overdue"],
  paid: ["receipt_generated"],
  overdue: ["paid", "reminder_sent"],
  reminder_sent: ["paid", "collection"],
  collection: ["paid", "written_off"],
  // Legacy mappings
  late: ["paid", "overdue", "reminder_sent"],
  unpaid: ["paid", "overdue"],
  partial: ["paid", "overdue"],
  succeeded: ["receipt_generated"],
};

// ============================================
// FUNCTIONS
// ============================================

/**
 * Normalize legacy statuses to canonical form.
 */
export function normalizeStatus(status: string): CanonicalInvoiceStatus {
  switch (status) {
    case "late":
      return "overdue";
    case "unpaid":
      return "overdue";
    case "partial":
      return "pending";
    case "succeeded":
      return "paid";
    default:
      return status as CanonicalInvoiceStatus;
  }
}

/**
 * Check if a transition is valid.
 */
export function canTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(newStatus);
}

/**
 * Check if an invoice is in a payable state.
 */
export function isPayable(status: string): boolean {
  return PAYABLE_STATUSES.includes(status as InvoiceStatus);
}

/**
 * Check if an invoice is in a terminal state.
 */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as InvoiceStatus);
}

/**
 * Get the next expected status for common flows.
 */
export function getNextStatus(
  currentStatus: string,
  event: "payment_received" | "reminder_sent" | "escalate" | "receipt_generated" | "write_off"
): CanonicalInvoiceStatus | null {
  switch (event) {
    case "payment_received":
      if (isPayable(currentStatus) || currentStatus === "collection") {
        return "paid";
      }
      return null;

    case "reminder_sent":
      if (currentStatus === "overdue" || currentStatus === "late") {
        return "reminder_sent";
      }
      return null;

    case "escalate":
      if (currentStatus === "reminder_sent") return "collection";
      if (
        currentStatus === "sent" ||
        currentStatus === "pending" ||
        currentStatus === "late" ||
        currentStatus === "unpaid"
      ) {
        return "overdue";
      }
      return null;

    case "receipt_generated":
      if (currentStatus === "paid" || currentStatus === "succeeded") {
        return "receipt_generated";
      }
      return null;

    case "write_off":
      if (currentStatus === "collection") return "written_off";
      return null;

    default:
      return null;
  }
}

// ============================================
// STATUS DISPLAY
// ============================================

export interface StatusDisplay {
  label: string;
  color: string;
  /** Tailwind badge classes */
  badgeClass: string;
  icon: string;
}

const STATUS_DISPLAY: Record<string, StatusDisplay> = {
  draft: {
    label: "Brouillon",
    color: "gray",
    badgeClass: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    icon: "FileEdit",
  },
  sent: {
    label: "Envoyée",
    color: "blue",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: "Send",
  },
  pending: {
    label: "En attente",
    color: "yellow",
    badgeClass: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: "Clock",
  },
  paid: {
    label: "Payée",
    color: "green",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    icon: "CheckCircle",
  },
  receipt_generated: {
    label: "Quittance envoyée",
    color: "emerald",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: "FileCheck",
  },
  overdue: {
    label: "En retard",
    color: "orange",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    icon: "AlertTriangle",
  },
  reminder_sent: {
    label: "Relancée",
    color: "amber",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    icon: "Bell",
  },
  collection: {
    label: "Recouvrement",
    color: "red",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    icon: "Gavel",
  },
  written_off: {
    label: "Irrécouvrable",
    color: "slate",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    icon: "XCircle",
  },
  // Legacy
  late: {
    label: "En retard",
    color: "orange",
    badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    icon: "AlertTriangle",
  },
  unpaid: {
    label: "Impayée",
    color: "red",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    icon: "XCircle",
  },
  succeeded: {
    label: "Payée",
    color: "green",
    badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    icon: "CheckCircle",
  },
};

/**
 * Get display information for an invoice status.
 */
export function getStatusDisplay(status: string): StatusDisplay {
  return (
    STATUS_DISPLAY[status] ?? {
      label: status,
      color: "gray",
      badgeClass: "bg-gray-100 text-gray-700",
      icon: "HelpCircle",
    }
  );
}

// ============================================
// REMINDER SCHEDULE
// ============================================

export interface ReminderScheduleItem {
  days: number;
  template: string;
  channel: string | string[];
  label: string;
}

export const REMINDER_SCHEDULE: ReminderScheduleItem[] = [
  { days: 1, template: "payment-reminder-gentle", channel: "email", label: "Rappel amical" },
  { days: 3, template: "payment-reminder-firm", channel: "email", label: "Relance ferme" },
  { days: 7, template: "payment-reminder-urgent", channel: ["email", "push"], label: "Relance urgente" },
  { days: 15, template: "payment-mise-en-demeure", channel: ["email", "rar"], label: "Mise en demeure" },
];
