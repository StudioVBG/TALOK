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
export {
  sendSms,
  sendOtpSms,
  sendRentReminderSms,
  SMS_TEMPLATES,
  type SmsOptions,
  type SmsResult,
} from "./sms-service";

// Service OTP (codes de vérification)
export {
  sendOtp,
  validateOtp,
  isValidPhoneNumber,
  type OtpGenerationResult,
  type OtpValidationResult,
} from "./otp-service";

// Service OCR (extraction CNI)
export {
  extractCNIData,
  isOCRConfigured,
  type CNIData,
  type OCRResult,
} from "./ocr-service";

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

