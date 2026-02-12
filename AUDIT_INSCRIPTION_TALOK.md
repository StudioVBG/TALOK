# AUDIT EXHAUSTIF — Système d'inscription Talok

**Date** : 2026-02-12
**Auditeur** : Claude Opus 4.6 — Audit technique senior Next.js 14+ / Supabase / TypeScript
**Périmètre** : Parcours d'inscription complet (signup, onboarding, emails, sécurité, données)
**Version analysée** : Branche principale au 2026-02-12

---

## AXE 1 — Parcours d'inscription (Flows)

### État actuel

Le parcours d'inscription suit un modèle en 3 étapes principales :

1. **`/signup/role`** → Sélection du rôle (owner, tenant, provider, guarantor)
2. **`/signup/account`** → Création du compte (identité, mot de passe/magic link, consentements)
3. **`/signup/verify-email`** → Vérification email
4. **`/signup/plan`** → Choix du forfait (propriétaires uniquement)

**Points d'entrée identifiés :**
- Inscription directe via `/signup/role`
- Lien d'invitation avec token (`/signup/role?invite=xxx&role=yyy`)
- Code logement (`PROP-XXXX-XXXX`) sur la page de rôle
- OAuth (Google, GitHub, Apple) via `/auth/callback`
- Magic link (sans mot de passe)
- Legacy `/auth/signup` → redirige vers `/signup/role`
- API REST `/api/v1/auth/register` (programmatique)

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| Sélection de rôle | ✅ Fonctionnel | `app/signup/role/page.tsx` | Le rôle "guarantor" n'est pas proposé en carte, uniquement via invitation — **cohérent** avec le design voulu | — | — |
| Création de compte | ✅ Fonctionnel | `app/signup/account/page.tsx` | `@ts-nocheck` en ligne 2 → masque toutes les erreurs TypeScript | **P1** | Supprimer `@ts-nocheck` et corriger les erreurs TS |
| Vérification email | ⚠️ Partiel | `app/signup/verify-email/page.tsx` | Pas de polling automatique ; l'utilisateur doit cliquer "J'ai confirmé" manuellement | **P2** | Ajouter un polling périodique (5-10s) via `setInterval` sur `authService.getUser()` |
| Choix du forfait | ✅ Fonctionnel | `app/signup/plan/page.tsx` | Redirection vers `/auth/login` (inexistant) si session expirée — devrait être `/auth/signin` | **P1** | Corriger la redirection L72 : `/auth/login` → `/auth/signin` |
| OAuth signup | ⚠️ Lacune critique | `features/auth/services/auth.service.ts` | L'OAuth (Google/GitHub/Apple) ne capture **aucun rôle** → le trigger `handle_new_user` assigne `tenant` par défaut | **P0** | Ajouter un écran de choix de rôle post-OAuth ou passer le rôle dans les query params du callback |
| Callback OAuth | ⚠️ Partiel | `app/auth/callback/route.ts` | Redirige vers dashboard selon le rôle du profil, mais un utilisateur OAuth frais n'a jamais fait d'onboarding | **P1** | Vérifier `onboarding_completed_at` dans le callback et rediriger vers l'onboarding si incomplet |
| Invitation garant | ✅ Fonctionnel | `app/signup/role/page.tsx:250-265` | Le bouton est bien désactivé sans token d'invitation | — | — |
| Code logement | ✅ Fonctionnel | `app/signup/role/page.tsx:82-115` | Vérifie le code via API, bonne UX | — | — |
| Abandon silencieux | ⚠️ Risque | `app/signup/account/page.tsx` | L'autosave stocke le mot de passe en clair dans le draft localStorage | **P0** | Ne **jamais** persister `password` et `confirmPassword` dans le localStorage/DB draft |
| Lien Calendly | ⚠️ Générique | `app/signup/role/page.tsx:324` | Le lien pointe vers `https://calendly.com/` (générique, pas un vrai lien) | **P2** | Remplacer par le vrai lien Calendly Talok |

### Cartographie des parcours par rôle

```
PROPRIÉTAIRE : /signup/role → /signup/account → /signup/verify-email → /signup/plan → /owner/onboarding/profile → /owner/onboarding/finance → /owner/onboarding/property → /owner/onboarding/automation → /owner/onboarding/invite → /owner/onboarding/review → /owner/dashboard

LOCATAIRE :    /signup/role → /signup/account → /signup/verify-email → /tenant/onboarding/context → /tenant/onboarding/file → /tenant/onboarding/identity → /tenant/onboarding/payments → /tenant/onboarding/sign → /tenant/dashboard

PRESTATAIRE :  /signup/role → /signup/account → /signup/verify-email → /provider/onboarding/profile → /provider/onboarding/services → /provider/onboarding/ops → /provider/onboarding/review → /provider/dashboard

GARANT :       /signup/role?invite=xxx → /signup/account → /signup/verify-email → /guarantor/onboarding/context → /guarantor/onboarding/financial → /guarantor/onboarding/sign → /guarantor/dashboard
```

---

## AXE 2 — Modèle de données (Supabase)

### Tables impliquées dans l'inscription

| Table | Rôle | Fichier migration |
|-------|------|-------------------|
| `auth.users` | Utilisateur Supabase Auth | Géré par Supabase |
| `profiles` | Profil commun (id, user_id, role, prenom, nom, telephone) | `20240101000000_initial_schema.sql` |
| `owner_profiles` | Extension propriétaire (type, siret, iban) | `20240101000000_initial_schema.sql` |
| `tenant_profiles` | Extension locataire (situation_pro, revenus) | `20240101000000_initial_schema.sql` |
| `provider_profiles` | Extension prestataire (type_services, zones) | `20240101000000_initial_schema.sql` |
| `onboarding_drafts` | Brouillons d'onboarding | `20240101000004_onboarding_tables.sql` |
| `onboarding_analytics` | Suivi parcours onboarding | `20260114000000_first_login_and_onboarding_tracking.sql` |
| `onboarding_reminders` | Relances automatiques | `20260114000000_first_login_and_onboarding_tracking.sql` |

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| Trigger `handle_new_user` | ⚠️ Incohérent | `20260105100001_fix_handle_new_user_with_metadata.sql` | Le trigger ne reconnaît **pas** le rôle `guarantor` dans sa validation (L28: `IF v_role NOT IN ('admin', 'owner', 'tenant', 'provider')`) → un garant sera forcé en `tenant` | **P0** | Ajouter `'guarantor'` à la liste des rôles valides dans le trigger |
| Double création profil | ⚠️ Race condition | `api/v1/auth/register/route.ts` + trigger | L'API route crée un profil (L48) **ET** le trigger en crée un aussi → doublon potentiel avec données incohérentes | **P1** | Supprimer l'INSERT dans l'API route et se fier uniquement au trigger (qui a le `ON CONFLICT`) |
| Contrainte CHECK `profiles.role` | ⚠️ Manquant | `20240101000000_initial_schema.sql:12` | Le CHECK initial n'inclut pas `guarantor` : `CHECK (role IN ('admin', 'owner', 'tenant', 'provider'))` | **P0** | Ajouter une migration `ALTER TABLE profiles DROP CONSTRAINT ...; ALTER TABLE profiles ADD CONSTRAINT ... CHECK (role IN ('admin', 'owner', 'tenant', 'provider', 'guarantor'))` |
| Table `guarantor_profiles` | ❌ Absente | — | Pas de table dédiée `guarantor_profiles` contrairement aux autres rôles ; les données garant sont dans `profiles` + documents | **P1** | Créer `guarantor_profiles` (type_garantie, revenus, date_naissance, etc.) pour la cohérence |
| RLS `profiles` INSERT | ⚠️ Manquante | `20240101000001_rls_policies.sql` | Aucune policy INSERT sur `profiles` → la création de profil repose sur `SECURITY DEFINER` du trigger | **P2** | Acceptable si le trigger est la seule voie de création. Documenter cette décision |
| Champ `profiles.telephone` | ⚠️ Sans contrainte | `20240101000000_initial_schema.sql:15` | Le champ telephone est `TEXT` sans contrainte de format → données E.164 non garanties au niveau DB | **P2** | Ajouter un CHECK regex : `CHECK (telephone IS NULL OR telephone ~ '^\+[1-9]\d{1,14}$')` |
| RLS recursion | ✅ Corrigé | `20260107150000_fix_profiles_rls_recursion.sql` | Les fonctions helper `user_profile_id()` et `user_role()` utilisaient une query sur `profiles` qui déclenchait les RLS de manière récursive — corrigé avec `SECURITY DEFINER` | — | — |
| Données orphelines | ⚠️ Risque | — | Si `auth.users` est supprimé sans CASCADE, les `profiles` restent. La FK `ON DELETE CASCADE` est en place, mais les `owner_profiles` dépendent de `profiles.id`, pas de `auth.users` directement | **P2** | Vérifier que la chaîne CASCADE fonctionne end-to-end avec un test d'intégration |

---

## AXE 3 — Validations (Frontend & Backend)

### Validations côté client

| Schéma | Fichier | Champs validés |
|--------|---------|----------------|
| `passwordSchema` | `lib/validations/onboarding.ts:9-15` | 12+ chars, 1 maj, 1 min, 1 chiffre, 1 spécial |
| `accountCreationSchema` | `lib/validations/onboarding.ts:24-39` | prenom (1-80), nom (1-80), email, password (optionnel si magic link), CGU, privacy |
| `consentsSchema` | `lib/validations/onboarding.ts:47-55` | terms_version, privacy_version, CGU obligatoire, privacy obligatoire |
| `minimalProfileSchema` | `lib/validations/onboarding.ts:58-104` | prenom, nom, country_code (DOM-TOM inclus), telephone E.164 |

### Validations côté serveur (API)

| Schéma | Fichier | Champs validés |
|--------|---------|----------------|
| `RegisterSchema` | `lib/api/schemas.ts:11-17` | email, password (8 chars min), role (owner/tenant/provider), prenom/nom optionnels |

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| **Incohérence mot de passe** | ❌ Critique | `lib/validations/onboarding.ts` vs `lib/api/schemas.ts` | Frontend exige **12 chars + complexité**, API exige seulement **8 chars** → un appel direct à l'API contourne la politique de sécurité | **P0** | Aligner `RegisterSchema.password` sur `passwordSchema` (12 chars + regex) |
| **Rôle guarantor manquant API** | ❌ Manquant | `lib/api/schemas.ts:14` | `RegisterSchema.role` n'accepte que `owner/tenant/provider`, pas `guarantor` | **P1** | Ajouter `"guarantor"` au z.enum |
| **Prenom/nom optionnels API** | ⚠️ Incohérent | `lib/api/schemas.ts:15-16` | Les champs prenom/nom sont `.optional()` côté API mais `.min(1)` côté frontend | **P1** | Rendre prenom et nom obligatoires dans `RegisterSchema` |
| **Email déjà existant** | ✅ Géré | `app/signup/account/page.tsx:281-286` | Message clair "Email déjà utilisé" avec suggestion de connexion/reset | — | — |
| **Confirmation mot de passe** | ✅ Géré | `app/signup/account/page.tsx:226-234` | Vérification `password !== confirmPassword` avant soumission | — | — |
| **Normalisation email** | ✅ Géré | `features/auth/services/auth.service.ts:24` | `trim().toLowerCase()` appliqué systématiquement | — | — |
| **Caractères spéciaux noms** | ⚠️ Non vérifié | `lib/validations/onboarding.ts:25-26` | Aucune regex sur prenom/nom → accepte emojis, HTML, scripts | **P2** | Ajouter `.regex(/^[\p{L}\s'-]+$/u)` pour n'accepter que lettres, espaces, tirets, apostrophes |
| **Longueur téléphone** | ✅ Validé | `lib/validations/onboarding.ts:99` | Format E.164 vérifié par regex post-normalisation | — | — |
| **Validation front-back synchronisée** | ❌ Désynchronisée | Multiple | Les règles front (Zod onboarding) et back (Zod API) diffèrent significativement | **P0** | Créer un schéma partagé unique importé des deux côtés |

---

## AXE 4 — Emails & Messages transactionnels

### Templates existants

| Template | Fichier | Contenu | Personnalisation | Branding |
|----------|---------|---------|-----------------|----------|
| `welcome` | `lib/emails/templates.ts:655-704` | Message de bienvenue basique par rôle | userName, role | ✅ Logo Talok, couleurs |
| `welcomeOnboarding` | `lib/emails/templates.ts:1151-1277` | Bienvenue enrichie avec guide par rôle | userName, role, étapes, bénéfices | ✅ Complet |
| `passwordReset` | `lib/emails/templates.ts:709-730` | Lien de réinitialisation | userName, resetUrl, expiresIn | ✅ |
| `propertyInvitation` | `lib/emails/templates.ts:614-650` | Invitation locataire par propriétaire | tenantName, ownerName, propertyCode | ✅ |
| `signatureRequest` | `lib/emails/templates.ts:531-569` | Demande de signature de bail | signerName, ownerName, property | ✅ |
| `onboardingReminder24h` | `lib/emails/templates.ts:1282-1322` | Relance à J+1 | userName, role, progression | ✅ |
| `onboardingReminder72h` | `lib/emails/templates.ts:1327-1368` | Relance à J+3 | userName, role, progression | ✅ |
| `onboardingReminder7d` | `lib/emails/templates.ts:1373-1404` | Relance à J+7 | userName, role | ✅ |
| `onboardingCompleted` | `lib/emails/templates.ts:1409-1495` | Félicitations 100% complété | userName, role, next steps | ✅ |

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| **Email de confirmation** | ❌ Template Supabase par défaut | — | Pas de template personnalisé pour l'email de confirmation de compte → l'utilisateur reçoit le template générique Supabase (en anglais !) | **P0** | Configurer un template personnalisé dans Supabase Auth → Email Templates, ou envoyer via Resend avec template custom |
| **SMTP custom** | ✅ Resend configuré | `lib/emails/resend.service.ts` | Service Resend intégré pour les emails transactionnels applicatifs | — | — |
| **Bienvenue** | ✅ Deux templates | `lib/emails/templates.ts` | `welcome` (simple) et `welcomeOnboarding` (enrichi) — mais il n'est pas clair lequel est envoyé et quand | **P2** | Documenter et uniformiser : envoyer `welcomeOnboarding` systématiquement |
| **Relance inscription incomplète** | ✅ Complet | `lib/emails/templates.ts` | 3 niveaux de relance (24h, 72h, 7j) avec tracking | — | — |
| **Email responsive** | ✅ | `lib/emails/templates.ts:225-241` | Media query `@media (max-width: 600px)` présente | — | — |
| **Liens désactivation** | ⚠️ Manquant | `lib/emails/templates.ts` | Les emails de relance n'ont pas de lien de désinscription conforme (unsubscribe) | **P1** | Ajouter un header `List-Unsubscribe` + lien dans le footer des emails de relance |
| **XSS dans templates** | ⚠️ Vulnérabilité | `lib/emails/templates.ts` | Les données utilisateur (noms, adresses) sont interpolées directement dans le HTML sans échappement : `${data.tenantName}`, `${data.propertyAddress}` | **P1** | Créer un helper `escapeHtml()` et l'appliquer à toutes les interpolations de données utilisateur |
| **Branding white-label** | ✅ Prévu | `lib/emails/branded-email.service.ts` | Service de branding pour domaines personnalisés | — | — |

---

## AXE 5 — Notifications in-app & Messages système

### Toasts identifiés dans le parcours d'inscription

| Étape | Type | Message | Fichier:Ligne |
|-------|------|---------|---------------|
| Rôle — erreur | destructive | "Une erreur est survenue." | `signup/role/page.tsx:74` |
| Code logement — vide | destructive | "Saisissez un code logement valide." | `signup/role/page.tsx:85-88` |
| Code logement — succès | default | "Vous allez poursuivre l'inscription en tant que locataire." | `signup/role/page.tsx:101-103` |
| Code logement — échec | destructive | "Nous n'avons pas trouvé ce code logement." | `signup/role/page.tsx:108-110` |
| Garant — pas d'invitation | destructive | "Demandez au propriétaire de vous inviter" | `signup/role/page.tsx:252-255` |
| Compte — email déjà utilisé | destructive | "Connexion ou réinitialisation nécessaire." | `signup/account/page.tsx:283-286` |
| Compte — rate limit | destructive | "Veuillez patienter avant de réessayer." | `signup/account/page.tsx:288-291` |
| Compte — succès | default | "Un email de vérification a été envoyé." | `signup/account/page.tsx:272-274` |
| Compte — magic link | default | "Vérifiez votre email pour vous connecter." | `signup/account/page.tsx:240-242` |
| Email — renvoyé | default | "Un nouvel email de confirmation a été envoyé." | `signup/verify-email/page.tsx:100-102` |
| Email — rate limit | destructive | "Trop de tentatives. Attendez quelques minutes." | `signup/verify-email/page.tsx:110` |
| Email — confirmé | default | "Votre email a été confirmé avec succès !" | `signup/verify-email/page.tsx:136-138` |
| Plan — session expirée | destructive | "Veuillez vous reconnecter." | `signup/plan/page.tsx:69-71` |
| Plan — annulation Stripe | default | "Vous pouvez choisir un autre forfait ou réessayer." | `signup/plan/page.tsx:133-136` |

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| Toasts français | ✅ Complet | Tous les fichiers signup | Tous les messages sont en français | — | — |
| Loading states | ✅ Présents | `signup/account/page.tsx`, `signup/plan/page.tsx` | Boutons désactivés + texte "Création en cours..." / "Vérification..." | — | — |
| Autosave feedback | ✅ Présent | `signup/account/page.tsx:327-338` | Barre d'état avec heure de dernière sauvegarde | — | — |
| Erreurs techniques exposées | ⚠️ Partiel | `signup/account/page.tsx:295-298` | Le catch générique affiche `error.message` brut — pourrait exposer des messages Supabase techniques | **P2** | Mapper les erreurs Supabase courantes vers des messages francophones explicites |
| Mot de passe — feedback temps réel | ⚠️ Manquant | `signup/account/page.tsx` | Aucun indicateur de force du mot de passe en temps réel pendant la saisie | **P2** | Ajouter un composant `PasswordStrength` avec barre de progression et critères cochés/décochés |
| Étape silencieuse post-vérification | ⚠️ Possible | `signup/verify-email/page.tsx:171-189` | `goToNextStep()` redirige sans feedback si le rôle par défaut tombe dans le `default: "/dashboard"` | **P2** | Ajouter un toast "Redirection en cours..." avant le `router.push` |

---

## AXE 6 — Sécurité & Conformité

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| **Politique mot de passe (frontend)** | ✅ Solide | `lib/validations/onboarding.ts:9-15` | 12 chars, majuscule, minuscule, chiffre, spécial | — | — |
| **Politique mot de passe (API)** | ❌ Faible | `lib/api/schemas.ts:13` | Seulement 8 chars, **aucune contrainte de complexité** | **P0** | Aligner sur le schema frontend (12 chars + complexité) |
| **Rate limiting — config** | ✅ Présent | `lib/security/rate-limit.ts:38-47` | Preset `signup`: 3 req/h, `auth`: 5 req/15min | — | — |
| **Rate limiting — appliqué** | ❌ Non appliqué | `api/v1/auth/register/route.ts` | La route register n'appelle **pas** `applyRateLimit()` | **P0** | Ajouter `const rl = await applyRateLimit(request, 'signup'); if (rl) return rl;` en début de handler |
| **CAPTCHA / Turnstile** | ❌ Absent | — | Aucune protection CAPTCHA sur le formulaire d'inscription | **P1** | Intégrer Cloudflare Turnstile ou hCaptcha sur `/signup/account` |
| **RGPD — consentements** | ✅ Complet | `signup/account/page.tsx:530-623` | CGU + Privacy obligatoires, cookies granulaires (essentiels verrouillés, analytics/ads optionnels) | — | — |
| **RGPD — versioning CGU** | ✅ Présent | `signup/account/page.tsx:32-33` | Versions CGU et privacy trackées (v1.0) | — | — |
| **RGPD — stockage consentement** | ⚠️ Incomplet | `signup/account/page.tsx` | Les consentements sont sauvés dans le draft onboarding mais **pas dans une table dédiée** avec horodatage et IP | **P1** | Créer une table `user_consents` avec : user_id, type, version, accepted_at, ip_address, user_agent |
| **Tokens / Sessions** | ✅ Standard | `lib/supabase/server.ts`, `middleware.ts` | Supabase Auth gère les sessions via cookies httpOnly | — | — |
| **Middleware auth** | ⚠️ Léger | `middleware.ts:92-95` | Vérification par présence de cookie uniquement (pas de validation JWT) — acceptable car la validation forte est en layout serveur | **P2** | Documenter cette architecture dans un ADR |
| **XSS champs inscription** | ⚠️ Risque | `signup/account/page.tsx` | Les champs prenom/nom ne filtrent pas le HTML/JS → les valeurs sont injectées dans les emails | **P1** | Sanitizer les inputs côté Zod : `.transform(v => v.replace(/[<>]/g, ''))` ou utiliser DOMPurify |
| **Open redirect** | ✅ Protégé | `middleware.ts:117-119` | Le redirect param est vérifié (`startsWith("/")` et `!startsWith("//")`) | — | — |
| **Mot de passe dans localStorage** | ❌ Critique | `signup/account/page.tsx:133-149` | La fonction `saveDraftInBackground` persiste **tout** le draft, y compris `password` et `confirmPassword` en clair dans localStorage et potentiellement en base | **P0** | Exclure explicitement les champs sensibles du draft : `const { password, confirmPassword, ...safeDraft } = nextDraft.formData` |
| **Console.log en production** | ⚠️ Fuite d'info | `features/auth/services/auth.service.ts` | Multiples `console.log` avec emails et données sensibles (L53, L83-84, etc.) | **P2** | Remplacer par un logger conditionnel qui ne s'active qu'en dev |
| **CSRF** | ✅ Prévu | `lib/security/csrf.ts` | Module CSRF présent | — | Vérifier qu'il est appliqué sur les routes POST d'inscription |

---

## AXE 7 — Onboarding post-inscription

### Parcours par rôle

**Propriétaire** (6 étapes) :
1. `/owner/onboarding/profile` — Profil (particulier/société, SIREN, SIRET)
2. `/owner/onboarding/finance` — Config financière (IBAN, SEPA, versements)
3. `/owner/onboarding/property` — Premier bien immobilier
4. `/owner/onboarding/automation` — Niveau d'automatisation
5. `/owner/onboarding/invite` — Invitation locataires
6. `/owner/onboarding/review` — Récapitulatif final

**Locataire** (5 étapes) :
1. `/tenant/onboarding/context` — Contexte logement + code propriété
2. `/tenant/onboarding/file` — Dossier locataire
3. `/tenant/onboarding/identity` — Vérification identité (KYC)
4. `/tenant/onboarding/payments` — Moyen de paiement
5. `/tenant/onboarding/sign` — Signature du bail

**Prestataire** (4 étapes) :
1. `/provider/onboarding/profile` — Profil pro
2. `/provider/onboarding/services` — Services et spécialités
3. `/provider/onboarding/ops` — Dispos et paiements
4. `/provider/onboarding/review` — Récapitulatif

**Garant** (3 étapes) :
1. `/guarantor/onboarding/context` — Identité + invitation
2. `/guarantor/onboarding/financial` — Capacité financière
3. `/guarantor/onboarding/sign` — Signature acte de cautionnement

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| Tracking progression | ✅ Complet | `features/onboarding/services/onboarding.service.ts` | Steps requis par rôle, progression pourcentage, sauvegarde draft | — | — |
| Dashboard gating | ✅ Complet | `features/onboarding/services/dashboard-gating.service.ts` | Checklist par rôle (email vérifié, IBAN, propriété, bail, etc.) | — | — |
| First login detection | ✅ Complet | `features/onboarding/services/first-login.service.ts` | RPC `record_user_login`, welcome modal, guided tour | — | — |
| Analytics onboarding | ✅ Complet | `features/onboarding/services/onboarding-analytics.service.ts` | Tracking dropoff, durée par étape, taux complétion | — | — |
| Skip onboarding | ✅ Présent | `features/onboarding/services/first-login.service.ts` | `skipOnboarding()` permet de différer | — | — |
| Propriétaire sans forfait | ⚠️ Bloquant | `signup/plan/page.tsx` | Si la session Stripe échoue ou est annulée, l'utilisateur est bloqué sur cette page sans alternative gratuite visible | **P1** | Ajouter le plan "Gratuit" dans les options de signup pour permettre de continuer sans payer |
| Prestataire — onboarding léger | ✅ Adapté | — | 4 étapes, pas de KYC requis immédiat | — | — |
| Garant — dépendance invitation | ⚠️ Risque | `guarantor/onboarding/context/page.tsx` | Si le token d'invitation expire, le garant ne peut pas poursuivre | **P2** | Permettre au garant de demander un renvoi d'invitation depuis la page d'erreur |
| Relances email | ✅ Complet | `lib/emails/templates.ts` | 3 niveaux de relance (24h, 72h, 7j) + email de complétion | — | — |

---

## AXE 8 — Spécificités DOM-TOM & multi-territoire

| Élément | État | Fichier(s) | Problème | Priorité | Recommandation |
|---------|------|-----------|----------|----------|----------------|
| Codes postaux DOM-TOM | ✅ Complet | `lib/validations/index.ts:960-1008` | Regex couvre 971-976 + helper `isDOMTOM()`, `getTerritoireFromCodePostal()` | — | — |
| Sélecteur pays téléphone | ⚠️ Incomplet | `signup/account/page.tsx:387-396` | Présents : FR, MQ, GP, GF, RE, YT. **Absents : PM (Saint-Pierre-et-Miquelon, +508), BL (Saint-Barthélemy, +590), MF (Saint-Martin, +590)** | **P2** | Ajouter PM, BL, MF au SelectContent |
| Country codes supportés (Zod) | ✅ Complet | `lib/validations/onboarding.ts:62` | `z.enum(["FR", "GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF"])` — tous présents | — | — |
| Phone normalisation | ✅ Complet | `lib/utils/phone.ts` | Mapping complet FR/DOM-TOM vers E.164 | — | — |
| Fuseaux horaires | ✅ Définis | `lib/types/diagnostics-dom-tom.ts` | Fuseaux déclarés par territoire (America/Guadeloupe, Indian/Reunion, etc.) | — | Vérifier que les fuseaux sont utilisés pour les notifications et rappels |
| Diagnostics DOM-TOM | ✅ Complet | `lib/types/diagnostics-dom-tom.ts` + `supabase/migrations/20260127000008_diagnostics_dom_tom.sql` | Termites, risques naturels, zones sismiques, volcaniques par territoire | — | — |
| Loi ALUR | ✅ Référencé | Templates de bail, composants lease | Encadrement des loyers, zones tendues | — | — |
| Bail mobilité | ✅ Implémenté | `lib/templates/bail/bail-mobilite.template.ts` | Template de bail mobilité disponible | — | — |
| Encadrement des loyers | ✅ Implémenté | `components/lease/RentControlAlert.tsx` | Alerte si dépassement du loyer de référence majoré | — | — |
| Page marketing DOM-TOM | ✅ Présente | `app/solutions/dom-tom/page.tsx` | Page dédiée solutions DOM-TOM | — | — |
| Mayotte — spécificités | ⚠️ Partiel | `lib/types/diagnostics-dom-tom.ts` | Mayotte a des règles spécifiques (essaim sismique 2018-2021) mais les adaptations réglementaires locales (cadastre incomplet, baux informels) ne sont pas documentées | **P2** | Ajouter un avertissement dans le formulaire de création de bail pour Mayotte |

---

## SYNTHÈSE GLOBALE

### Score de maturité du système d'inscription

| Axe | Score | Commentaire |
|-----|-------|-------------|
| 1. Parcours d'inscription | 7/10 | Parcours complet et bien structuré, mais OAuth lacunaire et quelques redirections cassées |
| 2. Modèle de données | 6/10 | Architecture solide, mais rôle `guarantor` mal intégré et trigger incohérent |
| 3. Validations | 5/10 | Bonne couverture frontend, mais désynchronisation critique front/back |
| 4. Emails | 7/10 | Templates riches et professionnels, mais email de confirmation Supabase par défaut |
| 5. Notifications in-app | 8/10 | Toasts complets, loading states présents, tout en français |
| 6. Sécurité | 5/10 | Mots de passe dans localStorage, rate limiting non appliqué, pas de CAPTCHA |
| 7. Onboarding | 9/10 | Parcours complet par rôle, tracking analytics, relances email, dashboard gating |
| 8. DOM-TOM | 8/10 | Couverture très complète, quelques territoires mineurs manquants dans le sélecteur |

### **Score global : 6.9 / 10**

---

### TOP 5 des actions prioritaires

| # | Action | Priorité | Fichier(s) à modifier | Charge estimée |
|---|--------|----------|----------------------|----------------|
| **1** | **Supprimer le stockage du mot de passe dans localStorage/draft** | P0 | `app/signup/account/page.tsx` (L133-149) | 0.5 jour |
| **2** | **Aligner les validations front/back** : password 12 chars + complexité, rôle guarantor, prenom/nom obligatoires | P0 | `lib/api/schemas.ts`, `lib/validations/onboarding.ts` | 1 jour |
| **3** | **Corriger le trigger `handle_new_user`** pour accepter le rôle `guarantor` + ajouter la contrainte CHECK en DB | P0 | `supabase/migrations/` (nouvelle migration) | 0.5 jour |
| **4** | **Appliquer le rate limiting sur `/api/v1/auth/register`** + ajouter CAPTCHA | P0-P1 | `app/api/v1/auth/register/route.ts`, `app/signup/account/page.tsx` | 1.5 jours |
| **5** | **Personnaliser le template email de confirmation Supabase** en français avec branding Talok | P0 | Config Supabase Dashboard + `lib/emails/templates.ts` | 1 jour |

---

### Liste complète des fichiers à créer ou modifier

#### Fichiers à **modifier** :

| Fichier | Modifications |
|---------|---------------|
| `app/signup/account/page.tsx` | Exclure password du draft, supprimer `@ts-nocheck` |
| `app/signup/plan/page.tsx` | Corriger `/auth/login` → `/auth/signin`, ajouter plan gratuit |
| `app/signup/role/page.tsx` | Corriger lien Calendly |
| `app/api/v1/auth/register/route.ts` | Ajouter rate limiting, supprimer double insertion profil |
| `lib/api/schemas.ts` | Aligner `RegisterSchema` (password, role, prenom/nom) |
| `lib/validations/onboarding.ts` | Ajouter regex noms pour prévenir XSS |
| `lib/emails/templates.ts` | Ajouter `escapeHtml()` sur toutes les interpolations |
| `features/auth/services/auth.service.ts` | Supprimer `console.log` sensibles |
| `app/auth/callback/route.ts` | Vérifier onboarding_completed avant redirect dashboard |
| `middleware.ts` | Ajouter `/signup` complet aux routes publiques |

#### Fichiers à **créer** :

| Fichier | Contenu |
|---------|---------|
| `supabase/migrations/YYYYMMDD_fix_guarantor_role.sql` | ALTER CHECK profiles.role + fix trigger handle_new_user |
| `supabase/migrations/YYYYMMDD_user_consents_table.sql` | Table `user_consents` pour traçabilité RGPD |
| `supabase/migrations/YYYYMMDD_guarantor_profiles.sql` | Table `guarantor_profiles` (type_garantie, revenus, etc.) |
| `lib/utils/escape-html.ts` | Helper d'échappement HTML pour les templates email |
| `components/ui/password-strength.tsx` | Indicateur visuel de force du mot de passe |

---

### Estimation de charge totale

| Catégorie | Charge |
|-----------|--------|
| P0 — Corrections critiques (sécurité, cohérence données) | **4 jours/dev** |
| P1 — Corrections importantes (UX, compliance, emails) | **5 jours/dev** |
| P2 — Améliorations (UX, DOM-TOM, feedback) | **3 jours/dev** |
| **Total** | **12 jours/dev** |

---

*Fin de l'audit — Document généré le 2026-02-12*
