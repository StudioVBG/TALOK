---
name: talok-buildings
description: >
  Architecture complète de la gestion des immeubles et lots Talok côté propriétaire :
  modèle données (buildings, building_units, properties), ownership_type full/partial,
  wizard de création, page hub managérial, routes UI et API, distinction avec le module
  syndic, règles de scoping baux/factures/tickets. Déclenche dès que la tâche touche à
  immeuble, lot, building, copropriétaire partiel, plan des lots, fiche immeuble,
  wizard building_config, BuildingVisualizer, ou route /owner/buildings.
---

# Talok — Gestion des immeubles et lots (SOTA 2026)

## 1. Modèle mental

Talok distingue trois concepts strictement séparés :

| Concept | Définition | Exemples |
|---|---|---|
| **Bien unitaire** | Une property standalone sans parent | Un appart isolé, une maison, un studio |
| **Lot d'immeuble** | Une property avec `parent_property_id` pointant vers un immeuble wrapper | Un appart dans une SCI qui possède plusieurs apparts au même endroit |
| **Immeuble conteneur** | Une property `type='immeuble'` + un record `buildings` + N `building_units` | La SCI Route du Phare, 4 apparts |

**Règle d'or** : le propriétaire ne voit **jamais** le wrapper `type='immeuble'` comme un bien dans la liste "Mes biens". Il voit ses lots individuellement (avec un badge vers l'immeuble parent) **et** l'immeuble comme un hub managérial dans l'onglet "Immeubles".

## 2. Modèle de données

### Tables

```
properties                             — Tous les biens (lots + unitaires + wrappers)
├── id (UUID PK)
├── owner_id (FK profiles)
├── type (enum 14 types — inclut 'immeuble' pour le wrapper)
├── parent_property_id (UUID, FK properties) — non-null pour les lots, pointe vers le wrapper
├── legal_entity_id (FK legal_entities) — entité SCI/EIRL/etc.
├── adresse_complete, code_postal, ville, ...
├── loyer_hc, charges, depot_garantie, ...
└── etat, deleted_at

buildings                              — Métadonnées physiques + équipements communs
├── id (UUID PK)
├── owner_id (FK profiles) NOT NULL
├── property_id (FK properties) — pointe vers le wrapper type='immeuble', nullable
├── ownership_type (ENUM: 'full' | 'partial') DEFAULT 'full'  ← à ajouter
├── total_lots_in_building (INTEGER nullable)  ← à ajouter (informatif si partial)
├── name, adresse_complete, code_postal, ville, departement
├── floors, construction_year, surface_totale
├── has_ascenseur, has_gardien, has_interphone, has_digicode
├── has_local_velo, has_local_poubelles, has_parking_commun, has_jardin_commun
├── notes, deleted_at
└── created_at, updated_at

building_units                         — Plan d'étage (floor/position) + ref lot
├── id (UUID PK)
├── building_id (FK buildings) ON DELETE CASCADE NOT NULL
├── property_id (FK properties) NULLABLE — la property lot correspondante
├── floor, position (UNIQUE per building)
├── type (appartement|studio|local_commercial|parking|cave|bureau)
├── template (studio|t1|t2|t3|t4|t5|local|parking|cave)
├── surface, nb_pieces, loyer_hc, charges, depot_garantie
├── status (vacant|occupe|travaux|reserve)
├── current_lease_id (FK leases) ON DELETE SET NULL
└── created_at, updated_at
```

### Relations

```
properties (type='immeuble', wrapper)
    ↑ property_id
    ↑
buildings
    ↓ id
    ↓
building_units
    ↓ property_id
    ↓
properties (type≠'immeuble', le lot réel)
    ↑ parent_property_id → wrapper
```

Le wrapper property existe pour faire la jointure entre `buildings` et les lots. Il n'est **jamais** exposé comme un bien dans les listes utilisateur.

### `ownership_type` (à ajouter)

| Valeur | Signification |
|---|---|
| `'full'` | Le propriétaire possède TOUS les lots de l'immeuble physique. Talok gère tout. |
| `'partial'` | Le propriétaire possède seulement CERTAINS lots (copropriété avec d'autres propriétaires). Talok ne gère que ses lots à lui, les parties communes sont en lecture-seule, la gouvernance est externe (syndic). |

Backfill : tous les records existants → `'full'` (comportement actuel).

## 3. Quota forfait

Un immeuble = **N biens dans le quota** où N est le nombre de lots du user.

```
buildings                 → ne consomme pas de slot
properties type=immeuble  → ne consomme pas de slot (wrapper technique)
properties (lots)         → consomme 1 slot chacun
properties (unitaires)    → consomme 1 slot chacun
```

Fichier : `lib/subscriptions/check-limit.ts` — filtre `neq('type', 'immeuble')`.

**Exemple** : SCI Marie-Line possède 2 lots dans Route du Phare (`ownership_type='partial'`, total=6) + 1 maison standalone = **3 biens dans le quota**.

## 4. Wizard de création

### Étapes pour `type='immeuble'`

```
1. type_bien              — sélection "Immeuble (entier ou partiel)"
2. address                — adresse du bâtiment
3. ownership_type         — NEW : radio full/partial + total_lots_in_building
4. building_config        — BuildingVisualizer + lots de l'utilisateur
5. photos                 — photos extérieures + parties communes
6. recap                  — récapitulatif + submit
```

### Submit → INSERTs atomiques

`POST /api/properties/[id]/building-units` fait en transaction :
1. Upsert 1 ligne `buildings` (avec `ownership_type`, `total_lots_in_building`)
2. Pour chaque lot : INSERT 1 ligne `properties` (`type != 'immeuble'`, `parent_property_id = wrapper.id`, `etat='published'`)
3. BULK INSERT N lignes `building_units` (avec `property_id` pointant vers chaque lot)

Source : `app/api/properties/[id]/building-units/route.ts:49-269`.

### Mode `partial`
- L'utilisateur configure uniquement **ses propres lots** (pas les 6 de l'immeuble physique s'il n'en possède que 2)
- Le visualiseur affiche les emplacements des autres lots en **grisé non-interactif** avec label "Appartient à un autre copropriétaire"
- Les équipements parties communes (ascenseur, gardien, ...) deviennent informatifs : "Géré par le syndic"

## 5. Routes

### UI (pages)

| Route | Fichier | Description |
|---|---|---|
| `/owner/properties` | `app/owner/properties/page.tsx` | Liste unifiée avec tabs `Mes biens` / `Immeubles` |
| `/owner/properties?tab=immeubles` | idem | Vue managériale des immeubles conteneurs |
| `/owner/properties/new` | `app/owner/properties/new/NewPropertyClient.tsx` | Wizard (inclut branche immeuble) |
| `/owner/properties/[id]` | `app/owner/properties/[id]/page.tsx` | Fiche d'un lot OU d'un bien unitaire |
| `/owner/buildings` | `app/owner/buildings/page.tsx` | Redirect 301 → `/owner/properties?tab=immeubles` |
| `/owner/buildings/[id]` | `app/owner/buildings/[id]/page.tsx` | **Hub managérial** (plan + cards lots + docs) |
| `/owner/buildings/[id]/units` | `app/owner/buildings/[id]/units/page.tsx` | Édition des lots (CRUD inline) |
| `/owner/buildings/[id]/not-found.tsx` | `app/owner/buildings/[id]/not-found.tsx` | 404 dédié (à distinguer de 403) |

**URL pattern** : `/owner/buildings/[id]` utilise `id = property_id` du wrapper (**pas** `building_id`). Le server component résout le `building_id` via `buildings.property_id`.

### API

| Endpoint | Méthode | Description |
|---|---|---|
| `/api/buildings` | GET, POST | Liste + création |
| `/api/buildings/[id]` | GET, PATCH, DELETE | Détail + update + soft-delete (fallback hard) |
| `/api/buildings/[id]/units` | GET, POST | Liste + création bulk de lots |
| `/api/buildings/[id]/units/[unitId]` | DELETE | Supprimer un lot |
| `/api/properties/[id]/building` | GET | Récupère building + units pour une property type=immeuble |
| `/api/properties/[id]/building-units` | POST | Upsert building + lots en une transaction (wizard) |
| `/api/properties/[id]/associate-building` | POST | **À créer** — rattacher une property existante à un immeuble parent |

## 6. Page `/owner/buildings/[id]` — structure

La page est un **hub managérial** à 3 sections stackées verticalement (pas de tabs) :

```
┌─────────────────────────────────────────────────┐
│ HEADER                                          │
│   Nom immeuble · adresse · année · surface      │
│   Badge ownership : "Propriétaire unique" ou    │
│                     "Copropriétaire · X/M lots" │
│   CTA : Modifier | Gérer les lots              │
├─────────────────────────────────────────────────┤
│ SECTION 1 — Plan des lots                       │
│   <BuildingVisualizer readOnly />               │
│   Lots user = cliquables (→ détail du lot)     │
│   Lots externes (partial) = grisés              │
├─────────────────────────────────────────────────┤
│ SECTION 2 — Lots                                │
│   Grille <BuildingLotCard /> réutilisable       │
│   Par card : photo, étage/position, type,       │
│   surface, loyer, statut, nom locataire, bail   │
│   Clic → /owner/properties/[lot.property_id]   │
├─────────────────────────────────────────────────┤
│ SECTION 3 — Documents de gestion                │
│   DPE collectif, règlement copro, PV AG,        │
│   attestation PNO, contrats entretien, devis    │
│   Upload / aperçu / suppression                 │
└─────────────────────────────────────────────────┘
```

**Composant `BuildingLotCard`** (à créer dans `components/buildings/BuildingLotCard.tsx`) :
- Props : `{ lot: PropertyRow, unit: BuildingUnitRow, lease?: LeaseRow, tenant?: ProfileRow }`
- Clic → `Link` vers `/owner/properties/${lot.id}` (pas `/owner/buildings/${building_id}/units/${unit_id}` — on veut la vraie fiche du bien)
- Toujours afficher la pastille statut (vacant/occupé/travaux/réserve)

## 7. Page `/owner/properties/[id]` pour un lot

Même composant que pour un bien unitaire, mais avec différences :
- Breadcrumb : `Mes biens → Immeuble [X] → Lot [Y]`
- Header : badge "Lot dans immeuble · [adresse]" cliquable → `/owner/buildings/[parent_property_id]`
- Toutes les tabs existantes fonctionnent (bail, finance, documents, tickets, etc.)

Le lot est traité comme un bien autonome pour tout ce qui est bail/locataire/factures — seul le "wrapping" managérial est groupé.

## 8. Check d'accès — fix 404 "Immeuble introuvable"

**Bug connu** : `app/owner/buildings/[id]/page.tsx:89-116` filtre `owner_id = profile.id` sans tenir compte des membres SCI (`entity_members`) ni du cas `building.property_id IS NULL`. Résultat : 404 pour des immeubles qui existent et sont légitimement accessibles.

**Fix** : copier le pattern de `app/api/invoices/[id]/route.ts:78-106` :

```
1. Query property/building SANS filtre owner (service client)
2. Autoriser si :
   - property.owner_id === profile.id
   - OU profile.id ∈ (SELECT user_id FROM entity_members WHERE entity_id = property.legal_entity_id)
3. Sinon → 403 access-denied (page dédiée distincte du 404 not-found)
4. Si building.property_id IS NULL → rendre quand même avec buildingRecord direct
```

## 9. Surfacer les lots dans "Mes biens"

Filtre actuel (`app/owner/properties/page.tsx:181`) :
```ts
filtered = filtered.filter(p => p.type !== "immeuble" && !p.parent_property_id);
```

**À remplacer par** :
```ts
filtered = filtered.filter(p => p.type !== "immeuble");
// Les lots avec parent_property_id apparaissent maintenant comme des biens
```

Le badge "Immeuble · [adresse]" est ajouté dans `PropertyCard` :
- Condition : `property.parent_property_id != null`
- Fetch léger en batch : `SELECT id, adresse_complete FROM properties WHERE id IN (distinct parent_property_ids)` au niveau de la page (pas N+1)
- Link vers `/owner/buildings/${parent_property_id}`

## 10. Gestion locative — scoping

| Entité | Scope | FK canonique |
|---|---|---|
| **Bail** | Toujours au lot | `leases.property_id = lot.id` (+ `leases.building_unit_id` pour le trigger sync) |
| **Facture** | Via bail | `invoices.lease_id` (remonte au lot via `leases.property_id`) |
| **Ticket privatif** | Lot | `tickets.property_id = lot.id` |
| **Ticket commun** (parties communes) | Immeuble | `tickets.building_id` (colonne à ajouter, phase ultérieure) |
| **Document privatif** (EDL, quittance, etc.) | Lot | `documents.property_id = lot.id` |
| **Document commun** (DPE collectif, PV AG, PNO) | Immeuble | `documents.building_id` OU `documents.property_id = wrapper.id` |

**Règle** : un bail ne pointe jamais directement vers le wrapper `type='immeuble'`. Il pointe toujours vers un lot réel ou un bien unitaire.

## 11. Suppression (cascade)

### Contraintes SQL actuelles
- `building_units.building_id` → `buildings.id` **ON DELETE CASCADE**
- `buildings.property_id` → `properties.id` **ON DELETE SET NULL**
- `building_units.current_lease_id` → `leases.id` **ON DELETE SET NULL**

### Comportement DELETE immeuble
`app/api/buildings/[id]/route.ts:163-235` :
1. Refuse si au moins 1 lot occupé
2. Soft-delete (`deleted_at = NOW()`) préféré, fallback hard-delete
3. **Ne supprime pas** les properties lots enfants → orphelines

### Comportement DELETE lot
`app/api/buildings/[id]/units/[unitId]/route.ts` :
1. `.delete()` physique sur `building_units`
2. **Ne supprime pas** la property liée via `parent_property_id`

**TODO** : ajouter un trigger de cleanup ou un soft-delete cascade sur les properties lots.

## 12. Distinction stricte avec le module `/syndic`

| `/owner/buildings` | `/syndic` |
|---|---|
| Vue propriétaire bailleur | Vue syndic / conseil syndical |
| Scopée aux lots possédés | Gouvernance de toute la copro |
| Obligations individuelles du user | Obligations collectives de la copro |
| Documents reçus du syndic | Documents émis par le syndic |
| Pas d'AG, pas de votes, pas d'appels de fonds émis | AG, convocations, votes, appels de fonds, mandats |

Un utilisateur peut avoir les deux rôles (syndic bénévole d'une copro dont il est aussi copropriétaire), mais les modules restent strictement séparés pour ne pas mélanger responsabilités légales.

## 12b. Bridge owner ↔ syndic (livré le 29/04/2026)

Quand le syndic d'une copropriété utilise aussi Talok, le `building` (côté
owner) peut être **connecté** au `site` (côté syndic). Ce pont est implémenté
via les colonnes `buildings.site_id`, `buildings.site_link_status`,
`buildings.owner_syndic_mode` et la table `building_site_links` (historique
des claims).

### Personas et CTAs

| Persona | ownership_type | site_link_status | UI affichée |
|---|---|---|---|
| Maison standalone | n/a (pas de building) | n/a | rien |
| Owner immeuble entier | `full` | `unlinked` | option discrète « Activer le mode syndic-bénévole » |
| Owner immeuble entier déjà bénévole | `full` | `linked` (`owner_syndic_mode='volunteer'`) | bandeau vert + lien vers `/syndic/sites/[id]` |
| Copro avec syndic externe | `partial` | `unlinked` | bandeau cyan « Votre syndic est-il sur Talok ? » + 2 CTAs : `Rechercher` / `Inviter par email` |
| Copro syndic Talok demandeur | `partial` | `pending` | bandeau ambre « Demande envoyée » + bouton `Annuler` |
| Copro syndic Talok refusé | `partial` | `rejected` | bandeau rouge avec motif + bouton `Renvoyer` |
| Copro syndic Talok approuvé | `partial` | `linked` (`owner_syndic_mode='managed_external'`) | bandeau vert + **panneau live « Côté copropriété »** (3 cards : prochaine AG, dernier appel de fonds, PV récents) |

### Flow d'approbation

```
Owner → POST /api/buildings/[id]/claim-site { site_id, message }
   → INSERT building_site_links { status='pending' }
   → trigger met buildings.site_link_status='pending'
   → notif côté syndic dans /syndic/claims

Syndic → POST /api/syndic/site-claims/[claimId] { decision: 'approve'|'reject' }
   → UPDATE building_site_links → trigger apply_building_site_link :
     - approve : set buildings.site_id, site_link_status='linked',
                 owner_syndic_mode='managed_external',
                 + INSERT user_site_roles { role_code: 'coproprietaire_bailleur' }
     - reject : site_link_status='rejected'
```

### Mode syndic-bénévole (full uniquement)

`POST /api/buildings/[id]/activate-as-syndic` :
1. Crée un `sites` row avec `syndic_profile_id = profile.id`
2. INSERT `building_site_links { status: 'approved' }` (auto-approuvé car owner = syndic)
3. Trigger applique le link → `owner_syndic_mode='volunteer'`
4. Promote `profiles.role` de `owner` vers `syndic` si applicable
5. Redirect vers `/syndic/sites/[id]` pour suite (compta, contrats, AGs)

**Légalement** : un mono-propriétaire n'a aucune obligation de syndic. Cette action est purement organisationnelle (compta dédiée, centralisation contrats).

### Permissions cross-module (coproprietaire_bailleur)

Une fois `linked`, l'owner reçoit le rôle `coproprietaire_bailleur` sur le site syndic. Les routes `/api/copro/*` filtrent par `user_site_roles` — l'owner peut donc lire (mais pas modifier) :
- `copro_assemblies` du site
- `copro_fund_calls` et leurs `copro_fund_call_lines` qui le concernent
- `copro_minutes` (PV publiés)
- documents officiels du site

Les pages `/syndic/sites/[id]/*` ne lui sont pas accessibles directement (le layout `/syndic` redirige les non-syndics). À la place, le panneau **`SyndicSidePanel`** affiche un résumé inline dans `/owner/buildings/[id]`.

### Composants et routes clés

| Fichier | Rôle |
|---|---|
| `components/buildings/SyndicLinkBanner.tsx` | Bandeau d'état + dialogs claim & activate |
| `components/buildings/SyndicSidePanel.tsx` | 3 cards lecture-seule visible si linked |
| `app/api/buildings/[id]/match-sites/route.ts` | Auto-suggestion par CP+ville |
| `app/api/buildings/[id]/claim-site/route.ts` | Soumet le claim |
| `app/api/buildings/[id]/unlink-site/route.ts` | Annule pending ou rompt linked |
| `app/api/buildings/[id]/activate-as-syndic/route.ts` | Bascule `full` en mode bénévole |
| `app/api/buildings/[id]/syndic-summary/route.ts` | Aggrège AG + fund call + PV pour le panel |
| `app/api/syndic/site-claims/route.ts` | GET liste pour le syndic |
| `app/api/syndic/site-claims/[claimId]/route.ts` | POST approve/reject |
| `app/syndic/claims/page.tsx` | Inbox côté syndic avec actions |
| `supabase/migrations/20260429120300_owner_syndic_bridge.sql` | Schéma + RLS + triggers |

### Limites actuelles (à itérer plus tard)

- Mapping fin **`building_units.copro_lot_id`** non encore implémenté → `user_owed_cents` calculé sur l'ensemble des lignes du fund call et non sur les lots précis de l'owner.
- L'auto-suggestion n'utilise que `code_postal + ville`. Recherche par SIRET du syndic ou par nom du cabinet à ajouter en V2.
- Pas de notification email aux deux parties lors d'un claim (toast + presence dans `/syndic/claims` uniquement).
- L'unlink ne révoque pas automatiquement le `user_site_roles` créé (volontaire — l'owner reste copropriétaire si invité indépendamment via `copro_invites`).

## 13. Règles dev obligatoires

1. **Check d'accès** : jamais de filtre `owner_id` seul sur les pages/routes building — toujours copier le pattern entity_members.
2. **Service client** : toutes les lectures DB côté SSR/API utilisent `getServiceClient()`, jamais `createClient()` user-scoped (évite récursion RLS 42P17).
3. **URL pattern** : `/owner/buildings/[id]` utilise `property_id` du wrapper, pas `building_id`. Le server component résout via `buildings.property_id = property_id`.
4. **BuildingLotCard** : lien vers `/owner/properties/[lot.property_id]`, jamais vers une fiche "lot" dédiée (qui n'existe pas).
5. **Wizard** : le type `immeuble` déclenche `BUILDING_STEPS` à la place de `DEFAULT_STEPS`. L'étape `building_config` utilise `BuildingVisualizer` + `BuildingConfigStep`.
6. **Quota** : les lots comptent, le wrapper ne compte pas. Filtre `.neq('type', 'immeuble')` dans `check-limit.ts`.
7. **RLS** : toutes les policies sur `buildings`, `building_units`, `properties` utilisent `public.user_profile_id()` — jamais `auth.uid()`.
8. **Regen types** : après toute migration buildings, lancer `npx supabase gen types typescript` et commit `lib/supabase/database.types.ts`.

## 14. Fichiers clés

| Domaine | Fichier |
|---|---|
| Types DB | `lib/supabase/database.types.ts` |
| Types building | `lib/types/building-v3.ts` |
| Wizard store | `features/properties/stores/wizard-store.ts` |
| Wizard UI | `features/properties/components/v3/property-wizard-v3.tsx` |
| Étape building config | `features/properties/components/v3/immersive/steps/BuildingConfigStep.tsx` |
| Visualiseur | `features/properties/components/v3/immersive/steps/BuildingVisualizer.tsx` |
| Page détail immeuble | `app/owner/buildings/[id]/page.tsx` + `BuildingDetailClient.tsx` |
| Page édition lots | `app/owner/buildings/[id]/units/UnitsManagementClient.tsx` |
| Not-found immeuble | `app/owner/buildings/[id]/not-found.tsx` |
| Liste immeubles | `app/owner/properties/page.tsx` (onglet `immeubles`) |
| API buildings | `app/api/buildings/route.ts`, `app/api/buildings/[id]/**` |
| API building-units (wizard) | `app/api/properties/[id]/building-units/route.ts` |
| API building lookup | `app/api/properties/[id]/building/route.ts` |
| Service | `features/properties/services/buildings.service.ts` |
| Quota | `lib/subscriptions/check-limit.ts` (exclusion wrapper) |
| RLS | `supabase/migrations/20260318020000_buildings_rls_sota2026.sql` |
| Table création | `supabase/migrations/20260107000000_building_support.sql` |
| Backfill lots | `supabase/migrations/20260409170000_backfill_building_unit_properties.sql` |
| Lease building_unit_id | `supabase/migrations/20260409160000_building_unit_lease_document_fk.sql` |

## 15. Skill sibling (Cursor)

Pour les règles de prévention de régressions spécifiques au property system (RLS, types, rate limiting, Zod enums), voir aussi `.cursor/skills/property-building-guard/SKILL.md` et `.cursor/skills/sota-property-system/SKILL.md`.
