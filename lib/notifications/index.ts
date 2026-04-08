/**
 * Unified notification system — barrel export
 *
 * Usage:
 *   import { notify, notifyMany } from '@/lib/notifications';
 *   await notify('payment.received', ownerProfileId, { amount: '450', tenantName: 'Jean' });
 */

export { notify, notifyMany } from './notification.service';
export type { NotifyOptions, NotifyResult } from './notification.service';
export { EVENT_CATALOGUE, EVENT_CATEGORIES } from './events';
export type { NotificationEventKey, NotificationChannel, NotificationPriority, EventDefinition } from './events';
