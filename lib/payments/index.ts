/**
 * Payments module — barrel export
 */

export {
  PAYABLE_INVOICE_STATUSES,
  isInvoicePayableStatus,
  getTenantInvoicePaymentContext,
  type TenantInvoicePaymentContext,
} from "./tenant-payment-flow";

export {
  INVOICE_STATUSES,
  PAYABLE_STATUSES,
  TERMINAL_STATUSES,
  REMINDER_SCHEDULE,
  normalizeStatus,
  canTransition,
  isPayable,
  isTerminal,
  getNextStatus,
  getStatusDisplay,
  type InvoiceStatus,
  type CanonicalInvoiceStatus,
  type StatusDisplay,
  type ReminderScheduleItem,
} from "./invoice-state-machine";

export {
  createRentPaymentIntent,
  getOwnerConnectAccount,
  calculateRentCommission,
  handleRentPaymentSucceeded,
  handleRentPaymentFailed,
  type CreateRentPaymentParams,
  type RentPaymentResult,
  type ConnectAccountInfo,
} from "./rent-collection.service";

export {
  UNPAID_INVOICE_STATUSES,
  isInvoiceUnpaid,
  getInvoiceEffectiveDueDate,
  computeUnpaidStats,
  getNextUpcomingInvoice,
  computePunctualityScore,
  type InvoiceLike,
  type UnpaidInvoiceStatus,
  type UnpaidStats,
} from "./unpaid-invoices";
