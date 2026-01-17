# Documentation des Flux Email - Talok

**Date:** 2026-01-17

---

## 1. Flux Onboarding

### 1.1 Email de Bienvenue

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Bienvenue Onboarding                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Trigger: Création de compte                                    │
│  Template: welcomeOnboarding                                    │
│  Destinataire: Nouvel utilisateur                               │
│  Fichier: lib/emails/templates.ts:1151                          │
│                                                                 │
│  Données requises:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ userName: string       - Prénom de l'utilisateur        │   │
│  │ role: 'owner'|'tenant'|'provider'|'guarantor'           │   │
│  │ onboardingUrl: string  - URL vers onboarding            │   │
│  │ supportEmail?: string  - Email support (optionnel)      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Contenu:                                                       │
│  - Guide de démarrage personnalisé par rôle                    │
│  - Étapes à suivre (3-4 selon rôle)                            │
│  - Avantages de la plateforme                                  │
│  - CTA: "Configurer mon espace"                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Rappels Onboarding (Cron)

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Rappels Onboarding Automatiques                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: /api/cron/onboarding-reminders                         │
│  Schedule: Toutes les heures                                   │
│  Auth: Bearer CRON_SECRET                                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rappel 24h                                              │   │
│  │  - Template: onboardingReminder24h                       │   │
│  │  - Affiche: progression %, prochaine étape              │   │
│  │  - Ton: Encourageant                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rappel 72h                                              │   │
│  │  - Template: onboardingReminder72h                       │   │
│  │  - Affiche: progression % (grande)                       │   │
│  │  - Ton: Plus insistant, urgence légère                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rappel 7 jours                                          │   │
│  │  - Template: onboardingReminder7d                        │   │
│  │  - Ton: "Vous nous manquez"                              │   │
│  │  - Stats: utilisateurs qui complètent tôt = 3x succès   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Conditions d'envoi:                                           │
│  - Status reminder = 'pending'                                 │
│  - scheduled_at <= maintenant                                  │
│  - Onboarding non complété                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Flux Bail (Lease)

### 2.1 Invitation Bail

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Invitation Bail                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/leases/invite                                │
│  Fonction: sendLeaseInviteEmail()                              │
│  Template: lease_invite                                        │
│  Fichier: lib/services/email-service.ts:750                    │
│                                                                 │
│  Trigger: Propriétaire crée un bail                            │
│                                                                 │
│  Données requises:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ to: string              - Email destinataire             │   │
│  │ tenantName?: string     - Nom du locataire              │   │
│  │ ownerName: string       - Nom du propriétaire           │   │
│  │ propertyAddress: string - Adresse complète              │   │
│  │ rent: number            - Loyer mensuel                 │   │
│  │ charges: number         - Charges mensuelles            │   │
│  │ leaseType: string       - Type de bail                  │   │
│  │ inviteUrl: string       - Lien de signature             │   │
│  │ role?: string           - Rôle du signataire            │   │
│  │ isReminder?: boolean    - Est-ce une relance ?          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Flux:                                                          │
│  1. Propriétaire remplit formulaire bail                       │
│  2. API crée le bail en statut 'draft'                         │
│  3. Crée les lease_signers                                     │
│  4. Génère token invitation (base64url)                        │
│  5. Envoie email avec lien /signature/{token}                  │
│                                                                 │
│  Variantes:                                                     │
│  - Colocation: email à chaque colocataire                      │
│  - Garant: email séparé au garant                              │
│  - Relance: isReminder=true, message adapté                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Relance Signature

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Relance Signature Bail                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/leases/[id]/signers/[signerId]/resend        │
│  Fonction: sendLeaseInviteEmail()                              │
│  Fichier: app/api/leases/[id]/signers/[signerId]/resend        │
│                                                                 │
│  Trigger: Propriétaire clique "Relancer"                       │
│                                                                 │
│  Conditions:                                                    │
│  - Signataire existe                                           │
│  - Status != 'signed'                                          │
│  - Bail pas encore complètement signé                          │
│                                                                 │
│  Actions:                                                       │
│  1. Régénère un nouveau token                                  │
│  2. Met à jour invite_token dans DB                            │
│  3. Envoie email avec isReminder=true                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Notification Bail Signé

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Notification Bail Signé                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendLeaseSignedNotification()                       │
│  Template: leaseSignedNotification                             │
│  Fichier: lib/emails/resend.service.ts:288                     │
│                                                                 │
│  Trigger: Un signataire signe le bail                          │
│  Destinataire: Propriétaire                                    │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ownerEmail: string     - Email propriétaire              │   │
│  │ ownerName: string      - Nom propriétaire                │   │
│  │ signerName: string     - Qui vient de signer             │   │
│  │ signerRole: string     - Rôle du signataire              │   │
│  │ propertyAddress: string - Adresse du bien                │   │
│  │ allSigned: boolean     - Tous ont signé ?                │   │
│  │ leaseId: string        - ID du bail                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Variantes:                                                     │
│  - allSigned=false: "Nouvelle signature reçue"                 │
│  - allSigned=true: "Bail entièrement signé!" (célébration)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Flux Paiements

### 3.1 Notification Nouvelle Facture

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Nouvelle Facture                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendInvoiceNotification()                           │
│  Template: newInvoice                                          │
│  Fichier: lib/emails/resend.service.ts:97                      │
│                                                                 │
│  Trigger: Génération automatique ou manuelle de facture        │
│  Destinataire: Locataire                                       │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ tenantEmail: string    - Email locataire                 │   │
│  │ tenantName: string     - Nom locataire                   │   │
│  │ propertyAddress: string - Adresse du bien                │   │
│  │ period: string         - Période (ex: "Janvier 2026")    │   │
│  │ amount: number         - Montant total en €              │   │
│  │ dueDate: string        - Date limite paiement            │   │
│  │ invoiceId: string      - ID facture                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CTA: "Voir et payer ma facture"                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Confirmation de Paiement

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Confirmation Paiement                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/payments/confirm                             │
│  Fonction: sendPaymentConfirmation()                           │
│  Template: paymentConfirmation                                 │
│  Fichier: lib/emails/resend.service.ts:129                     │
│                                                                 │
│  Trigger: Paiement validé (carte, SEPA, etc.)                  │
│  Destinataire: Locataire                                       │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ tenantEmail: string    - Email locataire                 │   │
│  │ tenantName: string     - Nom locataire                   │   │
│  │ amount: number         - Montant payé                    │   │
│  │ paymentDate: string    - Date du paiement                │   │
│  │ paymentMethod: string  - Mode de paiement                │   │
│  │ period: string         - Période concernée               │   │
│  │ paymentId: string      - ID paiement                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CTA: "Télécharger ma quittance"                               │
│  Badge: "PAIEMENT CONFIRMÉ" (vert)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Notification Paiement Reçu (Propriétaire)

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Notification Paiement au Propriétaire                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/webhooks/stripe                              │
│  Fonction: sendPaymentReceivedEmail()                          │
│  Template: payment_received                                    │
│  Fichier: lib/services/email-service.ts:725                    │
│                                                                 │
│  Trigger: Webhook Stripe payment_intent.succeeded              │
│  Destinataire: Propriétaire                                    │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ to: string             - Email propriétaire              │   │
│  │ ownerName: string      - Nom propriétaire                │   │
│  │ tenantName: string     - Nom locataire payeur            │   │
│  │ amount: number         - Montant reçu                    │   │
│  │ propertyAddress: string - Bien concerné                  │   │
│  │ period: string         - Période                         │   │
│  │ paymentDate: string    - Date du paiement                │   │
│  │ dashboardUrl: string   - Lien vers finances              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CTA: "Voir mes finances"                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Rappel de Paiement

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Rappel de Paiement                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendPaymentReminder()                               │
│  Template: paymentReminder                                     │
│  Fichier: lib/emails/resend.service.ts:161                     │
│                                                                 │
│  Triggers:                                                      │
│  - Automatique: lib/automations/rent-reminders.ts              │
│  - Manuel: Server Action app/owner/money/actions.ts            │
│                                                                 │
│  Destinataire: Locataire                                       │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ tenantEmail: string    - Email locataire                 │   │
│  │ tenantName: string     - Nom locataire                   │   │
│  │ amount: number         - Montant dû                      │   │
│  │ dueDate: string        - Date échéance                   │   │
│  │ daysLate: number       - Jours de retard (0 si préventif)│   │
│  │ invoiceId: string      - ID facture                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Variantes visuelles:                                          │
│  - daysLate=0: Badge orange "RAPPEL"                           │
│  - daysLate>0: Badge rouge "RETARD DE X JOURS"                 │
│                                                                 │
│  CTA: "Payer maintenant"                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Quittance de Loyer

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Envoi Quittance                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/webhooks/stripe                              │
│  Fonction: sendRentReceiptEmail()                              │
│  Template: rent_receipt                                        │
│  Fichier: lib/services/email-service.ts:683                    │
│                                                                 │
│  Trigger: Après génération PDF quittance                       │
│  Destinataire: Locataire                                       │
│                                                                 │
│  Flux complet:                                                  │
│  1. Webhook Stripe reçu                                        │
│  2. Paiement enregistré en DB                                  │
│  3. PDF quittance généré                                       │
│  4. PDF uploadé sur Storage                                    │
│  5. Document créé en DB                                        │
│  6. Email envoyé avec lien téléchargement                      │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ to: string              - Email locataire                │   │
│  │ tenantName: string      - Nom locataire                  │   │
│  │ period: string          - Période                        │   │
│  │ amount: number          - Montant                        │   │
│  │ propertyAddress: string - Adresse                        │   │
│  │ receiptUrl: string      - Lien PDF                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CTA: "Télécharger la quittance"                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Flux Maintenance (Tickets)

### 4.1 Nouveau Ticket

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Nouveau Ticket Maintenance                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendNewTicketNotification()                         │
│  Template: newTicket                                           │
│  Fichier: lib/emails/resend.service.ts:192                     │
│                                                                 │
│  Trigger: Locataire crée un ticket                             │
│  Destinataire: Propriétaire (et/ou prestataire assigné)        │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ recipientEmail: string   - Email destinataire            │   │
│  │ recipientName: string    - Nom destinataire              │   │
│  │ ticketTitle: string      - Titre du ticket               │   │
│  │ ticketDescription: string - Description                  │   │
│  │ priority: 'basse'|'normale'|'haute'                      │   │
│  │ propertyAddress: string  - Adresse du bien               │   │
│  │ createdBy: string        - Nom du créateur               │   │
│  │ ticketId: string         - ID ticket                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Badge priorité:                                               │
│  - haute: Rouge                                                │
│  - normale: Orange                                             │
│  - basse: Bleu                                                 │
│                                                                 │
│  CTA: "Voir le ticket"                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Mise à Jour Ticket

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Mise à Jour Ticket                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Routes:                                                        │
│  - POST /api/work-orders/[id]/accept                           │
│  - POST /api/work-orders/[id]/reject                           │
│  - POST /api/work-orders/[id]/complete                         │
│                                                                 │
│  Fonction: sendTicketUpdateNotification()                      │
│  Template: ticketUpdated                                       │
│  Fichier: lib/emails/resend.service.ts:227                     │
│                                                                 │
│  Trigger: Changement de statut du ticket                       │
│  Destinataires: Locataire et/ou Propriétaire (selon action)    │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ recipientEmail: string   - Email destinataire            │   │
│  │ recipientName: string    - Nom destinataire              │   │
│  │ ticketTitle: string      - Titre du ticket               │   │
│  │ newStatus: string        - Nouveau statut                │   │
│  │ updatedBy: string        - Qui a fait la mise à jour     │   │
│  │ comment?: string         - Commentaire optionnel         │   │
│  │ ticketId: string         - ID ticket                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  CTA: "Voir le ticket"                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Flux Visites

### 5.1 Demande de Visite

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Demande de Visite                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendVisitBookingRequest()                           │
│  Template: visitBookingRequest                                 │
│  Fichier: lib/emails/resend.service.ts:403                     │
│                                                                 │
│  Trigger: Visiteur réserve un créneau                          │
│  Destinataire: Propriétaire                                    │
│                                                                 │
│  Badge: "DEMANDE DE VISITE" (orange)                           │
│  CTA: "Voir les demandes de visite"                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Visite Confirmée

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Visite Confirmée                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendVisitBookingConfirmed()                         │
│  Template: visitBookingConfirmed                               │
│  Fichier: lib/emails/resend.service.ts:437                     │
│                                                                 │
│  Trigger: Propriétaire confirme la demande                     │
│  Destinataire: Visiteur                                        │
│                                                                 │
│  Badge: "VISITE CONFIRMÉE" (vert)                              │
│  Info: Coordonnées propriétaire si disponibles                 │
│  CTA: "Voir ma réservation"                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Visite Annulée

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Visite Annulée                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendVisitBookingCancelled()                         │
│  Template: visitBookingCancelled                               │
│  Fichier: lib/emails/resend.service.ts:471                     │
│                                                                 │
│  Trigger: Propriétaire ou visiteur annule                      │
│  Destinataire: L'autre partie                                  │
│                                                                 │
│  Badge: "VISITE ANNULÉE" (rouge)                               │
│  CTA: "Rechercher un logement"                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Rappels de Visite (Cron)

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Rappels de Visite Automatiques                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: GET /api/cron/visit-reminders                          │
│  Schedule: Toutes les 30 minutes                               │
│  Auth: Bearer CRON_SECRET                                      │
│                                                                 │
│  Fonction: sendVisitReminder()                                 │
│  Template: visitReminder                                       │
│  Fichier: lib/emails/resend.service.ts:506                     │
│                                                                 │
│  Rappels:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  24h avant (23-25h window)                               │   │
│  │  - À: Propriétaire + Visiteur                            │   │
│  │  - Flag: reminder_24h_sent = true                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1h avant (0.5-1.5h window)                              │   │
│  │  - À: Propriétaire + Visiteur                            │   │
│  │  - Flag: reminder_1h_sent = true                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Badge: "RAPPEL DE VISITE" (bleu)                              │
│  CTA: "Voir les détails"                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.5 Demande de Feedback

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Demande Feedback Post-Visite                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendVisitFeedbackRequest()                          │
│  Template: visitFeedbackRequest                                │
│  Fichier: lib/emails/resend.service.ts:547                     │
│                                                                 │
│  Trigger: X heures après la visite                             │
│  Destinataire: Visiteur                                        │
│                                                                 │
│  CTA: "Donner mon avis"                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Flux Authentification

### 6.1 Reset Password

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Réinitialisation Mot de Passe                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fonction: sendPasswordResetEmail()                            │
│  Template: passwordReset                                       │
│  Fichier: lib/emails/resend.service.ts:375                     │
│                                                                 │
│  Trigger: Demande de reset via formulaire                      │
│  Destinataire: Utilisateur                                     │
│                                                                 │
│  Données:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ userEmail: string     - Email utilisateur                │   │
│  │ userName: string      - Nom utilisateur                  │   │
│  │ resetToken: string    - Token de reset                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Expiration: 1 heure                                           │
│  CTA: "Réinitialiser mon mot de passe"                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 OTP Signature

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: OTP pour Signature Électronique                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/signature/[token]/send-otp                   │
│  Fonction: sendEmail() (générique)                             │
│  Template: Custom inline HTML                                  │
│  Fichier: app/api/signature/[token]/send-otp/route.ts          │
│                                                                 │
│  Trigger: Signataire demande un code OTP                       │
│  Destinataire: Signataire                                      │
│                                                                 │
│  Contenu:                                                       │
│  - Code à 6 chiffres                                           │
│  - Validité: 10 minutes                                        │
│  - Instructions de sécurité                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Flux Administratifs

### 7.1 Notification Expiration CNI

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Alerte Expiration CNI                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: GET /api/cron/check-cni-expiry                         │
│  Fonction: sendCniExpiryEmail() (locale)                       │
│  Template: Custom inline HTML                                  │
│                                                                 │
│  Trigger: Cron quotidien                                       │
│  Destinataire: Utilisateurs avec CNI expirant/expirée          │
│                                                                 │
│  Conditions:                                                    │
│  - CNI expire dans 30 jours                                    │
│  - CNI expire dans 7 jours                                     │
│  - CNI expirée                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Changement de Tarif

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Notification Changement Tarif                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Template: priceChange                                         │
│  Fichier: lib/emails/templates.ts:735                          │
│                                                                 │
│  Trigger: Manuel (admin déclenche)                             │
│  Destinataire: Abonnés concernés                               │
│                                                                 │
│  Conformité: Article L121-84 Code de la consommation           │
│  Contenu:                                                       │
│  - Ancien vs nouveau tarif                                     │
│  - Raison du changement                                        │
│  - Date d'effet                                                │
│  - Période de maintien garanti (grandfathering)                │
│  - Options: accepter ou résilier sans frais                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Mise à Jour CGU

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Notification MAJ CGU                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Template: cguUpdate                                           │
│  Fichier: lib/emails/templates.ts:852                          │
│                                                                 │
│  Trigger: Manuel (admin déclenche)                             │
│  Destinataire: Tous les utilisateurs actifs                    │
│                                                                 │
│  Contenu:                                                       │
│  - Version des CGU                                             │
│  - Résumé des changements                                      │
│  - Date d'entrée en vigueur                                    │
│  - Lien vers nouvelles CGU                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Flux Copropriété

### 8.1 Invitation Copropriété

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUX: Invitation Copropriété                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Route: POST /api/copro/invites                                │
│  Appel: POST /api/emails/send (interne)                        │
│  Template: Custom généré côté service                          │
│  Fichier: features/copro/services/invites.service.ts           │
│                                                                 │
│  Trigger: Syndic invite un copropriétaire                      │
│  Destinataire: Email invité                                    │
│                                                                 │
│  Contenu:                                                       │
│  - Nom de la copropriété                                       │
│  - Lien d'invitation avec token                                │
│  - Instructions                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
