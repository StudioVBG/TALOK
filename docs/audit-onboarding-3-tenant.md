# Audit Onboarding Post-Inscription — Locataire

**Date :** 29/03/2026
**Scope :** Parcours post-inscription locataire, de l'invitation à l'accès espace locataire
**Compte test :** volberg.thomas@hotmail.fr (Thomas VOLBERG)
**Méthode :** Lecture exhaustive du code source (pas de test E2E)

---

## 1. Parcours réel post-inscription locataire

### 1.1 Vue d'ensemble du flow

```
Invitation propriétaire (email avec token ou code propriété)
      ↓
/invite/[token]                    ← Validation token + acceptation
      ↓
/signup/account?role=tenant        ← Si nouveau compte
   OU
/auth/signin?email=X              ← Si compte existant
      ↓
Email confirmation → callback → redirect
      ↓
/tenant/onboarding/context         ← Étape 1/5 — Liaison logement
      ↓
/tenant/onboarding/file            ← Étape 2/5 — Dossier locataire
      ↓
/tenant/onboarding/identity        ← Étape 3/5 — Vérification identité (CNI recto/verso + selfie)
      ↓
/tenant/onboarding/payments        ← Étape 4/5 — Mode de paiement
      ↓
/tenant/onboarding/sign            ← Étape 5/5 — Signature bail
      ↓
/tenant/dashboard                  ← Dashboard locataire
```

### 1.2 Tableau des étapes

| Étape | Existe ? | Fichier | URL | Obligatoire ? | Guidé ? |
|-------|----------|---------|-----|---------------|---------|
| a) Réception invitation | ✅ | `app/invite/[token]/page.tsx` | `/invite/[token]` | Oui (ou code propriété) | Email avec bouton "Accepter" |
| b) Inscription / Login | ✅ | `app/signup/account/page.tsx` / `app/auth/signin/page.tsx` | `/signup/account?role=tenant` | Oui | Redirect automatique |
| c) Liaison logement | ✅ | `app/tenant/onboarding/context/page.tsx` | `/tenant/onboarding/context` | Oui | Étape 1/5, tips dans aside |
| d) Dossier locataire | ✅ | `app/tenant/onboarding/file/page.tsx` | `/tenant/onboarding/file` | Oui | Étape 2/5, tips dans aside |
| e) Upload CNI recto/verso + selfie | ✅ | `app/tenant/onboarding/identity/page.tsx` | `/tenant/onboarding/identity` | **Skippable** (mais requis pour signer) | Étape 3/5, wizard 7 sous-étapes |
| f) Configuration paiement | ✅ | `app/tenant/onboarding/payments/page.tsx` | `/tenant/onboarding/payments` | Oui | Étape 4/5 |
| g) Signature bail | ✅ | `app/tenant/onboarding/sign/page.tsx` | `/tenant/onboarding/sign` | Oui (si bail lié) | Étape 5/5, preview + pad signature |
| h) EDL d'entrée | ❌ Absent de l'onboarding | — | — | Non intégré | Via notification post-signature |
| i) Accès dashboard | ✅ | `app/tenant/dashboard/` | `/tenant/dashboard` | — | WelcomeModal + tour guidé |

---

## 2. Détail de chaque étape

### 2.1 Réception invitation

**Fichiers :** `app/invite/[token]/page.tsx`, `lib/emails/templates.ts`

| Aspect | Détail |
|--------|--------|
| Format email | Template `propertyInvitation()` : sujet "🏠 Invitation à rejoindre un logement" |
| Contenu email | Nom proprio, adresse logement, code propriété en fallback, CTA "Accepter l'invitation" |
| Lien | `/invite/[token]` (token 64 chars hex, 128-bit entropie) |
| Expiration | 7 jours (invitation standard), 30 jours (lease invite) |
| Code propriété fallback | `PROP-XXXX-XXXX` affiché dans l'email pour saisie manuelle |
| Validation | GET `/api/invitations/validate?token=X` (public, service_role) |

**Page `/invite/[token]` :**

| Scénario | Comportement |
|----------|-------------|
| Nouveau locataire | Bouton "Accepter" → `/signup/account?role=tenant&invite=[token]` |
| Compte existant | Lien "Se connecter" → `/auth/signin?email=X&redirect=/invite/[token]` |
| Token expiré | Message "Lien invalide ou expiré" + bouton "Demander un nouveau lien" |
| Token déjà utilisé | Message "Cette invitation a déjà été utilisée" |

---

### 2.2 Liaison logement — Étape 1/5

**Fichier :** `app/tenant/onboarding/context/page.tsx` (334 lignes)

**Deux modes d'entrée :**

| Mode | Champ | Détail |
|------|-------|--------|
| Token invitation | `invite_token` (pré-rempli depuis URL `?invite=TOKEN`) | Rôle verrouillé, propriété pré-chargée |
| Code propriété | `code_logement` (saisie manuelle, 4-20 chars alphanum) | Validé via `propertyCodesService.validatePropertyCode()` |

**Champs du formulaire :**

| Champ | Obligatoire | Détail |
|-------|-------------|--------|
| `code_logement` | Si pas de token | Code type `PROP-XXXX-XXXX` |
| `invite_token` | Si pas de code | Token 64 chars hex |
| `role` | Oui | Select : locataire_principal / colocataire / garant. Verrouillé si invitation |

**Validation Zod :** `tenantContextSchema` (`lib/validations/onboarding.ts:196-201`)

**Actions serveur :**
- Si token : POST `/api/invitations/accept` → liaison `lease_signers.profile_id` + `roommates` (coloc)
- Si code : POST `/api/tenant/link-property` → liaison propriété

**Persistance :** `onboarding_drafts` + `onboarding_progress` (step `tenant_context`)

**Redirect succès :** `/tenant/onboarding/file`

**Quit :** Draft sauvegardé localStorage + Supabase. Reprise au retour.

**Retour arrière :** ❌ Pas de bouton "Retour" dans l'UI.

---

### 2.3 Dossier locataire — Étape 2/5

**Fichier :** `app/tenant/onboarding/file/page.tsx` (234 lignes)

**Champs du formulaire :**

| Champ | Obligatoire | Détail |
|-------|-------------|--------|
| `situation_pro` | Non (recommandé) | Select : Salarié / Indépendant / Retraité / Étudiant / Sans emploi / Autre |
| `revenus_mensuels` | Non (recommandé) | Nombre décimal, ≥ 0 |
| `nb_adultes` | Oui | Entier ≥ 1 (défaut: 1) |
| `nb_enfants` | Oui | Entier ≥ 0 (défaut: 0) |
| `garant_required` | Non | Checkbox |

**Validation Zod :** `tenantFileSchema` (`lib/validations/onboarding.ts:203-214`)

**Note affichée :** "Vous pourrez uploader vos pièces justificatives (pièce d'identité, justificatifs de revenus, Visale) dans la prochaine étape" — **l'upload de documents n'a PAS lieu ici**, juste la collecte d'infos socio-professionnelles.

**Persistance :** UPSERT dans `tenant_profiles` (profile_id, situation_pro, revenus_mensuels, nb_adultes, nb_enfants, garant_required) + `onboarding_drafts` + `onboarding_progress` (step `tenant_file`)

**Redirect succès :** `/tenant/onboarding/identity`

**Quit :** Draft sauvegardé. Formulaire pré-rempli au retour.

**Retour arrière :** ❌ Pas de bouton "Retour".

---

### 2.4 Vérification identité — Étape 3/5

**Fichier :** `app/tenant/onboarding/identity/page.tsx` (227 lignes)

**Wizard 7 sous-étapes (via `useIdentityVerification` hook) :**

| Sous-étape | Contenu | Requis |
|-----------|---------|--------|
| 1. Intro | Explication vérification CNI | — |
| 2. Sélection type document | CNI / Passeport / Titre de séjour / Permis | Oui |
| 3. Scan recto | Capture caméra (composant `DocumentScan`, side="recto") | Oui |
| 4. Scan verso | Capture caméra (side="verso") — **uniquement si CNI** (passeport = pas de verso) | Conditionnel |
| 5. Selfie | Capture portrait | Oui |
| 6. Processing | Traitement automatique (OCR + validation) | Auto |
| 7. Succès / Erreur | Données extraites ou options retry/annuler | — |

**Caméra :**
- `facingMode: "environment"` (caméra arrière)
- Workaround iOS Safari (`onloadedmetadata` avant play)
- JPEG qualité 0.9
- Tips : éclairage, stabilité, cadrage

**Skip possible :** ✅ Bouton "Passer cette étape" → `/tenant/onboarding/payments` (toast "Vérification reportée")

**Mais KYC requis pour signer :** Sur `/tenant/onboarding/sign`, si `isKycVerified === false` → carte bloquante "Vérification obligatoire" (conformité eIDAS). Le locataire **ne peut pas signer** sans avoir fait la vérification identité.

**Upload serveur :** POST `/api/tenant/identity/upload` :
- MIME autorisés : `image/jpeg`, `image/png`, `image/webp`
- Taille max : 10 MB
- Stockage : `leases/{leaseId}/identity/cni_recto_{timestamp}.{ext}`
- Auto-archivage des anciens CNI du même type (`is_archived = true`)
- Validation date d'expiration via OCR

**Persistance :** `tenant_profiles` (cni_recto_path, cni_verso_path, kyc_status) + `documents` table + `onboarding_progress` (step `tenant_identity`)

**Redirect succès :** `/tenant/onboarding/payments`

---

### 2.5 Configuration paiement — Étape 4/5

**Fichier :** `app/tenant/onboarding/payments/page.tsx` (308 lignes)

**Champs du formulaire :**

| Champ | Obligatoire | Condition |
|-------|-------------|-----------|
| `moyen_encaissement` | Oui | Select : sepa_sdd / carte_wallet / virement_sct / virement_inst |
| Carte Stripe | Si `carte_wallet` | Composant `PaymentMethodSetup` (Stripe Elements) |
| `sepa_mandat_accepte` | Si `sepa_sdd` | Checkbox acceptation mandat SEPA |
| `part_percentage` | Si colocation | 0-100% part du loyer |
| `part_montant` | Si colocation | Montant en euros |

**Validation Zod :** `tenantPaymentSchema` (`lib/validations/onboarding.ts:216-224`)

**Persistance :** `onboarding_drafts` + `onboarding_progress` (step `tenant_payment`) + `payment_methods` (si Stripe card)

**Redirect succès :** `/tenant/onboarding/sign`

**Quit :** Draft sauvegardé. SEPA mandat non finalisé avant liaison bail.

**Retour arrière :** ❌ Pas de bouton "Retour".

---

### 2.6 Signature bail — Étape 5/5

**Fichier :** `app/tenant/onboarding/sign/page.tsx` (331 lignes)

**Pré-vérifications :**

| Check | Action si échoue |
|-------|-----------------|
| Déjà signé | Redirect `/tenant/dashboard` |
| Bail pas en `pending_signature` | Redirect `/tenant/dashboard` |
| KYC non vérifié (`isKycVerified === false`) | Carte bloquante "Vérification obligatoire" (conformité eIDAS) |

**Layout :** Split-screen — preview bail (7 cols) + panneau signature (5 cols)

**Étapes de signature :**

| # | Action | Composant |
|---|--------|-----------|
| 1 | Lecture bail | `LeasePreview` (preview PDF inline) |
| 2 | Acceptation CGU | Checkbox "J'ai lu et j'accepte les termes du contrat" |
| 3 | Signature manuscrite | `SignaturePad` (pad tactile, métadonnées eIDAS : screenSize, touchDevice) |
| 4 | Soumission | POST `/api/leases/{leaseId}/sign` (signature_image + metadata) |

**Post-signature :**
- Step `lease_signed` marquée complétée
- Toast "Bail signé avec succès"
- Écran de succès animé (CheckCircle2, bounce animation, "Contrat Validé !")
- Auto-redirect vers `/tenant/dashboard` après 3 secondes
- Email `leaseSigned()` envoyé au signataire
- Email `leaseFullySigned()` si tous les signataires ont signé
- Notification in-app au propriétaire

---

### 2.7 EDL d'entrée — ABSENT de l'onboarding

| Aspect | Détail |
|--------|--------|
| Intégré dans l'onboarding ? | **Non** |
| Notification au locataire ? | Via tips (`/api/tenant/tips`) — priorité LOW |
| Accès | `/tenant/documents` zone "À faire" si EDL pending |
| Signature EDL | Via lien `/signature-edl/[token]` (séparé du flow onboarding) |

---

## 3. Dashboard locataire — États post-login

### 3.1 Structure du dashboard

**Fichiers :** `app/tenant/dashboard/page.tsx`, `app/tenant/_data/fetchTenantDashboard.ts`

**Données chargées :**

| Donnée | Table(s) | Usage |
|--------|---------|-------|
| `leases` | `leases` + `properties` + `lease_signers` | Multi-bail supporté |
| `invoices` | `invoices` | Impayés, dernière quittance |
| `tickets` | `tickets` | Demandes maintenance |
| `pending_edls` | `edl` | EDL en attente signature |
| `recent_documents` | `documents` | Derniers docs partagés |
| `insurance` | `documents` (attestation_assurance) | Statut assurance |
| `kyc_status` | `tenant_profiles` | Statut vérification identité |
| `stats` | Calculé | unpaid_amount, unpaid_count, total_monthly_rent, active_leases_count |

### 3.2 États du dashboard

| État | Condition | Ce que voit le locataire |
|------|-----------|-------------------------|
| **Aucun bail lié** | `dashboard.lease === null` | Empty state — invitation à lier un logement (code propriété ou invitation) |
| **Bail lié, non signé** | `lease.statut !== 'active'` | Prompt d'onboarding — "Complétez votre inscription". Badge "Identité à vérifier" si KYC pending |
| **Bail signé, actif** | `lease.statut === 'active'` | Dashboard complet : loyer du mois, prochaine échéance, quittances récentes, EDL, tickets, assurance, compteurs |
| **Impayés** | `stats.unpaid_amount > 0` | Alerte rouge avec montant et bouton "Payer maintenant" |

### 3.3 Mécanisme auto-link (layout.tsx)

**Fichier :** `app/tenant/layout.tsx` (lignes 21-56)

À **chaque chargement** du layout tenant, la fonction `autoLinkLeaseSigners()` :
1. Recherche les `lease_signers` orphelins avec l'email du locataire mais sans `profile_id`
2. Les lie automatiquement au profil du locataire
3. Backfill les `invoices.tenant_id` pour les nouveaux baux

Cela résout le cas où un locataire existant est invité sur un nouveau bail — la liaison se fait au prochain chargement de page, sans action manuelle.

---

## 4. Document Center locataire

### 4.1 Page documents

**Fichier :** `app/tenant/documents/page.tsx` (1000+ lignes)

**Layout 3 zones :**

| Zone | Contenu | Fichiers |
|------|---------|----------|
| **1. "À faire"** | Actions pendantes prioritaires (bail à signer, assurance à déposer, paiement en retard, EDL à signer) | `lib/hooks/use-tenant-pending-actions.ts` |
| **2. "Documents essentiels"** | 4 slots fixes : Bail, Dernière quittance, EDL d'entrée, Assurance | Grid 4 colonnes, placeholders si manquant |
| **3. "Tous les documents"** | Liste complète avec recherche, filtres, tri | Search + filtres type/source/période/tri, vue grille ou cascade |

### 4.2 Actions pendantes (Zone 1)

**Fichier :** `lib/hooks/use-tenant-pending-actions.ts`

| # | Action | Priorité | Condition | Lien |
|---|--------|----------|-----------|------|
| 1 | Signer le bail | 1 (max) | `leaseStatus = "pending_signature"/"partially_signed"` ET pas encore signé | `/tenant/onboarding/sign` |
| 2 | Payer le loyer | 2 | `unpaid_amount > 0` | `/tenant/payments` |
| 3 | Signer l'EDL | 3 | `pendingEDLs.length > 0` | `/signature-edl/[token]` |
| 4 | Déposer l'assurance | 4 | `!has_insurance` | `/tenant/documents?action=upload&type=attestation_assurance` |

### 4.3 Documents requis par bail

**Fichier :** `lib/config/lease-document-types.ts`

| Type | Label | Obligatoire | Expire ? |
|------|-------|-------------|----------|
| `bail` | Contrat de bail | ✅ Oui | Non |
| `diagnostic_performance` | DPE (Énergie) | ✅ Oui | Oui (alerte 30j avant) |
| `attestation_assurance` | Assurance habitation | ✅ Oui | Oui (alerte 30j avant) |
| `EDL_entree` | État des lieux d'entrée | ✅ Oui | Non |
| `diagnostic_amiante` | Diagnostic amiante | Non | Oui |
| `EDL_sortie` | État des lieux de sortie | Non | Non |
| `quittance` | Quittance de loyer | Non | Non |
| `annexe_pinel` | Annexe Pinel | Non | Non |
| `etat_travaux` | État des travaux | Non | Non |
| `autre` | Autre document | Non | Non |

### 4.4 Vue "requis vs fourni"

| Aspect | Statut | Détail |
|--------|--------|--------|
| Checklist avec progression % | ❌ **ABSENT** | Pas de barre de progression explicite pour les documents requis |
| Slots "Documents essentiels" | ✅ | 4 slots avec placeholder si manquant — le locataire voit visuellement ce qu'il lui manque |
| Actions pendantes pulsantes | ✅ | Indicateur pulsant dans la zone "À faire" |
| Notification documents manquants | ⚠️ **Tips uniquement** | Via `/api/tenant/tips` (priorité LOW) — pas d'email dédié |

### 4.5 CNI recto/verso — Groupement

**Fichier :** `components/documents/document-groups.tsx`

**Algorithme de groupement (lignes 166-197) :**
1. Sépare les documents `cni_recto` et `cni_verso`
2. Matching par priorité :
   - Priorité 1 : même `lease_id`
   - Priorité 2 : même `tenant_id`
3. Affichage : grille 2 colonnes, recto et verso côte à côte
4. Si verso manquant : affichage simple côté unique

**Types identité regroupés :** `cni_recto`, `cni_verso`, `passeport`, `piece_identite`, `titre_sejour`

---

## 5. Notifications et rappels locataire

### 5.1 Crons de rappel

| Cron | Fichier | Destinataire | Intervalles | Canal |
|------|---------|-------------|------------|-------|
| **Rappels paiement** | `app/api/cron/payment-reminders/route.ts` | Locataire + proprio | J-3 (amical), J-1 (urgent), J+1 (retard), J+7 (formel), J+15 (mise en demeure), J+30 (dernier avertissement) | Outbox → email + push + SMS + in-app |
| **Rappels onboarding** | `app/api/cron/onboarding-reminders/route.ts` | Locataire (tous rôles) | 24h, 72h, 7 jours | Email (Resend) avec idempotency key |
| **Notifications générales** | `app/api/cron/notifications/route.ts` | Locataire | J-5, J-1, J+1, J+7 paiement + J-90, J-30, J-7 expiration bail | In-app (RPC `create_notification`) |

### 5.2 Rappels spécifiques

| Scénario | Rappel email ? | Rappel in-app ? | Fichier |
|----------|---------------|-----------------|---------|
| Documents manquants | ❌ **NON** | ⚠️ Tips uniquement (priorité LOW) | `app/api/tenant/tips/route.ts:192-204` |
| Bail non signé | ❌ Pas d'email dédié | ✅ Tip priorité HIGH + actions pendantes | `app/api/tenant/tips/route.ts:144-151` |
| Loyer impayé | ✅ 6 niveaux de relance | ✅ In-app + push + SMS | `app/api/cron/payment-reminders/route.ts` |
| Onboarding incomplet | ✅ 3 relances (24h/72h/7j) | ❌ Pas de tip dédié | `app/api/cron/onboarding-reminders/route.ts` |
| Assurance manquante | ❌ Pas d'email dédié | ✅ Tip priorité MEDIUM | `app/api/tenant/tips/route.ts:153-165` |
| Assurance expirant < 30j | ❌ Pas d'email dédié | ✅ Tip priorité MEDIUM | `app/api/tenant/tips/route.ts:167-180` |
| KYC non vérifié | ❌ Pas d'email dédié | ✅ Tip priorité MEDIUM | `app/api/tenant/tips/route.ts:182-190` |
| Relevés compteurs > 3 mois | ❌ Pas d'email dédié | ✅ Tip priorité LOW | `app/api/tenant/tips/route.ts:206-244` |

### 5.3 Tips contextuels (`/api/tenant/tips`)

**Fichier :** `app/api/tenant/tips/route.ts` (259 lignes)

**9 niveaux de priorité :**

| # | Priorité | Tip | Lien |
|---|----------|-----|------|
| 1 | HIGH | Loyer en retard (montant total affiché) | `/tenant/payments` |
| 2 | HIGH | Paiement dû dans ≤ 5 jours | `/tenant/payments` |
| 3 | HIGH | Bail à signer | `/tenant/onboarding/sign` |
| 4 | MEDIUM | Assurance manquante | `/tenant/documents` |
| 5 | MEDIUM | Assurance expirant < 30j | `/tenant/documents` |
| 6 | MEDIUM | KYC non vérifié | `/tenant/profile` |
| 7 | LOW | Documents manquants (CNI, justificatif domicile) | `/tenant/documents` |
| 8 | LOW | Relevés compteurs > 3 mois | `/tenant/meters` |
| 9 | DEFAULT | Tout est en ordre | — |

### 5.4 Badges navigation

**Fichier :** `app/api/tenant/nav-badges/route.ts`

| Badge | Source | Affiché |
|-------|--------|---------|
| Messages non lus | `conversations.tenant_unread_count > 0` | Compteur sur "Messages" |
| Demandes ouvertes | `tickets` avec statut `open` / `in_progress` / `assigned` | Compteur sur "Demandes" |

**Absent :** Pas de badge pour "Documents manquants" ou "Bail à signer" dans la navigation.

---

## 6. Signature bail — Flow technique

### 6.1 Signature depuis l'onboarding (`/tenant/onboarding/sign`)

| Étape | Détail |
|-------|--------|
| Preview bail | Composant `LeasePreview` — rendu PDF inline (7 colonnes) |
| Vérification KYC | Si `isKycVerified === false` → carte bloquante, lien vers `/tenant/onboarding/identity` |
| Acceptation | Checkbox "J'ai lu et j'accepte les termes du contrat" |
| Signature | `SignaturePad` — pad tactile avec métadonnées eIDAS (screenSize, touchDevice) |
| API | POST `/api/leases/{leaseId}/sign` — signature_image + metadata |
| Post-signature | Step `lease_signed` complétée, email, notification proprio, redirect dashboard 3s |

### 6.2 Signature publique (`/signature/[token]`)

**Fichier :** `app/signature/[token]/page.tsx`

| Aspect | Détail |
|--------|--------|
| Token | Base64url encode de `{leaseId}:{tenantEmail}:{timestamp}` |
| Validité page | 30 jours |
| Validité API sign | **7 jours** (`app/api/signature/[token]/sign/route.ts:28`) |
| Vérification | OTP par email (`verifyOTP()`) avant signature |
| Signature image | Optionnelle — défaut : `OTP_VERIFIED:{email}` |
| Signer lookup | 5 stratégies : profile_id → invited_email → email profiles → placeholder → owner check |

**Incohérence :** Le token est valide 30 jours côté page mais seulement **7 jours côté API** — un locataire peut voir la page mais échouer à signer si le token a entre 7 et 30 jours.

### 6.3 Génération lien signature

**Fichier :** `app/api/tenant/signature-link/route.ts`

**Bug potentiel :** La requête filtre uniquement `role = "locataire_principal"` (ligne 54) — les **colocataires** et **garants** ne reçoivent pas de lien signature via ce endpoint.

---

## 7. Persistance et reprise d'onboarding

### 7.1 Mécanisme de draft

| Aspect | Détail |
|--------|--------|
| Stockage | localStorage + table `onboarding_drafts` (Supabase) |
| Granularité | **1 seul draft par utilisateur** (upsert sur user_id) |
| Reprise | Chaque page vérifie les étapes complétées → redirect vers étape suivante si déjà fait |
| Méthode | `onboardingService.getDraft()` → localStorage d'abord, Supabase en fallback |

### 7.2 Tableau de reprise par étape

| Étape | Quit → que se passe-t-il ? | Reprend-on au bon endroit ? |
|-------|---------------------------|----------------------------|
| Context | Draft sauvegardé. Invitation non acceptée si formulaire non soumis | ✅ Formulaire pré-rempli |
| File | Draft sauvegardé. `tenant_profiles` non mis à jour avant submit | ✅ Formulaire pré-rempli |
| Identity | Sous-étape perdue (pas de draft des captures caméra) | ❌ Recommence depuis intro |
| Payments | Draft sauvegardé. Carte Stripe non liée avant submit | ✅ Formulaire pré-rempli |
| Sign | Signature non envoyée. Pad réinitialisé | ❌ Recommence lecture bail + signature |

### 7.3 Callback auth et reprise

**Fichier :** `app/auth/callback/route.ts`

Le callback redirige vers `/tenant/onboarding/context` si `onboarding_completed_at` est null — **toujours l'étape 1**, pas l'étape abandonnée. Les pages vérifient ensuite les étapes complétées et redirigent si nécessaire, ce qui crée un enchaînement rapide de redirects.

---

## 8. Required steps dans `onboarding.service.ts`

**Fichier :** `features/onboarding/services/onboarding.service.ts:214-223`

```
tenant: [
  "role_choice",
  "account_creation",
  "email_verification",
  "tenant_context",
  "tenant_file",
  "tenant_identity",
  "tenant_payment",
]
```

**Note :** `lease_signed` n'est **pas dans la liste** des required steps — l'onboarding se considère complet même sans signature de bail. Cela signifie que `isOnboardingComplete("tenant")` retourne `true` dès que l'étape paiement est complétée.

---

## 9. Tour guidé locataire

### 9.1 Steps du tour

**Fichier :** `components/onboarding/OnboardingTour.tsx` (lignes 254-319)

| # | ID | Titre | Cible |
|---|----|-------|-------|
| 1 | welcome | Bienvenue dans votre espace | Centre |
| 2 | lease | Votre contrat de location | `[data-tour="tenant-lease"]` |
| 3 | payments | Payez votre loyer en 1 clic | `[data-tour="tenant-payments"]` |
| 4 | documents | Vos documents accessibles partout | `[data-tour="tenant-documents"]` |
| 5 | requests | Signalez un problème | `[data-tour="tenant-requests"]` |
| 6 | support | Aide & Support | `[data-tour="tenant-support"]` |
| 7 | complete | Vous êtes prêt ! | Centre |

### 9.2 Attributs data-tour dans la sidebar

**À vérifier :** Les attributs `data-tour="tenant-*"` doivent être présents dans le composant sidebar/layout tenant. Si absents, le tour échoue silencieusement (même problème que les 2 étapes cassées du tour propriétaire).

---

## 10. Synthèse

### Score global : 6.5/10

### Points forts

| # | Point fort | Justification |
|---|-----------|---------------|
| 1 | Flow 5 étapes linéaire et clair | Indicateur de progression visible, étapes logiques |
| 2 | Double mode liaison (token + code propriété) | Flexibilité pour le locataire |
| 3 | KYC multi-étapes avec caméra | CNI recto/verso + selfie, OCR, validation expiration |
| 4 | Signature eIDAS-compliant | Métadonnées (screenSize, touchDevice), pad tactile |
| 5 | Auto-link orphan signers | Layout relance la liaison à chaque chargement |
| 6 | Système de tips contextuels | 9 niveaux de priorité couvrant tous les cas |
| 7 | Relances paiement robustes | 6 niveaux (J-3 à J+30), multi-canal (email + push + SMS + in-app) |
| 8 | Persistance draft | localStorage + Supabase, reprise sans perte |
| 9 | 3 zones documents bien structurées | "À faire" + "Essentiels" + "Tous" — priorisation claire |
| 10 | Support colocation (partage loyer) | Configuration % et montant à l'onboarding |

### Manques identifiés

| # | Manque | Sévérité | Impact |
|---|--------|----------|--------|
| 1 | **Incohérence expiration token signature** — page accepte 30j, API rejette après 7j | Haute | Locataire voit la page mais ne peut pas signer → erreur incompréhensible |
| 2 | **Lien signature exclut colocataires/garants** — filtre `role = "locataire_principal"` uniquement | Haute | Colocataires et garants ne reçoivent pas de lien de signature via cet endpoint |
| 3 | **Aucun email de rappel pour documents manquants** — tips in-app uniquement (priorité LOW) | Haute | Le locataire ne reçoit pas de relance email pour sa CNI ou son assurance |
| 4 | **Aucun email de rappel pour bail non signé** — tip HIGH in-app, mais pas d'email | Moyenne | Le locataire qui ne se reconnecte pas ne sait pas qu'il doit signer |
| 5 | **Pas de bouton "Retour"** sur les étapes 1, 2, 4 | Moyenne | UX dégradée — navigation par URL ou bouton navigateur |
| 6 | **`lease_signed` absent des required steps** — onboarding complet sans signature | Moyenne | Indicateur de complétion prématuré |
| 7 | **EDL d'entrée absent du flow d'onboarding** — aucun guidage post-signature | Moyenne | Le locataire ne sait pas qu'un EDL est attendu |
| 8 | **Callback redirige toujours vers étape 1** au lieu de l'étape abandonnée | Moyenne | Cascade de redirects à la reconnexion |
| 9 | **Pas de barre de progression documents requis** — juste des slots visuels | Basse | Le locataire ne voit pas clairement "3/5 documents fournis" |
| 10 | **Pas de badge nav pour "Bail à signer"** ou "Documents manquants" | Basse | Actions critiques sans signal dans la navigation |
| 11 | **KYC skip puis blocage** — le locataire peut skip l'identité mais est bloqué à la signature | Basse | UX confuse (pourquoi proposer de skip si c'est requis ensuite ?) |
| 12 | **Duplicate cron paiement** — `notifications/route.ts` ET `payment-reminders/route.ts` | Basse | Risque de doublons de notifications (canonical = payment-reminders) |
| 13 | **Étape file ne collecte pas de documents** — le locataire lit "prochaine étape" mais l'upload n'est dédié qu'à la CNI | Info | Justificatifs revenus/Visale non collectés dans le flow |
| 14 | **Outbox events de paiement insérés mais non traités** — process-outbox ne gère que 3 event types | Info | Events `Payment.Late` etc. insérés sans handler |

### Priorités recommandées

1. **P0** — Harmoniser expiration token signature (7j partout ou 30j partout)
2. **P0** — Corriger le filtre signature-link pour inclure colocataires et garants
3. **P1** — Ajouter email de rappel pour documents manquants (cron dédié)
4. **P1** — Ajouter email de rappel pour bail non signé (cron ou onboarding-reminders)
5. **P1** — Ajouter bouton "Retour" sur les étapes 1, 2, 4
6. **P1** — Ajouter `lease_signed` dans les required steps du tenant
7. **P2** — Intégrer un prompt EDL d'entrée après signature du bail
8. **P2** — Ajouter badges nav pour "Bail à signer" et "Documents manquants"
9. **P2** — Implémenter la reprise à la bonne étape dans le callback
10. **P2** — Ajouter barre de progression documents requis (ex: "2/4 documents fournis")
11. **P3** — Rendre le skip KYC plus explicite ("Vous devrez vérifier votre identité avant de signer")
12. **P3** — Ajouter handlers outbox pour les events Payment.*
