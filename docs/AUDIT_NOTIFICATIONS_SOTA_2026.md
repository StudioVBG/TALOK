# AUDIT SYSTÈME DE NOTIFICATIONS TALOK — SOTA 2026

**Date** : 23 février 2026
**Version** : 1.0
**Auditeur** : Claude Code (Opus 4.6)
**Périmètre** : Codebase complet Talok — infrastructure notifications, email, SMS, push, cron, frontend

---

## RÉSUMÉ EXÉCUTIF

Le système de notifications Talok dispose d'une **base solide mais incomplète**. L'infrastructure couvre les notifications in-app (table `notifications` avec Supabase Realtime), l'email transactionnel (Resend avec retry/rate-limiting), le SMS (Twilio avec support DOM-TOM), et un début de push navigateur (Web Notification API basique). **12 triggers PostgreSQL** automatisent les notifications clés (5 propriétaire, 7 locataire). Cependant, il manque des notifications critiques légales (quittance dématérialisée, révision IRL, régularisation charges, restitution dépôt de garantie, diagnostics expirés, trêve hivernale), le système multi-canal est partiel (pas de fallback intelligent email→push→SMS), les préférences utilisateur existent en DB mais le frontend de configuration est embryonnaire, et le prestataire n'a **aucune** notification dédiée. Le schema souffre de colonnes dupliquées (`user_id`/`recipient_id`/`profile_id`, `read`/`is_read`, `message`/`body`, `link`/`action_url`) issues de migrations successives. L'effort estimé pour atteindre le SOTA 2026 est de **35-45 jours/homme** répartis sur 4 sprints.

---

## PHASE 1 — CARTOGRAPHIE TECHNIQUE COMPLÈTE

### 1.1 Infrastructure Notifications

| Élément | Existe ? | Fichier(s) | État | Notes |
|---------|----------|------------|------|-------|
| **Table `notifications`** | ✅ | `supabase/migrations/20240101000021_add_notifications_table.sql` + 4 migrations correctrices | Fonctionnel | Schema hybride avec colonnes dupliquées (`user_id`/`recipient_id`/`profile_id`, `read`/`is_read`, `message`/`body`). RLS activé, Realtime activé. |
| **Table `notification_preferences`** | ✅ | `supabase/migrations/20251205600000_notifications_centralized.sql` | Fonctionnel | Canaux (in_app/email/sms/push), quiet hours, digest frequency, disabled_templates. |
| **Table `email_templates`** | ✅ | `supabase/migrations/20260212100001_email_template_system.sql` | Fonctionnel | Templates éditables avec versioning (`email_template_versions`) et logs (`email_logs`). |
| **Table `webhook_queue`** | ✅ | `supabase/migrations/20260128010001_webhook_queue.sql` | Fonctionnel | Outbox pattern avec retry (max 5), dead-letter, cleanup auto 30j. |
| **Table `onboarding_reminders`** | ✅ | `features/onboarding/services/onboarding-notifications.service.ts` | Fonctionnel | Rappels programmés 24h/72h/7j après inscription. |
| **Service email (Resend)** | ✅ | `lib/emails/resend.service.ts` | Fonctionnel | Retry 3x avec backoff exponentiel, rate-limiting (5/min/dest, 100/min global), validation emails. 16 fonctions d'envoi spécialisées. |
| **Templates email** | ✅ | `lib/emails/templates/` | Fonctionnel | Templates HTML pour : welcome, password_reset, invoice, payment_confirmation, payment_reminder, ticket_new, ticket_update, signature_request, lease_signed, property_invitation, visit_booking (5 templates visite). |
| **Service SMS (Twilio)** | ✅ | `lib/services/sms.service.ts` | Fonctionnel | Support DOM-TOM complet (Martinique +596, Guadeloupe +590, Réunion +262, Guyane +594, Mayotte +262). Mode simulation en dev. OTP + notifications SMS. Credentials depuis DB (Admin > Intégrations) ou env. |
| **Push notifications** | ⚠️ | `lib/hooks/use-push-notifications.ts` | Partiel | Web Notification API basique uniquement (pas de Service Worker, pas de Web Push API avec VAPID, pas de FCM). Permission request + notification locale seulement. |
| **Supabase Realtime** | ✅ | `lib/hooks/use-notifications.ts` | Fonctionnel | Subscription postgres_changes sur INSERT/UPDATE/DELETE de `notifications`. Filtre par `user_id`. Toast + son optionnel. |
| **Triggers PostgreSQL** | ✅ | `supabase/migrations/20251205000001_notification_triggers.sql` + `20260108200000_tenant_notification_triggers.sql` | Fonctionnel | 12 triggers total : 5 propriétaire (invoice_late, payment_received, lease_signed, ticket_created, ticket_resolved) + 7 locataire (lease_updated, invoice_created, document_uploaded, owner_signed, edl_scheduled, signature_requested, ticket_updated). |
| **Cron jobs** | ✅ | `app/api/cron/lease-expiry-alerts/route.ts`, `app/api/cron/rent-reminders/route.ts` | Fonctionnel | Lease expiry : alertes J-90/60/30/15/7 (lundi 8h). Rent reminders : relances J+5/10/15/30 (quotidien 9h). Sécurisés par CRON_SECRET. Audit trail dans `audit_log`. |
| **API routes notifications** | ✅ | `app/api/notifications/route.ts`, `app/api/notifications/preferences/route.ts` | Fonctionnel | CRUD complet (GET/POST/PATCH/DELETE). Préférences GET/PUT. Filtre hybride `profile_id OR user_id`. Support template via RPC `create_notification_from_template`. |
| **File d'attente** | ⚠️ | `webhook_queue` table | Partiel | Outbox pattern pour webhooks. Pas de queue dédiée notifications (pas de Bull/BullMQ, pas de pg_boss). |
| **Service Worker** | ❌ | — | NON TROUVÉ | Aucun `sw.js`, `service-worker.ts`, ou configuration PWA pour push en background. |
| **Database Webhooks Supabase** | ❌ | — | NON TROUVÉ | Aucun webhook configuré dans `supabase/config.toml` ou via Dashboard. |
| **pg_cron** | ❌ | — | NON TROUVÉ | Pas de pg_cron configuré. Les crons sont des API routes appelées par Netlify Scheduled Functions. |
| **Supabase Edge Functions** | ❌ | — | NON TROUVÉ | Dossier `supabase/functions/` absent ou vide. |
| **Analytics notifications** | ❌ | — | NON TROUVÉ | Aucun tracking taux ouverture/clic/action. |
| **i18n notifications** | ❌ | — | NON TROUVÉ | Tout en français hardcodé. |

### 1.2 Composants Frontend

| Élément | Existe ? | Fichier(s) | État | Notes |
|---------|----------|------------|------|-------|
| **NotificationCenter (Bell + Dropdown)** | ✅ | `components/notifications/notification-center.tsx` | Fonctionnel | Popover avec Bell icon, badge compteur (99+), tabs All/Non-lues, groupement par date, scroll area, mark read, mark all read, lien settings, lien voir toutes. Animation Framer Motion. |
| **NotificationItem** | ✅ | `components/notifications/notification-center.tsx` (interne) | Fonctionnel | Icône par type, priorité colorée, indicateur non-lu, lien action, temps relatif. |
| **Badge compteur non lues** | ✅ | `components/notifications/notification-center.tsx` | Fonctionnel | Badge rouge animé avec compteur. Poll toutes les 30s. |
| **Toast system** | ✅ | `components/ui/use-toast.ts` + `lib/hooks/use-notifications.ts` | Fonctionnel | Toast affiché automatiquement via Realtime sur nouvelle notification. |
| **Page historique notifications** | ⚠️ | Lien `/notifications` dans le composant | Partiel | Le lien existe dans le footer du dropdown mais la page dédiée n'a pas été vérifiée. |
| **Page préférences notifications** | ⚠️ | Lien `/settings/notifications` dans le composant | Partiel | Le lien existe, l'API backend est complète (GET/PUT), mais le composant frontend de préférences granulaires n'est pas identifié comme complet. |
| **Hook `useNotifications`** | ✅ | `lib/hooks/use-notifications.ts` | Fonctionnel | Realtime Supabase, CRUD optimiste, son optionnel, toast. Supporte `user_id` et `recipient_id` avec fallback. |
| **Hook `usePushNotifications`** | ⚠️ | `lib/hooks/use-push-notifications.ts` | Partiel | Web Notification API locale uniquement. Pas de Service Worker, pas de subscription serveur. |
| **Service notifications tenant** | ✅ | `features/tenant/services/notifications.service.ts` | Fonctionnel | Client-side service avec Realtime subscription, mark read, settings. |
| **Service notifications onboarding** | ✅ | `features/onboarding/services/onboarding-notifications.service.ts` | Fonctionnel | Welcome, step completed, almost done, completed, rappels programmés. |

### 1.3 Logique de Dispatch

| Élément | Existe ? | Fichier(s) | État | Notes |
|---------|----------|------------|------|-------|
| **Notification Service unifié** | ✅ | `lib/services/notification-service.ts` | Fonctionnel | 15 types, 4 priorités, 4 canaux configurés par défaut. Fonctions prédéfinies : paymentReceived, paymentLate, leaseSigned, ticketCreated, messageReceived. |
| **Config type→canaux** | ✅ | `lib/services/notification-service.ts:66-146` | Fonctionnel | Mapping complet type→{priority, channels, icon}. Ex: `payment_late` → urgent → [in_app, email, push, sms]. |
| **Routage multi-canal** | ❌ | — | NON TROUVÉ | Les `channels` sont stockés en DB mais **aucun dispatcher** ne route réellement vers email/SMS/push selon les canaux. Seul in-app (insert DB) est exécuté. L'email est envoyé séparément via des appels explicites. |
| **Fallback intelligent** | ❌ | — | NON TROUVÉ | Pas de logique in_app→push→email→SMS. |
| **Preference checker** | ❌ | — | NON TROUVÉ | Les préférences existent en DB mais ne sont **jamais consultées** avant envoi. |
| **Rate limiting notifications** | ⚠️ | `lib/emails/resend.service.ts` | Partiel | Rate-limiting sur email uniquement (5/min/dest). Aucun rate-limiting in-app ou SMS. |
| **Retry mécanisme** | ⚠️ | `lib/emails/resend.service.ts`, `webhook_queue` | Partiel | Retry 3x sur email (Resend). Retry 5x sur webhook_queue. Pas de retry sur in-app ou SMS. |
| **Timezone DOM-TOM** | ⚠️ | `notification_preferences.quiet_hours_timezone`, `lib/services/sms.service.ts` | Partiel | Le champ timezone existe dans preferences. Le SMS gère les indicatifs DOM-TOM. Mais aucune logique d'envoi timezone-aware n'est implémentée. |
| **Template engine dynamique** | ⚠️ | `email_templates` table + `lib/emails/templates/` | Partiel | Templates email en code TypeScript + templates DB éditables. Mais pas de template engine unifié pour in-app/SMS/push. |
| **Groupement/Digest** | ❌ | — | NON TROUVÉ | Champ `digest_mode` en DB mais aucune logique de digest implémentée. |
| **Snooze / rappel** | ❌ | — | NON TROUVÉ | |
| **Escalation automatique** | ❌ | — | NON TROUVÉ | Les crons font des relances séquentielles mais pas d'escalation de canal. |

---

## PHASE 2 — ÉTAT DES NOTIFICATIONS EXISTANTES

### A. Authentification & Compte

#### [AUTH-001] Email de bienvenue
- **Déclencheur** : Inscription complétée
- **Destinataire(s)** : Propriétaire / Locataire / Prestataire
- **Canal(aux)** : Email + In-app
- **Template** : `lib/emails/templates/` → `welcome()` + `onboarding-notifications.service.ts`
- **Données dynamiques** : `userName`, `role`, `loginUrl`
- **État** : ✅ Fonctionnel
- **Tests** : ❌ Non couverts
- **Conformité RGPD** : ⚠️ Pas de lien désinscription explicite

#### [AUTH-002] Réinitialisation mot de passe
- **Déclencheur** : Demande reset password
- **Destinataire(s)** : Tous
- **Canal(aux)** : Email
- **Template** : `lib/emails/templates/` → `passwordReset()`
- **Données dynamiques** : `userName`, `resetUrl`, `expiresIn`
- **État** : ✅ Fonctionnel
- **Tests** : ❌ Non couverts
- **Conformité RGPD** : ✅ Transactionnel (pas besoin de désinscription)

#### [AUTH-003] Notifications onboarding (progression)
- **Déclencheur** : Complétion d'étape d'onboarding
- **Destinataire(s)** : Tous les rôles
- **Canal(aux)** : In-app (+ push pour "almost done" et "completed")
- **Template** : `onboarding-notifications.service.ts`
- **Données dynamiques** : `userName`, `stepName`, `progressPercent`, `remainingSteps`
- **État** : ✅ Fonctionnel
- **Tests** : ❌ Non couverts
- **Conformité RGPD** : ✅ Notification de service

#### [AUTH-004] Rappels onboarding incomplet
- **Déclencheur** : Programmé 24h/72h/7j après inscription si onboarding non complété
- **Destinataire(s)** : Tous les rôles
- **Canal(aux)** : Email (via table `onboarding_reminders`)
- **Template** : Programmé mais envoi effectif non vérifié (cron manquant ?)
- **État** : ⚠️ Partiel — les rappels sont programmés en DB mais le cron d'envoi n'est pas identifié
- **Tests** : ❌ Non couverts

#### [AUTH-005] Confirmation email inscription
- **Déclencheur** : Inscription
- **Destinataire(s)** : Tous
- **Canal(aux)** : Email
- **État** : ✅ Géré par Supabase Auth nativement
- **Notes** : Template Supabase Auth, pas custom Talok

#### [AUTH-006] Changement email/mot de passe
- **État** : ❌ NON TROUVÉ — Aucune notification custom

#### [AUTH-007] Connexion nouveau device
- **État** : ❌ NON TROUVÉ

#### [AUTH-008] Compte désactivé/supprimé
- **État** : ❌ NON TROUVÉ

### B. Gestion des Biens

#### [PROP-001] Invitation à rejoindre un logement
- **Déclencheur** : Propriétaire invite un locataire
- **Destinataire(s)** : Locataire
- **Canal(aux)** : Email
- **Template** : `resend.service.ts` → `sendPropertyInvitation()`
- **Données dynamiques** : `tenantName`, `ownerName`, `propertyAddress`, `propertyCode`, `inviteUrl`
- **État** : ✅ Fonctionnel
- **Tests** : ❌ Non couverts
- **Conformité RGPD** : ⚠️ Pas de lien désinscription

#### [PROP-002] Bien créé/modifié/archivé
- **État** : ❌ NON TROUVÉ

#### [PROP-003] Documents bien uploadés
- **Déclencheur** : Trigger `notify_tenant_document_uploaded` (INSERT sur documents)
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app
- **État** : ✅ Fonctionnel (trigger PostgreSQL)
- **Types** : `document_uploaded`, `document_lease_added`, `document_receipt_added`, `document_edl_added`, `document_added`, `document_center_update`

#### [PROP-004] EDL créé/planifié
- **Déclencheur** : Trigger `notify_tenant_edl_scheduled`
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app
- **État** : ✅ Fonctionnel (trigger PostgreSQL)

#### [PROP-005] Diagnostics techniques expirés
- **État** : ❌ NON TROUVÉ

### C. Baux & Contrats

#### [BAIL-001] Demande de signature bail
- **Déclencheur** : Propriétaire envoie bail pour signature
- **Destinataire(s)** : Locataire (signataire)
- **Canal(aux)** : Email + In-app
- **Template** : `resend.service.ts` → `sendSignatureRequest()` + trigger `notify_tenant_signature_requested`
- **Données dynamiques** : `signerName`, `ownerName`, `propertyAddress`, `leaseType`, `signatureUrl`
- **État** : ✅ Fonctionnel
- **Tests** : ❌ Non couverts

#### [BAIL-002] Bail signé par locataire / toutes les parties
- **Déclencheur** : Signature + trigger `notify_lease_signed`
- **Destinataire(s)** : Propriétaire (email + in-app) + Locataire (in-app via trigger `notify_tenant_owner_signed`)
- **Canal(aux)** : Email + In-app
- **Template** : `resend.service.ts` → `sendLeaseSignedNotification()`
- **Données dynamiques** : `ownerName`, `signerName`, `signerRole`, `propertyAddress`, `allSigned`, `leaseUrl`
- **État** : ✅ Fonctionnel

#### [BAIL-003] Bail activé
- **Déclencheur** : Trigger `notify_tenant_lease_updated` quand statut → 'active'
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app
- **État** : ✅ Fonctionnel

#### [BAIL-004] Bail arrivant à échéance
- **Déclencheur** : Cron `lease-expiry-alerts` (hebdomadaire lundi 8h)
- **Destinataire(s)** : Propriétaire (J-90/60/30/15/7) + Locataire (J-30 et moins)
- **Canal(aux)** : In-app uniquement
- **Données dynamiques** : `lease_id`, `property_address`, `end_date`, `days_until_expiry`, `tenant_name`
- **État** : ✅ Fonctionnel
- **Notes** : Dédoublonnage par `alert_period`. Audit trail dans `audit_log`.

#### [BAIL-005] Modification loyer/charges
- **Déclencheur** : Trigger `notify_tenant_lease_updated` sur UPDATE leases (loyer ou charges modifié)
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app
- **État** : ✅ Fonctionnel

#### [BAIL-006] Congé donné
- **État** : ❌ NON TROUVÉ

#### [BAIL-007] Avenant bail
- **État** : ❌ NON TROUVÉ

#### [BAIL-008] Révision loyer annuelle (IRL/ILAT)
- **Déclencheur** : Type `rent_revision` existe dans notification-service.ts config
- **Canal(aux)** : Configuré [in_app, email]
- **État** : ⚠️ Partiel — Le type est défini mais aucun cron ou trigger ne le déclenche automatiquement

### D. Paiements & Finances

#### [PAY-001] Facture/Quittance créée
- **Déclencheur** : Trigger `notify_tenant_invoice_created` (INSERT sur invoices)
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app (trigger) + Email (`sendInvoiceNotification()`)
- **Template** : `resend.service.ts` → `sendInvoiceNotification()`
- **Données dynamiques** : `tenantName`, `propertyAddress`, `period`, `amount`, `dueDate`, `invoiceUrl`
- **État** : ✅ Fonctionnel

#### [PAY-002] Paiement reçu
- **Déclencheur** : Trigger `notify_payment_received` (INSERT sur payments, status='success')
- **Destinataire(s)** : Propriétaire (in-app trigger + `notifyPaymentReceived()`) + Locataire (email `sendPaymentConfirmation()`)
- **Canal(aux)** : In-app + Email
- **Données dynamiques** : `tenantName`, `amount`, `period`, `paymentDate`, `paymentMethod`
- **État** : ✅ Fonctionnel

#### [PAY-003] Retard de paiement — relances séquentielles
- **Déclencheur** : Cron `rent-reminders` (quotidien 9h)
- **Destinataire(s)** : Locataire (relance) + Propriétaire (info relance envoyée)
- **Canal(aux)** : In-app (cron) + Email (`sendPaymentReminder()`)
- **Niveaux** : J+5 (rappel amical), J+10 (second rappel), J+15 (mise en demeure, statut → 'late'), J+30 (dernier avertissement)
- **Données dynamiques** : `tenantName`, `amount`, `dueDate`, `daysLate`, `invoiceUrl`
- **État** : ✅ Fonctionnel
- **Notes** : `notifyPaymentLate()` dans notification-service.ts disponible aussi en standalone

#### [PAY-004] Loyer dû (rappel avant échéance)
- **État** : ❌ NON TROUVÉ — Pas de rappel J-5 ou J-3 avant échéance

#### [PAY-005] Quittance générée/disponible
- **État** : ⚠️ Partiel — La facture créée est notifiée mais pas spécifiquement la quittance dématérialisée

#### [PAY-006] Régularisation charges
- **État** : ❌ NON TROUVÉ

#### [PAY-007] Dépôt de garantie reçu/restitué
- **État** : ❌ NON TROUVÉ

#### [PAY-008] Stripe Connect events
- **État** : ❌ NON TROUVÉ — Pas de notification pour : paiement échoué Stripe, compte à vérifier, virement effectué

#### [PAY-009] Avis d'échéance généré
- **État** : ❌ NON TROUVÉ

### E. Incidents & Maintenance

#### [TICK-001] Incident signalé par locataire
- **Déclencheur** : Trigger `notify_ticket_created` (INSERT sur tickets)
- **Destinataire(s)** : Propriétaire
- **Canal(aux)** : In-app (trigger) + Email (`sendNewTicketNotification()`)
- **Template** : `resend.service.ts` → `sendNewTicketNotification()`
- **Données dynamiques** : `recipientName`, `ticketTitle`, `ticketDescription`, `priority`, `propertyAddress`, `createdBy`
- **État** : ✅ Fonctionnel

#### [TICK-002] Ticket mis à jour
- **Déclencheur** : Trigger `notify_tenant_ticket_updated` (UPDATE sur tickets, status change)
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app (trigger) + Email (`sendTicketUpdateNotification()`)
- **État** : ✅ Fonctionnel

#### [TICK-003] Ticket résolu
- **Déclencheur** : Trigger `notify_ticket_resolved` (UPDATE tickets, status → 'resolved')
- **Destinataire(s)** : Créateur du ticket
- **Canal(aux)** : In-app
- **État** : ✅ Fonctionnel

#### [TICK-004] Incident assigné à prestataire
- **État** : ❌ NON TROUVÉ

#### [TICK-005] Devis soumis par prestataire
- **État** : ❌ NON TROUVÉ

#### [TICK-006] Devis accepté/refusé
- **État** : ❌ NON TROUVÉ

#### [TICK-007] Intervention planifiée/terminée
- **État** : ❌ NON TROUVÉ — Type `maintenance_scheduled` existe dans la config mais aucun trigger/envoi

#### [TICK-008] Facture prestataire soumise/validée
- **État** : ❌ NON TROUVÉ

### F. Documents & Signature

#### [DOC-001] Document uploadé/partagé
- **Déclencheur** : Trigger `notify_tenant_document_uploaded` + `notify_tenant_document_center_update`
- **Destinataire(s)** : Locataire
- **Canal(aux)** : In-app
- **Types** : `document_uploaded`, `document_lease_added`, `document_receipt_added`, `document_edl_added`, `document_added`, `document_center_update`
- **État** : ✅ Fonctionnel

#### [DOC-002] Signature demandée
- **Cf. [BAIL-001]** — ✅ Fonctionnel (email + in-app)

#### [DOC-003] Document signé
- **Cf. [BAIL-002]** — ✅ Fonctionnel pour baux

#### [DOC-004] Signature expirée (rappel)
- **État** : ❌ NON TROUVÉ

#### [DOC-005] Document expiré (assurance, diagnostic)
- **État** : ❌ NON TROUVÉ

### G. Communication

#### [MSG-001] Message interne reçu
- **Déclencheur** : `notifyMessageReceived()` dans notification-service.ts
- **Destinataire(s)** : Destinataire du message
- **Canal(aux)** : In-app + Push (config par défaut)
- **Données dynamiques** : `senderName`, `messagePreview`, `conversationId`
- **État** : ✅ Fonctionnel (fonction disponible, push non effectif)

#### [MSG-002] Rappel RDV/visite
- **Déclencheur** : `sendVisitReminder()` dans resend.service.ts
- **Destinataire(s)** : Propriétaire + Locataire
- **Canal(aux)** : Email
- **Données dynamiques** : `recipientName`, `propertyAddress`, `visitDate`, `visitTime`, `hoursBeforeVisit`, `contactName`, `contactPhone`
- **État** : ✅ Fonctionnel

#### [MSG-003] Demande de visite
- **Déclencheur** : `sendVisitBookingRequest()` / `sendVisitBookingConfirmed()` / `sendVisitBookingCancelled()`
- **Canal(aux)** : Email
- **État** : ✅ Fonctionnel (3 emails : demande, confirmation, annulation)

#### [MSG-004] Feedback post-visite
- **Déclencheur** : `sendVisitFeedbackRequest()`
- **Canal(aux)** : Email
- **État** : ✅ Fonctionnel

### H. Abonnement & Facturation Plateforme

#### [SUB-001] Période d'essai (bienvenue, J-7, J-1, fin)
- **État** : ❌ NON TROUVÉ

#### [SUB-002] Abonnement activé/changé/annulé
- **État** : ❌ NON TROUVÉ

#### [SUB-003] Paiement abonnement échoué
- **État** : ❌ NON TROUVÉ

#### [SUB-004] Facture plateforme disponible
- **État** : ❌ NON TROUVÉ

#### [SUB-005] Limites plan approchées/atteintes
- **État** : ❌ NON TROUVÉ

### I. Légal & Conformité

#### [LEGAL-001] CGU/CGV mises à jour
- **État** : ❌ NON TROUVÉ

#### [LEGAL-002] Politique confidentialité modifiée
- **État** : ❌ NON TROUVÉ

#### [LEGAL-003] Données personnelles exportées (RGPD)
- **État** : ❌ NON TROUVÉ

#### [LEGAL-004] Demande suppression compte traitée
- **État** : ❌ NON TROUVÉ

### J. Prestataire

#### [PROV-001] Mission reçue
- **État** : ❌ NON TROUVÉ — **Aucune notification prestataire n'existe**

#### [PROV-002] Rappel intervention
- **État** : ❌ NON TROUVÉ

#### [PROV-003] Paiement reçu prestataire
- **État** : ❌ NON TROUVÉ

---

## PHASE 3 — MATRICE GAP ANALYSIS

### Légende
- **Priorité** : P0 = Obligation légale/critique | P1 = Standard marché | P2 = Différenciateur | P3 = Nice-to-have
- **Effort** : XS < 2h | S = 2-8h | M = 1-3j | L = 3-5j | XL > 5j
- **Impact** : Critique / Élevé / Moyen / Faible

### Notifications manquantes

| ID | Notification | Priorité | Existante | Canal actuel | Canal cible | Effort | Impact |
|----|-------------|----------|-----------|-------------|------------|--------|--------|
| **N-001** | Loyer dû rappel J-5 avant échéance | P0 | ❌ | — | Email+Push+InApp | S | Critique |
| **N-002** | Quittance dématérialisée disponible | P0 | ⚠️ | InApp (facture) | Email+InApp | S | Critique |
| **N-003** | Révision loyer annuelle IRL/ILAT | P0 | ⚠️ Config seulement | — | Email+InApp | M | Critique |
| **N-004** | Régularisation charges annuelle | P0 | ❌ | — | Email+InApp | M | Critique |
| **N-005** | Restitution dépôt garantie (rappel 1/2 mois) | P0 | ❌ | — | Email+InApp | M | Critique |
| **N-006** | Diagnostics obligatoires expirés (DPE, amiante, etc.) | P0 | ❌ | — | Email+InApp | M | Critique |
| **N-007** | Trêve hivernale rappel (1er nov - 31 mars) | P0 | ❌ | — | InApp+Email | S | Critique |
| **N-008** | Encadrement loyers zone tendue — dépassement | P0 | ❌ | — | InApp+Email | M | Critique |
| **N-009** | Congé donné (propriétaire ou locataire) | P0 | ❌ | — | Email+InApp+Push | M | Critique |
| **N-010** | Dispatcher multi-canal unifié | P0 | ❌ | — | Infrastructure | XL | Critique |
| **N-011** | Preference checker avant envoi | P0 | ❌ | — | Infrastructure | M | Critique |
| **N-012** | Lien désinscription one-click (RFC 8058) | P0 | ❌ | — | Email | M | Critique |
| **N-013** | Prestataire : mission reçue | P1 | ❌ | — | Email+InApp+Push | M | Élevé |
| **N-014** | Prestataire : devis accepté/refusé | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-015** | Prestataire : intervention planifiée | P1 | ❌ | — | Email+InApp+Push | S | Élevé |
| **N-016** | Prestataire : paiement reçu | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-017** | Propriétaire : devis soumis par prestataire | P1 | ❌ | — | Email+InApp+Push | S | Élevé |
| **N-018** | Intervention terminée | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-019** | Facture prestataire soumise | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-020** | Stripe Connect : paiement échoué | P1 | ❌ | — | Email+InApp+Push | M | Élevé |
| **N-021** | Stripe Connect : compte à vérifier | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-022** | Stripe Connect : virement effectué | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-023** | Dépôt garantie reçu/restitué | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-024** | Signature expirée rappel | P1 | ❌ | — | Email+InApp+Push | S | Élevé |
| **N-025** | Document expiré (assurance, diagnostic) | P1 | ❌ | — | Email+InApp | M | Élevé |
| **N-026** | Bail expiry → email en plus d'in-app | P1 | ⚠️ InApp only | InApp | Email+InApp+Push | S | Élevé |
| **N-027** | Rent reminders → email en plus d'in-app | P1 | ⚠️ InApp only (cron) | InApp | Email+InApp | S | Élevé |
| **N-028** | Avenant bail créé/signé | P1 | ❌ | — | Email+InApp | S | Moyen |
| **N-029** | Connexion nouveau device | P1 | ❌ | — | Email | S | Moyen |
| **N-030** | Abonnement : trial bienvenue/J-7/J-1/fin | P1 | ❌ | — | Email+InApp | M | Élevé |
| **N-031** | Abonnement : activé/changé/annulé | P1 | ❌ | — | Email+InApp | M | Élevé |
| **N-032** | Paiement abonnement échoué | P1 | ❌ | — | Email+InApp+Push | S | Élevé |
| **N-033** | Facture plateforme disponible | P1 | ❌ | — | Email+InApp | S | Moyen |
| **N-034** | Limites plan approchées/atteintes | P1 | ❌ | — | InApp+Email | S | Moyen |
| **N-035** | Web Push avec Service Worker (VAPID) | P1 | ❌ | — | Infrastructure | L | Élevé |
| **N-036** | Digest configurable (quotidien/hebdo) | P2 | ❌ | — | Email | L | Moyen |
| **N-037** | Centre préférences frontend granulaire | P2 | ⚠️ API seulement | — | Frontend | L | Moyen |
| **N-038** | Historique notifications searchable | P2 | ⚠️ Page basique | — | Frontend | M | Moyen |
| **N-039** | Groupement intelligent (batch) | P2 | ❌ | — | Infrastructure | L | Moyen |
| **N-040** | Snooze / rappel ultérieur | P2 | ❌ | — | Frontend+Backend | M | Faible |
| **N-041** | Analytics notifications (taux ouverture/clic) | P2 | ❌ | — | Infrastructure | L | Moyen |
| **N-042** | Mode silencieux / DND programmable | P2 | ⚠️ DB seulement | — | Frontend+Backend | M | Faible |
| **N-043** | Webhooks sortants (intégrations tierces) | P2 | ⚠️ webhook_queue | — | Infrastructure | M | Moyen |
| **N-044** | Escalation auto (notif→relance→alerte urgente) | P2 | ❌ | — | Infrastructure | L | Moyen |
| **N-045** | Accessibilité WCAG 2.2 AA (aria-live) | P2 | ⚠️ Partiel | — | Frontend | M | Moyen |
| **N-046** | i18n ready (FR/EN/créole DOM-TOM) | P2 | ❌ | — | Infrastructure | XL | Moyen |
| **N-047** | Double opt-in email (RGPD) | P2 | ❌ | — | Backend | M | Moyen |
| **N-048** | Journalisation audit trail envois | P2 | ⚠️ email_logs | — | Backend | M | Moyen |
| **N-049** | Data retention policy notifications | P2 | ❌ | — | Backend (pg_cron) | S | Faible |
| **N-050** | Droit à l'oubli appliqué aux notifications | P2 | ❌ | — | Backend | S | Faible |
| **N-051** | CGU/CGV mises à jour | P3 | ❌ | — | Email+InApp | S | Faible |
| **N-052** | Politique confidentialité modifiée | P3 | ❌ | — | Email+InApp | S | Faible |
| **N-053** | Données exportées RGPD | P3 | ❌ | — | Email | S | Faible |
| **N-054** | Demande suppression traitée | P3 | ❌ | — | Email | S | Faible |
| **N-055** | Permis de louer (communes) | P3 | ❌ | — | InApp+Email | S | Faible |
| **N-056** | Décence logement non-conformité | P3 | ❌ | — | InApp+Email | M | Faible |
| **N-057** | A/B testing templates | P3 | ❌ | — | Infrastructure | XL | Faible |
| **N-058** | Annonce propriétaire → locataires | P3 | ❌ | — | Email+InApp | M | Faible |

---

## PHASE 4 — ARCHITECTURE CIBLE & ROADMAP

### 4.1 Architecture Notifications SOTA 2026

#### A. Modèle de données Supabase — Nettoyage + Extensions

```sql
-- ============================================
-- MIGRATION: Normalisation table notifications
-- ============================================

-- 1. Ajouter les colonnes manquantes de manière cohérente
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id),
  ADD COLUMN IF NOT EXISTS template_code TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS group_key TEXT,  -- Pour groupement/digest
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed','cancelled','snoozed'));

-- Index pour digest/groupement
CREATE INDEX IF NOT EXISTS idx_notifications_group_key ON notifications(group_key) WHERE group_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_snoozed ON notifications(snoozed_until) WHERE snoozed_until IS NOT NULL;

-- ============================================
-- TABLE: notification_logs (audit trail envois)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','push')),
  status TEXT NOT NULL CHECK (status IN ('pending','sent','delivered','bounced','failed','clicked')),
  provider TEXT, -- 'resend', 'twilio', 'web_push'
  provider_message_id TEXT,
  recipient_address TEXT, -- email or phone (hashed for RGPD)
  attempts INTEGER DEFAULT 1,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_logs_notification ON notification_logs(notification_id);
CREATE INDEX idx_notification_logs_channel ON notification_logs(channel, status);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
-- Service role only
CREATE POLICY "Service role only" ON notification_logs FOR ALL USING (false);

-- ============================================
-- TABLE: notification_schedules (digest + programmées)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('digest','recurring','one_time')),
  cron_expression TEXT, -- Pour recurring: '0 8 * * 1' (lundi 8h)
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'Europe/Paris',
  config JSONB DEFAULT '{}', -- Paramètres spécifiques
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_schedules_next ON notification_schedules(next_run_at) WHERE is_active = true;

-- ============================================
-- TABLE: notification_rules (routage)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL, -- 'payment_received', 'lease_ending', etc.
  conditions JSONB DEFAULT '{}', -- Conditions supplémentaires
  channels TEXT[] NOT NULL DEFAULT '{in_app}',
  priority TEXT DEFAULT 'normal',
  template_code TEXT,
  fallback_channels TEXT[], -- Canaux de fallback
  escalation_delay_minutes INTEGER, -- Délai avant escalation
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### B. Service de notification unifié

```typescript
// lib/services/unified-notification-service.ts
// Architecture du NotificationService unifié

interface NotificationDispatchRequest {
  templateCode: string;
  recipientId: string;        // profile_id
  variables: Record<string, string>;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];  // Override canaux
  priority?: NotificationPriority;
  scheduledAt?: Date;         // Envoi différé
  groupKey?: string;          // Clé de groupement/digest
}

interface NotificationDispatcher {
  // 1. Résoudre le template → contenu par canal
  // 2. Vérifier les préférences utilisateur (opt-in/opt-out)
  // 3. Vérifier quiet hours + timezone
  // 4. Vérifier rate-limit
  // 5. Pour chaque canal autorisé:
  //    a. in_app → INSERT notifications
  //    b. email → Resend via queue
  //    c. sms → Twilio via queue
  //    d. push → Web Push via Service Worker
  // 6. Fallback si canal primaire échoue
  // 7. Logger dans notification_logs
  // 8. Tracker analytics (ouverture, clic)
  dispatch(request: NotificationDispatchRequest): Promise<DispatchResult>;
}

// Registry de templates (code→config)
// Router multi-canal avec fallback
// Template engine avec variables dynamiques
// Queue avec retry et dead-letter (webhook_queue existant)
// Preference checker (lecture notification_preferences)
// Rate limiter par utilisateur et canal
// Timezone handler DOM-TOM aware
// Analytics tracker
```

#### C. Composants Frontend

```
Composants nécessaires:
├── NotificationProvider          # Context + Supabase Realtime (existant dans useNotifications)
├── NotificationBell              # ✅ Existe (notification-center.tsx)
├── NotificationList              # ✅ Existe (dans le dropdown, à extraire pour page dédiée)
├── NotificationItem              # ✅ Existe (à enrichir avec swipe actions)
├── NotificationPreferencesPage   # 🆕 Page settings granulaire par type/canal
├── NotificationHistoryPage       # 🆕 Page complète avec recherche/filtres
├── NotificationToast             # ✅ Existe (via useToast)
├── NotificationSnooze            # 🆕 Dialog snooze avec date picker
├── NotificationDigestSettings    # 🆕 Config digest (instant/daily/weekly)
└── useNotifications()            # ✅ Existe (hook Realtime)
```

#### D. API Routes nécessaires

```
Routes existantes:
  ✅ GET    /api/notifications                    — Liste
  ✅ POST   /api/notifications                    — Créer (admin)
  ✅ PATCH  /api/notifications                    — Mark read
  ✅ DELETE /api/notifications                    — Supprimer
  ✅ GET    /api/notifications/preferences        — Préférences
  ✅ PUT    /api/notifications/preferences        — Modifier préférences

Routes manquantes:
  🆕 POST   /api/notifications/dispatch           — Envoi unifié multi-canal
  🆕 POST   /api/notifications/subscribe-push     — Enregistrer subscription Web Push
  🆕 DELETE /api/notifications/subscribe-push     — Supprimer subscription
  🆕 GET    /api/notifications/unsubscribe/[token]— Désinscription one-click email
  🆕 POST   /api/notifications/snooze/[id]        — Snooze une notification
  🆕 GET    /api/notifications/digest             — Récupérer le digest
  🆕 POST   /api/notifications/test               — Envoyer une notification test (admin)
```

### 4.2 Roadmap d'implémentation

| Sprint | Durée | Focus | Notifications couvertes | Dépendances |
|--------|-------|-------|------------------------|-------------|
| **S1** | 2 sem | **Infrastructure + P0 légales** | N-010 (dispatcher unifié), N-011 (preference checker), N-012 (désinscription), N-001 (loyer dû J-5), N-003 (révision IRL), N-005 (dépôt garantie), N-006 (diagnostics expirés), N-007 (trêve hivernale), N-009 (congé) | Normalisation schema notifications, nettoyage colonnes dupliquées |
| **S2** | 2 sem | **Paiements + Baux + Stripe** | N-002 (quittance), N-004 (régularisation charges), N-008 (encadrement loyers), N-020/N-021/N-022 (Stripe Connect), N-023 (dépôt garantie), N-024 (signature expirée), N-026/N-027 (multi-canal crons existants), N-030/N-031/N-032/N-033 (abonnement) | Stripe webhooks, cron modifications |
| **S3** | 2 sem | **Prestataire + Multi-canal + Push** | N-013 à N-019 (toutes notifs prestataire), N-025 (documents expirés), N-028 (avenant), N-029 (nouveau device), N-035 (Web Push VAPID + Service Worker) | Setup VAPID keys, Service Worker, notification_logs |
| **S4** | 2 sem | **Préférences UI + Analytics + P2** | N-036 (digest), N-037 (préférences frontend), N-038 (historique searchable), N-039 (groupement), N-040 (snooze), N-041 (analytics), N-042 (DND), N-044 (escalation), N-045 (a11y), N-047 (double opt-in), N-048/N-049/N-050 (RGPD) | Analytics setup |

### 4.3 Quick Wins (< 1 jour chacun)

Les 10 notifications les plus impactantes à implémenter immédiatement :

| # | Notification | Effort | Pourquoi c'est un quick win |
|---|-------------|--------|----------------------------|
| 1 | **N-001 : Loyer dû J-5** | 2-3h | Ajouter un check dans le cron `rent-reminders` existant pour `daysUntilDue <= 5` au lieu de seulement `daysLate >= 5`. |
| 2 | **N-026 : Bail expiry → ajouter email** | 2h | Appeler `sendEmail()` dans le cron `lease-expiry-alerts` existant en plus de l'insert in-app. |
| 3 | **N-027 : Rent reminders → ajouter email** | 2h | Appeler `sendPaymentReminder()` dans le cron `rent-reminders` en plus de l'insert in-app. |
| 4 | **N-012 : Header List-Unsubscribe** | 3h | Ajouter header `List-Unsubscribe` et `List-Unsubscribe-Post` dans `sendEmail()` + route GET `/api/notifications/unsubscribe/[token]`. |
| 5 | **N-011 : Preference checker basique** | 4h | Avant chaque `sendEmail()`/`sendSMS()`, vérifier `notification_preferences.email_enabled`/`sms_enabled` du destinataire. |
| 6 | **N-007 : Trêve hivernale rappel** | 2h | Notification système programmée le 25 octobre pour tous les propriétaires, rappelant la suspension des procédures d'expulsion du 1er nov au 31 mars. |
| 7 | **N-013 : Prestataire mission reçue** | 4h | Trigger PostgreSQL sur INSERT `work_orders` → notification in-app au prestataire + email si email_enabled. |
| 8 | **N-023 : Dépôt garantie** | 3h | Notification in-app au propriétaire quand `daysAfterLeaseEnd` = 25 jours (rappel avant deadline légale 1 mois). |
| 9 | **N-029 : Connexion nouveau device** | 3h | Comparer `user_agent` lors du login via `auth.onAuthStateChange` et notifier par email si device inconnu. |
| 10 | **N-002 : Quittance disponible** | 2h | Ajouter une notification `quittance_available` dans le flow existant de génération de quittance, distincte de la facture. |

---

## ANNEXE A — Schema SQL complet proposé

Voir section 4.1.A ci-dessus pour les migrations SQL complètes. Tables supplémentaires proposées :
- `notification_logs` — Audit trail exhaustif par canal
- `notification_schedules` — Planification digest et récurrentes
- `notification_rules` — Routage conditionnel

Tables existantes à normaliser :
- `notifications` — Unifier `user_id`/`profile_id`/`recipient_id` vers `profile_id` seul + migration des anciennes données
- `notifications` — Unifier `read`/`is_read` vers `is_read` seul
- `notifications` — Unifier `message`/`body` vers `message` seul
- `notifications` — Unifier `link`/`action_url` vers `action_url` seul

---

## ANNEXE B — Estimation effort total

| Phase | Effort (j/h) | Détail |
|-------|-------------|--------|
| Schema normalisation + dispatcher unifié | 5j | Migration colonnes, NotificationDispatcher, preference checker |
| Notifications P0 légales (9 notifs) | 6j | Révision IRL, régularisation, dépôt garantie, diagnostics, trêve, congé, encadrement, quittance, loyer dû |
| Notifications prestataire (7 notifs) | 4j | Mission, devis, intervention, facturation |
| Notifications Stripe Connect (3 notifs) | 3j | Webhooks Stripe → notifications |
| Notifications abonnement (5 notifs) | 3j | Trial, activation, échec paiement |
| Web Push + Service Worker | 4j | VAPID setup, Service Worker, subscription management |
| Multi-canal emails crons existants | 2j | Ajouter email aux crons lease-expiry + rent-reminders |
| Frontend préférences + historique | 4j | Page préférences granulaire, page historique searchable |
| Digest system | 3j | Cron digest quotidien/hebdo, agrégation, template email digest |
| Analytics + audit trail | 3j | notification_logs, tracking ouverture/clic |
| RGPD compliance | 2j | Double opt-in, désinscription one-click, data retention, droit oubli |
| Tests | 3j | Tests unitaires services, tests intégration API |
| **TOTAL** | **~42 j/h** | **~8.5 semaines à 1 dev** |

---

## ANNEXE C — Risques et dépendances

### Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|------------|--------|------------|
| Schema dual `user_id`/`profile_id` crée des notifications orphelines | Haute | Élevé | Migration de normalisation en S1 avec backfill |
| Rate limiting SMS inexistant → coûts Twilio explosifs | Moyenne | Élevé | Implémenter rate-limit SMS avant activation massive |
| Push notifications sans Service Worker → aucune notification en background | Haute | Moyen | Implémenter Web Push VAPID en S3 |
| Crons sans monitoring → échecs silencieux | Moyenne | Élevé | Ajouter alerting sur `audit_log` erreurs cron |
| Templates email hardcodés en TypeScript → modification nécessite déploiement | Basse | Faible | La table `email_templates` existe déjà, migrer les templates progressivement |
| Pas de preference checker → emails envoyés à des utilisateurs opt-out | Haute | Critique (RGPD) | **Priorité S1** — implémenter avant tout nouvel envoi email |

### Dépendances externes

| Dépendance | Service | Statut | Action requise |
|------------|---------|--------|----------------|
| Resend API | Email transactionnel | ✅ Configuré | Vérifier SPF/DKIM/DMARC sur talok.fr |
| Twilio | SMS | ✅ Configuré (DB ou env) | Vérifier crédits, activer rate-limit |
| VAPID Keys | Web Push | ❌ Non configuré | Générer paire VAPID, configurer env |
| Stripe Webhooks | Events paiement | ⚠️ Partiel | Ajouter handlers pour `payment_intent.failed`, `account.updated`, `payout.paid` |
| Netlify Scheduled Functions | Crons | ✅ Configuré | Vérifier scheduling `lease-expiry-alerts` (lundi 8h) et `rent-reminders` (quotidien 9h) |
| Indice IRL/ILAT | Révision loyers | ❌ Non intégré | API INSEE ou saisie manuelle nécessaire |
| Base communes zones tendues | Encadrement loyers | ❌ Non intégré | Référentiel Open Data nécessaire |

---

*Document généré le 23 février 2026 — Audit SOTA Notifications Talok v1.0*
