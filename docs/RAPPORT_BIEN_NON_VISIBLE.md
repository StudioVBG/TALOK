# 📊 RAPPORT D'ANALYSE - Bien créé non visible dans le tableau de bord

**Date** : 2025-02-18  
**Problème** : Un bien a été créé avec succès mais n'apparaît pas dans le tableau de bord du propriétaire  
**Erreur observée** : `500 (Internal Server Error)` sur `GET /api/properties`

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Fallback pour colonnes manquantes (`app/app/owner/_data/fetchProperties.ts`)

**Problème** : La requête utilisait `is_cover` et `collection` qui peuvent ne pas exister si la migration n'a pas été appliquée.

**Solution** : Ajout d'un fallback qui :
- Essaie d'abord avec les colonnes complètes
- Si erreur liée aux colonnes, utilise une requête simplifiée sans `is_cover` et `collection`
- Retourne toujours la propriété même en cas d'erreur (sans média)

**Code ajouté** :
```typescript
try {
  // Essayer avec colonnes complètes
  const { data: media } = await supabase
    .from("documents")
    .select("id, preview_url, is_cover")
    .eq("property_id", property.id)
    .eq("collection", "property_media")
    .order("is_cover", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // ...
} catch (columnError: any) {
  // Fallback si colonnes manquantes
  if (columnError.message?.includes("column") || columnError.code === "42703") {
    const { data: media } = await supabase
      .from("documents")
      .select("id, preview_url")
      .eq("property_id", property.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // ...
  }
}
```

### 2. Logs de diagnostic (`app/app/owner/layout.tsx`)

**Ajout** : Logs pour diagnostiquer les erreurs lors du chargement des données :

```typescript
if (propertiesResult.status === "rejected") {
  console.error("[OwnerLayout] Erreur lors du chargement des propriétés:", propertiesResult.reason);
  if (propertiesResult.reason instanceof Error) {
    console.error("[OwnerLayout] Stack:", propertiesResult.reason.stack);
  }
}
```

---

## 🔍 DIAGNOSTIC INITIAL

### Erreur dans la console

```
Error 500: {error: 'Erreur lors de la récupération des propriétés', details: {...}}
GET http://localhost:3000/api/properties 500 (Internal Server Error)
```

### Flux de données

1. **Layout Server Component** (`app/app/owner/layout.tsx`)
   - Appelle `fetchProperties(profile.id)`
   - Utilise `unstable_cache` avec tag `owner:properties`
   - Propage les données via `OwnerDataProvider` (Context)

2. **Page Client** (`app/app/owner/properties/PropertiesPageClient.tsx`)
   - Utilise `useOwnerData()` pour récupérer les données du Context
   - Affiche la liste des propriétés

### Point de défaillance identifié

**Fichier** : `app/app/owner/_data/fetchProperties.ts`  
**Ligne** : 120-128 (avant correction)

La requête utilisait les colonnes `is_cover` et `collection` qui peuvent ne pas exister si la migration `202411140230_documents_gallery.sql` n'a pas été appliquée.

---

## 🐛 CAUSES IDENTIFIÉES

### Cause principale : Colonnes manquantes dans `documents`

Les colonnes `is_cover` et `collection` sont ajoutées par la migration `202411140230_documents_gallery.sql`. Si cette migration n'a pas été appliquée :

- ❌ La requête échoue avec une erreur SQL
- ❌ `fetchProperties` lève une exception
- ❌ Le layout retourne `properties = []` (valeur par défaut)
- ❌ Aucun bien n'est affiché

---

## ✅ SOLUTIONS APPLIQUÉES

### Solution 1 : Fallback pour colonnes manquantes ✅

**Statut** : ✅ **APPLIQUÉ**

Le code essaie maintenant d'abord avec les colonnes complètes, puis utilise un fallback si elles n'existent pas.

### Solution 2 : Logs de diagnostic ✅

**Statut** : ✅ **APPLIQUÉ**

Les erreurs sont maintenant loggées dans la console serveur pour faciliter le débogage.

---

## 📋 CHECKLIST DE VÉRIFICATION

### Vérifications effectuées

- [x] ✅ Fallback ajouté pour colonnes manquantes
- [x] ✅ Gestion d'erreur améliorée
- [x] ✅ Logs de diagnostic ajoutés
- [ ] ⏳ Vérifier que la migration `202411140230_documents_gallery.sql` est appliquée
- [ ] ⏳ Vérifier que les biens existent en base avec le bon `owner_id`
- [ ] ⏳ Tester l'affichage après redémarrage du serveur

### Vérifications à faire

1. **Redémarrer le serveur de développement** :
   ```bash
   npm run dev
   ```

2. **Vérifier les logs serveur** :
   - Regarder les logs pour voir si le fallback est utilisé
   - Vérifier qu'il n'y a plus d'erreur 500

3. **Vérifier l'affichage** :
   - Aller sur `/app/owner/properties`
   - Vérifier que les biens apparaissent

4. **Vérifier la migration** (si problème persiste) :
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'documents' 
   AND column_name IN ('is_cover', 'collection');
   ```

---

## 🚀 RÉSULTAT ATTENDU

Après application des corrections :

1. ✅ `fetchProperties` fonctionne même si les colonnes `is_cover` et `collection` n'existent pas
2. ✅ Les biens sont chargés correctement depuis la base de données
3. ✅ Les biens apparaissent dans le tableau de bord
4. ✅ Les erreurs sont loggées pour faciliter le débogage
5. ✅ Plus d'erreur 500 sur `GET /api/properties`

---

## 📊 FICHIERS MODIFIÉS

- ✅ `app/app/owner/_data/fetchProperties.ts` - Fallback ajouté
- ✅ `app/app/owner/layout.tsx` - Logs de diagnostic ajoutés

---

## 🔧 PROCHAINES ÉTAPES

1. **Redémarrer le serveur** : `npm run dev`
2. **Vérifier les logs** : Regarder la console serveur pour voir si le fallback est utilisé
3. **Tester l'affichage** : Aller sur `/app/owner/properties` et vérifier que les biens apparaissent
4. **Si problème persiste** : Vérifier les logs pour voir l'erreur exacte

---

**Note** : Le bien existe probablement en base de données. Les corrections devraient permettre son affichage même si les colonnes `is_cover` et `collection` n'existent pas.

