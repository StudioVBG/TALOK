# Audit Onboarding Post-Inscription — Propriétaire

**Date :** 29/03/2026
**Scope :** Parcours post-inscription propriétaire, de la confirmation email au premier usage
**Compte test :** contact.explore.mq@gmail.com (Marie-Line VOLBERG)
**Méthode :** Lecture exhaustive du code source (pas de test E2E)

---

## 1. Parcours réel post-inscription propriétaire

### 1.1 Vue d'ensemble du flow

```
Email confirmé
      ↓
/signup/plan?role=owner          ← OBLIGATOIRE — choix plan avant onboarding
      ↓
/owner/onboarding/profile        ← Étape 1/4 (indicateur de progression visible)
      ↓
/owner/onboarding/finance        ← Étape 2/4
      ↓
/owner/onboarding/property       ← Étape 3/4
      ↓
/owner/onboarding/review         ← Étape 4/4 (checklist avant soumission bien)
      ↓
/owner/dashboard                 ← Dashboard + WelcomeModal (1-3 premières connexions) + tour guidé
      ↓
[OPTIONNEL] /owner/onboarding/invite      ← Inviter locataires
[DÉCONNECTÉ] /owner/onboarding/automation ← Niveau automation (jamais appelé dans le flow)
[DÉCONNECTÉ] /owner/money (tab Banque)    ← Stripe Connect (jamais dans l'onboarding)
```

### 1.2 Tableau des étapes

| Étape | Existe ? | Fichier | URL | Obligatoire ? | Persisté en DB ? | Barre progression ? |
|-------|----------|---------|-----|---------------|-----------------|---------------------|
| Choix de plan | ✅ | `app/signup/plan/page.tsx` | `/signup/plan?role=owner` | **Oui** (pas de skip) | `subscriptions` table | Non (hors flow onboarding) |
| Profil proprio | ✅ | `app/owner/onboarding/profile/page.tsx` | `/owner/onboarding/profile` | **Oui** | `owner_profiles` + `onboarding_drafts` + `onboarding_progress` | ✅ Étape 1/4 |
| Finance / IBAN | ✅ | `app/owner/onboarding/finance/page.tsx` | `/owner/onboarding/finance` | **Oui** | `owner_profiles` + `onboarding_drafts` + `onboarding_progress` | ✅ Étape 2/4 |
| Premier bien | ✅ | `app/owner/onboarding/property/page.tsx` | `/owner/onboarding/property` | **Oui** | `properties` (+ `units` si coloc) + `onboarding_drafts` | ✅ Étape 3/4 |
| Validation bien | ✅ | `app/owner/onboarding/review/page.tsx` | `/owner/onboarding/review` | **Oui** | `properties.etat = "submitted"` | ✅ Étape 4/4 |
| Inviter locataires | ✅ | `app/owner/onboarding/invite/page.tsx` | `/owner/onboarding/invite` | Non (bouton "Passer") | `invitations` | ❌ (hors indicateur 4 étapes) |
| Niveau automation | ✅ (page existe) | `app/owner/onboarding/automation/page.tsx` | `/owner/onboarding/automation` | **JAMAIS APPELÉ** | `owner_profiles.automation_level` | ❌ (non intégré au flow) |
| Premier locataire | ❌ Absent | — | — | N/A | N/A | N/A |
| Création premier bail | ❌ Absent | — | — | N/A | N/A | N/A |
| Stripe Connect | ❌ Absent de l'onboarding | `app/owner/money/tabs/CompteBancaireTab.tsx` | `/owner/money?tab=banque` | Non | `stripe_connect_accounts` | ❌ |

---

## 2. Détail de chaque étape

### 2.1 Choix de plan (`/signup/plan`)

**Fichier :** `app/signup/plan/page.tsx`

| Aspect | Détail |
|--------|--------|
| Plans affichés | 4 : Gratuit, Starter, Confort, Pro (pas Enterprise) |
| Plan par défaut sélectionné | **Confort** (pas Gratuit) |
| Option skip | **Aucune** — sélection obligatoire |
| Flow plan gratuit | POST `/api/subscriptions/select-plan` → `subscriptions` table → `/owner/onboarding/profile?subscription=free` |
| Flow plan payant | POST `/api/subscriptions/checkout` → Stripe Checkout → `/owner/onboarding/profile?subscription=success` |
| 1er mois gratuit | Oui — `trial_period_days: 30` (nouveaux clients uniquement, `app/api/subscriptions/checkout/route.ts:174`) |
| Abandon en cours | Cancel URL → `/signup/plan?role=owner&canceled=true` (reprend la page) |
| Persistance | `subscriptions` table, colonne `selected_plan_source: "signup_free"` ou `"checkout"` |

**Note :** Les prix affichés dans la page plan (Confort 24.90€, Pro 59.90€) sont **incohérents** avec la grille officielle (Confort 35€, Pro 69€) — cf. bug connu #9 dans le skill onboarding SOTA.

---

### 2.2 Profil propriétaire — Étape 1/4

**Fichier :** `app/owner/onboarding/profile/page.tsx`

**Champs du formulaire :**

| Champ | Obligatoire | Condition |
|-------|-------------|-----------|
| `type` | Oui | "particulier" ou "societe" |
| `raison_sociale` | Si société | Nom de la société |
| `siren` | Si société | 9 chiffres |
| `siret` | Optionnel | 14 chiffres |
| `tva` | Optionnel | Numéro TVA |
| `ubo` | Optionnel | Bénéficiaire effectif |

**Validation Zod :** `ownerProfileOnboardingSchema` dans `lib/validations/onboarding.ts:107-122`

**Tom AI :** Composant `<TomOnboarding>` présent — guide la saisie via conversation. `onDataUpdate` extrait les infos en temps réel, `onComplete` valide le formulaire. **Pas de formulaire fallback visible** si Tom AI ne charge pas.

**Persistance :**
- PUT `/me/owner-profile` → `owner_profiles` (type, raison_sociale, siren, siret, tva, ubo)
- `onboardingService.saveDraft("owner_profile", data, "owner")` → `onboarding_drafts`
- `onboardingService.markStepCompleted("owner_profile", "owner")` → `onboarding_progress`

**Quit / Reprise :** Draft sauvegardé en localStorage + Supabase. Le formulaire se pré-remplit au retour.

**Retour arrière :** Pas de bouton "Retour" dans l'UI — navigation URL manuelle ou bouton navigateur.

**Entités légales :** Type particulier/société collecté ici mais **aucun enregistrement dans la table `legal_entities`** à cette étape. Stocké dans `owner_profiles.type`.

---

### 2.3 Finance / IBAN — Étape 2/4

**Fichier :** `app/owner/onboarding/finance/page.tsx`

**Champs du formulaire :**

| Groupe | Champ | Obligatoire |
|--------|-------|-------------|
| Encaissement | `encaissement_prefere` : sepa_sdd / virement_sct / virement_inst / pay_by_bank / carte_wallet | Oui |
| Encaissement | `encaissement_secondaires` : tableau de méthodes alternatives | Non |
| Encaissement | `sepa_mandat_type` : core / b2b | Si SEPA |
| Encaissement | `sepa_rum` : référence mandat existant | Non |
| Paiement sortant | `payout_iban` | **Oui** |
| Paiement sortant | `payout_frequence` : immediat / hebdo / mensuel / seuil | Oui |
| Paiement sortant | `payout_jour` : 1-28 | Si mensuel |
| Paiement sortant | `payout_seuil` | Si seuil |
| Paiement sortant | `payout_rail` : sct / sct_inst | Oui |

**Validation Zod :** `ownerFinanceSchema` dans `lib/validations/onboarding.ts:125-140`

**Stripe Connect :** **ABSENT** de cette étape. L'IBAN collecté ici est pour les **virements sortants** (Talok → propriétaire), pas pour recevoir des paiements en ligne des locataires.

**Persistance :**
- PUT `/me/owner-profile` → `owner_profiles` (iban, encaissement_prefere, payout_frequence, payout_rail, payout_seuil, payout_jour)
- `onboardingService.saveDraft("owner_finance", data, "owner")`
- `onboardingService.markStepCompleted("owner_finance", "owner")`

**Quit / Reprise :** Draft auto-sauvegardé. Champs pré-remplis au retour.

**Retour arrière :** Pas de bouton "Retour" dans l'UI.

---

### 2.4 Premier bien — Étape 3/4

**Fichier :** `app/owner/onboarding/property/page.tsx`

**Champs du formulaire :**

| Groupe | Champ | Obligatoire |
|--------|-------|-------------|
| Adresse | `adresse_complete` | Oui |
| Adresse | `code_postal` (5 chiffres) | Oui |
| Adresse | `ville` | Oui |
| Adresse | `departement` (2 chars) | Oui |
| Bien | `type` : appartement / maison / immeuble / local_commercial / bureaux / entrepot / parking / fonds_de_commerce | Oui |
| Bien | `nb_pieces` | Oui |
| Bien | `surface` (m²) | Oui |
| Coloc | `is_colocation` (checkbox) | Non |
| Coloc | `unit_nom` (ex : "Chambre 1") | Si coloc |
| Coloc | `unit_capacite_max` (1-10) | Si coloc |
| Coloc | `unit_surface` | Non |

**Validation Zod :** `firstPropertySchema` dans `lib/validations/onboarding.ts:146-170` (étend `addressSchema` + `financialSchema` + `dpeSchema` + `permisLouerSchema`)

**Note :** Le champ `loyer_base` fait partie du schema (`financialSchema`) mais n'est pas visible dans la liste des champs UI — à vérifier si affiché dans une autre section ou optionnel côté interface.

**Persistance :**
- `propertiesService.createProperty(...)` → table `properties`
- Si coloc : POST `/properties/{id}/units` → table `units`
- `onboardingService.saveDraft("final_review", { property_id }, "owner")`
- `onboardingService.markStepCompleted("first_property", "owner")`

**Quit / Reprise :** Le `property_id` est sauvegardé dans le draft — si quit après création, la propriété existe déjà dans la DB en status `draft`.

**Retour arrière :** Pas de bouton "Retour" dans l'UI.

---

### 2.5 Validation bien — Étape 4/4

**Fichier :** `app/owner/onboarding/review/page.tsx`

**Checklist de validation (7 points) :**

| # | Point | Requis pour submit |
|---|-------|-------------------|
| 1 | Coordonnées complètes (adresse, CP, ville, surface, pièces) | Oui |
| 2 | Données financières (loyer, charges, dépôt > 0) | Oui |
| 3 | Encadrement loyer (si zone encadrée : loyer ≤ plafond) | Oui si applicable |
| 4 | Diagnostics énergétiques (classe DPE, conso, émissions) | Oui |
| 5 | Autorisation de louer (si obligatoire dans la commune) | Oui si applicable |
| 6 | Galerie médias (≥ 1 document/photo + image de couverture) | Oui |
| 7 | Statut du bien (doit être "draft" ou "rejected") | Oui |

**Comportement :** Bouton "Soumettre" désactivé jusqu'à ce que tous les items `valid === true`. **Pas de soumission partielle possible.**

**Persistance :**
- `propertiesService.submitProperty(property.id)` → `properties.etat = "submitted"`
- `onboardingService.markStepCompleted("final_review", "owner")`
- `onboardingService.clearDraft()` — efface le draft

**Bouton retour :** ✅ "Retour au formulaire" présent (redirige vers l'étape property)

**Quit :** Le draft persiste. Au retour suivant, l'utilisateur retrouve la review avec son bien non soumis.

**Redirect succès :** `/owner/dashboard`

---

### 2.6 Inviter locataires — OPTIONNEL (hors indicateur 4 étapes)

**Fichier :** `app/owner/onboarding/invite/page.tsx`

| Aspect | Détail |
|--------|--------|
| Champs | `emails[]` (≥ 1 email valide), `role` (locataire_principal / colocataire / garant) |
| Skip | ✅ Bouton "Passer cette étape" → `/owner` |
| Persistance | `invitations` table (token + email + rôle) |
| Email envoyé | Oui via Resend |
| Doublon check | `invitationsService.hasPendingInvitation()` avant création |
| Redirect succès | Auto-redirect 2s → `/owner` |

**Problème :** Cette étape n'est **pas dans le tableau `STEP_PATH_MAP`** du layout onboarding (`profile=0, finance=1, property=2, review=3`) — elle est accessible manuellement mais **pas appelée automatiquement** après la review.

---

### 2.7 Automation — DÉCONNECTÉ

**Fichier :** `app/owner/onboarding/automation/page.tsx`

| Aspect | Détail |
|--------|--------|
| Page existe | Oui |
| Intégrée au flow | **Non** — absente du `STEP_PATH_MAP` et du tableau `ONBOARDING_STEPS.owner` |
| Niveaux | basique / standard / pro / autopilot |
| Redirect si accédée | → `/owner/onboarding/invite` |
| Persistance | `owner_profiles.automation_level` |

---

## 3. Abandon en cours d'onboarding

| Étape | Quit → que se passe-t-il ? | Reprend-on au bon endroit ? |
|-------|---------------------------|----------------------------|
| Plan | Redirigé vers `/signup/plan?canceled=true` (retour page) | Oui — même page |
| Profil | Draft sauvegardé localStorage + Supabase. `owner_profiles` non mis à jour si formulaire non soumis | ✅ Formulaire pré-rempli |
| Finance | Draft sauvegardé. `owner_profiles` non mis à jour avant submit | ✅ Formulaire pré-rempli |
| Bien | Bien créé dans `properties` (statut `draft`) si formulaire soumis. Sinon rien | ✅ si property_id dans draft |
| Review | Bien reste en `draft` dans la DB. Draft persiste | ✅ Retrouve la review |
| Invite | Invitations NON envoyées si fermeture sans submit | ❌ Draft invitations perdu |

**Mécanisme de reprise :** `onboardingService.getDraft()` — recherche en localStorage d'abord, puis Supabase en fallback. **Un seul draft par utilisateur** (upsert sur `user_id`).

**Middleware :** À la reconnexion, `app/auth/callback/route.ts` vérifie `onboarding_completed_at` et redirige vers l'onboarding si incomplet. Cependant la redirection est vers `/owner/onboarding/profile` (début), pas vers l'étape où l'utilisateur s'était arrêté.

---

## 4. Gestion multi-entités à l'onboarding

| Aspect | Statut | Détail |
|--------|--------|--------|
| Type propriétaire (particulier/société) | ✅ Collecté en étape 1 | Champ `type` dans `owner_profiles` |
| SIREN / SIRET | ✅ Si société | Collecté en étape 1, stocké dans `owner_profiles` |
| Numéro TVA | ✅ Optionnel | Champ `tva` dans `owner_profiles` |
| Bénéficiaire effectif (UBO) | ✅ Optionnel | Champ `ubo` dans `owner_profiles` |
| SARL / SAS / SCI / Indivision | ❌ Pas de distinction | Juste "particulier" vs "société" — pas de type juridique précis |
| Création table `legal_entities` | **Absent** de l'onboarding | Via backfill migration après. L'entité "particulier" est créée automatiquement mais le type SCI/SAS n'y est pas reporté |
| Plusieurs entités | ❌ Impossible à l'onboarding | Section `/owner/entities` est accessible post-onboarding uniquement |

**Constat :** Un propriétaire SCI ne peut pas déclarer la forme juridique précise (SCI, SARL, SAS) à l'inscription — seulement "société". La granularité arrive dans `/owner/entities` post-onboarding.

---

## 5. Stripe Connect

### 5.1 Position dans le parcours

| Aspect | Détail |
|--------|--------|
| Présent dans l'onboarding | **NON** |
| Point d'accès | `/owner/money?tab=banque` → CompteBancaireTab → bouton "Connecter mon compte" |
| Déclencheur | `POST /api/stripe/connect` — création compte Express + génération `onboarding_url` |
| Return URL | `/owner/money?tab=banque` |
| Table DB | `stripe_connect_accounts` |
| Fichier API | `app/api/stripe/connect/route.ts` |

### 5.2 L'app sans Stripe Connect

| Fonctionnalité | Sans Stripe Connect |
|----------------|---------------------|
| Créer propriétés | ✅ Possible |
| Créer baux | ✅ Possible |
| Inviter locataires | ✅ Possible |
| Paiement en ligne par le locataire | ❌ Non fonctionnel si Stripe non configuré |
| Virement bancaire classique | ✅ Possible (IBAN collecté à l'onboarding) |
| Génération quittances | ✅ Possible (si loyer marqué payé manuellement) |

**L'application est utilisable sans Stripe Connect** — les propriétaires peuvent gérer leurs biens et baux, mais ne peuvent pas activer l'encaissement automatique en ligne.

### 5.3 Impact sur le locataire

Si le propriétaire n'a pas configuré Stripe Connect et qu'un locataire tente de payer en ligne : `app/api/leases/[id]/pay/route.ts` — route **deprecated**, redirige vers `/api/payments/create-intent`. Si `STRIPE_SECRET_KEY` absent → 503 "Stripe n'est pas configuré".

---

## 6. Choix de plan

### 6.1 Moment du choix

Le plan est proposé **pendant le signup, avant le premier onboarding** — sur `/signup/plan?role=owner`, déclenché via le callback d'auth (`app/auth/callback/route.ts` : `case 'owner': redirect('/signup/plan?role=owner')`).

### 6.2 Plan par défaut

| Scénario | Plan par défaut |
|----------|----------------|
| Aucune sélection possible (pas de skip) | N/A — sélection obligatoire |
| Plan pré-sélectionné dans l'UI | **Confort** (ligne 54 de `plan/page.tsx`) |
| Si owner créé via API sans passer par /signup/plan | Plan "gratuit" créé via trigger `create_owner_subscription()` |

**Le plan Gratuit est le défaut silencieux si l'utilisateur ne passe pas par la page `/signup/plan`** (inscription programmatique via API). Si l'utilisateur passe par l'UI, le plan Confort est pré-sélectionné.

### 6.3 Post-plan — où atterrit-on ?

| Plan | Redirect |
|------|---------|
| Gratuit | `/owner/onboarding/profile?subscription=free` |
| Payant (Stripe success) | `/owner/onboarding/profile?subscription=success` |
| Payant (Stripe cancel) | `/signup/plan?role=owner&canceled=true` |

### 6.4 Plans affichés vs grille officielle

| Plan | Prix page signup | Prix grille officielle | Écart |
|------|-----------------|----------------------|-------|
| Gratuit | 0€ | 0€ | ✅ |
| Starter | ?(non affiché) | 9€ | — |
| Confort | **24.90€** | **35€** | 🔴 -10.10€ |
| Pro | **59.90€** | **69€** | 🔴 -9.10€ |

**Incohérence tarifaire** : les prix dans l'UI sont ceux de la DB qui n'a pas été mise à jour.

---

## 7. Dashboard — état d'accueil post-onboarding

### 7.1 Première connexion (WelcomeModal)

**Fichiers :** `components/onboarding/FirstLoginOrchestrator.tsx`, `components/onboarding/welcome-modal.tsx`

| Condition d'affichage | Détail |
|----------------------|--------|
| `login_count <= 3` | Oui (sinon supprimé) |
| `welcome_seen_at IS NULL` | Oui |
| `tour_completed_at IS NOT NULL` | Non (skip modal) |
| localStorage `lokatif-welcome-seen` = "true" | Non |

**Contenu pour owners :**
- Emoji 🏠, titre "Bienvenue sur Talok !"
- 4 features : Gestion biens, Baux numériques, Encaissement loyers, Maintenance
- CTA "Configurer mon espace" → lance le tour guidé
- "Plus tard" → marque `onboarding_skipped_at`

### 7.2 Tour guidé — 12 étapes owner

**Fichier :** `components/onboarding/OnboardingTour.tsx`

| # | ID | Titre | Cible | Attribut data-tour |
|---|----|----|-------|-------------------|
| 1 | welcome | Bienvenue sur Talok ! | Centre | — |
| 2 | dashboard | Votre Tableau de Bord | En-tête dashboard | `dashboard-header` |
| 3 | properties | Gestion des Biens | Nav Biens | `nav-properties` |
| 4 | leases | Baux & Locataires | Nav Baux | `nav-leases` |
| 5 | money | Loyers & Quittances | Nav Finances | `nav-money` |
| 6 | inspections | États des Lieux | Nav EDL | `nav-inspections` |
| 7 | tickets | Tickets & Maintenance | Nav Tickets | `nav-tickets` |
| 8 | documents | Documents & Coffre-fort | Nav Documents | `nav-documents` |
| 9 | command-palette | Recherche Rapide | Bouton search | `search-button` |
| 10 | notifications | Notifications | Cloche | `notifications-bell` |
| 11 | support | Aide & Support | Nav Support | `nav-support` |
| 12 | complete | Vous êtes prêt ! | Centre | — |

**Attributs `data-tour` présents dans `owner-app-layout.tsx` :**

| Cible | Présent ? |
|-------|-----------|
| `nav-properties` | ✅ |
| `nav-leases` | ✅ |
| `nav-money` | ✅ |
| `nav-tickets` | ✅ |
| `nav-documents` | ✅ |
| `nav-inspections` | ❌ **ABSENT** — l'item EDL n'est pas dans le menu principal |
| `nav-support` | ❌ **ABSENT** — Support est dans un dropdown, pas dans la nav principale |
| `search-button` | ✅ |
| `notifications-bell` | ✅ |

**Résultat :** 2 des 12 étapes du tour ciblent des éléments inexistants dans le DOM → le spotlight échoue silencieusement pour les étapes 6 et 11.

### 7.3 Dashboard — état vide (0 propriétés)

| Condition | Comportement |
|-----------|-------------|
| 0 propriétés ET complétion < 50% | EmptyState affiché : "Bienvenue sur Talok !" + CTA "Ajouter un bien" → `/owner/properties/new` |
| 0 propriétés MAIS complétion ≥ 50% | Dashboard classique affiché (KPIs à 0) |
| Propriétés présentes | Dashboard complet |

### 7.4 Carte de complétion profil

**Fichier :** `components/owner/dashboard/profile-completion-card.tsx`

**11 tâches (12 pour sociétés) :**

| # | Tâche | Poids | Condition |
|---|-------|-------|-----------|
| 1 | Prénom | +10% | Toujours |
| 2 | Nom | +10% | Toujours |
| 3 | Téléphone | +10% | Toujours |
| 4 | Avatar | +5% | Toujours |
| 5 | Statut juridique | +10% | Toujours |
| 6 | SIRET | +5% | Si société |
| 7 | Coordonnées bancaires (IBAN) | +15% | Toujours |
| 8 | Adresse facturation | +5% | Toujours |
| 9 | Pièce d'identité | +10% | Toujours |
| 10 | Premier bien | +10% | Toujours |
| 11 | Premier bail | +5% | Si bien présent |

**Affiché jusqu'à 100% de complétion** (toujours visible si non complété).

---

## 8. Persistance et tables DB utilisées

| Table | Étape | Données stockées |
|-------|-------|-----------------|
| `subscriptions` | Choix plan | plan_slug, status, selected_plan_source, trial |
| `owner_profiles` | Profil (ét. 1) + Finance (ét. 2) | type, raison_sociale, siren, siret, tva, iban, encaissement_prefere, payout_frequence, payout_rail, automation_level |
| `properties` | Bien (ét. 3) + Review (ét. 4) | adresse_complete, code_postal, ville, type, surface, nb_pieces, etat (draft→submitted) |
| `units` | Bien (ét. 3) — si coloc | nom, capacite_max, surface |
| `onboarding_drafts` | Toutes étapes | user_id, role, step, data (JSON) — **1 seul draft par user** |
| `onboarding_progress` | Toutes étapes | user_id, role, step, completed, completed_at |
| `profiles` | Post-onboarding | welcome_seen_at, tour_completed_at, onboarding_skipped_at, login_count |
| `invitations` | Invite (optionnel) | email, role, token, expires_at |
| `stripe_connect_accounts` | Post-onboarding (manuel) | account_id, status |

---

## 9. Étapes listées dans `onboarding.service.ts` (required steps)

**Fichier :** `features/onboarding/services/onboarding.service.ts:204-213`

```
role_choice
account_creation
email_verification
owner_profile
owner_finance
first_property
final_review
```

**Note :** Ces noms utilisent des underscores (`owner_profile`) alors que les méthodes `markStepCompleted()` dans les pages utilisent aussi des underscores — cohérence OK. L'étape `invite_sent` est marquée mais **pas dans la liste des required steps** → l'onboarding se considère complet sans elle.

---

## 10. Synthèse

### Score global : 6/10

### Points forts

| # | Point fort | Justification |
|---|-----------|---------------|
| 1 | Flow linéaire clair | 4 étapes avec indicateur de progression visible |
| 2 | Persistance draft robuste | localStorage + Supabase, reprise sans perte |
| 3 | Tom AI en étape profil | Guidage conversationnel pour collecte de données |
| 4 | Checklist de validation | 7 critères avant soumission du bien — évite les biens incomplets |
| 5 | Choix plan avant onboarding | Contexte tarifaire clair dès le départ |
| 6 | Carte complétion profil | Persistante dans le dashboard, 11 tâches pondérées |
| 7 | WelcomeModal + tour guidé 12 étapes | Onboarding post-inscription contextuel |
| 8 | IBAN + méthodes paiement collectés | Prêt à facturer dès la fin de l'onboarding |

### Manques identifiés

| # | Manque | Sévérité | Impact |
|---|--------|----------|--------|
| 1 | **Stripe Connect absent de l'onboarding** — le proprio découvre cette étape uniquement dans les settings | Haute | Premier loyer non collecté en ligne sans aller dans /money manuellement |
| 2 | **Tour guidé cassé aux étapes 6 et 11** — `nav-inspections` et `nav-support` absents du DOM | Haute | Spotlight échoue, tour semble bogué lors de la première utilisation |
| 3 | **Pas de bouton "Retour"** dans les étapes 1, 2, 3 | Moyenne | UX dégradée — l'utilisateur doit éditer l'URL ou utiliser le bouton navigateur |
| 4 | **Le callback redirige toujours vers /profile** (étape 1) au lieu de l'étape abandonnée | Moyenne | L'utilisateur qui avait atteint l'étape Finance recommence depuis le début |
| 5 | **Étape automation déconnectée** — page existe mais jamais appelée dans le flow | Moyenne | Feature morte, configuration automation level inaccessible à l'onboarding |
| 6 | **Étape invite non intégrée dans l'indicateur de progression** — jamais appelée automatiquement après review | Moyenne | Les 4 étapes terminent sur le dashboard sans proposer d'inviter un locataire |
| 7 | **Prices incohérentes** — page /signup/plan affiche 24.90€ / 59.90€ (DB) vs 35€ / 69€ (grille officielle) | Haute | Engagement sur un prix incorrect, risque juridique/commercial |
| 8 | **Aucun type juridique précis** (SCI, SAS, SARL, indivision) — seulement "particulier/société" | Moyenne | Propriétaires en SCI ne peuvent pas déclarer leur structure dès l'onboarding |
| 9 | **Tom AI sans fallback formulaire** — si TomOnboarding ne charge pas, l'étape 1 est inutilisable | Moyenne | Dépendance OpenAI/réseau critique pour la première étape |
| 10 | **Pas de création de bail dans l'onboarding** — le nouveau proprio doit trouver seul `/owner/leases/new` | Moyenne | Friction post-onboarding : l'utilisateur a un bien mais pas de locataire ni bail |
| 11 | **La DPE est requise dans la checklist** avant même d'avoir publié le bien | Basse | Bloquant pour les propriétaires qui n'ont pas encore le diagnostic |
| 12 | **Un seul draft par user** — si l'utilisateur a plusieurs onglets, le dernier écrase les autres | Basse | Edge case mais perte de données possible |
| 13 | **`lokatif-welcome-seen`** comme clé localStorage (nom de produit concurrent ?) | Info | À vérifier — clé localStorage devrait être `talok-welcome-seen` |

### Priorités recommandées

1. **P0** — Corriger les prix sur `/signup/plan` (DB : Confort 35€, Pro 69€)
2. **P0** — Corriger les 2 étapes cassées du tour guidé (`nav-inspections`, `nav-support`)
3. **P1** — Intégrer Stripe Connect comme étape post-review de l'onboarding (ou prompt dashboard)
4. **P1** — Implémenter la reprise à la bonne étape (callback → étape abandonnée, pas toujours étape 1)
5. **P1** — Ajouter bouton "Retour" sur les étapes 1, 2, 3
6. **P1** — Chaîner l'étape Invite automatiquement après Review (au lieu d'être orpheline)
7. **P2** — Ajouter l'étape Automation dans le flow (entre Review et Invite, ou dans les settings)
8. **P2** — Ajouter fallback formulaire classique si Tom AI ne charge pas
9. **P2** — Proposer création de bail dans l'onboarding (optionnel, après invite locataire)
10. **P3** — Ajouter types juridiques précis (SCI, SAS, SARL, indivision) au profil
11. **P3** — Renommer la clé localStorage `lokatif-welcome-seen` → `talok-welcome-seen`
