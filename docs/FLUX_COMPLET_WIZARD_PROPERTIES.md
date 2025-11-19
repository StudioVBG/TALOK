# 📋 Flux Complet : Du Wizard à l'Affichage des Propriétés

## 🎯 Vue d'Ensemble

```
Wizard (Frontend) → API Routes → Supabase Postgres → Affichage
```

---

## 1️⃣ FLUX DU WIZARD (Frontend)

### État React (Zustand Store)

**Fichier :** `app/app/owner/property/new/_store/useNewProperty.ts`

**Stockage local :**
- Les données sont stockées dans le state React (Zustand avec persist)
- Aucun appel API pendant la saisie (bonne pratique)
- Les données sont sauvegardées dans `localStorage` (persist middleware)

**Structure du Draft :**
```typescript
interface Draft {
  kind?: "APARTMENT" | "HOUSE" | ...;
  address?: Address;
  details?: Details;
  rooms?: Room[];
  photos?: Photo[];
  features?: string[];
  property_id?: string;  // ← Rempli après création du draft
  unit_id?: string;       // ← Rempli après création du draft
}
```

### Étapes du Wizard

1. **TYPE** → Sélection du type de bien
2. **ADDRESS** → Adresse complète
3. **DETAILS** → Surface, pièces, DPE, etc.
4. **ROOMS** → Pièces (mode FULL uniquement)
5. **PHOTOS** → Photos du bien
6. **FEATURES** → Équipements (mode FULL uniquement)
7. **PUBLISH** → Options de publication (mode FULL uniquement)
8. **SUMMARY** → Récapitulatif + Création finale

---

## 2️⃣ CRÉATION DU DRAFT (SummaryStep.tsx)

### Étape 1 : Créer le Draft

**Fichier :** `app/app/owner/property/new/_steps/SummaryStep.tsx` (ligne 103)

**Appel API :**
```typescript
const draftResponse = await PropertyAPI.createDraft({
  kind: draft.kind,
  address: {
    line1: draft.address?.adresse_complete || "",
    city: draft.address?.ville || "",
    postal_code: draft.address?.code_postal || "",
    country_code: "FR",
  },
  status: "DRAFT",
});
```

**Route Backend :** `POST /api/properties`

**Payload envoyé :**
```json
{
  "type_bien": "appartement",
  "usage_principal": "habitation"
}
```

**Ce que fait le Backend :**

1. **Authentification :**
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   ```

2. **Récupération du profil :**
   ```typescript
   const { data: profile } = await serviceClient
     .from("profiles")
     .select("id, role")
     .eq("user_id", user.id)
     .single();
   ```

3. **Insertion dans `properties` :**
   ```typescript
   const insertPayload = {
     owner_id: profile.id,  // ✅ Utilise profile.id
     type_bien: "appartement",
     adresse_complete: "Adresse à compléter",
     code_postal: "00000",
     ville: "Ville à préciser",
     etat: "draft",
     // ... autres champs par défaut
   };
   
   const { data } = await serviceClient
     .from("properties")
     .insert(insertPayload)
     .select("id, owner_id, type_bien, etat")
     .single();
   ```

**Réponse :**
```json
{
  "property": {
    "id": "a99c73dc-e86b-...",
    "owner_id": "profile-id-xxx",  // ✅ profile.id
    "type_bien": "appartement",
    "etat": "draft"
  }
}
```

**Stockage dans le state :**
```typescript
draft.property_id = draftResponse.property_id;  // ← Stocké pour les PATCH suivants
```

---

### Étape 2 : Mettre à Jour avec les Détails

**Fichier :** `app/app/owner/property/new/_steps/SummaryStep.tsx` (ligne 162)

**Appel API :**
```typescript
await apiClient.patch(`/properties/${propertyId}`, {
  adresse_complete: draft.address.adresse_complete,
  code_postal: draft.address.code_postal,
  ville: draft.address.ville,
  surface: draft.details.surface_m2,
  nb_pieces: draft.details.rooms_count,
  // ... autres champs
});
```

**Route Backend :** `PATCH /api/properties/:id`

**Ce que fait le Backend :**
1. Vérifie que `property.owner_id === profile.id`
2. Met à jour la ligne dans `properties`
3. Retourne la propriété mise à jour

---

### Étape 3 : Upload des Photos

**Fichier :** `app/app/owner/property/new/_steps/SummaryStep.tsx` (ligne 198)

**Flux :**
1. **Obtenir URL signée :**
   ```typescript
   POST /api/properties/:id/photos/upload-url
   {
     "file_name": "salon.jpg",
     "mime_type": "image/jpeg",
     "tag": "vue_generale"
   }
   ```

2. **Upload direct vers Storage :**
   ```typescript
   PUT {upload_url}
   Content-Type: image/jpeg
   [binary data]
   ```

3. **Enregistrement en base :**
   - La photo est automatiquement créée dans `property_media` ou équivalent

---

## 3️⃣ LECTURE DES PROPRIÉTÉS (GET /api/properties)

### Route Backend

**Fichier :** `app/api/properties/route.ts` (ligne 22)

**Flux :**

1. **Authentification :**
   ```typescript
   const { data: { user } } = await supabase.auth.getUser();
   ```

2. **Récupération du profil :**
   ```typescript
   const { data: profile } = await supabase
     .from("profiles")
     .select("id, role, user_id")
     .eq("user_id", user.id)
     .single();
   ```

3. **Requête Supabase :**
   ```typescript
   const { data: propertiesData } = await supabase
     .from("properties")
     .select("*")
     .eq("owner_id", profile.id)  // ✅ Utilise profile.id (cohérent avec création)
     .order("created_at", { ascending: false });
   ```

4. **Enrichissement avec les baux :**
   ```typescript
   // Récupérer les baux actifs/en préavis
   const { data: leases } = await supabase
     .from("leases")
     .select("id, property_id, loyer, charges_forfaitaires, statut")
     .in("property_id", propertyIds)
     .in("statut", ["active", "pending_signature"]);
   
   // Enrichir chaque propriété avec status et monthlyRent
   ```

5. **Réponse :**
   ```json
   {
     "propertiesCount": 3,
     "properties": [...],
     "leasesCount": 2
   }
   ```

---

## 4️⃣ UTILISATION DES PROPRIÉTÉS

### Page "Mes biens" (`/app/owner/properties`)

**Fichier :** `app/app/owner/properties/page.tsx`

**Hook utilisé :**
```typescript
const { data: properties = [], isLoading, isError } = useProperties();
```

**Hook React Query :**
```typescript
// lib/hooks/use-properties.ts
const response = await apiClient.get<{ 
  propertiesCount: number;
  properties: PropertyRow[];
  leasesCount: number;
}>("/properties");

return response.properties;  // Extrait le tableau properties
```

**Affichage :**
- Loading → Skeleton cards
- Error → Carte d'erreur
- Empty → Message "Aucun bien"
- Success → Grille de cartes de propriétés

---

### Dashboard Propriétaire (`/app/owner/dashboard`)

**Route :** `GET /api/owner/dashboard`

**Utilise les propriétés pour :**
- Nombre total de biens
- Répartition par type
- Indicateurs de loyer & revenus

---

### Baux & Locataires

**Table `leases` :**
```sql
CREATE TABLE leases (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),  -- ← Référence vers properties
  ...
);
```

**Si `properties.owner_id` est incorrect :**
- ❌ Impossible de créer un bail sur ce bien
- ❌ Impossible de générer les loyers
- ❌ Impossible d'associer un locataire

---

## 5️⃣ VÉRIFICATION DE COHÉRENCE

### ✅ Création (POST /api/properties)

**Ligne 523 :** `profileId: profile.id` ✅
**Ligne 384 :** `owner_id: profileId` ✅
**Ligne 558 :** `owner_id: profile.id` ✅

**Conclusion :** La création utilise bien `profile.id`.

### ✅ Lecture (GET /api/properties)

**Ligne 127 :** `.eq("owner_id", profile.id)` ✅

**Conclusion :** La lecture utilise bien `profile.id`.

### ✅ Cohérence

**Création :** `owner_id = profile.id` ✅
**Lecture :** `owner_id = profile.id` ✅

**✅ COHÉRENT :** Les deux utilisent la même valeur.

---

## 6️⃣ POINTS DE VÉRIFICATION

### Point 1 : Vérifier que le Draft est Créé

**Logs attendus lors de la création :**
```
[POST /api/properties] DEBUG: {
  authUserId: "...",
  profileId: "...",  ← Doit être différent de authUserId
  profileRole: "owner"
}
[createDraftProperty] Insert payload owner_id: "..."  ← Doit être égal à profileId
[createDraftProperty] ✅ Insert successful: {
  id: "...",
  owner_id: "...",  ← Doit être égal à profileId
  type_bien: "...",
  etat: "draft"
}
```

**Vérification dans Supabase :**
```sql
SELECT id, owner_id, type_bien, etat, created_at
FROM properties
WHERE owner_id = 'profile-id-xxx'  -- Remplacer par le profile.id réel
ORDER BY created_at DESC;
```

---

### Point 2 : Vérifier que les PATCH Fonctionnent

**Logs attendus :**
```
PATCH /api/properties/:id → 200
```

**Vérification :**
- La propriété doit être mise à jour avec les nouvelles valeurs
- `updated_at` doit être mis à jour

---

### Point 3 : Vérifier que la Lecture Trouve les Propriétés

**Logs attendus :**
```
[api/properties] DEBUG: profile.id = "..."
[api/properties] DEBUG: owner_id filter = "..."  ← Doit être égal à profile.id
[api/properties] DEBUG: Nombre de propriétés trouvées: X
```

**Si `X = 0` :**
- Vérifier que des propriétés existent dans Supabase
- Vérifier que `owner_id` dans la base = `profile.id` dans les logs
- Vérifier les RLS policies sur `properties`

---

## 7️⃣ PROBLÈMES POSSIBLES ET SOLUTIONS

### Problème 1 : Aucune Propriété Créée

**Symptôme :** Les logs montrent que `createDraftProperty` est appelé mais aucune ligne n'apparaît dans Supabase.

**Causes possibles :**
1. Erreur silencieuse dans `insertPropertyRecord`
2. RLS policy bloque l'insertion
3. Contrainte de base de données non respectée

**Solution :**
1. Vérifier les logs serveur pour les erreurs
2. Vérifier les RLS policies sur `properties`
3. Tester l'insertion directement dans Supabase SQL Editor

---

### Problème 2 : Propriétés Créées mais Non Trouvées

**Symptôme :** Des propriétés existent dans Supabase mais `propertiesCount = 0`.

**Causes possibles :**
1. `owner_id` dans la base ≠ `profile.id` utilisé dans le filtre
2. RLS policy bloque la lecture
3. Filtre incorrect dans la requête

**Solution :**
1. Exécuter le diagnostic SQL pour vérifier `owner_id`
2. Vérifier les logs pour comparer `profile.id` et `owner_id` dans la base
3. Si mismatch, exécuter la migration de correction

---

### Problème 3 : Propriétés Visibles mais Baux Non Associés

**Symptôme :** Les propriétés s'affichent mais les baux ne sont pas associés.

**Causes possibles :**
1. `property_id` dans `leases` ne correspond pas
2. Requête de baux échoue silencieusement

**Solution :**
1. Vérifier les logs `[fetchProperties] DEBUG: Nombre de baux trouvés`
2. Vérifier que `leases.property_id` correspond à `properties.id`

---

## 8️⃣ CHECKLIST DE VÉRIFICATION

### Lors de la Création d'un Bien

- [ ] `POST /api/properties` retourne `201` avec `property.id`
- [ ] Les logs montrent `owner_id = profile.id` (pas `user.id`)
- [ ] La propriété apparaît dans Supabase avec le bon `owner_id`
- [ ] `PATCH /api/properties/:id` met à jour correctement
- [ ] Les photos s'uploadent correctement

### Lors de la Lecture

- [ ] `GET /api/properties` retourne `200`
- [ ] Les logs montrent `owner_id filter = profile.id`
- [ ] Les logs montrent `Nombre de propriétés trouvées: X` (X > 0 si propriétés existent)
- [ ] La page `/app/owner/properties` affiche les biens
- [ ] Les baux sont correctement associés (si présents)

---

## 9️⃣ ROUTES API RECOMMANDÉES (Référence)

### 🔵 1. Créer le Draft

**POST** `/api/properties`

**Payload :**
```json
{
  "type_bien": "appartement",
  "usage_principal": "habitation"
}
```

**Réponse :**
```json
{
  "property": {
    "id": "uuid",
    "owner_id": "profile-id",
    "etat": "draft"
  }
}
```

---

### 🔵 2. Mettre à Jour le Bien

**PATCH** `/api/properties/:id`

**Payload :**
```json
{
  "adresse_complete": "...",
  "surface": 45,
  "nb_pieces": 2,
  ...
}
```

**Vérification :** `property.owner_id === profile.id`

---

### 🔵 3. Upload de Photos

**POST** `/api/properties/:id/photos/upload-url`

**Payload :**
```json
{
  "file_name": "salon.jpg",
  "mime_type": "image/jpeg",
  "tag": "vue_generale"
}
```

**Réponse :**
```json
{
  "upload_url": "https://...",
  "public_url": "https://...",
  "media_id": "uuid"
}
```

---

### 🔵 4. Lister les Biens

**GET** `/api/properties`

**Réponse :**
```json
{
  "propertiesCount": 3,
  "properties": [...],
  "leasesCount": 2
}
```

**Filtre :** `.eq("owner_id", profile.id)`

---

### 🔵 5. Détail d'un Bien

**GET** `/api/properties/:id`

**Vérification :** `property.owner_id === profile.id`

---

## ✅ CONCLUSION

### État Actuel du Code

- ✅ **Création** : Utilise `profile.id` pour `owner_id`
- ✅ **Lecture** : Filtre sur `owner_id = profile.id`
- ✅ **Cohérence** : Les deux utilisent la même valeur

### Prochaines Étapes

1. **Exécuter le diagnostic SQL** pour vérifier les données existantes
2. **Créer un nouveau bien** et vérifier les logs
3. **Vérifier que la page affiche les biens**

---

**Date :** $(date)
**Status :** Code aligné, prêt pour diagnostic des données

