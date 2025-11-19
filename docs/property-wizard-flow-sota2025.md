# Documentation complète : Flux "Ajouter un bien (Propriétaire)" SOTA 2025

## Vue d'ensemble

### Modes de parcours

**Rapide (FAST, ≤4 écrans)** : 
- Type → Adresse → Photos (simple) → Résumé & Créer
- Objectif : création d'un lot actif en ≤ 60s (photos min 1)

**Complet (FULL, 8 écrans)** :
- Type → Adresse → Détails → Pièces → Photos (par pièce) → Équipements & énergie → Publication → Résumé & Créer (+ Compteurs/EDL option)
- Objectif : dossier prêt publication en ≤ 6 min

### Routes Next.js App Router

- `/owner/property/new` - Page principale du wizard (wrapper)
- Mode détecté via query param `?mode=fast|full` (défaut: `full`)

### Patterns UI

- **Design System** : shadcn/ui + Tailwind CSS
- **Animations** : Framer Motion 200-240ms, spring (stiffness 320, damping 28)
- **Stepper** : sticky en haut avec barre de progression animée
- **Footer** : sticky en bas avec actions "Précédent / Continuer" + micro-copy contextuelle
- **Autosave** : debounce 2s (local + draft BDD)
- **Accessibilité** : ARIA, navigation clavier, `prefers-reduced-motion`

---

## Étape 1 — Type de bien

### But
Cadrer le parcours et pré-remplir des champs conditionnels.

### Champs
- `type_bien` (ENUM requis) : `APARTMENT` | `HOUSE` | `STUDIO` | `COLOCATION` | `PARKING` | `BOX` | `RETAIL` | `OFFICE` | `WAREHOUSE` | `MIXED`
- Mapping vers valeurs BDD : `appartement`, `maison`, `studio`, `colocation`, `parking`, `box`, `local_commercial`, `bureaux`, `entrepot`, `fonds_de_commerce`

### Validations Zod
```typescript
z.enum([
  "appartement", "maison", "studio", "colocation",
  "parking", "box", "local_commercial", "bureaux",
  "entrepot", "fonds_de_commerce"
]).required()
```

### UX/Animations
- **Grille cliquable** : cartes pleine surface (3-4 colonnes responsive)
- **Recherche instantanée** : filtre par label/description
- **Pills de catégories** : Habitation / Parking & Box / Local commercial
- **Feedback visuel** : badge "Sélectionné" animé (scale 0→1, fade-in)
- **Navigation clavier** : ↑↓←→ pour naviguer, Entrée pour valider
- **Transition** : 220ms ease-out

### Accessibilité
- `role="listbox"` sur la grille
- `aria-pressed` sur les cartes sélectionnées
- `aria-label` descriptif pour chaque carte
- Focus ring 2px sur navigation clavier
- Annonce live pour la sélection

### API
Aucun appel API (état local uniquement)

### Events Analytics
- `type_step_view` - Vue de l'étape
- `type_selected` - Sélection d'un type avec `{ type_bien: string }`

### Composant
`features/properties/components/v3/property-type-selection.tsx`

---

## Étape 2 — Adresse & géolocalisation

### But
Créer le brouillon côté serveur et géocoder l'adresse.

### Champs
- `address.line1`* (string, requis)
- `address.line2` (string, optionnel)
- `address.postal_code`* (string, requis, format FR: 5 chiffres)
- `address.city`* (string, requis)
- `address.country_code`* (string, requis, ISO 3166-1 alpha-2, défaut: "FR")
- `geo.lat` (number, auto via géocodage)
- `geo.lng` (number, auto via géocodage)
- `geo.precision` (string, auto: "exact" | "approximate" | "none")

### Validations Zod
```typescript
z.object({
  address: z.object({
    line1: z.string().min(1, "Adresse requise"),
    line2: z.string().optional(),
    postal_code: z.string().regex(/^\d{5}$/, "Code postal invalide"),
    city: z.string().min(1, "Ville requise"),
    country_code: z.enum(["FR", "GP", "MQ", "GF", "RE", "YT", "PM"]).default("FR")
  }),
  geo: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    precision: z.enum(["exact", "approximate", "none"]).optional()
  }).optional()
})
```

### UX/Animations
- **Auto-complétion** : intégration API Adresse (data.gouv.fr) ou Google Places
- **Badge "Adresse vérifiée"** : affiché après géocodage réussi
- **Fallback** : bouton "Saisir manuellement" si géocodage échoue
- **Loader skeleton** : bref (<1s) pendant le géocodage
- **Transition** : 220ms ease-out

### Accessibilité
- Labels ARIA pour chaque champ
- Messages d'erreur associés aux champs (`aria-describedby`)
- Navigation tabulaire fluide

### API
```typescript
// POST /api/properties
{
  owner_id: string,
  address: { line1, line2?, postal_code, city, country_code },
  geo?: { lat, lng, precision },
  type_bien: PropertyTypeV3,
  status: "draft"
}
→ { property_id: string }

// Si type_bien ≠ BUILDING (immeuble):
// POST /api/properties/[id]/units
{
  property_id: string,
  kind: PropertyTypeV3,
  is_shared: false  // lot par défaut
}
→ { unit_id: string }
```

### Events Analytics
- `prop_address_submitted` - Soumission de l'adresse
- `prop_geocoded_ok` - Géocodage réussi avec `{ precision: string }`
- `prop_geocoded_fail` - Échec du géocodage

### Composant
`features/properties/components/v3/dynamic-step.tsx` (étape `adresse`)

---

## Étape 3 — Détails du lot (Complet uniquement)

### But
Préciser les caractéristiques du lot (ou 1er lot si immeuble).

### Champs
- `is_shared` (boolean, défaut: `false`, requis si `type_bien === "colocation"`)
- `surface_m2` (number, 0-9999.99, optionnel)
- `rooms_count` (number, 0-50, optionnel)
- `floor` (number, optionnel, -2 à 50)
- `elevator` (boolean, optionnel)

### Validations Zod
```typescript
z.object({
  is_shared: z.boolean().refine(
    (val) => type_bien !== "colocation" || val === true,
    "La colocation nécessite is_shared=true"
  ),
  surface_m2: z.number().min(0).max(9999.99).optional(),
  rooms_count: z.number().int().min(0).max(50).optional(),
  floor: z.number().int().min(-2).max(50).optional(),
  elevator: z.boolean().optional()
})
```

### UX/Animations
- **Aide contextuelle** : "Vous pourrez affiner plus tard" (badge info)
- **Champs conditionnels** : affichage selon `type_bien`
- **Transition** : 220ms ease-out

### Accessibilité
- Labels clairs avec unités (m², étage)
- Messages d'aide contextuels

### API
```typescript
// PATCH /api/properties/[id]
// ou PATCH /api/properties/[id]/units/[unit_id]
{
  is_shared: boolean,
  surface_m2?: number,
  rooms_count?: number,
  floor?: number,
  elevator?: boolean
}
```

### Events Analytics
- `unit_details_saved` - Sauvegarde des détails avec `{ has_surface: boolean, has_rooms: boolean }`

### Composant
`features/properties/components/v3/dynamic-step.tsx` (étape `details`)

---

## Étape 4 — Pièces (Complet uniquement)

### But
Structurer le plan (utile pour photos/EDL).

### Champs
Liste de `rooms[]` :
- `room_type` (ENUM requis) : `salon`, `chambre`, `cuisine`, `salle_de_bain`, `wc`, `couloir`, `bureau`, `jardin`, etc.
- `name` (string, optionnel, ex: "Chambre 1")
- `is_private` (boolean, optionnel, requis si colocation)
- `sort_order` (number, auto via drag & drop)

### Validations Zod
```typescript
z.array(
  z.object({
    room_type: z.enum(["salon", "chambre", "cuisine", "salle_de_bain", "wc", "couloir", "bureau", "jardin", ...]),
    name: z.string().optional(),
    is_private: z.boolean().optional(),
    sort_order: z.number().int().min(0)
  })
).min(1, "Au moins une pièce requise")
.refine(
  (rooms) => type_bien !== "colocation" || rooms.some(r => r.room_type === "chambre" && r.is_private === true),
  "La colocation nécessite au moins une chambre privative"
)
```

### UX/Animations
- **Templates** : Studio / T2 / T3 / T4 (boutons rapides)
- **Ajout/Suppression** : boutons avec animations (scale + fade)
- **Drag & drop** : réordonnancement avec feedback visuel (opacity 0.5 pendant drag)
- **Transition** : 220ms ease-out

### Accessibilité
- `role="list"` sur la liste de pièces
- `aria-label` pour chaque pièce
- Navigation clavier pour réordonner (flèches)

### API
```typescript
// POST /api/properties/[id]/rooms (batch)
{
  rooms: Array<{
    property_id: string,
    unit_id?: string,
    room_type: string,
    name?: string,
    is_private?: boolean,
    sort_order: number
  }>
}
→ { rooms: Array<{ id: string, ... }> }
```

### Events Analytics
- `rooms_set` - Pièces définies avec `{ count: number, has_private: boolean }`

### Composant
`features/properties/components/v3/rooms-photos-step.tsx` (section pièces)

---

## Étape 5 — Photos

### Rapide (photos_simple)
- **But** : galerie simple (min 1 photo)
- **Champs** : `photos[]` avec `storage_key`, `tags[]`, `sort_order`
- **Validations** : `z.array(z.object({ storage_key: z.string() })).min(1)`

### Complet (pieces_photos)
- **But** : photos par pièce (rappels si pièces clés sans photo)
- **Champs** : `photos[]` avec `storage_key`, `room_id?`, `tags[]`, `sort_order`
- **Validations** : idéal ≥1 par pièce clé (salon/chambre/cuisine)

### UX/Animations
- **Drag-drop** : zone de drop avec feedback visuel (border-primary pendant hover)
- **Tri** : réordonnancement avec animations
- **Signed upload** : URL signée Supabase Storage
- **Vignette + progress** : barre de progression pendant upload
- **Suggestion de tag pièce** : option ML (future)
- **Compression client** : WebP/JPEG avant upload
- **EXIF** : extraction automatique (orientation, date)
- **Lazy-load** : chargement différé des vignettes

### Accessibilité
- Labels ARIA pour zone de drop
- Messages d'erreur pour formats invalides
- Navigation clavier pour réordonner

### API
```typescript
// POST /api/properties/[id]/photos/upload-url
{
  propertyId: string,
  contentType: string,
  fileName: string
}
→ { uploadURL: string, key: string }

// Upload direct vers Supabase Storage (bucket: property-photos)
// Puis POST /api/properties/[id]/photos
{
  property_id: string,
  unit_id?: string,
  room_id?: string,
  storage_key: string,
  tags?: string[],
  sort_order: number
}
→ { photo: { id: string, ... } }
```

### Events Analytics
- `photos_uploaded` - Photos uploadées avec `{ count: number, mode: "fast" | "full" }`

### Composant
- Rapide : `features/properties/components/v3/dynamic-step.tsx` (étape `photos_simple`)
- Complet : `features/properties/components/v3/rooms-photos-step.tsx` (section photos)

---

## Étape 6 — Équipements & énergie (Complet uniquement)

### But
Définir les équipements et la classe énergétique.

### Champs
- `features[]` (array d'ENUM) : `cuisine_equipee`, `fibre`, `PMR`, `parking`, `clim`, `wifi`, `television`, `lave_linge`, `lave_vaisselle`, etc.
- `dpe.class` (ENUM optionnel) : `A`, `B`, `C`, `D`, `E`, `F`, `G`, `non_renseigne`
- `heating_type` (ENUM optionnel) : `electrique`, `gaz`, `fioul`, `bois`, `pompe_chaleur`, `autre`

### Validations Zod
```typescript
z.object({
  features: z.array(z.enum([...])).optional(),
  dpe: z.object({
    class: z.enum(["A", "B", "C", "D", "E", "F", "G", "non_renseigne"]).optional()
  }).optional(),
  heating_type: z.enum([...]).optional()
})
// Aucune validation bloquante (lint publication peut l'exiger selon pays)
```

### UX/Animations
- **Chips multi-select** : sélection multiple avec badges animés
- **Descriptions succinctes** : tooltips au hover
- **Transition** : 220ms ease-out

### Accessibilité
- `role="group"` pour chaque catégorie d'équipements
- Labels clairs avec descriptions

### API
```typescript
// POST /api/properties/[id]/features/bulk
{
  unit_id: string,
  features: Array<{
    feature: string,
    value?: boolean | string
  }>
}
// ou PATCH /api/properties/[id] avec champs énergie
{
  dpe_class?: string,
  heating_type?: string,
  equipments?: string[]
}
```

### Events Analytics
- `features_saved` - Équipements sauvegardés avec `{ count: number, has_dpe: boolean }`

### Composant
`features/properties/components/v3/dynamic-step.tsx` (étape `features` ou `energie`)

---

## Étape 7 — Publication (Complet uniquement)

### But
Décider privé/public et vérifier lint avant publication.

### Champs
- `publication` (ENUM requis) : `PRIVATE` | `PUBLIC`
- Si `PUBLIC` :
  - `title` (string, ≥8 caractères)
  - `description` (string, ≥30 caractères)
  - `rent_cents` (number, ≥0)
  - `charges_cents` (number, ≥0)
  - `available_from` (date, ISO 8601)

### Validations Zod
```typescript
z.object({
  publication: z.enum(["PRIVATE", "PUBLIC"]),
  title: z.string().min(8).optional(),
  description: z.string().min(30).optional(),
  rent_cents: z.number().int().min(0).optional(),
  charges_cents: z.number().int().min(0).optional(),
  available_from: z.string().datetime().optional()
}).refine(
  (data) => data.publication !== "PUBLIC" || (
    data.title && data.title.length >= 8 &&
    data.description && data.description.length >= 30 &&
    data.rent_cents !== undefined && data.rent_cents >= 0
  ),
  "Les champs de publication publique sont requis"
)
```

### Lint avant publier
- Photos ≥3
- Adresse OK (géocodée)
- Title ≥8 caractères
- Description ≥30 caractères
- (Option) DPE présent

### UX/Animations
- **Checklist d'exigences** : ticks animés (scale 0→1) pour chaque critère
- **Prévisualisation annonce** : modal avec aperçu
- **Transition** : 220ms ease-out

### Accessibilité
- Checklist avec `role="list"` et `aria-checked`
- Messages d'erreur clairs pour chaque critère manquant

### API
```typescript
// POST /api/listings/publish
{
  unit_id: string,
  title?: string,
  description?: string,
  rent_cents?: number,
  charges_cents?: number,
  available_from?: string
}
→ { 
  success: boolean,
  errors?: Array<{ field: string, message: string }>,
  listing_id?: string
}

// POST /api/listings/unpublish
{
  unit_id: string
}
```

### Events Analytics
- `listing_publish_clicked` - Clic sur "Publier"
- `listing_published` - Publication réussie
- `listing_lint_failed` - Échec du lint avec `{ errors: Array<{ field, message }> }`

### Composant
`features/properties/components/v3/dynamic-step.tsx` (étape `publication`)

---

## Étape 8 — Résumé & Création (activation)

### But
Finaliser, générer le code logement unique (non réattribuable), shortcuts post-création.

### Affichage
Récapitulatif :
- Adresse complète
- Type de bien
- Détails (surface, pièces, etc.)
- Photos (miniatures)
- Équipements & énergie
- Publication (si PUBLIC)

### Actions
- `PATCH /api/properties/:id` avec `{ status: "active" }`
- `POST /api/units/:unitId/code` → `{ code: string }` (+ insert `app.unit_codes`)
- CTA : "Inviter locataires/garants", "Créer le bail", "Partager le code"

### UX/Animations
- **Confetti subtil** : animation réduite si `prefers-reduced-motion`
- **Toast "Bien créé"** : notification de succès
- **Transition** : 220ms ease-out

### Accessibilité
- Récapitulatif structuré avec headings hiérarchiques
- Liens d'action clairs

### API
```typescript
// PATCH /api/properties/[id]
{
  status: "active"
}

// POST /api/units/[unitId]/code
{
  unitId: string
}
→ { code: string }

// Insert dans app.unit_codes
{
  unit_id: string,
  code: string,
  retired: false
}
```

### Events Analytics
- `property_activated` - Propriété activée
- `code_generated` - Code unique généré

### Composant
`features/properties/components/v3/recap-step.tsx`

---

## Étape 9 — Compteurs & EDL (Optionnel)

### But
Ajouter les compteurs et planifier l'EDL d'entrée.

### Champs
- `meters[]` :
  - `type` (ENUM) : `WATER` | `ELECTRICITY` | `GAS`
  - `provider` (string, optionnel)
  - `meter_ref` (string, optionnel)
- `edl.entry_datetime` (datetime, optionnel, ISO 8601)

### Validations Zod
```typescript
z.object({
  meters: z.array(
    z.object({
      type: z.enum(["WATER", "ELECTRICITY", "GAS"]),
      provider: z.string().optional(),
      meter_ref: z.string().optional()
    })
  ).optional(),
  edl: z.object({
    entry_datetime: z.string().datetime().optional()
  }).optional()
})
```

### UX/Animations
- Formulaire simple avec ajout/suppression de compteurs
- Date picker pour EDL
- Transition : 220ms ease-out

### API
```typescript
// POST /api/properties/[id]/meters
{
  property_id: string,
  type: string,
  provider?: string,
  meter_ref?: string
}

// POST /api/edl/schedule
{
  property_id: string,
  unit_id?: string,
  entry_datetime: string
}
```

### Events Analytics
- `meter_added` - Compteur ajouté
- `edl_scheduled` - EDL planifié

---

## Validations Zod (résumé complet)

Voir `lib/validations/property-v3.ts` pour les schémas complets.

---

## UX/Animations (communs à toutes les étapes)

### Stepper sticky (haut)
- Barre de progression animée (Framer Motion `width` transition)
- Label "Étape X sur Y"
- Animation : 400ms ease-out

### Footer sticky (bas)
- Boutons "Précédent / Continuer"
- Micro-copy contextuelle ("Parfait, on passe à l'adresse ✨")
- Animation : 220ms ease-out

### Transitions enter/exit
- Durée : 200-240ms
- Easing : spring (stiffness 320, damping 28)
- `prefers-reduced-motion` → fade only (pas de translation/scale)

### Autosave
- Debounce : 2s
- Restore si retour (localStorage + draft BDD)

### Accessibilité
- `role="listbox"` / `aria-pressed` sur cartes
- Focus ring 2px
- Navigation flèches + Entrée
- `prefers-reduced-motion` respecté

### Mobile
- Grilles responsive : 1→2→3→4 colonnes
- Cibles ≥44px
- Safe-area iOS pour le footer

---

## API (façade REST — récap)

```
POST   /api/properties                    # Créer brouillon
PATCH  /api/properties/:id                # Mettre à jour (status ACTIVE à la fin)
POST   /api/properties/:id/units          # Créer unité
PATCH  /api/properties/:id/units/:uid    # Mettre à jour unité
POST   /api/properties/:id/rooms          # Créer pièces (batch)
POST   /api/properties/:id/photos/upload-url  # Obtenir URL signée
POST   /api/properties/:id/photos         # Enregistrer photo
POST   /api/properties/:id/features/bulk  # Ajouter équipements
POST   /api/listings/publish              # Publier annonce
POST   /api/listings/unpublish            # Dépublier annonce
POST   /api/units/:unitId/code            # Générer code unique
POST   /api/properties/:id/meters         # Ajouter compteur
POST   /api/edl/schedule                  # Planifier EDL
```

---

## Modèle de données (extrait clés)

Voir `supabase/migrations/202502150000_property_model_v3.sql` pour le schéma complet.

### RLS
- Owner peut CRUD ses `properties`/`units`/...
- Admin full access

---

## Événements analytics (funnel)

```
type_step_view
  → type_selected
    → prop_address_submitted
      → prop_geocoded_ok|fail
        → unit_details_saved
          → rooms_set
            → photos_uploaded
              → features_saved
                → listing_publish_clicked
                  → listing_published|lint_failed
                    → property_activated
                      → code_generated
```

---

## Critères de succès

- **Rapide** : création d'un lot actif en ≤ 60s (photos min 1)
- **Complet** : dossier prêt publication en ≤ 6 min
- **Lint** : <10% d'échecs à la publication (guidage clair)
- **Accessibilité** : contrastes AA, clavier & SR OK, reduced-motion respecté

---

## Structure de fichiers

```
app/owner/property/new/
  page.tsx                    # Wrapper principal (router)
  
features/properties/components/v3/
  property-wizard-v3.tsx      # Orchestrateur principal
  property-type-selection.tsx # Étape 1
  dynamic-step.tsx            # Étapes 2, 3, 6, 7 (générique)
  rooms-photos-step.tsx       # Étapes 4, 5 (complet)
  recap-step.tsx              # Étape 8
  utilities-step.tsx          # Étape 9 (optionnel)

lib/design-system/
  wizard-layout.tsx           # Layout réutilisable (header, progress, footer)
  animations.ts                # Variants Framer Motion

lib/config/
  property-wizard-loader.ts    # Chargement configuration JSON
  property-wizard-config.json  # Configuration des étapes

lib/validations/
  property-v3.ts               # Schémas Zod V3
  property-validation.ts       # Validation complète
```

---

## Prêt à builder ✅

Cette documentation est complète et alignée avec :
- Le code existant (`property-wizard-v3.tsx`, `wizard-layout.tsx`)
- Les routes API existantes
- Les schémas Zod existants
- Les spécifications SOTA 2025

Tous les composants, validations, API et événements sont documentés et prêts à être implémentés.

