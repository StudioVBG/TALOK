# ✅ Corrections de Performance et Routes Manquantes

## 🐛 Problèmes Identifiés

1. **Route `/api/properties/new` n'existait pas** - Requête GET vers une route inexistante
2. **Route `/api/leases?property_id=new`** - "new" n'est pas un ID valide
3. **Route `/documents/upload` retournait 404** - Route manquante
4. **Page "Ajouter un bien" pas dans le layout owner** - Pointait vers `/properties/new` au lieu de `/app/owner/properties/new`
5. **Performance lente** - Trop de timeouts et vérifications dans `/api/properties`
6. **Logs verbeux** - Logs détaillés ralentissaient les requêtes

## ✅ Solutions Appliquées

### 1. Page "Ajouter un bien" dans le Layout Owner

**Créé** : `/app/app/owner/properties/new/page.tsx`
- Page intégrée dans le layout owner avec sidebar
- Utilise `PropertyWizardV3` pour la création de propriété

**Modifié** : `app/app/owner/properties/page.tsx`
- Liens "Ajouter un bien" pointent maintenant vers `/app/owner/properties/new`

### 2. Optimisation de `/api/properties`

**Avant** : Requête avec multiples timeouts et vérifications (jusqu'à 3s de timeout)
**Après** : Requête directe simplifiée sans timeouts inutiles

```typescript
// Requête simplifiée et optimisée
const { data, error } = await serviceClient
  .from("properties")
  .select("id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_base, created_at, etat")
  .eq("owner_id", profileData.id)
  .order("created_at", { ascending: false })
  .limit(50);
```

### 3. Optimisation de `/api/leases`

**Ajouté** : Gestion du cas `property_id=new` (retourne un tableau vide)
**Optimisé** : Limite de 100 propriétés pour éviter les problèmes de performance

```typescript
if (propertyIdParam === "new") {
  return NextResponse.json({ leases: [] });
}
```

### 4. Création de `/api/documents/upload`

**Créé** : `app/api/documents/upload/route.ts`
- Route POST pour uploader des documents
- Compatible avec les anciens appels
- Gère l'upload vers Supabase Storage et la création d'entrées dans la table `documents`

### 5. Réduction des Logs API

**Modifié** : `lib/api-client.ts`
- Logs détaillés seulement en développement
- Log minimal en production pour améliorer les performances

```typescript
// Log minimal seulement en développement
if (process.env.NODE_ENV === 'development') {
  console.log(`[api-client] ${options.method || 'GET'} ${url} - ${response.status}`);
}
```

## 📊 Résultats Attendus

- ✅ **Performance améliorée** : Requêtes plus rapides sans timeouts inutiles
- ✅ **Routes fonctionnelles** : Plus d'erreurs 404 pour les routes manquantes
- ✅ **Navigation cohérente** : Page "Ajouter un bien" dans le layout owner
- ✅ **Logs optimisés** : Moins de logs en production

## 🚀 Déploiement

Les modifications ont été déployées sur Vercel.

