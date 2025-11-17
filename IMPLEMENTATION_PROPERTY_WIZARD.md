# Implémentation : Wizard d'ajout de logement (Mode rapide + Mode avancé)

## Vue d'ensemble

### Objectif

Mettre en place un processus d'ajout de logement qui :
- crée une propriété exploitable en gestion locative (baux, loyers, conformité),
- permet ensuite de construire une annonce publique (titre, description, photos par pièce, règles, quartier).

### Concepts clés

- **Propriété** = entité de gestion interne (`properties`)
- **Annonce** = couche marketing / publique liée à la propriété (dans `properties` via des champs dédiés + un `listing_status`)
- **Deux modes de wizard** :
  - `wizard_mode = 'fast'` → Mode rapide (3–4 steps)
  - `wizard_mode = 'detailed'` → Mode avancé (10–11 steps)
- **Single source of truth** :
  - structure (surface, nb pièces, nb chambres) dans `properties`,
  - pièces dans `rooms`,
  - photos dans `photos` (avec `room_id` optionnel),
  - couchages dans `beds`

---

## 1. Modèle de données

### 1.1. Enums

```sql
CREATE TYPE property_type AS ENUM (
  'appartement',
  'maison',
  'studio',
  'colocation',
  'parking',
  'box',
  'local_commercial',
  'bureaux',
  'entrepot'
);

CREATE TYPE rental_mode AS ENUM (
  'longue_duree',
  'courte_duree'
);

CREATE TYPE property_status AS ENUM (
  'draft',
  'pending_review',
  'active',
  'archived'
);

CREATE TYPE listing_status AS ENUM (
  'none',
  'draft',
  'ready',
  'published'
);

CREATE TYPE room_type AS ENUM (
  'sejour',
  'chambre',
  'cuisine',
  'salle_de_bain',
  'wc',
  'bureau',
  'balcon',
  'terrasse',
  'jardin',
  'autre'
);

CREATE TYPE bed_type AS ENUM (
  'simple',
  'double',
  'queen',
  'king',
  'canape_lit',
  'superpose',
  'lit_bebe',
  'autre'
);
```

### 1.2. Table `properties`

Source de vérité pour : type, adresse, structure, loyers, mode de location, champs d'annonce.

Voir migration SQL complète dans `supabase/migrations/YYYYMMDD_property_wizard_v2.sql`

### 1.3. Table `rooms`

```sql
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  type_piece room_type NOT NULL,
  label_affiche text NOT NULL,
  surface_m2 numeric,
  chauffage_present boolean,
  clim_presente boolean,
  "order" int NOT NULL DEFAULT 0
);
```

### 1.4. Table `photos`

```sql
CREATE TABLE photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  url text NOT NULL,
  purpose text NOT NULL DEFAULT 'main',  -- 'main', 'room', 'plan', 'other'
  is_main boolean DEFAULT false,
  "order" int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

### 1.5. Table `beds`

```sql
CREATE TABLE beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type_lit bed_type NOT NULL,
  quantite int NOT NULL DEFAULT 1
);
```

---

## 2. Wizard : Mode rapide & Mode avancé

### 2.1. Colonne `wizard_mode`

```sql
ALTER TABLE properties
ADD COLUMN wizard_mode text NOT NULL DEFAULT 'fast'; -- 'fast' ou 'detailed'
```

### 2.2. Steps (concept)

**Mode rapide (FAST_STEPS)**
- `fast.type_address`
- `fast.core_info`
- `fast.rent`
- `fast.photos`

**Mode avancé (DETAILED_STEPS)** – habitation
- `detailed.type_bien`
- `detailed.adresse`
- `detailed.structure`
- `detailed.acces`
- `detailed.exterieurs`
- `detailed.confort`
- `detailed.equipements`
- `detailed.pieces`
- `detailed.photos`
- `detailed.loyers`
- `detailed.recap`

L'UI choisit la liste de steps en fonction de `property.wizard_mode`.

### 2.3. Comportement UX

- **Entrée** : écran "Tu veux ajouter ce logement comment ?" → choix Mode rapide / avancé
- **Header du wizard** :
  - bouton "🔁 Passer en mode avancé" si `wizard_mode = 'fast'`
  - Switch Rapide → Avancé
- **Modal** :
  - "En mode avancé, tu auras plus de détails (pièces, confort, équipements…).
  - ✅ Tes réponses actuelles sont conservées.
  - ❌ Tu ne pourras plus revenir en mode rapide."
- **Si confirmé** :
  - `wizard_mode` passe à `'detailed'`
  - rechargement du wizard avec `DETAILED_STEPS`
  - pré-remplissage des champs en commun

---

## 3. Registry de champs & config de wizard

### 3.1. Field Registry TS

Voir `lib/registry/field-registry.ts`

### 3.2. Config de wizard

Voir `lib/config/wizard-steps.ts`

---

## 4. Endpoints API

### 4.1. Créer un brouillon de propriété

**POST /api/properties**

Body minimal : `{ type_bien, wizard_mode }` (optionnellement `owner_id` via auth).

Crée une ligne `properties` avec `status = 'draft'`.

Retourne `{ id, ... }`.

### 4.2. Récupérer une propriété (wizard + fiche)

**GET /api/properties/:id**

Retourne :
- `property` (tous les champs),
- `rooms` (liste),
- `photos` (liste),
- éventuellement `leases` actifs

### 4.3. Update générique propriété

**PATCH /api/properties/:id**

Body : partiel (champs du wizard ou de la finalisation).

Backend :
- filtre les champs autorisés,
- applique les validations basiques (types, min/max),
- logique spéciale pour `mode_location` (voir §8)

### 4.4. Upload photo

**POST /api/properties/:id/photos**

Body :
- `room_id` (optionnel),
- `purpose` (optionnel, default 'main'),
- `is_main` (optionnel)

### 4.5. Soumettre pour validation

**POST /api/properties/:id/submit**

Vérifie `status` (doit être `draft`).

Charge `property`, `rooms`, `photos`.

Selon `type_bien` :
- `validateHabitation(property, rooms, photos)` pour habitation
- `validateParking(property, photos)` pour parking/box
- `validateCommercial(property, photos)` pour locaux commerciaux

Si `result.isValid === false` → 400 avec erreurs détaillées.

Si OK → `status = 'pending_review'` (ou `active` selon politique interne).

### 4.6. Complétion d'annonce (optionnel mais conseillé)

**GET /api/properties/:id/completion**

Retourne :
```json
{
  "core": 100,
  "annonce": 68,
  "checks": [
    { "id": "titre_annonce", "label": "Titre d'annonce", "completed": false },
    { "id": "description_logement", "label": "Description du logement", "completed": true },
    { "id": "photos_min", "label": "Au moins 5 photos", "completed": true },
    { "id": "couchages", "label": "Couchages par chambre", "completed": false },
    { "id": "quartier", "label": "Description du quartier", "completed": false }
  ]
}
```

---

## 5. Règles de validation /submit (par type)

### 5.1. Habitation (appartement / maison / studio / coloc)

**Minimum pour `pending_review`** :
- `type_bien` renseigné et ∈ [appartement, maison, studio, colocation]
- Adresse : `adresse_complete`, `code_postal`, `ville` non vides
- Structure :
  - `surface_habitable_m2 > 0`,
  - `nb_pieces >= 1`,
  - `nb_chambres >= 0`,
  - `meuble` non null
- Conditions :
  - `loyer_hc > 0`,
  - `depot_garantie >= 0`
- Photos :
  - au moins 1 photo (mode rapide),
  - idéalement ≥ 3 (warning seulement au début)
- Si `wizard_mode = 'detailed'` :
  - au moins 1 room de type `sejour`
  - éventuellement : au moins 1 room de type `chambre` si `nb_chambres > 0`

### 5.2. Parking / Box

**Minimum** :
- `parking_type` non null,
- `parking_gabarit` non null,
- Adresse ok,
- `loyer_hc > 0`,
- `depot_garantie >= 0`,
- au moins 1 photo

### 5.3. Locaux commerciaux / bureaux

**Minimum** :
- `local_surface_totale > 0`,
- `local_type` non null,
- Adresse ok,
- `loyer_hc > 0`,
- `depot_garantie >= 0`,
- au moins 1 photo

---

## 6. Fiche logement propriétaire `/properties/:id`

### 6.1. Header / Résumé

Bloc avec :
- Titre (`titre_annonce` ou fallback),
- Adresse courte,
- Badges : `type_bien`, `mode_location`, `status`, disponibilité,
- Loyer / charges / dépôt,
- Annexes (parking, balcon, cave…),
- Mini-photos des pièces principales

### 6.2. Tabs

**"Gestion & contrat"**
- baux, locataires, loyers, documents
- montants éditables (`loyer_hc`, `charges_mensuelles`, `depot_garantie`)

**"Pièces & photos"**
- Liste des rooms à gauche (badge ✅/⚠️ selon présence de photos)
- Galerie de la pièce sélectionnée à droite
- Bloc "Photos non classées" pour associer les photos issues du wizard
- Lorsque l'utilisateur ajoute une pièce → suggestion d'ajouter une photo

**"Annonce & expérience locataire"**
- Cards :
  - Identité de l'annonce (titre + tagline),
  - Description (3 textes),
  - Couchages (via `beds` par chambre),
  - Séjour & accès,
  - Règlement intérieur,
  - Sécurité,
  - Quartier & environnement
- Complétion d'annonce (score + checklist)

---

## 7. Mode de location & baux

### 7.1. Champ `mode_location`

Enum `rental_mode` : `'longue_duree'` | `'courte_duree'`.

Éditable uniquement dans l'UI annonce (avec texte d'explication).

### 7.2. Règle côté backend (dans PATCH /api/properties/:id)

Pseudocode :
```typescript
if (payload.mode_location && payload.mode_location !== property.mode_location) {
  const hasActiveLease = await hasActiveLeaseForProperty(property.id);
  
  if (hasActiveLease) {
    return res.status(400).json({
      error: 'active_lease_blocking',
      fieldErrors: {
        mode_location: "Impossible de changer le mode de location tant qu'un bail est en cours."
      },
      globalErrors: [
        "Résiliez ou terminez le bail actuel avant de passer en location courte durée."
      ]
    });
  }
  
  // sinon on autorise le changement
}
```

### 7.3. UX

Si erreur `active_lease_blocking` :
- modal avec :
  - nom du locataire,
  - type de bail,
  - dates,
  - boutons :
    - "Voir le bail en cours"
    - "Créer une fin de bail / préavis"

---

## 8. Process QA / Admin

### 8.1. Page Admin "Process & QA"

**Route** : `/admin/process-tests`

Liste de scénarios :
- `create_fast_T2_habitation`
- `create_detailed_T3_habitation`
- `create_parking`
- `submit_without_photos`
- `switch_mode_location_with_active_lease`

Chaque scénario :
- affiche les étapes,
- lance les calls (en environnement de test),
- montre un résultat vert/rouge,
- logue la réponse

**Objectif** : permettre à l'équipe de vérifier régulièrement que le process d'ajout de logement et la soumission `/submit` fonctionnent correctement, même après refacto.

---

## Plan d'implémentation

1. ✅ Créer le document d'implémentation structuré
2. ⏳ Créer la migration SQL pour les nouveaux champs
3. ⏳ Créer le Field Registry TypeScript
4. ⏳ Créer la configuration des steps wizard
5. ⏳ Créer les endpoints API
6. ⏳ Créer les règles de validation métier par type de bien
7. ⏳ Créer le composant PropertyWizard avec support des deux modes
8. ⏳ Créer la fiche logement propriétaire avec tabs
9. ⏳ Implémenter la logique mode_location avec vérification des baux actifs
10. ⏳ Créer la page Admin Process & QA

