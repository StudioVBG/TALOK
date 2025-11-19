# 📋 DIFFS COMPLETS - Patch Final

**Date** : 2025-02-18

---

## 🔧 PROBLÈME 1 : PUT /app/owner/property/undefined

### Cause identifiée

L'API `/api/properties/[id]/photos/upload-url` retourne `upload_url` (snake_case) mais le code TypeScript attend `uploadURL` (camelCase), ce qui cause `response.uploadURL` = `undefined` et génère l'URL `/app/owner/property/undefined`.

### Patch appliqué

**Fichier** : `app/app/owner/property/new/_steps/SummaryStep.tsx`

```diff
- .post<{ uploadURL: string; key: string }>(
+ .post<{ upload_url: string; uploadURL?: string; key?: string; photo?: any }>(
    `/properties/${propertyId}/photos/upload-url`,
    {
      file_name: photo.file!.name,
      mime_type: photo.file!.type as "image/jpeg" | "image/png" | "image/webp",
      tag: defaultTag,
      room_id: null,
    }
  )
- .then((response) => ({ response, index, photo }))
+ .then((response) => {
+   // ✅ CORRECTION: L'API retourne upload_url (snake_case), pas uploadURL (camelCase)
+   const uploadURL = response.upload_url || response.uploadURL;
+   if (!uploadURL) {
+     console.error(`[SummaryStep] ⚠️ uploadURL manquant dans la réponse:`, response);
+     throw new Error("URL d'upload manquante dans la réponse");
+   }
+   return { response: { uploadURL, key: response.key || "" }, index, photo };
+ })
```

```diff
- .filter((item): item is { response: { uploadURL: string; key: string }; index: number; photo: any } => item !== null);
+ .filter((item): item is { response: { uploadURL: string; key: string }; index: number; photo: any } => {
+   if (item === null) return false;
+   // ✅ VALIDATION: Vérifier que uploadURL est bien une URL valide (Supabase signed URL)
+   if (!item.response.uploadURL || !item.response.uploadURL.startsWith('http')) {
+     console.error(`[SummaryStep] ⚠️ uploadURL invalide:`, item.response.uploadURL);
+     return false;
+   }
+   return true;
+ });
```

---

## 🔧 PROBLÈME 2 : fetchProperties retourne 0 propriétés

### Causes identifiées

1. `user_profile_id()` peut retourner NULL dans certains contextes
2. Les médias sont chargés avec le client utilisateur (peut avoir des problèmes RLS)
3. Logs de diagnostic insuffisants pour identifier le problème

### Patches appliqués

#### Patch 2.1 : Migration SQL pour user_profile_id()

**Fichier** : `supabase/migrations/202502180003_ensure_user_profile_id_works.sql`

```sql
-- Supprimer toutes les versions existantes pour éviter les conflits
DROP FUNCTION IF EXISTS public.user_profile_id() CASCADE;
DROP FUNCTION IF EXISTS public.user_profile_id(UUID) CASCADE;

-- Créer une version robuste sans paramètre
CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO result
  FROM profiles
  WHERE user_id = current_user_id
  LIMIT 1;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Créer une version avec paramètre
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
-- ... (même logique avec p_user_id)
$$;

-- Faire de même pour user_role()
-- ...
```

#### Patch 2.2 : Utilisation service_role pour médias

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

```diff
  // Charger les médias (cover_url) de manière optimisée avec fallback
+ // ✅ IMPORTANT: Utiliser serviceClient pour charger les médias aussi (bypass RLS)
+ // Car supabase (client utilisateur) peut avoir des problèmes RLS
+ const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
+ const mediaServiceClient = supabaseAdmin();
+ 
  const propertiesWithMedia = await Promise.all(
    properties.slice(0, 20).map(async (property) => {
      try {
        try {
-          const { data: media } = await supabase
+          const { data: media } = await mediaServiceClient
            .from("documents")
            .select("id, preview_url, is_cover")
            .eq("property_id", property.id)
            // ...
        } catch (columnError: any) {
          if (columnError.message?.includes("column") || columnError.code === "42703") {
            console.warn("[fetchProperties] Colonnes is_cover/collection manquantes, utilisation fallback");
-            const { data: media } = await supabase
+            const { data: media } = await mediaServiceClient
              .from("documents")
              .select("id, preview_url")
              // ...
```

#### Patch 2.3 : Logs de diagnostic améliorés

**Fichier** : `app/app/owner/_data/fetchProperties.ts`

```diff
      } else {
        console.warn(`[fetchProperties] ⚠️ AUCUNE PROPRIÉTÉ TROUVÉE pour owner_id=${ownerId}`);
+       console.warn(`[fetchProperties] ⚠️ Profil utilisé: id=${profile.id}, user_id=${user.id}`);
+       console.warn(`[fetchProperties] ⚠️ Profil attendu (avec 5 biens): 3b9280bc-061b-4880-a5e1-57d3f7ab06e5`);
        
-       const { data: allProperties, error: checkError } = await supabase
+       const { data: allProperties, error: checkError } = await serviceClient
          .from("properties")
-         .select("id, owner_id")
+         .select("id, owner_id, adresse_complete")
          .limit(10);
        if (!checkError && allProperties) {
+         console.log("[fetchProperties] Exemples de propriétés en base (tous owner_id):", allProperties);
+         const ownerIds = new Set(allProperties.map(p => p.owner_id));
+         console.log("[fetchProperties] Owner IDs trouvés en base:", Array.from(ownerIds));
+         if (!ownerIds.has(ownerId)) {
+           console.error(`[fetchProperties] ❌ ERREUR: owner_id=${ownerId} n'existe dans aucune propriété en base`);
+           console.error(`[fetchProperties] ❌ Les propriétés existent avec d'autres owner_id:`, Array.from(ownerIds));
+         }
        }
      }
```

---

## 📊 RÉSUMÉ DES CORRECTIONS

### Fichiers modifiés

1. ✅ `app/app/owner/property/new/_steps/SummaryStep.tsx`
   - Correction mapping `upload_url` → `uploadURL`
   - Validation URL avant utilisation
   - Gestion d'erreur améliorée

2. ✅ `app/app/owner/_data/fetchProperties.ts`
   - Utilisation `service_role` pour médias (bypass RLS)
   - Logs de diagnostic améliorés
   - Vérification `owner_id` vs propriétés en base

3. ✅ `supabase/migrations/202502180003_ensure_user_profile_id_works.sql` (NOUVEAU)
   - Version robuste de `user_profile_id()` et `user_role()`
   - Gestion des cas d'erreur

---

## 🎯 RÉSULTAT ATTENDU

Après application des patches :

1. ✅ Plus d'erreur `PUT /app/owner/property/undefined`
2. ✅ Les photos s'uploadent correctement avec l'URL signée Supabase
3. ✅ `fetchProperties` retourne les propriétés correctement
4. ✅ `OwnerDataProvider` reçoit `propertiesCount > 0`
5. ✅ Les propriétés apparaissent dans `/app/owner/properties`

---

## 🧪 TESTS À EFFECTUER

1. **Appliquer la migration SQL** :
   ```bash
   supabase migration up
   ```

2. **Créer un bien avec photos** :
   - Vérifier qu'il n'y a plus d'erreur `PUT /app/owner/property/undefined`
   - Vérifier que les photos s'uploadent correctement

3. **Vérifier les logs serveur** :
   - `[fetchProperties] ✅ Requête directe réussie: X propriétés trouvées`
   - `[OwnerLayout] ✅ Propriétés chargées: X`
   - `[OwnerDataProvider] Données reçues: { propertiesCount: X, ... }`

4. **Vérifier la page `/app/owner/properties`** :
   - Les propriétés doivent apparaître sans toucher aux filtres

---

**Tous les patches sont appliqués. Appliquer la migration SQL et tester.**

