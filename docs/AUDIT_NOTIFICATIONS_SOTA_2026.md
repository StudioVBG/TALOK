# AUDIT SYSTÈME DE NOTIFICATIONS TALOK — SOTA 2026

**Date** : 23 février 2026
**Version** : 2.0
**Auditeur** : Claude Code (Opus 4.6)
**Périmètre** : Codebase complet Talok — 15 migrations, 14 crons, 3 webhook handlers, 10 Edge Functions, 22 templates email, 12 triggers PostgreSQL, composants frontend

---

## 1. RÉSUMÉ EXÉCUTIF

Le système de notifications Talok dispose d'une **infrastructure riche mais fragmentée**. L'architecture couvre 4 canaux (in-app via Supabase Realtime, email via Resend avec retry/rate-limiting, SMS via Twilio avec support DOM-TOM complet, push navigateur basique), **12 triggers PostgreSQL** automatiques, **14 crons** (rappels paiement J-3/J-1/J+1/J+7, retards J+5/J+10/J+15/J+30, expiration baux J-90→J-7, abonnements, onboarding, CNI, visites, indexation IRL), **31 templates email** éditables en DB avec versioning, et un **outbox pattern** pour l'event sourcing.

**Points forts** : couverture paiements et baux solide, double système de relance (outbox + crons directs), templates email complets avec admin UI, SMS DOM-TOM natif, branded/white-label emails.

**Faiblesses critiques** : schema `notifications` avec 6 colonnes dupliquées issues de 15 migrations successives (`user_id`/`recipient_id`/`profile_id`, `read`/`is_read`, `message`/`body`, `link`/`action_url`), **aucun dispatcher multi-canal unifié** (les channels sont stockés mais jamais routés), **préférences utilisateur jamais consultées** avant envoi (risque RGPD), **zéro notification prestataire**, push sans Service Worker, notifications légales manquantes (régularisation charges, dépôt garantie, encadrement loyers, trêve hivernale, congé). Effort estimé : **38-45 j/h** sur 4 sprints.

---

## 2. PHASE 1 — CARTOGRAPHIE TECHNIQUE COMPLÈTE

### 2.1 Infrastructure Notifications

| Élément | Existe ? | Fichier(s) | État | Notes |
|---------|----------|------------|------|-------|
| **Table `notifications`** | ✅ | `supabase/migrations/20240101000021` + 10 migrations correctrices | Fonctionnel | 19 colonnes dont 6 dupliquées. RLS activé (3 stratégies coexistantes : `user_id`, `recipient_id`, `profile_id`). Realtime publié. |
| **Table `notification_preferences`** | ✅ | `supabase/migrations/20251205600000` | Fonctionnel | Canaux (in_app/email/sms/push), quiet_hours, email_digest_frequency, disabled_templates. UNIQUE(profile_id). |
| **Table `email_templates`** | ✅ | `supabase/migrations/20260212100001` | Fonctionnel | 31 templates seedés. Versioning auto (`email_template_versions`). Admin UI complète. |
| **Table `email_logs`** | ✅ | `supabase/migrations/20260212100001` | Fonctionnel | Audit trail : template_slug, recipient_email, variables_used, status (sent/failed/bounced), sent_at. |
| **Table `email_template_versions`** | ✅ | `supabase/migrations/20260212100001` | Fonctionnel | Archive automatique via trigger BEFORE UPDATE. |
| **Table `webhook_queue`** | ✅ | `supabase/migrations/20260128010001` | Fonctionnel | Outbox pattern. Retry 5x max, statuts pending/processing/success/failed/dead_letter. Cleanup auto 30j. |
| **Table `outbox`** | ✅ | Utilisée par `payment-reminders` cron + Stripe webhook | Fonctionnel | Event sourcing : Payment.ReminderFriendly/Urgent/Late/LateFormal, Payment.Succeeded/Received, Owner.TenantPaymentLate. |
| **Table `sms_messages`** | ✅ | `supabase/migrations/20260209100000` | Fonctionnel | Tracking Twilio : sid, status (queued/sent/delivered/undelivered/failed), segments, error_code. |
| **Table `cni_expiry_notifications`** | ✅ | `app/api/cron/check-cni-expiry/route.ts` | Fonctionnel | Dédoublonnage par document_id + notification_type (contrainte unique). |
| **Table `onboarding_reminders`** | ✅ | `features/onboarding/services/onboarding-notifications.service.ts` | Fonctionnel | Rappels programmés 24h/72h/7j. Statuts pending/sent/cancelled. |
| **Table `end_of_lease_processes`** | ✅ | `supabase/migrations/20251204700000` | Fonctionnel | Processus fin de bail : notice, dépôt, inspection, clés. |
| **Service email (Resend)** | ✅ | `lib/emails/resend.service.ts` (650+ lignes) | Fonctionnel | Retry 3x backoff exponentiel (1s→2s→4s, max 10s, ±25% jitter). Rate-limit 5/min/dest, 100/min global, 20/h/dest, 500/h global. Validation RFC 5322 + blocage jetables. 16 fonctions d'envoi. |
| **Templates email (code)** | ✅ | `lib/emails/templates.ts` (1500+ lignes) | Fonctionnel | 22 templates TypeScript avec HTML complet. Design system cohérent (Inter, couleurs Primary #2563eb). |
| **Templates email (DB)** | ✅ | `supabase/migrations/20260212100002` (seed) | Fonctionnel | 31 templates : 4 auth, 3 invitation, 3 lease, 4 payment, 3 document, 2 EDL, 5 incident, 5 subscription, 1 messaging, 1 report. |
| **Branded email service** | ✅ | `lib/emails/branded-email.service.ts` (320 lignes) | Fonctionnel | White-label : logo, couleurs, footer custom par organisation. |
| **Admin email templates UI** | ✅ | `app/admin/email-templates/` | Fonctionnel | CRUD templates, preview, test send, version history. |
| **Service SMS (Twilio)** | ✅ | `lib/services/sms.service.ts` | Fonctionnel | DOM-TOM complet : Martinique +596, Guadeloupe +590, Réunion +262, Guyane +594, Mayotte +262. Mode simulation dev. Credentials DB ou env. |
| **Webhook Twilio** | ✅ | `app/api/webhooks/twilio/route.ts` | Fonctionnel | HMAC-SHA1 signature. Tracking statut SMS. Désactivation auto SMS sur erreur permanente (30003/30004/30005). |
| **Push notifications** | ⚠️ | `lib/hooks/use-push-notifications.ts` | Partiel | Web Notification API locale uniquement. Pas de Service Worker, pas de Web Push VAPID côté serveur. Package `web-push` installé mais non utilisé. `VAPID_*` env vars définies mais pas de code d'envoi serveur. |
| **PWA / next-pwa** | ⚠️ | `next.config.js` (next-pwa@5.6.0) | Partiel | Configuré avec `register: true, skipWaiting: true`. Mais **désactivé sur Netlify** (`NETLIFY=true`). Service Worker généré mais push non implémenté. |
| **Supabase Realtime** | ✅ | `lib/hooks/use-notifications.ts` | Fonctionnel | postgres_changes sur INSERT/UPDATE/DELETE. Filtre `user_id`. Toast + son optionnel. Mise à jour optimiste. |
| **Triggers PostgreSQL (Owner)** | ✅ | `supabase/migrations/20251205000001` | Fonctionnel | 5 triggers : `notify_invoice_late`, `notify_payment_received`, `notify_lease_signed`, `notify_ticket_created`, `notify_ticket_resolved`. |
| **Triggers PostgreSQL (Tenant)** | ✅ | `supabase/migrations/20260108200000` | Fonctionnel | 7 triggers : `notify_tenant_lease_updated`, `notify_tenant_invoice_created`, `notify_tenant_document_uploaded`, `notify_tenant_owner_signed`, `notify_tenant_edl_scheduled`, `notify_tenant_signature_requested`, `notify_tenant_ticket_updated`. |
| **Trigger document → owner** | ✅ | `supabase/migrations/20260223000003` | Fonctionnel | `notify_owner_on_tenant_document` : quand locataire upload un document (assurance, CNI, etc.). |
| **Trigger tenant account created** | ✅ | `supabase/migrations/20260219100000` | Fonctionnel | `auto_link_lease_signers_on_profile_created` : notifie le propriétaire quand un locataire crée son compte. |
| **Cron payment-reminders** | ✅ | `app/api/cron/payment-reminders/route.ts` | Fonctionnel | J-3 (amical), J-1 (urgent), J+1 (retard), J+7 (formel). Outbox events. Notifie propriétaire sur J+1/J+7. |
| **Cron rent-reminders** | ✅ | `app/api/cron/rent-reminders/route.ts` | Fonctionnel | J+5/J+10/J+15/J+30. Notifications directes DB. Marque factures "late" à J+15. Audit trail. |
| **Cron lease-expiry-alerts** | ✅ | `app/api/cron/lease-expiry-alerts/route.ts` | Fonctionnel | J-90/60/30/15/7 (±3j tolérance). Propriétaire (tous paliers) + locataire (≤30j). Dédoublonnage. |
| **Cron subscription-alerts** | ✅ | `app/api/cron/subscription-alerts/route.ts` | Fonctionnel | Trial ending J-3, renouvellement J-7, annulation expiring J-7. Dédoublonnage. |
| **Cron check-cni-expiry** | ✅ | `app/api/cron/check-cni-expiry/route.ts` | Fonctionnel | J-30/15/7/expiré. Email + in-app. Locataire + propriétaire. Révocation `cni_verified_at` si expiré. |
| **Cron onboarding-reminders** | ✅ | `app/api/cron/onboarding-reminders/route.ts` | Fonctionnel | Templates email 24h/72h/7j. Batch 100/run. Vérifie complétion avant envoi. |
| **Cron visit-reminders** | ✅ | `app/api/cron/visit-reminders/route.ts` | Fonctionnel | H-24 et H-1. Email locataire + propriétaire. Flags `reminder_24h_sent`/`reminder_1h_sent`. |
| **Cron irl-indexation** | ✅ | `app/api/cron/irl-indexation/route.ts` | Fonctionnel | Calcul révision IRL mensuelle pour baux à anniversaire. |
| **Cron notifications (générique)** | ✅ | `app/api/cron/notifications/route.ts` | Fonctionnel | Dispatcher via RPC `create_notification()`. Paiements J-5/J-1/J+1/J+7 + baux J-90/J-30/J-7. |
| **Cron process-webhooks** | ✅ | `app/api/cron/process-webhooks/route.ts` | Fonctionnel | Retry webhooks échoués + cleanup >30j. |
| **Cron generate-monthly-invoices** | ✅ | `app/api/cron/generate-monthly-invoices/route.ts` | Fonctionnel | 1er du mois 6h. Outbox events pour notifications async. |
| **Webhook Stripe** | ✅ | `app/api/webhooks/stripe/route.ts` (766 lignes) | Fonctionnel | 9 events : checkout.session.completed, payment_intent.succeeded/failed, invoice.paid, subscription.updated/deleted, account.updated, transfer.created/failed. |
| **Webhook payments** | ✅ | `app/api/webhooks/payments/route.ts` | Fonctionnel | payment_intent.succeeded/failed/canceled. In-app + email. |
| **Supabase Edge Functions** | ✅ | `supabase/functions/` (10 fonctions) | Fonctionnel | process-outbox, payment-reminders, monthly-invoicing, sepa-prenotification, sepa-auto-collect, generate-pdf, bank-sync, cleanup-exports, cleanup-orphans, analyze-documents. |
| **API notifications** | ✅ | `app/api/notifications/route.ts` | Fonctionnel | GET/POST/PATCH/DELETE. Filtre hybride `profile_id OR user_id`. Support template via RPC. |
| **API preferences** | ✅ | `app/api/notifications/preferences/route.ts` | Fonctionnel | GET/PUT. Validation Zod. Upsert on conflict. |
| **API email send** | ✅ | `app/api/emails/send/route.ts` | Fonctionnel | Auth : internal API key ou Supabase auth (admin/owner). Rate-limit headers. |
| **Service Worker** | ❌ | — | NON TROUVÉ | Généré par next-pwa mais push non implémenté. Désactivé sur Netlify. |
| **Database Webhooks Supabase** | ❌ | — | NON TROUVÉ | Pas de webhooks configurés via Dashboard/config. |
| **pg_cron** | ❌ | — | NON TROUVÉ | Remplacé par API routes cron + Netlify/Vercel scheduled functions. |
| **Analytics notifications** | ❌ | — | NON TROUVÉ | Aucun tracking taux ouverture/clic/action. |
| **i18n notifications** | ❌ | — | NON TROUVÉ | Tout en français hardcodé. |

### 2.2 Composants Frontend

| Élément | Existe ? | Fichier(s) | État | Notes |
|---------|----------|------------|------|-------|
| **NotificationCenter** | ✅ | `components/notifications/notification-center.tsx` | Fonctionnel | Popover + Bell icon + badge animé (99+) + tabs All/Non-lues + groupement par date + scroll area + mark read/all + lien settings + lien historique. Framer Motion. |
| **NotificationItem** | ✅ | `components/notifications/notification-center.tsx` (interne) | Fonctionnel | Icône par type, priorité colorée, indicateur non-lu, lien action, temps relatif. |
| **PushNotificationPrompt** | ✅ | `components/notifications/push-notification-prompt.tsx` | Fonctionnel | Prompt permission navigateur. |
| **Badge compteur** | ✅ | Intégré dans NotificationCenter | Fonctionnel | Badge rouge animé. Poll 30s. |
| **Toast system** | ✅ | `components/ui/toast.tsx` + `use-toast.ts` | Fonctionnel | Radix UI Toast. Limit 1. Auto-affiché via Realtime. |
| **Page /notifications** | ✅ | `app/notifications/page.tsx` | Fonctionnel | Centre in-app complet. API integration. Filtres par type (6 types). Mark read, delete. |
| **Page /tenant/notifications** | ✅ | `app/tenant/notifications/page.tsx` | Fonctionnel | Vue spécifique locataire. |
| **Page /settings/notifications** | ✅ | `app/settings/notifications/page.tsx` | Fonctionnel | Préférences par canal, catégorie, quiet hours, digest mode, per-template enable/disable. |
| **Hook `useNotifications`** | ✅ | `lib/hooks/use-notifications.ts` | Fonctionnel | Realtime Supabase, CRUD optimiste, son optionnel, toast auto. Fallback `user_id` si `recipient_id` échoue. |
| **Hook `usePushNotifications`** | ⚠️ | `lib/hooks/use-push-notifications.ts` | Partiel | Web Notification API locale. Pas de Service Worker. Pas de subscription serveur. |
| **Service notifications tenant** | ✅ | `features/tenant/services/notifications.service.ts` | Fonctionnel | Client-side avec Realtime subscription. |
| **Service notifications onboarding** | ✅ | `features/onboarding/services/onboarding-notifications.service.ts` | Fonctionnel | Welcome, step completed, almost done, completed, rappels. |
| **Email templates viewer** | ✅ | `components/emails/email-templates-viewer.tsx` | Fonctionnel | Preview admin avec données mock. |

### 2.3 Logique de Dispatch

| Élément | Existe ? | Fichier(s) | État | Notes |
|---------|----------|------------|------|-------|
| **Notification Service** | ✅ | `lib/services/notification-service.ts` | Fonctionnel | 15 types, 4 priorités, mapping type→{priority, channels, icon}. 5 fonctions prédéfinies. **Mais n'envoie que in-app** (insert DB). |
| **Outbox event sourcing** | ✅ | `app/api/cron/payment-reminders/` + `supabase/functions/process-outbox/` | Fonctionnel | Reliable delivery. Retry 2/4/8 min. Types : Rent.InvoiceIssued, Payment.*, Ticket.Opened, Lease.Activated. |
| **Config type→canaux** | ✅ | `lib/services/notification-service.ts:66-146` | Fonctionnel | Ex: `payment_late` → urgent → [in_app, email, push, sms]. **Mais jamais exécuté** — channels stockés, pas routés. |
| **Routage multi-canal réel** | ❌ | — | NON TROUVÉ | Chaque cron/webhook appelle indépendamment insert DB + sendEmail. Pas de dispatcher unifié. |
| **Fallback intelligent** | ❌ | — | NON TROUVÉ | Pas de logique in_app→push→email→SMS. |
| **Preference checker** | ❌ | — | NON TROUVÉ | `notification_preferences` jamais consultées avant envoi. **Risque RGPD**. |
| **Rate limiting in-app/SMS** | ❌ | — | NON TROUVÉ | Rate-limit email seulement. |
| **Timezone DOM-TOM** | ⚠️ | `notification_preferences.quiet_hours_timezone` (DB) + SMS indicatifs | Partiel | Champ existe mais non utilisé à l'envoi. |
| **Digest** | ⚠️ | `notification_preferences.email_digest_frequency` (DB) | Partiel | Champ "instant/daily/weekly" existe mais aucun cron de digest. |
| **Escalation automatique** | ⚠️ | Crons rent-reminders + payment-reminders | Partiel | Escalation séquentielle J+5→J+30, mais pas de changement de canal. |

---

## 3. PHASE 2 — ÉTAT DES NOTIFICATIONS EXISTANTES

### A. Authentification & Compte

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| AUTH-001 | Confirmation email | Inscription | Tous | Email | Supabase Auth natif + DB template `auth_confirmation` | ✅ |
| AUTH-002 | Reset mot de passe | Demande reset | Tous | Email | `passwordReset()` + DB `auth_reset_password` | ✅ |
| AUTH-003 | Magic link | Connexion sans MDP | Tous | Email | DB template `auth_magic_link` | ✅ |
| AUTH-004 | Changement email | Modification email | Tous | Email | DB template `auth_email_change` | ✅ |
| AUTH-005 | Bienvenue (simple) | Inscription | Tous (3 rôles) | Email | `sendWelcomeEmail()` | ✅ |
| AUTH-006 | Bienvenue onboarding | Inscription | Tous | Email+InApp | `welcomeOnboarding()` + `sendWelcomeNotification()` + DB `welcome_owner` | ✅ |
| AUTH-007 | Rappel onboarding 24h | Cron horaire | Onboarding incomplet | Email | `onboardingReminder24h()` | ✅ |
| AUTH-008 | Rappel onboarding 72h | Cron horaire | Onboarding incomplet | Email | `onboardingReminder72h()` | ✅ |
| AUTH-009 | Rappel onboarding 7j | Cron horaire | Onboarding incomplet | Email | `onboardingReminder7d()` | ✅ |
| AUTH-010 | Onboarding complété | 100% complété | Tous | Email+InApp+Push | `onboardingCompleted()` + `sendCompletedNotification()` | ✅ |
| AUTH-011 | Step onboarding | Chaque étape | Tous | InApp | `sendStepCompletedNotification()` | ✅ |
| AUTH-012 | Presque terminé (80%+) | Seuil atteint | Tous | InApp+Push | `sendAlmostDoneNotification()` | ✅ |
| AUTH-013 | Compte locataire créé | Profil créé + signer lié | Propriétaire | InApp | Trigger `auto_link_lease_signers_on_profile_created` | ✅ |
| AUTH-014 | Connexion nouveau device | — | — | — | ❌ NON TROUVÉ |
| AUTH-015 | Compte désactivé/supprimé | — | — | — | ❌ NON TROUVÉ |

### B. Gestion des Biens

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| PROP-001 | Invitation logement | Propriétaire invite | Locataire | Email | `sendPropertyInvitation()` + DB `invitation_tenant` | ✅ |
| PROP-002 | Invitation prestataire | Propriétaire invite | Prestataire | Email | DB `invitation_provider` | ✅ |
| PROP-003 | Document uploadé (loc→proprio) | Trigger INSERT documents | Propriétaire | InApp | `notify_owner_on_tenant_document()` (assurance, CNI, fisc, etc.) | ✅ |
| PROP-004 | Document uploadé (proprio→loc) | Trigger INSERT documents | Locataire | InApp | `notify_tenant_document_uploaded()` (bail, quittance, EDL, etc.) | ✅ |
| PROP-005 | Document center update | Trigger INSERT documents | Locataire | InApp | `notify_tenant_document_center_update()` | ✅ |
| PROP-006 | EDL planifié | Trigger INSERT/UPDATE EDL | Locataire | InApp | `notify_tenant_edl_scheduled()` | ✅ |
| PROP-007 | EDL scheduled (email) | EDL créé | Destinataire | Email | DB template `edl_scheduled` | ✅ |
| PROP-008 | EDL completed (email) | EDL terminé | Destinataire | Email | DB template `edl_completed` | ✅ |
| PROP-009 | CNI expire J-30 | Cron quotidien | Locataire+Proprio | Email+InApp | `sendCniExpiryEmail()` + insert notifications | ✅ |
| PROP-010 | CNI expire J-15 | Cron quotidien | Locataire+Proprio | Email+InApp | Idem | ✅ |
| PROP-011 | CNI expire J-7 | Cron quotidien | Locataire+Proprio | Email+InApp | Idem | ✅ |
| PROP-012 | CNI expirée | Cron quotidien | Locataire+Proprio | Email+InApp | Idem + révocation `cni_verified_at` | ✅ |
| PROP-013 | Bien créé/modifié/archivé | — | — | — | ❌ NON TROUVÉ |
| PROP-014 | DPE/amiante/gaz/élec expirés | — | — | — | ❌ NON TROUVÉ (seule CNI couverte) |

### C. Baux & Contrats

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| BAIL-001 | Bail créé | Création bail | Destinataire | Email | DB template `lease_created` | ✅ |
| BAIL-002 | Demande signature | Envoi pour signature | Locataire | Email+InApp | `sendSignatureRequest()` + trigger `notify_tenant_signature_requested` + DB `document_to_sign` | ✅ |
| BAIL-003 | Propriétaire a signé | Signer UPDATE | Locataire | InApp | Trigger `notify_tenant_owner_signed` | ✅ |
| BAIL-004 | Bail signé (toutes parties) | Lease → active | Propriétaire | Email+InApp | `sendLeaseSignedNotification()` + trigger `notify_lease_signed` + DB `document_signed` | ✅ |
| BAIL-005 | Bail activé | Lease statut → active | Locataire | InApp | Trigger `notify_tenant_lease_updated` | ✅ |
| BAIL-006 | Modification loyer/charges | UPDATE leases (loyer/charges) | Locataire | InApp | Trigger `notify_tenant_lease_updated` | ✅ |
| BAIL-007 | Bail expire J-90/60/30/15/7 | Cron hebdo lundi 8h | Propriétaire | InApp | Cron `lease-expiry-alerts` | ✅ |
| BAIL-008 | Bail expire ≤30j (loc) | Cron hebdo | Locataire | InApp | Cron `lease-expiry-alerts` | ✅ |
| BAIL-009 | Bail expiring (email) | Template DB | Propriétaire | Email | DB template `lease_expiring` | ✅ |
| BAIL-010 | Bail terminated (email) | Fin de bail | Destinataire | Email | DB template `lease_terminated` | ✅ |
| BAIL-011 | Indexation IRL | Cron mensuel | Propriétaire+Locataire | InApp | Cron `irl-indexation` | ✅ |
| BAIL-012 | Congé donné | — | — | — | ❌ NON TROUVÉ |
| BAIL-013 | Avenant créé/signé | — | — | — | ❌ NON TROUVÉ |
| BAIL-014 | Régularisation charges | — | — | — | ❌ NON TROUVÉ |

### D. Paiements & Finances

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| PAY-001 | Facture/quittance créée | Trigger INSERT invoices | Locataire | InApp+Email | Trigger `notify_tenant_invoice_created` + `sendInvoiceNotification()` + DB `quittance_available` | ✅ |
| PAY-002 | Rappel J-3 (amical) | Cron quotidien | Locataire | Outbox | `Payment.ReminderFriendly` | ✅ |
| PAY-003 | Rappel J-1 (urgent) | Cron quotidien | Locataire | Outbox | `Payment.ReminderUrgent` | ✅ |
| PAY-004 | Retard J+1 | Cron quotidien | Locataire+Proprio | Outbox | `Payment.Late` + `Owner.TenantPaymentLate` | ✅ |
| PAY-005 | Relance J+7 (formelle) | Cron quotidien | Locataire+Proprio | Outbox | `Payment.LateFormal` + `Owner.TenantPaymentLate` | ✅ |
| PAY-006 | Relance J+5 | Cron quotidien | Locataire+Proprio | InApp | Cron `rent-reminders` | ✅ |
| PAY-007 | Relance J+10 | Cron quotidien | Locataire+Proprio | InApp | Cron `rent-reminders` | ✅ |
| PAY-008 | Mise en demeure J+15 | Cron quotidien | Locataire+Proprio | InApp | Cron `rent-reminders` + statut→late | ✅ |
| PAY-009 | Dernier avertissement J+30 | Cron quotidien | Locataire+Proprio | InApp | Cron `rent-reminders` | ✅ |
| PAY-010 | Paiement reçu (proprio) | Trigger INSERT payments (succeeded) + Stripe webhook | Propriétaire | InApp+Email | Trigger `notify_payment_received` + Stripe webhook + DB `rent_received` | ✅ |
| PAY-011 | Confirmation paiement (loc) | Stripe webhook | Locataire | Email | `sendPaymentConfirmation()` | ✅ |
| PAY-012 | Facture late (trigger) | Trigger UPDATE invoices → late | Propriétaire | InApp | Trigger `notify_invoice_late` + DB `rent_late` | ✅ |
| PAY-013 | Paiement échoué Stripe | Stripe webhook payment_intent.payment_failed | Locataire | InApp | Webhook payments handler | ✅ |
| PAY-014 | Rappel paiement (email) | Template DB | Locataire | Email | DB template `rent_reminder` + `sendPaymentReminder()` | ✅ |
| PAY-015 | Loyer retard (email loc) | Template DB | Locataire | Email | DB template `rent_late_tenant` | ✅ |
| PAY-016 | Stripe Connect activé | Webhook account.updated | Propriétaire | InApp | Stripe webhook handler | ✅ |
| PAY-017 | Subscription annulée | Webhook subscription.deleted | Propriétaire | InApp | Stripe webhook handler | ✅ |
| PAY-018 | Régularisation charges | — | — | — | ❌ NON TROUVÉ |
| PAY-019 | Dépôt garantie reçu/restitué | — | — | — | ❌ NON TROUVÉ |
| PAY-020 | Avis d'échéance | — | — | — | ❌ NON TROUVÉ |
| PAY-021 | Transfer/virement Stripe | Webhook transfer.created/failed | — | DB only | ❌ Pas de notification (tracking DB seulement) |

### E. Incidents & Maintenance

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| TICK-001 | Ticket créé | Trigger INSERT tickets | Propriétaire | InApp+Email | Trigger `notify_ticket_created` + `sendNewTicketNotification()` + DB `incident_reported` | ✅ |
| TICK-002 | Ticket mis à jour | Trigger UPDATE tickets (statut) | Locataire | InApp+Email | Trigger `notify_tenant_ticket_updated` + `sendTicketUpdateNotification()` + DB `incident_update` | ✅ |
| TICK-003 | Ticket résolu | Trigger UPDATE tickets → resolved/closed | Créateur | InApp | Trigger `notify_ticket_resolved` | ✅ |
| TICK-004 | Intervention assignée (email) | Template DB | Prestataire | Email | DB template `intervention_assigned` | ⚠️ Template existe mais aucun code d'envoi trouvé |
| TICK-005 | Intervention planifiée (email) | Template DB | Locataire | Email | DB template `intervention_scheduled` | ⚠️ Template existe mais aucun code d'envoi trouvé |
| TICK-006 | Intervention terminée (email) | Template DB | Propriétaire | Email | DB template `intervention_completed` | ⚠️ Template existe mais aucun code d'envoi trouvé |
| TICK-007 | Devis soumis par prestataire | — | — | — | ❌ NON TROUVÉ |
| TICK-008 | Devis accepté/refusé | — | — | — | ❌ NON TROUVÉ |
| TICK-009 | Facture prestataire soumise | — | — | — | ❌ NON TROUVÉ |

### F. Documents & Signature

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| DOC-001 | Document uploadé (6 types) | Triggers INSERT documents | Locataire/Proprio | InApp | 3 triggers combinés | ✅ |
| DOC-002 | Signature demandée | Cf. BAIL-002 | Locataire | Email+InApp | ✅ |
| DOC-003 | Document signé | Cf. BAIL-003/004 | Parties | Email+InApp | ✅ |
| DOC-004 | Signature expirée (rappel) | — | — | — | ❌ NON TROUVÉ |
| DOC-005 | Document expiré (assurance, diag) | — | — | — | ❌ NON TROUVÉ (seule CNI couverte) |

### G. Communication & Visites

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| COM-001 | Message reçu | Appel fonction | Destinataire | InApp+Push(config) | `notifyMessageReceived()` + DB `new_message` | ✅ |
| COM-002 | Demande visite | Booking créé | Propriétaire | Email | `sendVisitBookingRequest()` | ✅ |
| COM-003 | Visite confirmée | Booking confirmé | Locataire | Email | `sendVisitBookingConfirmed()` | ✅ |
| COM-004 | Visite annulée | Booking annulé | Locataire | Email | `sendVisitBookingCancelled()` | ✅ |
| COM-005 | Rappel visite H-24 | Cron 30min | Locataire+Proprio | Email | `sendVisitReminder()` + flags tracking | ✅ |
| COM-006 | Rappel visite H-1 | Cron 30min | Locataire+Proprio | Email | `sendVisitReminder()` | ✅ |
| COM-007 | Feedback post-visite | Post-visite | Locataire | Email | `sendVisitFeedbackRequest()` | ✅ |

### H. Abonnement & Facturation Plateforme

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| SUB-001 | Trial ending J-3 | Cron quotidien 10h | Propriétaire | InApp | Cron `subscription-alerts` | ✅ |
| SUB-002 | Renouvellement J-7 | Cron quotidien 10h | Propriétaire | InApp | Cron `subscription-alerts` | ✅ |
| SUB-003 | Annulation expire J-7 | Cron quotidien 10h | Propriétaire | InApp | Cron `subscription-alerts` | ✅ |
| SUB-004 | Subscription welcome (email) | Activation | Propriétaire | Email | DB template `subscription_welcome` | ✅ |
| SUB-005 | Subscription expiring (email) | Proche fin | Propriétaire | Email | DB template `subscription_expiring` | ✅ |
| SUB-006 | Subscription renewed (email) | Renouvellement | Propriétaire | Email | DB template `subscription_renewed` | ✅ |
| SUB-007 | Payment failed (email) | Échec paiement | Propriétaire | Email | DB template `payment_failed` | ✅ |
| SUB-008 | Invoice available (email) | Facture générée | Propriétaire | Email | DB template `invoice_available` | ✅ |
| SUB-009 | Subscription annulée | Webhook Stripe | Propriétaire | InApp | Webhook handler | ✅ |
| SUB-010 | Changement tarif | Modification plan | Propriétaire | Email | `priceChange()` template (L121-84) | ✅ |

### I. Légal & Conformité

| ID | Notification | Déclencheur | Destinataire | Canal | Template | État |
|----|-------------|-------------|--------------|-------|----------|------|
| LEGAL-001 | CGU/CGV mises à jour | Modification | Tous | Email | `cguUpdate()` template | ✅ |
| LEGAL-002 | Monthly summary owner | Mensuel | Propriétaire | Email | DB template `monthly_summary_owner` | ✅ |
| LEGAL-003 | Données exportées RGPD | — | — | — | ❌ NON TROUVÉ |
| LEGAL-004 | Suppression compte traitée | — | — | — | ❌ NON TROUVÉ |
| LEGAL-005 | Politique confidentialité modifiée | — | — | — | ❌ NON TROUVÉ |

### J. Prestataire

| ID | Notification | Déclencheur | Destinataire | Canal | État |
|----|-------------|-------------|--------------|-------|------|
| PROV-001 | Mission reçue | — | Prestataire | — | ❌ NON TROUVÉ |
| PROV-002 | Devis accepté/refusé | — | Prestataire | — | ❌ NON TROUVÉ |
| PROV-003 | Intervention planifiée | — | Prestataire | — | ❌ NON TROUVÉ |
| PROV-004 | Rappel intervention | — | Prestataire | — | ❌ NON TROUVÉ |
| PROV-005 | Paiement reçu | — | Prestataire | — | ❌ NON TROUVÉ |

> **Note** : Les templates DB `intervention_assigned`, `intervention_scheduled`, `intervention_completed` existent mais aucun code ne les envoie. Le prestataire est le rôle le plus sous-notifié.

---

## 4. PHASE 3 — MATRICE GAP ANALYSIS

### Légende
- **Priorité** : P0 = Obligation légale/critique | P1 = Standard marché | P2 = Différenciateur | P3 = Nice-to-have
- **Effort** : XS < 2h | S = 2-8h | M = 1-3j | L = 3-5j | XL > 5j
- **Impact** : Critique / Élevé / Moyen / Faible

| ID | Notification | Priorité | Existante | Canal actuel | Canal cible | Effort | Impact |
|----|-------------|----------|-----------|-------------|------------|--------|--------|
| **N-001** | **Dispatcher multi-canal unifié** | P0 | ❌ | — | Infrastructure | XL | Critique |
| **N-002** | **Preference checker avant envoi** | P0 | ❌ | — | Infrastructure | M | Critique |
| **N-003** | **Lien désinscription one-click (RFC 8058)** | P0 | ❌ | — | Email header | M | Critique |
| **N-004** | Régularisation charges annuelle avec décompte | P0 | ❌ | — | Email+InApp | M | Critique |
| **N-005** | Dépôt garantie restitution (rappel 1/2 mois) | P0 | ❌ | — | Email+InApp | M | Critique |
| **N-006** | Diagnostics obligatoires expirés (DPE, amiante, gaz, élec, plomb, ERNMT) | P0 | ❌ | — | Email+InApp | M | Critique |
| **N-007** | Trêve hivernale rappel (1er nov - 31 mars) | P0 | ❌ | — | InApp+Email | S | Critique |
| **N-008** | Encadrement loyers zone tendue — dépassement | P0 | ❌ | — | InApp+Email | M | Critique |
| **N-009** | Congé donné (propriétaire ou locataire) avec AR numérique | P0 | ❌ | — | Email+InApp+Push | M | Critique |
| **N-010** | Quittance dématérialisée distincte (avec consentement) | P0 | ⚠️ | InApp (facture) | Email+InApp | S | Critique |
| **N-011** | Prestataire : mission/intervention assignée | P1 | ⚠️ | Template DB seul | Email+InApp+Push | M | Élevé |
| **N-012** | Prestataire : intervention planifiée | P1 | ⚠️ | Template DB seul | Email+InApp+Push | S | Élevé |
| **N-013** | Prestataire : intervention terminée (→proprio) | P1 | ⚠️ | Template DB seul | Email+InApp | S | Élevé |
| **N-014** | Prestataire : devis soumis | P1 | ❌ | — | Email+InApp+Push | S | Élevé |
| **N-015** | Prestataire : devis accepté/refusé | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-016** | Prestataire : paiement reçu | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-017** | Facture prestataire soumise (→proprio) | P1 | ❌ | — | Email+InApp | S | Élevé |
| **N-018** | Signature expirée rappel | P1 | ❌ | — | Email+InApp+Push | S | Élevé |
| **N-019** | Document expiré (assurance, diagnostic hors CNI) | P1 | ❌ | — | Email+InApp | M | Élevé |
| **N-020** | Stripe transfer/virement notif (actuellement DB only) | P1 | ⚠️ | DB only | Email+InApp | S | Élevé |
| **N-021** | Bail expiry cron → ajouter email | P1 | ⚠️ | InApp only | Email+InApp+Push | S | Élevé |
| **N-022** | Rent reminders cron → ajouter email | P1 | ⚠️ | InApp only | Email+InApp | S | Élevé |
| **N-023** | Subscription alerts → ajouter email | P1 | ⚠️ | InApp only | Email+InApp | S | Élevé |
| **N-024** | Avenant bail créé/signé | P1 | ❌ | — | Email+InApp | S | Moyen |
| **N-025** | Connexion nouveau device | P1 | ❌ | — | Email | S | Moyen |
| **N-026** | Permis de louer (communes concernées) | P1 | ❌ | — | InApp+Email | M | Moyen |
| **N-027** | Décence logement non-conformité | P1 | ❌ | — | InApp+Email | M | Moyen |
| **N-028** | Web Push VAPID + Service Worker serveur | P1 | ❌ | — | Infrastructure | L | Élevé |
| **N-029** | Normalisation schema notifications (6 colonnes dupliquées) | P1 | ❌ | — | Migration | L | Élevé |
| **N-030** | Digest configurable (quotidien/hebdo) | P2 | ⚠️ | DB field only | Email+Cron | L | Moyen |
| **N-031** | Groupement intelligent (batch similar) | P2 | ❌ | — | Infrastructure | L | Moyen |
| **N-032** | Snooze / rappel ultérieur | P2 | ❌ | — | Frontend+Backend | M | Faible |
| **N-033** | Analytics notifications (ouverture/clic) | P2 | ❌ | — | Infrastructure | L | Moyen |
| **N-034** | Mode silencieux / DND programmable | P2 | ⚠️ | DB quiet_hours | Frontend+Backend | M | Faible |
| **N-035** | Webhooks sortants intégrations tierces | P2 | ⚠️ | webhook_queue | Infrastructure | M | Moyen |
| **N-036** | Escalation auto canal (notif→email→SMS) | P2 | ❌ | — | Infrastructure | L | Moyen |
| **N-037** | Accessibilité WCAG 2.2 AA (aria-live, focus) | P2 | ⚠️ | Partiel | Frontend | M | Moyen |
| **N-038** | i18n notifications (FR/EN/créole) | P2 | ❌ | — | Infrastructure | XL | Moyen |
| **N-039** | Double opt-in email (RGPD) | P2 | ❌ | — | Backend | M | Moyen |
| **N-040** | Data retention policy notifications | P2 | ❌ | — | Backend (cron) | S | Faible |
| **N-041** | Droit à l'oubli appliqué aux notifications | P2 | ❌ | — | Backend | S | Faible |
| **N-042** | Données personnelles exportées RGPD | P3 | ❌ | — | Email | S | Faible |
| **N-043** | Suppression compte traitée | P3 | ❌ | — | Email | S | Faible |
| **N-044** | Politique confidentialité modifiée | P3 | ❌ | — | Email+InApp | S | Faible |
| **N-045** | A/B testing templates | P3 | ❌ | — | Infrastructure | XL | Faible |
| **N-046** | Annonce propriétaire → locataires | P3 | ❌ | — | Email+InApp | M | Faible |

**Synthèse** : 46 gaps identifiés — 10 P0, 19 P1, 12 P2, 5 P3.

---

## 5. PHASE 4 — ARCHITECTURE CIBLE & ROADMAP

### 5.1 Architecture Notifications SOTA 2026

#### A. Modèle de données — Normalisation + Extensions

```sql
-- ============================================
-- MIGRATION 1: Normalisation table notifications
-- Objectif: éliminer les 6 colonnes dupliquées
-- ============================================

-- Étape 1: Backfill profile_id depuis user_id/recipient_id
UPDATE notifications
SET profile_id = COALESCE(
  profile_id,
  recipient_id,
  (SELECT id FROM profiles WHERE user_id = notifications.user_id LIMIT 1)
)
WHERE profile_id IS NULL;

-- Étape 2: Backfill message depuis body
UPDATE notifications SET message = body WHERE message IS NULL AND body IS NOT NULL;

-- Étape 3: Backfill action_url depuis link
UPDATE notifications SET action_url = link WHERE action_url IS NULL AND link IS NOT NULL;

-- Étape 4: Backfill is_read depuis read
UPDATE notifications SET is_read = read WHERE is_read IS NULL AND read IS NOT NULL;

-- Étape 5: Ajouter colonnes manquantes
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES email_templates(id),
  ADD COLUMN IF NOT EXISTS template_code TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS group_key TEXT,
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed','cancelled','snoozed'));

-- Étape 6: Index supplémentaires
CREATE INDEX IF NOT EXISTS idx_notifications_group_key
  ON notifications(group_key) WHERE group_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled
  ON notifications(scheduled_at) WHERE scheduled_at IS NOT NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications(status, created_at DESC);

-- ============================================
-- TABLE: notification_logs (audit trail multi-canal)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','push')),
  status TEXT NOT NULL CHECK (status IN ('pending','sent','delivered','bounced',
                                         'failed','clicked','opened')),
  provider TEXT,             -- 'resend', 'twilio', 'web_push'
  provider_message_id TEXT,
  recipient_address TEXT,    -- email ou phone (hashé RGPD)
  attempts INTEGER DEFAULT 1,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

CREATE INDEX idx_notif_logs_notification ON notification_logs(notification_id);
CREATE INDEX idx_notif_logs_channel ON notification_logs(channel, status);
CREATE INDEX idx_notif_logs_created ON notification_logs(created_at DESC);

-- ============================================
-- TABLE: notification_schedules (digest + programmées)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('digest','recurring','one_time')),
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'Europe/Paris',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_schedules_next
  ON notification_schedules(next_run_at) WHERE is_active = true;

-- ============================================
-- TABLE: notification_rules (routage conditionnel)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  conditions JSONB DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{in_app}',
  priority TEXT DEFAULT 'normal',
  template_code TEXT,
  fallback_channels TEXT[],
  escalation_delay_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### B. Service de notification unifié

```typescript
// lib/services/unified-notification-dispatcher.ts

interface DispatchRequest {
  templateCode?: string;           // Template DB slug
  recipientProfileId: string;      // profile_id
  title: string;
  message: string;
  variables?: Record<string, string>;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];  // Override canaux
  priority?: NotificationPriority;
  scheduledAt?: Date;               // Envoi différé
  groupKey?: string;                // Clé de groupement/digest
  actionUrl?: string;
  actionLabel?: string;
}

// Pipeline d'envoi unifié:
// 1. Résoudre template → contenu par canal
// 2. Lookup notification_preferences du destinataire
// 3. Filtrer canaux autorisés (opt-in/opt-out)
// 4. Vérifier quiet hours + timezone (DOM-TOM aware)
// 5. Vérifier rate-limit par canal
// 6. Pour chaque canal autorisé :
//    a. in_app → INSERT notifications table
//    b. email  → Resend via sendEmail() avec List-Unsubscribe
//    c. sms   → Twilio via sendSMS()
//    d. push  → Web Push via web-push package (VAPID)
// 7. Fallback si canal primaire échoue (email→push→sms)
// 8. Logger chaque envoi dans notification_logs
// 9. Émettre outbox event pour tracking async
```

#### C. Composants Frontend

```
Existants (à conserver) :
├── NotificationCenter          ✅ (Popover + Bell + Badge)
├── NotificationItem            ✅ (Icône + priorité + action)
├── useNotifications()          ✅ (Realtime + CRUD optimiste)
├── usePushNotifications()      ⚠️ (À étendre avec Service Worker)
├── Toast system                ✅ (Radix UI)
├── /notifications              ✅ (Page historique)
├── /settings/notifications     ✅ (Page préférences)
└── /tenant/notifications       ✅ (Vue locataire)

À créer :
├── NotificationSnooze          🆕 (Dialog avec date picker)
├── NotificationDigestSettings  🆕 (Config digest dans settings)
├── NotificationSearchBar       🆕 (Recherche dans historique)
└── ServiceWorkerPush           🆕 (sw.js avec push handler)
```

#### D. API Routes

```
Existantes :
  ✅ GET    /api/notifications                    — Liste
  ✅ POST   /api/notifications                    — Créer (admin)
  ✅ PATCH  /api/notifications                    — Mark read
  ✅ DELETE /api/notifications                    — Supprimer
  ✅ GET    /api/notifications/preferences        — Préférences
  ✅ PUT    /api/notifications/preferences        — Modifier
  ✅ POST   /api/emails/send                      — Envoi email

À créer :
  🆕 POST   /api/notifications/dispatch           — Envoi unifié multi-canal
  🆕 POST   /api/notifications/subscribe-push     — Enregistrer Web Push
  🆕 DELETE /api/notifications/subscribe-push     — Supprimer subscription
  🆕 GET    /api/notifications/unsubscribe/[token]— Désinscription one-click
  🆕 POST   /api/notifications/[id]/snooze        — Snooze
  🆕 GET    /api/cron/digest                      — Cron envoi digest
  🆕 GET    /api/cron/diagnostic-expiry            — Cron diagnostics immobiliers
  🆕 GET    /api/cron/deposit-return-reminder      — Cron rappel dépôt garantie
```

### 5.2 Roadmap d'implémentation

| Sprint | Durée | Focus | Notifications couvertes | Dépendances |
|--------|-------|-------|------------------------|-------------|
| **S1** | 2 sem | **Normalisation schema + Dispatcher + P0 légales** | N-001 (dispatcher), N-002 (preferences), N-003 (unsubscribe), N-004 (régularisation), N-005 (dépôt garantie), N-006 (diagnostics), N-007 (trêve), N-008 (encadrement), N-009 (congé), N-010 (quittance), N-029 (normalisation schema) | Migration colonnes dupliquées. |
| **S2** | 2 sem | **Prestataire + Multi-canal crons existants** | N-011→N-017 (prestataire complet), N-018 (signature expirée), N-019 (documents expirés), N-020 (Stripe transfer), N-021→N-023 (ajout email aux crons), N-024 (avenant), N-025 (device) | Triggers prestataire, modification crons. |
| **S3** | 2 sem | **Push VAPID + Outbox→email + Escalation** | N-028 (Web Push VAPID + Service Worker), N-036 (escalation canal), N-026 (permis louer), N-027 (décence), relier outbox events → email/push dispatch | VAPID keys, Service Worker, process-outbox upgrade. |
| **S4** | 2 sem | **Digest + Analytics + RGPD + P2** | N-030 (digest), N-031 (groupement), N-032 (snooze), N-033 (analytics), N-034 (DND), N-037 (a11y), N-039 (double opt-in), N-040/N-041 (data retention/oubli) | Analytics setup, cron digest. |

### 5.3 Quick Wins (< 1 jour chacun)

| # | Quick Win | Effort | Impact | Comment |
|---|-----------|--------|--------|---------|
| 1 | **N-003 : Header List-Unsubscribe** | 3h | Critique (RGPD) | Ajouter `List-Unsubscribe` et `List-Unsubscribe-Post` dans `sendEmail()` + route GET unsubscribe. |
| 2 | **N-002 : Preference checker basique** | 4h | Critique (RGPD) | Avant chaque `sendEmail()`/`sendSMS()`, vérifier `notification_preferences.{email/sms}_enabled`. |
| 3 | **N-021 : Lease-expiry → ajouter email** | 2h | Élevé | Appeler `sendEmail()` avec template DB `lease_expiring` dans le cron existant. |
| 4 | **N-022 : Rent-reminders → ajouter email** | 2h | Élevé | Appeler `sendPaymentReminder()` dans le cron `rent-reminders` en plus de l'insert in-app. |
| 5 | **N-023 : Subscription-alerts → ajouter email** | 2h | Élevé | Appeler les templates DB `subscription_expiring`/`payment_failed` dans le cron. |
| 6 | **N-011 : Prestataire intervention assignée** | 4h | Élevé | Le template DB `intervention_assigned` existe — connecter son envoi au workflow d'assignation. |
| 7 | **N-007 : Trêve hivernale rappel** | 2h | Critique (P0) | Cron le 25 octobre : notification système à tous les propriétaires. |
| 8 | **N-005 : Dépôt garantie rappel** | 3h | Critique (P0) | Cron sur `end_of_lease_processes` : rappel J+25 après `move_out_date` (deadline légale 1 mois). |
| 9 | **N-020 : Stripe transfer → notification** | 2h | Élevé | Le webhook `transfer.created` existe mais ne notifie pas — ajouter insert notification + email. |
| 10 | **N-010 : Quittance email distincte** | 2h | Critique (P0) | Le template DB `quittance_available` existe — l'envoyer après génération de quittance. |

---

## ANNEXE A — Schema SQL complet proposé

Voir section 5.1.A pour les 3 tables supplémentaires (`notification_logs`, `notification_schedules`, `notification_rules`) et la migration de normalisation.

**Tables existantes à normaliser** :

| Colonne dupliquée | Garder | Supprimer | Migration |
|-------------------|--------|-----------|-----------|
| `user_id` / `recipient_id` / `profile_id` | `profile_id` | `recipient_id` (alias) | Backfill `profile_id` depuis `user_id` via JOIN profiles, puis views de compat |
| `read` / `is_read` | `is_read` | `read` | Backfill `is_read = read`, créer vue de compat |
| `message` / `body` | `message` | `body` | Backfill `message = body` |
| `link` / `action_url` | `action_url` | `link` | Backfill `action_url = link` |

> **Stratégie** : Migration progressive avec vues de compatibilité (`CREATE VIEW`) pour éviter de casser le code existant. Supprimer les anciennes colonnes en S4 après mise à jour de tout le code.

---

## ANNEXE B — Estimation effort total

| Phase | Effort (j/h) | Détail |
|-------|-------------|--------|
| Normalisation schema (migration + vues compat + mise à jour queries) | 4j | 6 colonnes × 15+ fichiers à modifier |
| Dispatcher multi-canal unifié | 5j | Service + preference checker + rate limiter + fallback |
| Notifications P0 légales (7 notifs) | 5j | Régularisation, dépôt garantie, diagnostics, trêve, encadrement, congé, quittance |
| Notifications prestataire (7 notifs) | 4j | Mission, devis×2, intervention×2, facture, paiement |
| Ajout email aux crons existants (3 crons) | 2j | lease-expiry, rent-reminders, subscription-alerts |
| Web Push VAPID + Service Worker | 4j | Server-side web-push, SW push handler, subscription management |
| Multi-canal outbox events | 2j | Relier process-outbox → dispatch unifié |
| Frontend (snooze, digest settings, search) | 3j | 3 composants + modifications pages existantes |
| Digest system | 3j | Cron digest quotidien/hebdo, agrégation, template email |
| Analytics + notification_logs | 3j | Table logs, tracking pixels, dashboard admin |
| RGPD (unsubscribe, double opt-in, data retention, oubli) | 3j | Route unsubscribe, header List-Unsubscribe, cron cleanup |
| Tests | 3j | Tests unitaires services, tests intégration API routes, tests triggers |
| **TOTAL** | **~41 j/h** | **~8 semaines à 1 dev, ~4 semaines à 2 devs** |

---

## ANNEXE C — Risques et dépendances

### Risques

| Risque | Prob. | Impact | Mitigation |
|--------|-------|--------|------------|
| Schema dual `user_id`/`profile_id` crée des notifications orphelines ou doublons | Haute | Élevé | Migration normalisation S1 avec backfill + vues compat |
| Préférences jamais consultées → emails envoyés à utilisateurs opt-out | Haute | **Critique (RGPD)** | **Quick win #2** — implémenter avant tout nouvel envoi |
| Absence List-Unsubscribe → non-conformité RFC 8058 → delivrabilité dégradée | Haute | Élevé | **Quick win #1** — header + route unsubscribe |
| 2 systèmes de relance parallèles (payment-reminders outbox + rent-reminders direct) → doublons | Moyenne | Moyen | Unifier sur le dispatcher lors de S1 |
| Push sans Service Worker → notifications uniquement si app ouverte | Haute | Moyen | VAPID + SW en S3 |
| Rate limiting SMS inexistant → coûts Twilio | Moyenne | Élevé | Ajouter rate-limit SMS dans dispatcher |
| Crons sans monitoring → échecs silencieux | Moyenne | Élevé | Ajouter alerting sur `audit_log` erreurs + health check endpoint |
| Templates DB non connectés (intervention_assigned/scheduled/completed) | Haute | Moyen | Quick win #6 — connecter les templates existants |
| PWA désactivée sur Netlify → push impossible en prod | Haute | Élevé | Config Netlify ou migration hébergement pour PWA support |

### Dépendances externes

| Dépendance | Service | Statut | Action requise |
|------------|---------|--------|----------------|
| Resend | Email transactionnel | ✅ Configuré | Vérifier SPF/DKIM/DMARC sur talok.fr. Ajouter List-Unsubscribe. |
| Twilio | SMS | ✅ Configuré | Vérifier crédits. Ajouter rate-limit. Auto-disable sur erreur permanente ✅ déjà fait. |
| web-push (npm) | Web Push | ✅ Installé (v3.6.7) | Générer VAPID keys. Implémenter server-side push. Env vars `VAPID_*` déjà définies. |
| next-pwa | PWA/SW | ⚠️ Désactivé Netlify | Résoudre conflit Netlify ou implémenter SW custom. |
| Stripe Webhooks | Events paiement | ✅ 9 events gérés | Ajouter notifications pour `transfer.created/failed`. |
| Indice IRL/ILAT | Révision loyers | ✅ Cron `irl-indexation` | Vérifier source données INSEE. |
| Base communes zones tendues | Encadrement loyers | ❌ Non intégré | Référentiel Open Data à intégrer. |
| Netlify Scheduled Functions | Crons | ✅ Configuré | Vérifier planification de tous les 14 crons. |

---

*Document généré le 23 février 2026 — Audit SOTA Notifications Talok v2.0*
*Basé sur l'analyse exhaustive de : 15 migrations SQL, 14 API routes cron, 3 webhook handlers, 10 Edge Functions, 22 templates email code, 31 templates email DB, 12 triggers PostgreSQL, 10 composants frontend.*
