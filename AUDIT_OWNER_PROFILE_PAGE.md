# RAPPORT D'AUDIT COMPLET — Page Profil Propriétaire (/owner/profile)

**Date** : 2026-02-06
**Scope** : Page `/owner/profile`, onglets Identité / Entités / Sécurité
**Statut** : Audit uniquement — aucune modification de code

---

## A. INVENTAIRE DES FICHIERS

### Fichiers principaux de la page

| Chemin | Rôle | Lignes | État |
|--------|------|--------|------|
| `app/owner/profile/page.tsx` | Page d'entrée, wrapper `ProtectedRoute` | 13 | OK |
| `app/owner/profile/profile-form.tsx` | Orchestrateur de tabs + formulaire unifié | 135 | A modifier |
| `components/profile/ProfileIdentityTab.tsx` | Onglet Identité & Contact + champs société | 459 | A modifier |
| `components/profile/ProfileEntitiesTab.tsx` | Onglet Entités (liste via Zustand store) | 159 | A modifier |
| `components/profile/ProfileSecurityTab.tsx` | Onglet Sécurité (mot de passe, 2FA) | 179 | OK |
| `components/profile/profile-completion.tsx` | Indicateur de progression % | 75 | A modifier |
| `components/profile/siret-input.tsx` | Input SIRET avec formatage automatique | 55 | OK (sera réutilisé) |
| `app/owner/profile/loading.tsx` | Skeleton de chargement | 5 | OK |

### Sous-pages du profil

| Chemin | Rôle | Lignes | État |
|--------|------|--------|------|
| `app/owner/profile/identity/page.tsx` | Upload CNI (recto/verso) | 546 | OK |
| `app/owner/profile/banking/page.tsx` | Informations bancaires (IBAN, BIC) | 258 | OK |
| `app/owner/profile/emails/page.tsx` | Aperçu des templates email | 39 | OK |

### Hooks et services

| Chemin | Rôle | Lignes | État |
|--------|------|--------|------|
| `lib/hooks/use-profile-form.ts` | Hook central du formulaire (state, validation, save) | 312 | A modifier |
| `lib/hooks/use-profile.ts` | Fetch du profil par rôle | 124 | OK |
| `features/profiles/services/owner-profiles.service.ts` | Service API pour owner_profiles CRUD | 70 | OK |
| `app/owner/_data/fetchOwnerProfile.ts` | Fetch server-side (profiles + owner_profiles) | 29 | OK |
| `app/owner/_data/fetchProfileCompletion.ts` | Calcul complétion profil (dashboard) | 95 | A modifier |

### State management et entités

| Chemin | Rôle | Lignes | État |
|--------|------|--------|------|
| `stores/useEntityStore.ts` | Store Zustand pour les entités juridiques | 173 | OK |
| `providers/EntityProvider.tsx` | Provider qui charge les entités au mount | ~45 | OK |
| `lib/entities/resolveOwnerIdentity.ts` | Résolveur central d'identité pour documents | 680 | OK (déjà SOTA) |

### Pages entités (existantes, fonctionnelles)

| Chemin | Rôle | Lignes | État |
|--------|------|--------|------|
| `app/owner/entities/page.tsx` | Liste des entités | - | OK |
| `app/owner/entities/new/page.tsx` | Wizard création d'entité (5 étapes) | ~300 | OK |
| `app/owner/entities/[entityId]/page.tsx` | Fiche détail entité | - | OK |
| `app/owner/entities/[entityId]/EntityDetailClient.tsx` | Client component du détail | ~250 | OK |
| `app/owner/entities/actions.ts` | Server actions CRUD entités | ~250 | OK |
| `app/owner/entities/EntitiesPageClient.tsx` | Client component liste | - | OK |
| `features/legal-entities/services/legal-entities.service.ts` | Service entités complet | ~748 | OK |
| `components/entities/create/StepLegalInfo.tsx` | Étape "infos légales" du wizard | ~150 | OK |

### Layout

| Chemin | Rôle | Lignes | État |
|--------|------|--------|------|
| `app/owner/layout.tsx` | Layout owner (auth, EntityProvider, OwnerDataProvider) | 91 | OK |

---

## B. SCHEMA DE DONNEES ACTUEL

### Table `profiles`
```
profiles
├── id              UUID (PK)
├── user_id         UUID (FK → auth.users)
├── role            TEXT ('owner', 'tenant', 'provider', 'admin')
├── prenom          TEXT
├── nom             TEXT
├── email           TEXT
├── telephone       TEXT
├── avatar_url      TEXT
├── date_naissance  DATE
├── lieu_naissance  TEXT (via cast)
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ
```

### Table `owner_profiles`
```
owner_profiles
├── profile_id           UUID (PK, FK → profiles.id)
├── type                 TEXT ('particulier' | 'societe')      ← DONNÉE MIXTE
├── siret                TEXT                                   ← DONNÉE ENTITÉ
├── tva                  TEXT                                   ← DONNÉE ENTITÉ
├── iban                 TEXT
├── adresse_facturation  TEXT
├── raison_sociale       TEXT                                   ← DONNÉE ENTITÉ
├── adresse_siege        TEXT                                   ← DONNÉE ENTITÉ
├── forme_juridique      TEXT (CHECK: SARL, SAS, SASU, SCI...) ← DONNÉE ENTITÉ
├── bic                  VARCHAR(11)
├── titulaire_compte     VARCHAR(255)
├── nom_banque           VARCHAR(255)
├── usage_strategie      TEXT
├── tva_optionnelle      BOOLEAN
├── tva_taux             NUMERIC(5,2)
├── notes_fiscales       TEXT
├── onboarding_completed BOOLEAN
├── onboarding_completed_at TIMESTAMPTZ
├── created_at           TIMESTAMPTZ
└── updated_at           TIMESTAMPTZ
```

### Table `legal_entities` (existe depuis migration `20260115000000`)
```
legal_entities
├── id                  UUID (PK)
├── owner_profile_id    UUID (FK → owner_profiles.profile_id)
├── entity_type         TEXT ('particulier', 'sci_ir', 'sci_is', 'sarl', ...)
├── nom                 TEXT                     ← Équivalent de raison_sociale
├── nom_commercial      TEXT
├── siren               TEXT (9 chiffres)
├── siret               TEXT (14 chiffres)
├── rcs_ville           TEXT
├── rcs_numero          TEXT
├── numero_tva          TEXT
├── code_ape            TEXT
├── adresse_siege       TEXT
├── complement_adresse  TEXT
├── code_postal_siege   TEXT
├── ville_siege         TEXT
├── pays_siege          TEXT (DEFAULT 'France')
├── forme_juridique     TEXT
├── capital_social      DECIMAL(12,2)
├── regime_fiscal       TEXT ('ir', 'is', 'ir_option_is', 'is_option_ir')
├── tva_assujetti       BOOLEAN
├── tva_regime          TEXT
├── tva_taux_defaut     DECIMAL(5,2)
├── date_creation       DATE
├── iban                TEXT
├── bic                 TEXT
├── banque_nom          TEXT
├── titulaire_compte    TEXT
├── type_gerance        TEXT
├── is_active           BOOLEAN
├── couleur             TEXT
├── icone               TEXT
├── notes               TEXT
├── metadata            JSONB
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
```

### Relations clés

```
profiles (1) ──→ (1) owner_profiles       [profile_id]
owner_profiles (1) ──→ (N) legal_entities  [owner_profile_id]
legal_entities (1) ──→ (N) entity_associates [legal_entity_id]
legal_entities (1) ──→ (N) properties      [legal_entity_id, nullable]
legal_entities (1) ──→ (N) leases          [signatory_entity_id, nullable]
legal_entities (1) ──→ (N) documents       [entity_id, nullable]
legal_entities (1) ──→ (N) invoices        [issuer_entity_id, nullable]
properties (N) ──→ (1) profiles            [owner_id]
leases (N) ──→ (1) properties              [property_id]
```

### Observation critique

La table `legal_entities` **existe déjà** avec un schéma riche et complet. Les FK `legal_entity_id` sur `properties` et `signatory_entity_id` sur `leases` sont **déjà en place**. Le problème n'est donc **pas** un manque de schéma, mais un **manque de migration des données** depuis `owner_profiles` vers `legal_entities`, et un **manque de synchronisation UI** entre les deux onglets.

---

## C. PROBLEMES IDENTIFIES

### P1. Champs d'entité dans l'onglet Identité (MAJEUR — criticité 5/5)

**Description** : Les champs raison_sociale, forme_juridique, siret, adresse_siege, et tva sont affichés dans `ProfileIdentityTab.tsx` (lignes 321-421), conditionnés par `owner_type === "societe"`. Ces champs sont des données d'entité juridique qui devraient être dans l'onglet Entités.

**Fichiers concernés** :
- `components/profile/ProfileIdentityTab.tsx:321-421`
- `lib/hooks/use-profile-form.ts:23-28` (interface `ProfileFormData`)
- `lib/hooks/use-profile-form.ts:62-68` (valeurs par défaut)
- `lib/hooks/use-profile-form.ts:83-88` (mapping depuis ownerProfile)
- `lib/hooks/use-profile-form.ts:169-187` (validation conditionnelle)
- `lib/hooks/use-profile-form.ts:235-246` (payload de sauvegarde)

**Impact** : Confusion architecturale — les données société sont sauvegardées dans `owner_profiles` (table mono-entité) au lieu de `legal_entities` (table multi-entité). Un propriétaire ne peut avoir qu'une seule société alors que `legal_entities` supporte N entités.

---

### P2. Duplication des données société (MAJEUR — criticité 4/5)

**Description** : Les mêmes données (raison_sociale, siret, forme_juridique, adresse_siege) existent potentiellement en double :
1. Dans `owner_profiles` (via le formulaire du tab Identité)
2. Dans `legal_entities` (via le wizard `/owner/entities/new`)

Il n'y a aucun mécanisme de synchronisation entre les deux.

**Fichiers concernés** :
- `lib/hooks/use-profile-form.ts:235-246` (écrit dans owner_profiles)
- `app/owner/entities/actions.ts` (écrit dans legal_entities)

**Impact** : Incohérence des données — un propriétaire peut avoir un SIRET différent dans `owner_profiles` et dans `legal_entities`.

---

### P3. Modèle mono-entité dans owner_profiles (MAJEUR — criticité 4/5)

**Description** : Le champ `owner_type` dans `owner_profiles.type` force un modèle binaire (particulier/societe). Un propriétaire personne physique qui détient 2 SCI et 1 SARL ne peut pas représenter cette réalité avec un seul champ `type = "societe"`.

**Fichiers concernés** :
- `lib/hooks/use-profile-form.ts:23` (`owner_type: OwnerType`)
- `components/profile/ProfileIdentityTab.tsx:301-317` (sélecteur binaire)

**Impact** : Limitation fonctionnelle majeure — le modèle `legal_entities` (multi-entité, multi-type) est en place mais court-circuité par le formulaire mono-entité du profil.

---

### P4. Onglet Entités : état vide erroné (MINEUR — criticité 2/5)

**Description** : Le composant `ProfileEntitiesTab.tsx` fonctionne correctement : il affiche les entités depuis `useEntityStore` et propose un bouton "Créer une entité" si `entities.length === 0`. Le problème est que si l'utilisateur a renseigné ses champs société dans l'onglet Identité mais n'a jamais créé d'entité dans `legal_entities`, l'onglet Entités affiche "Aucune entité juridique" alors que des données existent dans `owner_profiles`.

**Fichiers concernés** :
- `components/profile/ProfileEntitiesTab.tsx:55-75` (état vide)
- `stores/useEntityStore.ts:64-117` (fetch depuis `legal_entities` uniquement)

**Impact** : Confusion utilisateur — les données société existent mais ne sont pas visibles dans le bon onglet.

---

### P5. Barre de progression inclut les champs entité (MINEUR — criticité 2/5)

**Description** : Le calcul de complétion dans `profile-completion.tsx:25-32` inclut les champs `raison_sociale`, `forme_juridique`, `siret`, et `adresse_siege` quand `owner_type === "societe"`. Si ces champs migrent vers l'onglet Entités, le calcul devra être revu.

**Fichiers concernés** :
- `components/profile/profile-completion.tsx:25-32`
- `app/owner/_data/fetchProfileCompletion.ts:82-85` (dashboard completion)

**Impact** : La barre de progression affichera un pourcentage incorrect après migration.

---

### P6. L'onglet Identité conserve le sélecteur "Type de propriétaire" (MINEUR — criticité 1/5)

**Description** : Le champ `owner_type` (Particulier/Société) reste pertinent dans l'onglet Identité comme indicateur, mais il ne devrait plus conditionner l'affichage des champs entité dans ce même onglet.

**Fichiers concernés** :
- `components/profile/ProfileIdentityTab.tsx:300-318`

**Impact** : Minimal si le sélecteur est conservé comme métadonnée mais découplé des champs société.

---

### P7. TODO non résolu dans l'onboarding (MINEUR — criticité 1/5)

**Description** : `app/owner/onboarding/profile/page.tsx:76` contient un TODO : "Ajouter raison_sociale si le schéma BDD le supporte (pour l'instant mappé sur le type societe)". Cela confirme que le problème est identifié mais pas traité.

**Fichier** : `app/owner/onboarding/profile/page.tsx:76`

---

## D. CARTE DES DEPENDANCES DOCUMENTAIRES

### D.1. Résolveur central : `resolveOwnerIdentity`

Toute la génération de documents passe par `lib/entities/resolveOwnerIdentity.ts`. Ce fichier implémente **déjà** le pattern de migration correct :

```
1. entityId fourni → fetch legal_entities          (source: "legal_entity")
2. leaseId → lease.signatory_entity_id → legal_entities
3. propertyId → property.legal_entity_id → legal_entities
4. profileId → fallback owner_profiles + profiles  (source: "owner_profile_fallback")
```

La propriété `source` de `OwnerIdentity` indique quelle stratégie a été utilisée.

### D.2. Tableau des dépendances documentaires

| Document | Champ utilisé | Source actuelle (via resolveOwnerIdentity) | Fichier template/générateur | Statut |
|----------|--------------|-------------------------------------------|---------------------------|--------|
| **Bail habitation** | displayName, legalCaption, siret, companyName, legalForm, representative, address | `legal_entities` si entity_id existe, sinon `owner_profiles` fallback | `app/api/leases/[id]/pdf/route.ts:202-295` | 🟡 A ADAPTER |
| **Bail meublé** | idem | idem | `lib/templates/bail/bail-meuble.template.ts` | 🟡 A ADAPTER |
| **Bail commercial** | idem + tvaNumber | idem | `lib/templates/bail/bail-commercial.template.ts` | 🟡 A ADAPTER |
| **Bail professionnel** | idem + numero_tva_intra | idem | `lib/templates/bail/bail-professionnel.template.ts` | 🟡 A ADAPTER |
| **Bail étudiant** | idem | idem | `lib/templates/bail/bail-etudiant.template.ts` | 🟡 A ADAPTER |
| **Bail mobilité** | idem | idem | `lib/templates/bail/bail-mobilite.template.ts` | 🟡 A ADAPTER |
| **Bail saisonnier** | idem | idem | `lib/templates/bail/bail-saisonnier.template.ts` | 🟡 A ADAPTER |
| **Bail colocation** | idem | idem | `lib/templates/bail/bail-colocation.template.ts` | 🟡 A ADAPTER |
| **Bail parking** | idem | idem | `lib/templates/bail/bail-parking.template.ts` | 🟡 A ADAPTER |
| **Bail dérogatoire** | idem | idem | `lib/templates/bail/bail-derogatoire.template.ts` | 🟡 A ADAPTER |
| **Bail location-gérance** | idem + loueur_numero_tva | idem | `lib/templates/bail/bail-location-gerance.template.ts` | 🟡 A ADAPTER |
| **Quittance de loyer** | ownerName, ownerAddress, ownerSiret | Construit via query directe (pas toujours via resolveOwnerIdentity) | `lib/services/receipt-generator.ts` | 🟡 A ADAPTER |
| **État des lieux (entrée)** | nom_complet, raison_sociale, representant, adresse, type | Via query directe dans `app/api/edl/pdf/route.ts` | `lib/templates/edl/edl.template.ts` | 🟡 A ADAPTER |
| **État des lieux (sortie)** | idem | idem | `lib/templates/edl/edl.template.ts` | 🟡 A ADAPTER |
| **EDL commercial** | idem | idem | `lib/templates/edl/edl-commercial.template.ts` | 🟡 A ADAPTER |
| **CRG (Compte Rendu de Gestion)** | gestionnaire.raison_sociale, gestionnaire.adresse | Via query accounting | `features/accounting/services/pdf-export.service.ts` | 🟡 A ADAPTER |
| **Récapitulatif fiscal** | proprietaire.raison_sociale | Via query accounting | `features/accounting/services/pdf-export.service.ts` | 🟡 A ADAPTER |
| **Régularisation de charges** | owner name, address, SIRET | Via template | `lib/pdf/templates.ts` | 🟡 A ADAPTER |
| **Appel de fonds** | copropriétaire info, IBAN | Via template | `lib/pdf/templates.ts` | 🟡 A ADAPTER |
| **PV d'AG** | owner_name, lot info | Via template | `lib/pdf/templates.ts` | 🟢 SAFE |
| **Bail signé (PDF)** | displayName, companyName, siret, forme_juridique | Via resolveOwnerIdentity | `app/api/leases/[id]/pdf-signed/route.ts` | 🟡 A ADAPTER |
| **Aperçu HTML bail** | raison_sociale, siret, type, adresse_siege | Query directe owner_profiles | `app/api/leases/[id]/html/route.ts:271-273` | 🔴 CASSÉ SI NON TRAITÉ |
| **Aperçu signature** | raison_sociale | Query directe owner_profiles | `app/api/signature/[token]/preview/route.ts:110` | 🔴 CASSÉ SI NON TRAITÉ |
| **EDL preview** | raison_sociale, type | Query directe | `app/api/edl/preview/route.ts:402-404` | 🔴 CASSÉ SI NON TRAITÉ |
| **Webhook Stripe** | raison_sociale, type, adresse_siege | Query owner_profiles | `app/api/webhooks/stripe/route.ts:57-92` | 🔴 CASSÉ SI NON TRAITÉ |

### D.3. Analyse de risque par catégorie

| Catégorie | Nombre | Risque |
|-----------|--------|--------|
| 🟢 SAFE — Données snapshotées, pas d'impact | 1 | Aucun |
| 🟡 A ADAPTER — Utilise resolveOwnerIdentity avec fallback | 18 | **Moyen** — Le fallback fonctionne mais doit être maintenu pendant la transition |
| 🔴 CASSÉ SI NON TRAITÉ — Query directe sur owner_profiles | 4 | **Critique** — Ces routes accèdent directement à `owner_profiles.raison_sociale` etc. sans passer par `resolveOwnerIdentity` |

### D.4. Routes à risque critique (🔴)

1. **`app/api/leases/[id]/html/route.ts:271-273`** — Génère l'aperçu HTML du bail. Lit `raison_sociale`, `siret`, `adresse_siege` directement depuis `owner_profiles`. Si ces colonnes sont vidées après migration, l'aperçu sera vide.

2. **`app/api/signature/[token]/preview/route.ts:110`** — Aperçu du bail pour le signataire. Affiche `raison_sociale` conditionnellement si `type === "societe"`. Source directe : `owner_profiles`.

3. **`app/api/edl/preview/route.ts:402-404`** — Aperçu de l'état des lieux. Construit `nom_complet` avec `raison_sociale` si `type === "societe"`. Source directe : `owner_profiles`.

4. **`app/api/webhooks/stripe/route.ts:57-92`** — Webhook Stripe. Récupère `raison_sociale`, `adresse_siege` depuis `owner_profiles` pour construire les données de facturation.

---

## E. DONNEES A MIGRER

| Champ | Source actuelle | Destination cible | Documents impactés | Risque |
|-------|----------------|-------------------|-------------------|--------|
| `raison_sociale` | `owner_profiles.raison_sociale` | `legal_entities.nom` | Baux, quittances, EDL, CRG, fiscal, HTML preview, signature preview, EDL preview, Stripe webhook | 🔴 Élevé |
| `forme_juridique` | `owner_profiles.forme_juridique` | `legal_entities.forme_juridique` | Baux, HTML preview | 🟡 Moyen |
| `siret` | `owner_profiles.siret` | `legal_entities.siret` | Baux, quittances, régularisation charges, HTML preview | 🔴 Élevé |
| `adresse_siege` | `owner_profiles.adresse_siege` | `legal_entities.adresse_siege` | Baux, EDL, CRG, Stripe webhook | 🔴 Élevé |
| `tva` | `owner_profiles.tva` | `legal_entities.numero_tva` | Baux commerciaux, professionnels, location-gérance | 🟡 Moyen |
| `owner_type` | `owner_profiles.type` | Reste dans `owner_profiles` comme indicateur legacy. Les entités sont auto-suffisantes via `entity_type`. | Tous les documents avec logique conditionnelle | 🟡 Moyen |

---

## F. COMPOSANTS MANQUANTS

### F.1. Composants à créer

| Composant | Description | Priorité |
|-----------|-------------|----------|
| **Bannière de migration** dans ProfileIdentityTab | Si `owner_profiles` contient des données société ET `legal_entities` est vide, afficher un CTA "Migrer vers une entité" | Haute |
| **Script de migration automatique** | Créer automatiquement une `legal_entity` à partir des données `owner_profiles` quand `type = "societe"` | Haute |
| **Sélecteur d'entité dans le formulaire de bail** | Permettre de choisir quelle entité signe le bail (si le propriétaire en a plusieurs) | Haute |
| **Lien "Gérer mes entités"** dans ProfileIdentityTab | Remplacer les champs société par un lien vers l'onglet Entités | Moyenne |

### F.2. Composants existants déjà fonctionnels (pas besoin de les créer)

- **Bouton "Créer une entité"** dans l'onglet Entités → `ProfileEntitiesTab.tsx:67-72` (existe)
- **Formulaire de création d'entité** → `app/owner/entities/new/page.tsx` (wizard 5 étapes, existe)
- **Liste des entités avec liens** → `ProfileEntitiesTab.tsx:78-156` (existe)
- **Fiche détail entité** → `app/owner/entities/[entityId]/EntityDetailClient.tsx` (existe)
- **Actions CRUD entités** → `app/owner/entities/actions.ts` (existe)
- **Store Zustand entités** → `stores/useEntityStore.ts` (existe)

---

## G. RECOMMANDATIONS D'ARCHITECTURE

### Onglet Identité (données personnelles uniquement)

```
Card "Identité & contact"
├── Avatar + upload
├── Prénom *
├── Nom *
├── Téléphone
├── Date de naissance
└── Lieu de naissance

Card "Profil propriétaire"
├── Type de propriétaire (Particulier/Société) — conservé comme indicateur
├── IBAN (optionnel)
└── Adresse de facturation (optionnel)

// SUPPRIMÉ de cet onglet :
// ❌ Raison sociale
// ❌ Forme juridique
// ❌ SIRET
// ❌ Adresse du siège social
// ❌ Numéro TVA
```

Si `owner_type === "societe"` et aucune entité n'existe dans `legal_entities`, afficher un **encart de migration** :

> "Vous avez indiqué être une société. Créez votre entité juridique pour gérer vos informations légales (SIRET, raison sociale, etc.)"
> [Bouton → Créer mon entité]

### Onglet Entités (données juridiques)

```
Header
├── Compteur "N entité(s) juridique(s)"
└── Bouton "Nouvelle entité"

Liste des entités (cards)
├── Nom + Badge type (SCI IR, SARL, etc.)
├── SIRET vérifié (✅ / ⚠️)
├── Nombre de biens associés
├── Nombre de baux actifs
└── Lien → Fiche détail

Lien "Voir toutes les entités" → /owner/entities
```

Cet onglet fonctionne **déjà correctement** via `ProfileEntitiesTab.tsx` + `useEntityStore`. Le seul problème est l'absence de données dans `legal_entities` quand les données sont dans `owner_profiles`.

---

## H. STRATEGIE DE MIGRATION SANS CASSE

### Phase 1 : Préparation (zéro impact sur l'existant)

1. **Vérifier que la table `legal_entities` existe** — ✅ Déjà fait (migration `20260115000000`)
2. **Vérifier que `properties.legal_entity_id` existe** — ✅ Déjà fait
3. **Vérifier que `leases.signatory_entity_id` existe** — ✅ Déjà fait
4. **Vérifier que `resolveOwnerIdentity` gère le fallback** — ✅ Déjà fait (source: "owner_profile_fallback")

### Phase 2 : Migration des données

5. **Créer un script SQL de migration** qui, pour chaque `owner_profiles` où `type = 'societe'` et `raison_sociale IS NOT NULL` :
   - Crée une entrée `legal_entities` avec :
     - `owner_profile_id` = owner_profiles.profile_id
     - `entity_type` = déduit de `forme_juridique` (SCI → 'sci_ir', SARL → 'sarl', etc.)
     - `nom` = owner_profiles.raison_sociale
     - `siret` = owner_profiles.siret
     - `forme_juridique` = owner_profiles.forme_juridique
     - `adresse_siege` = owner_profiles.adresse_siege
     - `numero_tva` = owner_profiles.tva
     - `is_active` = true
   - **NE PAS** vider les colonnes de `owner_profiles` (garder pour le fallback)

6. **Mettre à jour les FK** :
   - Pour chaque `property` dont `owner_id` est le profile_id du propriétaire société ET `legal_entity_id IS NULL` → setter `legal_entity_id` vers la nouvelle entité
   - Pour chaque `lease` actif lié à ces propriétés, setter `signatory_entity_id` si NULL

7. **Vérifier l'intégrité** :
   - Compter les owner_profiles avec type='societe' = X
   - Compter les legal_entities créées = X
   - Compter les properties mises à jour
   - Compter les leases mis à jour

### Phase 3 : Double lecture (période de transition)

8. **`resolveOwnerIdentity` gère déjà le fallback** — Aucun changement requis. Les documents liront EN PRIORITÉ depuis `legal_entities` (si `signatory_entity_id` ou `legal_entity_id` est renseigné), avec fallback sur `owner_profiles`.

9. **Migrer les 4 routes à risque critique (🔴)** pour utiliser `resolveOwnerIdentity` au lieu de query directe :
   - `app/api/leases/[id]/html/route.ts` — Remplacer la query `owner_profiles.raison_sociale` par `resolveOwnerIdentity({ leaseId })`
   - `app/api/signature/[token]/preview/route.ts` — Idem
   - `app/api/edl/preview/route.ts` — Idem
   - `app/api/webhooks/stripe/route.ts` — Idem

10. **Tester chaque document** — Générer un bail, une quittance, un EDL pour un propriétaire société et vérifier que toutes les données apparaissent.

### Phase 4 : Mise à jour UI

11. **Modifier `ProfileIdentityTab.tsx`** :
    - Supprimer les champs société (lignes 321-421)
    - Conserver le sélecteur `owner_type` comme indicateur
    - Si `owner_type === "societe"` et pas d'entité, afficher le CTA de migration
    - Si entité existe, afficher un lien "Gérer mon entité →"

12. **Modifier `use-profile-form.ts`** :
    - Supprimer `raison_sociale`, `forme_juridique`, `siret`, `adresse_siege`, `tva` de `ProfileFormData`
    - Supprimer la validation conditionnelle pour ces champs
    - Supprimer ces champs du payload `ownerPayload`

13. **Modifier `profile-completion.tsx`** :
    - Supprimer les champs société du calcul
    - Éventuellement, inclure "a au moins une entité" si `owner_type === "societe"`

14. **Modifier `fetchProfileCompletion.ts`** :
    - Remplacer `hasSiret` par une vérification dans `legal_entities`
    - Adapter `hasBillingAddress`

### Phase 5 : Nettoyage

15. **Après validation complète** (minimum 1 mois de double lecture) :
    - Supprimer les colonnes orphelines de `owner_profiles` : `raison_sociale`, `forme_juridique`, `adresse_siege` (garder `siret` et `tva` comme legacy si nécessaire)
    - Supprimer le fallback dans `resolveOwnerIdentity` (optionnel, peut rester comme sécurité)
    - Mettre à jour les types TypeScript

16. **Tests e2e complets** (voir section I)

---

## I. PLAN DE TESTS POST-MIGRATION

### Tests de non-régression documentaire

- [ ] Générer un nouveau bail habitation (propriétaire société) → vérifier raison sociale, SIRET, forme juridique, adresse siège
- [ ] Générer un nouveau bail habitation (propriétaire particulier) → vérifier nom/prénom, pas de champs société
- [ ] Ouvrir un bail existant (créé avant migration) → vérifier que les infos sont toujours présentes via fallback
- [ ] Générer une quittance de loyer → vérifier ownerName = raison sociale si société
- [ ] Générer un EDL d'entrée → vérifier les données propriétaire/entité
- [ ] Générer un EDL commercial → vérifier les données société
- [ ] Aperçu HTML d'un bail (`/api/leases/[id]/html`) → vérifier raison sociale affichée
- [ ] Aperçu signature (`/api/signature/[token]/preview`) → vérifier affichage conditionnel
- [ ] Aperçu EDL (`/api/edl/preview`) → vérifier nom complet
- [ ] Webhook Stripe → vérifier que les données de facturation sont correctes

### Tests fonctionnels UI

- [ ] Créer une nouvelle entité depuis l'onglet Entités → vérifier apparition dans la liste
- [ ] Modifier une entité → vérifier que les documents futurs utilisent les nouvelles données
- [ ] Supprimer une entité liée à des baux → vérifier le comportement (blocage attendu)
- [ ] Vérifier la barre de progression du profil après suppression des champs société
- [ ] Vérifier le CTA de migration si owner_type="societe" et pas d'entité
- [ ] Vérifier que le dashboard profile-completion-card est cohérent

### Tests de migration de données

- [ ] Propriétaire avec type="societe" et raison_sociale → entité créée automatiquement
- [ ] Propriétaire avec type="particulier" → aucune entité créée
- [ ] Propriété du propriétaire société → legal_entity_id renseigné
- [ ] Bail actif du propriétaire société → signatory_entity_id renseigné
- [ ] Données identiques entre owner_profiles et legal_entities nouvellement créée

### Tests de régression

- [ ] Vérifier que l'onboarding owner fonctionne toujours
- [ ] Vérifier que la page `/owner/entities` fonctionne toujours
- [ ] Vérifier que le wizard `/owner/entities/new` fonctionne toujours
- [ ] Vérifier que le dashboard owner affiche les bonnes données
- [ ] Vérifier que les paiements Stripe fonctionnent (webhook)

---

## J. VERIFICATION DES COMPOSANTS INVISIBLES

### TODOs trouvés

| Fichier | Ligne | Contenu | Impact |
|---------|-------|---------|--------|
| `app/owner/onboarding/profile/page.tsx` | 76 | "TODO: Ajouter raison_sociale si le schéma BDD le supporte" | Confirme la dette technique |
| `app/provider/onboarding/profile/page.tsx` | 111 | "TODO: Ajouter ces champs au schéma provider_profiles" | Hors scope mais similaire |

### Code mort identifié

Aucun composant mort identifié directement lié à la page profil. Les composants sont tous importés et utilisés.

### Migrations existantes

La migration `20260115000000_multi_entity_architecture.sql` a **déjà créé** :
- Table `legal_entities` avec toutes les colonnes nécessaires
- Table `entity_associates` pour les associés
- Table `property_ownership` pour la multi-détention
- FK `legal_entity_id` sur `properties`
- FK `signatory_entity_id` sur `leases`
- FK `issuer_entity_id` sur `invoices`
- FK `entity_id` sur `documents`
- Politiques RLS sur toutes ces tables

Le schéma est **prêt**. Seule manque la migration des données existantes et l'adaptation UI.

---

## K. RESUME EXECUTIF

### Ce qui fonctionne déjà

1. La table `legal_entities` existe avec un schéma riche et complet
2. Les FK sur `properties`, `leases`, `documents`, `invoices` sont en place
3. `resolveOwnerIdentity` implémente le pattern entity-first avec fallback
4. L'onglet Entités (`ProfileEntitiesTab`) est fonctionnel avec store Zustand
5. Le wizard de création d'entité (`/owner/entities/new`) est complet
6. Les pages de gestion d'entités existent et fonctionnent
7. Les RLS policies sont en place

### Ce qui doit être corrigé

1. **Supprimer les champs entité de l'onglet Identité** (raison_sociale, siret, forme_juridique, adresse_siege, tva)
2. **Migrer les données existantes** de `owner_profiles` vers `legal_entities` pour les propriétaires société
3. **Mettre à jour les FK** (properties.legal_entity_id, leases.signatory_entity_id)
4. **Adapter 4 routes critiques** qui font des query directes sur owner_profiles au lieu de passer par resolveOwnerIdentity
5. **Mettre à jour le calcul de complétion** du profil
6. **Ajouter un CTA de migration** pour les propriétaires société sans entité

### Risque global de la migration

**MOYEN** — L'architecture cible (multi-entité) est **déjà en place** au niveau BDD et service. Le résolveur `resolveOwnerIdentity` gère déjà le fallback. Le risque principal est sur les **4 routes qui font des query directes** sur `owner_profiles` et sur la **synchronisation des données** lors de la migration. En suivant la stratégie de double-lecture (Phase 3), le risque de casse est minimal.
