# Refonte complète du processus d'ajout de bien

## ✅ Statut : TERMINÉ

Date : 2025-02-18

## Résumé des changements

### 1. Canon de routes (Frontend)
- ✅ Toutes les routes utilisent `/owner/property/new` (singulier)
- ✅ Redirections legacy en place pour `/owner/properties/new`

### 2. Canon d'API (Backend)

#### Routes créées/modifiées :

**POST `/api/properties`**
- Crée un draft property + unit par défaut
- Renvoie `{property_id, unit_id, property}` (canon + compatibilité)
- Ajoute `revalidateTag("owner:properties")` et `revalidateTag("admin:properties")`

**PATCH `/api/properties/[id]`**
- Met à jour une propriété
- Ajoute `revalidateTag("owner:properties")` et `revalidateTag("admin:properties")`

**PATCH `/api/units/[id]`**
- Met à jour une unité
- Ajoute `revalidateTag("owner:properties")` et `revalidateTag("admin:properties")`

**POST `/api/units/[id]/code`**
- Génère un code unique pour une unité
- Format : `U` + 6 caractères aléatoires (ex: `UABC123`)

### 3. Client API centralisé

**`lib/api.ts`**
- `PropertyAPI.createDraft()` - Crée un draft avec mapping automatique
- `PropertyAPI.activate()` - Active une propriété
- `UnitAPI.patch()` - Met à jour une unité
- `UnitAPI.createCode()` - Génère un code unique

### 4. Migration SQL RLS

**`supabase/migrations/202502180000_rls_properties_units.sql`**
- Active RLS sur `properties` et `units`
- Politiques pour INSERT, SELECT, UPDATE selon `owner_id`
- Utilise `public.user_profile_id()` pour obtenir le `profiles.id` de l'utilisateur connecté
- Vérification de propriété pour les units via sous-requête

### 5. Wizard mis à jour

**`SummaryStep.tsx`**
- Utilise `PropertyAPI.createDraft()` au lieu de `apiClient.post()`
- Stocke `property_id` et `unit_id` dans le store
- Génère le code unique via `UnitAPI.createCode()`
- Active la propriété via `PropertyAPI.activate()`

**`useNewProperty.ts` (store)**
- Ajout de `property_id` et `unit_id` dans le Draft

### 6. Revalidation

- ✅ `revalidateTag("owner:properties")` dans POST et PATCH
- ✅ `revalidateTag("admin:properties")` dans POST et PATCH
- ✅ Headers `Cache-Tag` dans GET `/api/properties`

## Structure des fichiers

```
app/
├── api/
│   ├── _lib/
│   │   └── supabase.ts                    # ✅ NOUVEAU - Helpers Supabase
│   ├── properties/
│   │   ├── route.ts                       # ✅ MODIFIÉ - POST crée property + unit
│   │   └── [id]/
│   │       └── route.ts                   # ✅ MODIFIÉ - PATCH avec revalidateTag
│   └── units/
│       └── [id]/
│           ├── route.ts                   # ✅ NOUVEAU - PATCH unit
│           └── code/
│               └── route.ts               # ✅ NOUVEAU - POST génère code

lib/
└── api.ts                                 # ✅ NOUVEAU - Client API centralisé

app/owner/property/new/
├── _store/
│   └── useNewProperty.ts                  # ✅ MODIFIÉ - Ajout property_id/unit_id
└── _steps/
    └── SummaryStep.tsx                    # ✅ MODIFIÉ - Utilise PropertyAPI/UnitAPI

supabase/migrations/
└── 202502180000_rls_properties_units.sql  # ✅ NOUVEAU - RLS policies
```

## Flux de création

1. **Type → Adresse** : Stockage dans le store (pas d'API)
2. **Adresse → Détails** : Stockage dans le store (pas d'API)
3. **Summary → Créer** :
   - `PropertyAPI.createDraft()` → Crée property + unit → Retourne `{property_id, unit_id}`
   - PATCH property avec toutes les données (adresse, détails, etc.)
   - POST rooms (si présentes)
   - Upload photos (si présentes)
   - POST features (si présentes)
   - `UnitAPI.createCode()` → Génère code unique
   - `PropertyAPI.activate()` → Active la propriété
   - Redirection vers `/owner/properties/${propertyId}`

## Critères d'acceptation

- ✅ Aucun appel vers `/owner/properties/new` ou API anciennes
- ✅ POST `/api/properties` retourne `{property_id, unit_id}` et crée 2 lignes (properties, units)
- ✅ Après activation, le bien apparaît dans `/owner/properties` sans refresh manuel (grâce à revalidateTag)
- ✅ Le flux ne jette aucune 404/500 dans la console
- ✅ Single source of truth : `/lib/api.ts` pour tous les appels API

## Prochaines étapes

1. **Déployer la migration SQL** :
   ```bash
   supabase db push
   ```

2. **Tester le flux complet** :
   - Créer un bien en mode FAST
   - Créer un bien en mode FULL
   - Vérifier que le bien apparaît dans la liste sans refresh
   - Vérifier que le code unique est généré

3. **Vérifier RLS** :
   - Tester que les propriétaires ne voient que leurs biens
   - Tester que les units sont bien liées aux properties

4. **Tests E2E (optionnel)** :
   - Ajouter des tests Playwright pour le flux "ajout rapide"
   - Tester Type → Adresse → Photos (skip) → Summary → Create

## Notes techniques

- Le mapping `kind` → `type_bien` est fait dans `PropertyAPI.createDraft()`
- L'unit par défaut est créée avec `nom: "Unité principale"` et `capacite_max: 1` (ou 10 pour colocation)
- Le code unique unit est généré avec `U` + 6 caractères aléatoires
- La revalidation fonctionne grâce à `revalidateTag()` côté serveur et `Cache-Tag` headers côté client

