# Audit Tours Guidés & Emails Transactionnels — Onboarding

**Date :** 29/03/2026
**Scope :** Tours guidés interactifs, emails liés à l'onboarding, persistance onboarding
**Méthode :** Lecture exhaustive du code source (pas de test E2E)

---

## 1. Tours guidés — État d'implémentation

### 1.1 Librairies utilisées

| Librairie | Installée ? | Usage |
|-----------|-------------|-------|
| NextStepJS | ❌ Non | Aucune trace dans package.json |
| Driver.js | ❌ Non | Aucune trace dans package.json |
| Framer Motion | ✅ Oui | Animations du tour (entrée/sortie tooltips, spotlight) |
| **Solution custom** | ✅ | Tour entièrement fait maison, pas de lib tierce |

### 1.2 Composants du système de tour

| Fichier | Lignes | Rôle | Statut |
|---------|--------|------|--------|
| `components/onboarding/OnboardingTour.tsx` | 981 | **Tour principal** — spotlight, tooltips, swipe mobile | ✅ Actif |
| `components/onboarding/guided-tour.tsx` | 474 | **Doublon** — implémentation alternative moins complète | ⚠️ À supprimer |
| `components/onboarding/FirstLoginOrchestrator.tsx` | 157 | Orchestrateur WelcomeModal → tour | ✅ Actif |
| `components/onboarding/welcome-modal.tsx` | 372 | Modal bienvenue par rôle | ✅ Actif |
| `components/onboarding/RestartTourCard.tsx` | 106 | Bouton "Relancer le tour" dans settings | ✅ Actif |
| `components/onboarding/onboarding-tooltip.tsx` | 289 | Tooltips contextuels (`OnboardingTooltip`, `InlineHint`) | ✅ Actif |
| `components/onboarding/skip-onboarding-button.tsx` | 277 | Bouton skip avec restrictions par rôle + bannière reprise | ✅ Actif |
| `components/onboarding/step-indicator.tsx` | 333 | Indicateur de progression (horizontal/vertical/compact) | ✅ Actif |
| `components/onboarding/onboarding-shell.tsx` | ~100 | Container pages onboarding | ✅ Actif |
| `features/onboarding/services/first-login.service.ts` | 328 | Service DB (login, welcome, tour, tooltips) | ✅ Actif |

### 1.3 Doublon `guided-tour.tsx` vs `OnboardingTour.tsx`

| Aspect | `OnboardingTour.tsx` (principal) | `guided-tour.tsx` (doublon) |
|--------|--------------------------------|---------------------------|
| Steps owner | 12 | 6 |
| Steps tenant | 7 | 5 |
| Mobile support | ✅ Swipe, sidebar auto-open, z-index boost | ❌ Aucun |
| Spotlight | Shadow technique + ResizeObserver | SVG mask |
| Keyboard | ✅ Arrows, Enter, Escape | ❌ Non |
| Persistance | ✅ localStorage + Supabase | ✅ localStorage + Supabase |
| Export hook | Context `useOnboardingTour()` | Hook `useTour(role)` |

**Décision :** `guided-tour.tsx` est un doublon inférieur à supprimer.

---

## 2. Tours par rôle

### 2.1 Owner — 12 étapes

| # | ID | Titre | Cible `data-tour` | Cible présente dans le DOM ? |
|---|----|----|-------------------|------------------------------|
| 1 | `welcome` | Bienvenue sur Talok ! | Centre (pas de cible) | ✅ N/A |
| 2 | `dashboard` | Votre Tableau de Bord | `dashboard-header` | ✅ DashboardClient.tsx |
| 3 | `properties` | Gestion des Biens | `nav-properties` | ✅ owner-app-layout.tsx |
| 4 | `leases` | Baux & Locataires | `nav-leases` | ✅ owner-app-layout.tsx |
| 5 | `money` | Loyers & Quittances | `nav-money` | ✅ owner-app-layout.tsx |
| 6 | `inspections` | États des Lieux | `nav-inspections` | ❌ **ABSENT** — pas d'item EDL dans la nav |
| 7 | `tickets` | Tickets & Maintenance | `nav-tickets` | ✅ owner-app-layout.tsx |
| 8 | `documents` | Documents & Coffre-fort | `nav-documents` | ✅ owner-app-layout.tsx |
| 9 | `command-palette` | Recherche Rapide | `search-button` | ✅ owner-app-layout.tsx |
| 10 | `notifications` | Notifications | `notifications-bell` | ✅ NotificationCenter |
| 11 | `support` | Aide & Support | `nav-support` | ❌ **ABSENT** — Support est dans un dropdown |
| 12 | `complete` | Vous êtes prêt ! | Centre (pas de cible) | ✅ N/A |

**Résultat :** 2/12 étapes ciblent des éléments inexistants → le spotlight échoue silencieusement, le tooltip s'affiche centré.

### 2.2 Tenant — 7 étapes

| # | ID | Titre | Cible `data-tour` | Cible présente dans le DOM ? |
|---|----|----|-------------------|------------------------------|
| 1 | `welcome-tenant` | Bienvenue dans votre espace | Centre | ✅ N/A |
| 2 | `dashboard-tenant` | Votre Tableau de Bord | `nav-dashboard` | ⚠️ À vérifier |
| 3 | `payments-tenant` | Payez votre loyer | `nav-payments` | ⚠️ À vérifier |
| 4 | `lease-tenant` | Votre contrat | `nav-lease` | ⚠️ À vérifier |
| 5 | `documents-tenant` | Vos documents | `nav-documents` | ⚠️ À vérifier |
| 6 | `requests-tenant` | Signalez un problème | `nav-requests` | ⚠️ À vérifier |
| 7 | `complete-tenant` | Vous êtes prêt ! | Centre | ✅ N/A |

**Note :** Les attributs `data-tour` côté tenant doivent être vérifiés dans le composant sidebar/layout tenant. Le risque d'attributs manquants est similaire au cas propriétaire.

### 2.3 Tableau récapitulatif par rôle

| Rôle | Nb étapes | Persisté ? | `data-tour` attrs ? | Skippable ? | Rejouable ? |
|------|-----------|------------|---------------------|-------------|-------------|
| Owner | 12 | ✅ localStorage + `profiles.tour_completed_at` | ⚠️ 2/12 manquants | ✅ Skip + restrictions | ✅ Via RestartTourCard |
| Tenant | 7 | ✅ localStorage + `profiles.tour_completed_at` | ⚠️ Non vérifiés | ✅ Skip + restrictions | ✅ Via RestartTourCard |
| Provider | 0 | — | — | — | — |
| Guarantor | 0 | — | — | — | — |
| Syndic | 0 | — | — | — | — |
| Agency | 0 | — | — | — | — |

**Constat :** Seuls owner et tenant ont un tour guidé. Les 4 autres rôles n'ont aucun tour.

---

## 3. Mécanique du tour

### 3.1 Déclenchement

**FirstLoginOrchestrator** (conditions pour afficher le WelcomeModal → tour) :

| Condition | Valeur requise |
|-----------|---------------|
| `tour_completed_at` | `NULL` |
| `welcome_seen_at` | `NULL` |
| `login_count` | `≤ 3` |
| localStorage `lokatif-welcome-seen` | Absent |

**Flow :**
1. WelcomeModal s'affiche automatiquement
2. "Configurer mon espace" → `markWelcomeSeen()` + `startTour()`
3. "Plus tard" → `markWelcomeSeen()` + `markOnboardingSkipped()`
4. Fermer (X) → `markWelcomeSeen()` seulement

### 3.2 Persistance du tour

| Donnée | Stockage | Clé |
|--------|----------|-----|
| Tour complété | `profiles.tour_completed_at` + localStorage | `lokatif-tour-completed` |
| Welcome vu | `profiles.welcome_seen_at` + localStorage | `lokatif-welcome-seen` |
| Prompt auto fermé | localStorage | `lokatif-tour-prompt-dismissed` |
| Onboarding skip | `profiles.onboarding_skipped_at` | — |
| Login count | `profiles.login_count` | — |

### 3.3 Replay du tour

**Fichier :** `components/onboarding/RestartTourCard.tsx`

| Action | Détail |
|--------|--------|
| Reset localStorage | Supprime `lokatif-tour-completed`, `lokatif-tour-prompt-dismissed`, `lokatif-welcome-seen` |
| Reset DB | `profiles.tour_completed_at = NULL` |
| Redirect | `/{role}/dashboard` après reset |
| Accessible | Settings du compte |

### 3.4 Interactions supportées

| Interaction | Desktop | Mobile |
|-------------|---------|--------|
| Navigation étapes | Boutons Précédent/Suivant | ✅ + Swipe (seuil 50px) |
| Raccourcis clavier | ← → Enter Escape | N/A |
| Spotlight overlay | Shadow cutout + 8px padding | ✅ identique |
| Sidebar auto-open | N/A | Event `tour:sidebar` |
| Z-index boost sidebar | N/A | `boostSidebarZIndex()` |
| ARIA labels | ✅ | ✅ |

### 3.5 Événement sidebar mobile

**Problème identifié :** `OnboardingTour.tsx` dispatch un événement custom `window.dispatchEvent(new CustomEvent("tour:sidebar", { detail: { open } }))` pour ouvrir la sidebar sur mobile. **Aucun composant layout n'écoute cet événement** → la sidebar ne s'ouvre pas automatiquement pendant le tour sur mobile.

---

## 4. Table `onboarding_progress`

### 4.1 Schéma DB

**Migration :** `supabase/migrations/20260114000000_first_login_and_onboarding_tracking.sql` (453 lignes)

**Tables créées/modifiées :**

| Table | Colonnes principales | Usage |
|-------|---------------------|-------|
| `profiles` (colonnes ajoutées) | `first_login_at`, `login_count`, `last_login_at`, `onboarding_completed_at`, `onboarding_skipped_at`, `welcome_seen_at`, `tour_completed_at` | Tracking first login + onboarding |
| `onboarding_analytics` | `user_id`, `role`, `started_at`, `completed_at`, `total_duration_seconds`, `steps_data` (JSONB), `dropped_at_step`, `utm_source`, `utm_medium`, `utm_campaign` | Analytics parcours onboarding |
| `onboarding_reminders` | `user_id`, `role`, `reminder_type` (24h/72h/7d/14d/30d), `channel` (email/push/sms), `scheduled_at`, `sent_at`, `status` | Relances planifiées |
| `user_feature_discoveries` | `user_id`, `feature_key`, `first_seen_at`, `tooltip_dismissed_at`, `tour_step_completed_at` | Tracking tooltips/features |

**RPC disponibles :**
- `record_user_login(p_profile_id)` — enregistre login + détecte premier login
- `get_onboarding_stats(p_days)` — stats admin onboarding

### 4.2 Utilisation dans le code

**Service principal :** `features/onboarding/services/first-login.service.ts` (328 lignes)

| Méthode | Table | Action |
|---------|-------|--------|
| `recordLogin(profileId)` | `profiles` | Incrémente `login_count`, set `first_login_at` / `last_login_at` |
| `getFirstLoginState(profileId)` | `profiles` | Lit welcome/tour/onboarding state |
| `shouldShowWelcomeModal(profileId)` | `profiles` | Logique d'affichage |
| `markWelcomeSeen(profileId)` | `profiles` | Set `welcome_seen_at` |
| `markTourCompleted(profileId)` | `profiles` | Set `tour_completed_at` |
| `markOnboardingCompleted(profileId, role)` | `profiles` | Set `onboarding_completed_at` |
| `skipOnboarding(profileId)` | `profiles` | Set `onboarding_skipped_at` |
| `resumeOnboarding(profileId)` | `profiles` | Clear `onboarding_skipped_at` |
| `dismissTooltip(profileId, featureKey)` | `user_feature_discoveries` | Set `tooltip_dismissed_at` |
| `markFeatureDiscovered(profileId, featureKey)` | `user_feature_discoveries` | Insert/update |

**Service onboarding :** `features/onboarding/services/onboarding.service.ts`

| Méthode | Table | Action |
|---------|-------|--------|
| `saveDraft(step, data, role)` | `onboarding_drafts` + localStorage | Sauvegarde draft |
| `getDraft()` | `onboarding_drafts` + localStorage | Charge draft |
| `markStepCompleted(step, role)` | `onboarding_progress` | Marque étape complétée |
| `isStepCompleted(step, role)` | `onboarding_progress` | Check étape |
| `isOnboardingComplete(role)` | `onboarding_progress` | Check toutes les required steps |

### 4.3 Tooltips contextuels

**Fichier :** `components/onboarding/onboarding-tooltip.tsx`

| Composant | Persisté ? | Usage |
|-----------|-----------|-------|
| `OnboardingTooltip` | ✅ DB (`user_feature_discoveries`) | Tooltip one-shot avec `showOnce=true` |
| `InlineHint` | ❌ (hover only) | Tooltip simple sans persistance |

**Problème :** Le tracking tooltips (`user_feature_discoveries`) et le tracking tour (`profiles.tour_completed_at`) sont **deux systèmes séparés sans intégration**.

---

## 5. Emails transactionnels — Inventaire complet

### 5.1 Infrastructure email

| Aspect | Détail |
|--------|--------|
| Provider | **Resend** (`lib/emails/resend.service.ts`) |
| From | `Talok <noreply@talok.fr>` (configurable via env ou DB) |
| Reply-To | `support@talok.fr` |
| Dev mode | Simulation par défaut, override avec `EMAIL_FORCE_SEND=true` |
| Rate limit | 5/min par destinataire, 100/min global, 20/h par destinataire, 500/h global |
| Retry | 3 tentatives, backoff exponentiel (1s → 2s → 4s), max 10s, jitter ±25% |
| Idempotency | Clé optionnelle, expiration 24h |
| Validation | RFC 5322, 254 chars max, 12 domaines jetables bloqués |

### 5.2 Fichiers du système email

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `lib/emails/resend.service.ts` | 759 | Service principal — 16 méthodes spécialisées + `sendEmail()` |
| `lib/emails/templates.ts` | 1809 | **27 templates** HTML inline |
| `lib/emails/utils/rate-limit.ts` | 222 | Rate limiting in-memory |
| `lib/emails/utils/validation.ts` | 257 | Validation email RFC 5322 |
| `lib/emails/utils/retry.ts` | 139 | Retry avec backoff exponentiel |
| `lib/services/resend-config.ts` | 132 | Résolution config (DB → env → défaut) |
| `lib/emails/branded-email.service.ts` | 236 | Support white-label |
| `app/api/emails/send/route.ts` | 196 | API endpoint (auth interne ou user) |

### 5.3 Templates — Layout commun

**Fonction :** `baseLayout()` dans `templates.ts:29-272`

| Aspect | Détail |
|--------|--------|
| Police | **Inter** (Google Fonts) — ⚠️ devrait être **Manrope** |
| Couleur primaire | `#2563eb` (blue) ✅ correct |
| Max-width | 600px |
| Header | Gradient bleu avec branding Talok |
| Footer | Description Talok + lien |
| Composants réutilisables | `.highlight-box`, `.badge`, `.button`, `.info-grid` |
| Responsive | ✅ Media queries, padding adaptatif |
| White-label | ✅ Via `branded-email.service.ts` (logo, couleur, footer custom) |

### 5.4 Inventaire des 27 templates

| # | Template | Sujet | Lié à l'onboarding ? | Variables principales |
|---|---------|-------|----------------------|---------------------|
| 1 | `welcome()` | "Bienvenue sur Talok !" | ✅ | userName, role, loginUrl |
| 2 | `welcomeOnboarding()` | "Bienvenue sur Talok, {userName} !" | ✅ | userName, role, onboardingUrl, supportEmail |
| 3 | `onboardingCompleted()` | "Félicitations ! Votre espace est prêt !" | ✅ | userName, role, dashboardUrl |
| 4 | `propertyInvitation()` | "🏠 {ownerName} vous invite à rejoindre" | ✅ | tenantName, ownerName, propertyAddress, propertyCode, inviteUrl |
| 5 | `leaseInvite()` | "📄 {ownerName} vous invite à signer un bail" | ✅ | tenantName, ownerName, propertyAddress, rent, charges, inviteUrl |
| 6 | `signatureRequest()` | "✍️ Signature de bail requise" | ✅ | signerName, ownerName, propertyAddress, signatureUrl |
| 7 | `leaseSignedNotification()` | "✅ Nouvelle signature" / "Bail entièrement signé" | ✅ | ownerName, signerName, signerRole, allSigned |
| 8 | `passwordReset()` | "Réinitialisation de votre mot de passe Talok" | ✅ | userName, resetUrl, expiresIn |
| 9 | `passwordChanged()` | "Votre mot de passe a été modifié" | ✅ | userName, loginUrl |
| 10 | `otpVerification()` | "🔐 Votre code de vérification Talok" | ✅ | recipientName, otpCode, expiresInMinutes |
| 11 | `newInvoice()` | "🧾 Nouvelle facture - {period}" | Non | tenantName, amount, dueDate |
| 12 | `initialInvoiceNotification()` | "🧾 Première facture" | Partiel | tenantName, amount, depositAmount |
| 13 | `paymentConfirmation()` | "✅ Paiement confirmé - {amount} €" | Non | tenantName, amount, paymentDate |
| 14 | `paymentReminder()` | "⚠️ Rappel : Loyer" | Non | tenantName, amount, daysLate |
| 15 | `invoiceReminder()` | "💳 Rappel facture" | Non | tenantName, amount, dueDate |
| 16 | `newTicket()` | "🔧 Nouveau ticket" | Non | recipientName, ticketTitle, priority |
| 17 | `ticketUpdated()` | "💬 Ticket mis à jour" | Non | recipientName, ticketTitle, newStatus |
| 18 | `cniExpiryNotification()` | Custom (data.subject) | Non | recipientName, daysUntilExpiry, urgencyLevel |
| 19 | `priceChange()` | "Tarifs Talok : changement à venir" | Non | userName, planName, oldPrice, newPrice |
| 20 | `cguUpdate()` | "Mise à jour de nos CGU" | Non | userName, newVersion, acceptUrl |
| 21 | `visitBookingRequest()` | "📅 Demande de visite" | Non | ownerName, tenantName, visitDate |
| 22 | `visitBookingConfirmed()` | "📅 Visite confirmée !" | Non | tenantName, visitDate, ownerPhone |
| 23 | `visitBookingCancelled()` | "📅 Visite annulée" | Non | tenantName, cancellationReason |
| 24 | `visitReminder()` | "📅 Rappel : visite dans {hours}h" | Non | recipientName, visitDate, hoursBeforeVisit |
| 25 | `visitFeedbackRequest()` | "📝 Partagez votre avis" | Non | tenantName, visitDate, feedbackUrl |
| 26 | `genericReminder()` | Custom (title) | Partiel | title, message, reminderUrl |
| 27 | `integrationTest()` | "Test de configuration Resend" | Non | testDate |

---

## 6. Emails liés à l'onboarding — Analyse détaillée

| Email | Existe ? | Template custom ? | Branding Talok ? | Responsive ? | Fichier |
|-------|----------|-------------------|-----------------|-------------|---------|
| a) **Confirmation email** (auth) | ⚠️ **Supabase natif** | ❌ Template Supabase par défaut | ❌ Pas de branding Talok | ❌ Template Supabase basique | Supabase Auth interne |
| b) **Bienvenue post-inscription** | ✅ | ✅ `welcome()` + `welcomeOnboarding()` | ✅ Header gradient, couleurs, footer | ✅ 600px max, padding adaptatif | `templates.ts:657`, `templates.ts:1209` |
| c) **Invitation locataire** | ✅ | ✅ `propertyInvitation()` + `leaseInvite()` | ✅ | ✅ | `templates.ts:616`, `templates.ts:1590` |
| d) **Invitation prestataire** | ⚠️ Partiel | `welcome()` avec `role=provider` | ✅ | ✅ | `templates.ts:657` (pas de template dédié) |
| e) **Relance inscription incomplète** | ✅ | ✅ `welcomeOnboarding()` via cron | ✅ | ✅ | `app/api/cron/onboarding-reminders/route.ts` |
| f) **Rappel documents manquants** | ❌ **ABSENT** | — | — | — | — |
| g) **Confirmation création bail** | ⚠️ Partiel | `leaseSignedNotification()` (signature, pas création) | ✅ | ✅ | `templates.ts:576` |
| h) **Notification signature requise** | ✅ | ✅ `signatureRequest()` | ✅ | ✅ | `templates.ts:533` |

### 6.1 Email de confirmation (Supabase Auth)

| Aspect | Détail |
|--------|--------|
| Provider | **Supabase Auth natif** — PAS Resend custom |
| Template | Template par défaut Supabase (non personnalisable via code) |
| Branding | ❌ Pas de branding Talok (logo, couleurs, police) |
| Personnalisation | Uniquement via Supabase Dashboard (Auth > Email Templates) |
| Impact | Premier email que le user reçoit — impression initiale non brandée |

### 6.2 Relances onboarding

**Fichier :** `app/api/cron/onboarding-reminders/route.ts`

| Intervalle | Template | Contenu |
|-----------|---------|---------|
| 24h | `welcomeOnboarding()` | Progression %, étape suivante, avantages par rôle |
| 72h | `welcomeOnboarding()` | Progression %, relance |
| 7 jours | `welcomeOnboarding()` | Dernière relance |

**Steps par rôle (pour les relances) :**
- Owner : 7 étapes
- Tenant : 5 étapes
- Provider : 4 étapes
- Guarantor : 3 étapes

---

## 7. Configuration Supabase Auth vs Resend

| Aspect | Détail |
|--------|--------|
| Confirmation email | **Supabase Auth natif** (pas Resend) |
| Reset password | **Custom Resend** via `app/api/auth/forgot-password/route.ts` → `passwordReset()` template |
| OTP verification | **Custom Resend** via `otpVerification()` template |
| Welcome email | **Custom Resend** via `welcome()` template (fire-and-forget post signup) |
| Onboarding reminders | **Custom Resend** via `welcomeOnboarding()` template (cron) |

**Constat :** L'email de confirmation est le **seul** email auth utilisant Supabase natif. Tous les autres passent par Resend custom avec branding Talok.

**Variables `.env.example` :**
```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=Talok <noreply@talok.fr>
RESEND_REPLY_TO=support@talok.fr
EMAIL_FORCE_SEND=false
INTERNAL_EMAIL_API_KEY=xxx
```

---

## 8. Indicateurs de progression onboarding (step-indicator)

**Fichier :** `components/onboarding/step-indicator.tsx`

### 8.1 Steps définis par rôle

| Rôle | Steps | Labels |
|------|-------|--------|
| Owner | 4 | Profil → Finances → Bien → Validation |
| Tenant | 5 | Contexte → Dossier → Identité → Paiement → Signature |
| Provider | 4 | Profil → Services → Zone → Validation |
| Guarantor | 3 | Identité → Finances → Signature |
| Syndic | ❌ Non défini | — |
| Agency | ❌ Non défini | — |

### 8.2 Variantes d'affichage

| Variante | Description | Utilisée |
|----------|-------------|----------|
| `horizontal` | Dots connectés par lignes, labels en dessous | ✅ Layout onboarding owner/tenant |
| `vertical` | Timeline verticale | Disponible, non utilisé |
| `compact` | Badge avec mini barre de progression | Disponible, non utilisé |

---

## 9. Skip onboarding — Restrictions par rôle

**Fichier :** `components/onboarding/skip-onboarding-button.tsx`

| Rôle | Restrictions affichées au skip |
|------|-------------------------------|
| Owner | "Pas de paiements sans IBAN", "Baux incomplets", "Fonctionnalités avancées limitées" |
| Tenant | "Ne peut pas signer le bail", "Paiement indisponible", "Dossier incomplet" |
| Provider | "Ne recevra pas de demandes", "Profil invisible", "Facturation désactivée" |
| Guarantor | "Ne peut pas signer l'acte", "Locataire bloqué" |
| Syndic | "Gestion copropriétés limitée", "Tantièmes non configurés" |

**Composants :**
- `SkipOnboardingButton` — confirmation dialog avec liste de restrictions
- `ResumeOnboardingBanner` — bandeau avec barre de progression pour reprendre

---

## 10. Synthèse

### Score global : 6/10

### Points forts

| # | Point fort | Justification |
|---|-----------|---------------|
| 1 | Tour custom complet | 12 étapes owner, 7 tenant, spotlight, swipe, keyboard |
| 2 | Persistance dual | localStorage + Supabase — survit restart navigateur |
| 3 | Replay du tour | `RestartTourCard` dans les settings, reset complet |
| 4 | Skip avec restrictions | Avertissements clairs par rôle avant de skip |
| 5 | Reprise d'onboarding | `ResumeOnboardingBanner` avec progression |
| 6 | 27 templates email | Couverture large, responsive, branding Talok |
| 7 | Rate limiting email | 4 limites (minute/heure × recipient/global) |
| 8 | Retry avec backoff | 3 tentatives, jitter, max 10s |
| 9 | Relances onboarding | 3 intervalles (24h/72h/7j) via cron |
| 10 | Relances paiement | 6 niveaux (J-3 à J+30) multi-canal |

### Manques identifiés

| # | Manque | Sévérité | Impact |
|---|--------|----------|--------|
| 1 | **Email confirmation = Supabase natif non brandé** — premier email reçu sans branding Talok | Haute | Impression initiale dégradée, perte de confiance |
| 2 | **2 étapes tour owner cassées** — `nav-inspections` et `nav-support` absents du DOM | Haute | Tour semble bogué aux étapes 6 et 11 |
| 3 | **Event `tour:sidebar` non écouté** — sidebar ne s'ouvre pas sur mobile pendant le tour | Haute | Tour inutilisable sur mobile pour les étapes nav |
| 4 | **Police Inter dans les emails** au lieu de Manrope (charte Talok) | Moyenne | Incohérence visuelle emails vs app |
| 5 | **Doublon `guided-tour.tsx`** — 474 lignes de code mort | Moyenne | Confusion, maintenance inutile |
| 6 | **Aucun tour pour provider/guarantor/syndic/agency** | Moyenne | 4 rôles sans guidage post-inscription |
| 7 | **Aucun email de rappel documents manquants** | Moyenne | Locataires non relancés par email pour CNI/assurance |
| 8 | **Pas d'email de confirmation création bail** — seulement notification signature | Moyenne | Le proprio ne reçoit pas de confirmation quand le bail est créé (juste quand il est signé) |
| 9 | **Pas de template invitation prestataire dédié** | Basse | Welcome générique envoyé aux providers |
| 10 | **Pas d'indicateur onboarding pour syndic/agency** dans step-indicator | Basse | Pas de steps définis pour ces rôles |
| 11 | **localStorage keys `lokatif-*`** au lieu de `talok-*` | Basse | Branding incohérent, nom de concurrent |
| 12 | **Tracking tooltips ≠ tracking tour** — deux systèmes séparés | Info | `user_feature_discoveries` vs `profiles.tour_completed_at` sans lien |

### Priorités recommandées

1. **P0** — Migrer la confirmation email vers un template custom Resend brandé Talok
2. **P0** — Corriger les 2 `data-tour` manquants (`nav-inspections`, `nav-support`)
3. **P0** — Implémenter le listener `tour:sidebar` dans le layout owner/tenant mobile
4. **P1** — Changer Inter → Manrope dans `templates.ts:48`
5. **P1** — Supprimer `guided-tour.tsx` (doublon)
6. **P1** — Créer un template email "rappel documents manquants" + cron
7. **P1** — Créer un template email "bail créé avec succès"
8. **P2** — Créer des tours guidés pour provider (4 étapes) et syndic (7 étapes)
9. **P2** — Créer un template invitation prestataire dédié
10. **P2** — Renommer toutes les clés localStorage `lokatif-*` → `talok-*`
11. **P3** — Définir les steps onboarding pour syndic et agency dans step-indicator
12. **P3** — Intégrer le tracking tooltips dans le tracking tour

### Estimation effort total

| Tâche | Effort estimé |
|-------|--------------|
| P0 — Email confirmation custom Resend | 2-3h |
| P0 — Fix data-tour manquants | 30min |
| P0 — Listener tour:sidebar mobile | 1-2h |
| P1 — Police Inter → Manrope | 15min |
| P1 — Supprimer guided-tour.tsx | 30min |
| P1 — Template + cron docs manquants | 3-4h |
| P1 — Template bail créé | 1h |
| P2 — Tours provider + syndic | 4-6h |
| P2 — Template invitation prestataire | 1h |
| P2 — Rename localStorage keys | 1h |
| **Total estimé** | **~14-19h** |
