# Audit Complet Resend - Talok

**Date:** 2026-01-17
**Version:** 1.0
**Auditeur:** Claude Opus 4.5

---

## 1. Configuration Resend

### 1.1 Variables d'environnement

| Variable | Fichier | Statut | Description |
|----------|---------|--------|-------------|
| `RESEND_API_KEY` | `.env.example`, `env.example` | **Requise** | Clé API Resend |
| `RESEND_FROM_EMAIL` | `.env.example` | Optionnelle | Adresse d'expédition (défaut: `Talok <noreply@talok.fr>`) |
| `RESEND_REPLY_TO` | `lib/emails/resend.service.ts:26` | Optionnelle | Adresse de réponse (défaut: `support@talok.fr`) |
| `EMAIL_PROVIDER` | `lib/services/email-service.ts:56` | Optionnelle | Provider (défaut: `resend`) |
| `EMAIL_FROM` | `lib/services/email-service.ts:58` | Optionnelle | Alias pour RESEND_FROM_EMAIL |
| `EMAIL_FORCE_SEND` | `lib/services/email-service.ts:61` | Optionnelle | Force l'envoi en dev |

### 1.2 Clients Resend

| Service | Fichier | Type | Description |
|---------|---------|------|-------------|
| `resendClient` | `lib/emails/resend.service.ts:11` | Singleton lazy | Client principal via SDK |
| `sendViaResend` | `lib/services/email-service.ts:79` | Fetch direct | Client HTTP direct (fallback DB credentials) |
| `resend` | `lib/emails/branded-email.service.ts:12` | Instance directe | Client pour white-label |
| `resend` | `app/api/cron/onboarding-reminders/route.ts:22` | Instance directe | Client pour cron |

### 1.3 Sources des Credentials

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUX CREDENTIALS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Variables d'environnement (RESEND_API_KEY)                │
│      └── Priorité: HAUTE (utilisé si présent)                   │
│                                                                 │
│   2. Base de données (via credentials-service.ts)              │
│      └── Table: api_providers + api_credentials                │
│      └── Provider: "Resend"                                    │
│      └── Chiffrement: AES-256-GCM                              │
│      └── Cache: 5 minutes TTL                                  │
│                                                                 │
│   3. Fallback: onboarding@resend.dev (domaine test Resend)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Configuration domaine

| Paramètre | Valeur par défaut | Fichier |
|-----------|-------------------|---------|
| From Name | `Talok` | Plusieurs fichiers |
| From Domain | `noreply@talok.fr` | `lib/services/email-service.ts:58` |
| Fallback Domain | `onboarding@resend.dev` | `lib/services/email-service.ts:118` |

---

## 2. Architecture des Services Email

### 2.1 Hiérarchie des Services

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE EMAIL                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  lib/emails/index.ts (barrel export)                           │
│     │                                                           │
│     ├── lib/emails/resend.service.ts                           │
│     │   └── emailService (objet exporté)                       │
│     │       ├── sendEmail()                                    │
│     │       ├── sendInvoiceNotification()                      │
│     │       ├── sendPaymentConfirmation()                      │
│     │       ├── sendPaymentReminder()                          │
│     │       ├── sendNewTicketNotification()                    │
│     │       ├── sendTicketUpdateNotification()                 │
│     │       ├── sendSignatureRequest()                         │
│     │       ├── sendLeaseSignedNotification()                  │
│     │       ├── sendPropertyInvitation()                       │
│     │       ├── sendWelcomeEmail()                             │
│     │       ├── sendPasswordResetEmail()                       │
│     │       ├── sendVisitBookingRequest()                      │
│     │       ├── sendVisitBookingConfirmed()                    │
│     │       ├── sendVisitBookingCancelled()                    │
│     │       ├── sendVisitReminder()                            │
│     │       └── sendVisitFeedbackRequest()                     │
│     │                                                           │
│     └── lib/emails/templates.ts                                │
│         └── emailTemplates (templates HTML)                    │
│                                                                 │
│  lib/services/email-service.ts (abstraction multi-provider)    │
│     ├── sendEmail()                                            │
│     ├── sendTemplateEmail()                                    │
│     ├── sendWelcomeEmail()                                     │
│     ├── sendRentReceiptEmail()                                 │
│     ├── sendRentReminderEmail()                                │
│     ├── sendPaymentReceivedEmail()                             │
│     ├── sendLeaseInviteEmail()                                 │
│     └── sendLeaseSignatureEmail()                              │
│                                                                 │
│  lib/emails/branded-email.service.ts (white-label)             │
│     └── BrandedEmailService                                    │
│         └── sendBrandedEmail()                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Templates Disponibles

| Template | Catégorie | Fonction génératrice |
|----------|-----------|---------------------|
| `newInvoice` | Payment | `emailTemplates.newInvoice()` |
| `paymentConfirmation` | Payment | `emailTemplates.paymentConfirmation()` |
| `paymentReminder` | Payment | `emailTemplates.paymentReminder()` |
| `newTicket` | Maintenance | `emailTemplates.newTicket()` |
| `ticketUpdated` | Maintenance | `emailTemplates.ticketUpdated()` |
| `signatureRequest` | Lease | `emailTemplates.signatureRequest()` |
| `leaseSignedNotification` | Lease | `emailTemplates.leaseSignedNotification()` |
| `propertyInvitation` | Lease | `emailTemplates.propertyInvitation()` |
| `welcome` | Account | `emailTemplates.welcome()` |
| `passwordReset` | Account | `emailTemplates.passwordReset()` |
| `visitBookingRequest` | Visit | `emailTemplates.visitBookingRequest()` |
| `visitBookingConfirmed` | Visit | `emailTemplates.visitBookingConfirmed()` |
| `visitBookingCancelled` | Visit | `emailTemplates.visitBookingCancelled()` |
| `visitReminder` | Visit | `emailTemplates.visitReminder()` |
| `visitFeedbackRequest` | Visit | `emailTemplates.visitFeedbackRequest()` |
| `welcomeOnboarding` | Onboarding | `emailTemplates.welcomeOnboarding()` |
| `onboardingReminder24h` | Onboarding | `emailTemplates.onboardingReminder24h()` |
| `onboardingReminder72h` | Onboarding | `emailTemplates.onboardingReminder72h()` |
| `onboardingReminder7d` | Onboarding | `emailTemplates.onboardingReminder7d()` |
| `onboardingCompleted` | Onboarding | `emailTemplates.onboardingCompleted()` |
| `priceChange` | Legal | `emailTemplates.priceChange()` |
| `cguUpdate` | Legal | `emailTemplates.cguUpdate()` |
| `lease_invite` | Lease | `EMAIL_TEMPLATES.lease_invite` |
| `rent_receipt` | Payment | `EMAIL_TEMPLATES.rent_receipt` |
| `rent_reminder` | Payment | `EMAIL_TEMPLATES.rent_reminder` |
| `ticket_created` | Maintenance | `EMAIL_TEMPLATES.ticket_created` |
| `lease_signature` | Lease | `EMAIL_TEMPLATES.lease_signature` |
| `payment_received` | Payment | `EMAIL_TEMPLATES.payment_received` |

---

## 3. Cartographie des Envois d'Email

### 3.1 Par Trigger/Événement

| Trigger | Fichier | Fonction | Template | Destinataire(s) |
|---------|---------|----------|----------|-----------------|
| **Inscription** | - | `sendWelcomeEmail()` | `welcome` | Nouvel utilisateur |
| **Onboarding bienvenue** | `templates.ts` | `welcomeOnboarding()` | `welcomeOnboarding` | Nouvel utilisateur |
| **Onboarding rappel 24h** | `cron/onboarding-reminders` | `onboardingReminder24h()` | `onboardingReminder24h` | User incomplet |
| **Onboarding rappel 72h** | `cron/onboarding-reminders` | `onboardingReminder72h()` | `onboardingReminder72h` | User incomplet |
| **Onboarding rappel 7j** | `cron/onboarding-reminders` | `onboardingReminder7d()` | `onboardingReminder7d` | User incomplet |
| **Invitation bail** | `api/leases/invite` | `sendLeaseInviteEmail()` | `lease_invite` | Locataire |
| **Demande signature** | `resend.service.ts` | `sendSignatureRequest()` | `signatureRequest` | Signataire |
| **Relance signature** | `api/leases/[id]/signers/[id]/resend` | `sendLeaseInviteEmail()` | `lease_invite` | Signataire |
| **Bail signé** | `resend.service.ts` | `sendLeaseSignedNotification()` | `leaseSignedNotification` | Propriétaire |
| **Nouvelle facture** | `resend.service.ts` | `sendInvoiceNotification()` | `newInvoice` | Locataire |
| **Paiement confirmé** | `api/payments/confirm` | `sendPaymentConfirmation()` | `paymentConfirmation` | Locataire |
| **Paiement reçu (proprio)** | `webhooks/stripe` | `sendPaymentReceivedEmail()` | `payment_received` | Propriétaire |
| **Quittance** | `webhooks/stripe` | `sendRentReceiptEmail()` | `rent_receipt` | Locataire |
| **Rappel loyer** | `automations/rent-reminders` | `sendPaymentReminder()` | `paymentReminder` | Locataire |
| **Nouveau ticket** | `resend.service.ts` | `sendNewTicketNotification()` | `newTicket` | Propriétaire |
| **Ticket mis à jour** | `api/work-orders/[id]/*` | `sendTicketUpdateNotification()` | `ticketUpdated` | Concerné |
| **Demande visite** | `resend.service.ts` | `sendVisitBookingRequest()` | `visitBookingRequest` | Propriétaire |
| **Visite confirmée** | `resend.service.ts` | `sendVisitBookingConfirmed()` | `visitBookingConfirmed` | Visiteur |
| **Visite annulée** | `resend.service.ts` | `sendVisitBookingCancelled()` | `visitBookingCancelled` | Visiteur |
| **Rappel visite** | `cron/visit-reminders` | `sendVisitReminder()` | `visitReminder` | Propriétaire + Visiteur |
| **Feedback visite** | `resend.service.ts` | `sendVisitFeedbackRequest()` | `visitFeedbackRequest` | Visiteur |
| **Reset password** | `resend.service.ts` | `sendPasswordResetEmail()` | `passwordReset` | Utilisateur |
| **OTP signature** | `api/signature/[token]/send-otp` | `sendEmail()` | Custom HTML | Signataire |
| **Expiration CNI** | `cron/check-cni-expiry` | `sendEmail()` | Custom HTML | User |
| **Invitation copro** | `api/copro/invites` | via `/api/emails/send` | Custom | Invité copro |

### 3.2 Par Route API

| Route | Méthode | Email(s) envoyé(s) |
|-------|---------|-------------------|
| `/api/emails/send` | POST | Generic (any template) |
| `/api/admin/integrations/email/test` | POST | Test email |
| `/api/leases/invite` | POST | Lease invite |
| `/api/leases/[id]/signers` | POST | Lease invite to signer |
| `/api/leases/[id]/signers/[id]/resend` | POST | Resend lease invite |
| `/api/leases/[id]/roommates` | POST | Lease invite to roommate |
| `/api/payments/confirm` | POST | Payment confirmation |
| `/api/work-orders/[id]/accept` | POST | Ticket update (accepted) |
| `/api/work-orders/[id]/reject` | POST | Ticket update (rejected) |
| `/api/work-orders/[id]/complete` | POST | Ticket update (completed) |
| `/api/signature/[token]/send-otp` | POST | OTP email |
| `/api/cron/onboarding-reminders` | GET | Onboarding reminders |
| `/api/cron/visit-reminders` | GET | Visit reminders |
| `/api/cron/check-cni-expiry` | GET | CNI expiry notification |
| `/api/webhooks/stripe` | POST | Receipt + payment notification |
| `/api/copro/invites` | POST | Copro invitation |

---

## 4. Analyse Qualité du Code

### 4.1 Checklist par Service

#### `lib/emails/resend.service.ts`

| Critère | Statut | Détails |
|---------|--------|---------|
| Error Handling | **OK** | try/catch + retour `EmailResult` |
| Logging | **OK** | `console.log/error` avec prefix `[Email]` |
| Type Safety | **OK** | TypeScript interfaces |
| Validation destinataire | **PARTIEL** | Pas de validation format email |
| Retry Logic | **NON** | Aucune logique de retry |
| Rate Limiting | **NON** | Aucune protection |
| Async/Non-bloquant | **OK** | Toutes fonctions async |
| Tags Resend | **OK** | Tags pour tracking |

#### `lib/services/email-service.ts`

| Critère | Statut | Détails |
|---------|--------|---------|
| Error Handling | **OK** | try/catch + validation |
| Logging | **OK** | `console.log/warn/error` |
| Mode Dev | **OK** | Simulation si `NODE_ENV=development` |
| Fallback Credentials | **OK** | DB + env variables |
| Multi-provider | **OK** | Resend + SendGrid supportés |
| Template Interpolation | **OK** | `{{variable}}` replacement |
| Validation destinataire | **OK** | Vérifie `to` non vide |
| Validation contenu | **OK** | Vérifie `subject`, `html/text` |

#### `lib/emails/branded-email.service.ts`

| Critère | Statut | Détails |
|---------|--------|---------|
| White-label | **OK** | Branding dynamique par organisation |
| Error Handling | **OK** | try/catch avec retour structuré |
| Async | **OK** | Toutes méthodes async |

### 4.2 Routes API - Qualité

| Route | Error Handling | Auth Check | Validation | Logging |
|-------|---------------|------------|------------|---------|
| `/api/emails/send` | **OK** | **NON** | **PARTIEL** | **OK** |
| `/api/cron/onboarding-reminders` | **OK** | **OK** | **OK** | **OK** |
| `/api/cron/visit-reminders` | **OK** | **OK** | **OK** | **OK** |
| `/api/leases/invite` | **OK** | **OK** | **OK** (Zod) | **OK** |
| `/api/payments/confirm` | **OK** | **OK** | **OK** | **OK** |
| `/api/work-orders/[id]/*` | **OK** | **OK** | **OK** | **OK** |

---

## 5. Problèmes Identifiés

### 5.1 Critiques

| # | Problème | Impact | Fichier |
|---|----------|--------|---------|
| 1 | **`/api/emails/send` sans authentification** | Spam potentiel | `app/api/emails/send/route.ts` |
| 2 | **Pas de retry logic** | Emails perdus en cas d'erreur réseau | Tous services |
| 3 | **Pas de rate limiting** | Possible surcharge Resend API | Tous services |

### 5.2 Importants

| # | Problème | Impact | Fichier |
|---|----------|--------|---------|
| 4 | **Duplication de code** | Maintenance difficile | `resend.service.ts` vs `email-service.ts` |
| 5 | **Templates dans 2 fichiers différents** | Confusion | `templates.ts` vs `email-service.ts` |
| 6 | **Client Resend instancié plusieurs fois** | Inconsistance config | Plusieurs fichiers |
| 7 | **Pas de validation email format** | Erreurs API Resend | `resend.service.ts` |

### 5.3 Mineurs

| # | Problème | Impact | Fichier |
|---|----------|--------|---------|
| 8 | **Logs non structurés** | Debugging difficile | Tous fichiers |
| 9 | **Pas de métriques d'envoi** | Pas de monitoring | N/A |
| 10 | **Pas de queue pour emails** | Latence UX | N/A |

---

## 6. Résumé

### Statistiques

- **Total templates:** 27
- **Total fonctions d'envoi:** 22
- **Routes API avec emails:** 16
- **Cron jobs:** 3
- **Services:** 4

### Scores

| Catégorie | Score |
|-----------|-------|
| Configuration | 8/10 |
| Error Handling | 7/10 |
| Type Safety | 9/10 |
| Sécurité | 5/10 |
| Maintenabilité | 6/10 |
| Testabilité | 4/10 |
| **GLOBAL** | **6.5/10** |
