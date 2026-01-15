/**
 * Export centralisé des services
 * 
 * Tous les services récupèrent automatiquement leurs credentials
 * depuis la base de données (Admin > Intégrations) ou les variables d'environnement
 */

// Service de gestion des credentials
export {
  getProviderCredentials,
  isProviderConfigured,
  getResendCredentials,
  getTwilioCredentials,
  getStripeCredentials,
  invalidateCredentialsCache,
  type ProviderName,
  type ProviderCredentials,
} from "./credentials-service";

// Service Email (Resend)
export {
  sendEmail,
  sendTemplateEmail,
  sendLeaseInviteEmail,
  EMAIL_TEMPLATES,
  type EmailOptions,
  type EmailResult,
} from "./email-service";

// Service SMS (Twilio)
// Note: sms-service.ts is deprecated, use sms.service.ts instead
export {
  sendSMS,
  sendSMS as sendSms, // Backward compatibility alias
  sendOTPSMS,
  sendOTPSMS as sendOtpSms, // Backward compatibility alias
  sendNotificationSMS,
  isSMSServiceAvailable,
  detectTerritory,
  smsUtils,
  type SMSOptions,
  type SMSOptions as SmsOptions, // Backward compatibility alias
  type SMSResult,
  type SMSResult as SmsResult, // Backward compatibility alias
  type SMSProvider,
} from "./sms.service";

// Service OTP (codes de vérification)
export {
  sendOtp,
  validateOtp,
  isValidPhoneNumber,
  type OtpGenerationResult,
  type OtpValidationResult,
} from "./otp-service";

// Service OCR - CNI/Identity Document Extraction (Mindee/Google Vision)
export {
  extractCNIData,
  isOCRConfigured,
  type CNIData,
  type OCRResult,
} from "./ocr-service";

// Service OCR - Meter Photo Reading (Tesseract.js)
// Note: For advanced meter OCR with image preprocessing, use '@/lib/ocr/meter.service' directly
export {
  meterOCRService,
  MeterOCRService,
  type MeterOCRResult,
} from "@/lib/ocr/meter.service";

// Backward compatibility: ocrService is deprecated, use meterOCRService instead
export {
  ocrService,
  OCRService,
} from "./ocr.service";

// Service France Identité / FranceConnect
export {
  startFranceConnectAuth,
  exchangeCodeForTokens,
  getUserInfo,
  isFranceConnectConfigured,
  simulateFranceConnectUser,
  type FranceConnectUser,
  type AuthorizationResult,
  type TokenResult,
  type UserInfoResult,
} from "./france-identite-service";

// Service Devis (Quotes)
export {
  createQuote,
  sendQuote,
  respondToQuote,
  getProviderQuotes,
  getOwnerQuotes,
  type Quote,
  type QuoteItem,
  type CreateQuoteInput,
} from "./quote-service";

// Service Signature électronique (interne TALOK)
export {
  createSignatureRequest,
  getSignatureRequest,
  sendSignatureRequest,
  signDocument,
  refuseSignature,
  cancelSignatureRequest,
  generateSignatureToken,
  verifySignatureToken,
} from "@/lib/signatures/service";

export type {
  SignatureRequest,
  SignatureRequestSigner,
  SignatureRequestStatus,
  SignerStatus,
  CreateSignatureRequestDTO,
  CreateSignerDTO,
  SignDocumentDTO,
} from "@/lib/signatures/types";

// Service Paiement (Stripe)
export {
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  createCustomer,
  findCustomerByEmail,
  createRefund,
  verifyWebhookSignature,
  type PaymentIntent,
  type PaymentResult,
  type CustomerData,
  type CustomerResult,
} from "./stripe.service";

// =============================================================================
// Service Notifications In-App (PRIMARY - notification-service.ts)
// =============================================================================
// This is the primary notification service for in-app/database notifications
export {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupExpiredNotifications,
  // Predefined notification helpers
  notifyPaymentReceived,
  notifyPaymentLate,
  notifyLeaseSigned,
  notifyTicketCreated,
  notifyMessageReceived,
  // Types
  type NotificationType,
  type NotificationPriority,
  type NotificationChannel,
  type Notification,
  type CreateNotificationInput,
} from "./notification-service";

// Default export from primary notification service
export { default as notificationService } from "./notification-service";

// =============================================================================
// Service Notifications Push/SMS (DEPRECATED - notification.service.ts)
// =============================================================================
// @deprecated - Use notification-service.ts for in-app notifications
// @deprecated - Use sms.service.ts for SMS functionality
// These exports are maintained for backward compatibility only

// Push notification functions (deprecated)
export {
  sendPushNotification,
  sendPushToMultiple,
  type NotificationPayload,
  type PushSubscription as WebPushSubscription,
} from "./notification.service";

// Notification templates (deprecated but still useful)
export {
  NOTIFICATION_TEMPLATES,
  generateNotificationContent,
  type NotificationOptions as LegacyNotificationOptions,
} from "./notification.service";

// Deprecated service object - use notificationService from notification-service.ts instead
export { notificationService as legacyNotificationService } from "./notification.service";

// Backward compatibility aliases for notification.service.ts
// @deprecated - formatPhoneNumber: Use smsUtils.formatPhoneNumber from sms.service.ts
export { formatPhoneNumber as formatPhoneNumberLegacy } from "./notification.service";
// @deprecated - notifyUser: Use createNotification from notification-service.ts
export { notifyUser } from "./notification.service";
