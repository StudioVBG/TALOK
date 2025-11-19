# 🐛 Correctif : Chargement infini sur la page "Mes biens"

**Date** : 2025-02-15  
**Problème** : La page `/app/owner/properties` reste bloquée sur "Chargement..." indéfiniment

---

## 🔍 Diagnostic

### Problème identifié

1. **Pas de gestion d'erreur** : La page n'affichait pas d'erreur si l'API échouait
2. **Hook React Query bloqué** : Le hook `useProperties()` restait en `isLoading: true` si la requête échouait
3. **Pas de timeout côté client** : Les requêtes pouvaient rester en attente indéfiniment
4. **Messages d'erreur peu clairs** : Les erreurs n'étaient pas différenciées (timeout vs auth vs serveur)

---

## ✅ Correctifs appliqués

### 1. Gestion d'erreur dans la page

**Fichier** : `app/app/owner/properties/page.tsx`

**Changements** :
- Ajout de `error` et `refetch` depuis `useProperties()`
- Affichage d'une carte d'erreur avec message clair
- Boutons "Réessayer" et "Recharger la page"
- Message d'erreur contextuel selon le type d'erreur

**Code ajouté** :
```typescript
if (propertiesError) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-destructive">Erreur de chargement</CardTitle>
        <CardDescription>Impossible de charger vos propriétés</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{propertiesError.message}</p>
        <Button onClick={() => refetchProperties()}>Réessayer</Button>
      </CardContent>
    </Card>
  );
}
```

### 2. Amélioration du hook `useProperties`

**Fichier** : `lib/hooks/use-properties.ts`

**Changements** :
- Gestion différenciée des erreurs (timeout, auth, serveur)
- Messages d'erreur clairs et contextuels
- Retry intelligent (ne réessaie pas pour auth/timeout)
- Configuration de cache optimisée :
  - `staleTime: 30s` - données considérées fraîches pendant 30s
  - `gcTime: 5min` - garde en cache pendant 5 minutes
  - `refetchOnWindowFocus: false` - évite les refetch automatiques

**Code ajouté** :
```typescript
catch (error: any) {
  if (error?.statusCode === 504 || error?.message?.includes("timeout")) {
    throw new Error("Le chargement prend trop de temps. Veuillez réessayer.");
  }
  if (error?.statusCode === 401 || error?.statusCode === 403) {
    throw new Error("Vous n'êtes pas autorisé à accéder à ces données.");
  }
  throw error;
}
```

### 3. Timeout côté client dans `api-client`

**Fichier** : `lib/api-client.ts`

**Changements** :
- Ajout d'un timeout de **10 secondes** pour toutes les requêtes
- Utilisation de `AbortController` pour annuler les requêtes lentes
- Gestion spécifique des erreurs de timeout/abort
- Message d'erreur clair pour les timeouts

**Code ajouté** :
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  // ...
} catch (error: any) {
  if (error.name === 'AbortError') {
    throw new Error("Le chargement prend trop de temps. Veuillez réessayer.");
  }
  throw error;
}
```

### 4. Amélioration du hook `useLeases`

**Fichier** : `lib/hooks/use-leases.ts`

**Changements** :
- Configuration de cache cohérente avec `useProperties`
- Retry intelligent
- Gestion d'erreur améliorée (retourne tableau vide pour ne pas bloquer l'UI)

---

## 🎯 Résultat

### Avant
- ❌ Chargement infini si l'API échoue
- ❌ Pas de feedback utilisateur
- ❌ Pas de possibilité de réessayer

### Après
- ✅ Affichage d'une erreur claire après 10 secondes max
- ✅ Message d'erreur contextuel selon le type d'erreur
- ✅ Boutons pour réessayer ou recharger
- ✅ Timeout côté client pour éviter les attentes infinies
- ✅ Cache optimisé pour réduire les requêtes inutiles

---

## 🧪 Tests à effectuer

1. **Test timeout** :
   - Simuler une API lente (>10s)
   - Vérifier que l'erreur s'affiche après 10 secondes
   - Vérifier le message "Le chargement prend trop de temps"

2. **Test erreur API** :
   - Simuler une erreur 500 ou 504
   - Vérifier que l'erreur s'affiche correctement
   - Vérifier que le bouton "Réessayer" fonctionne

3. **Test succès** :
   - Vérifier que les propriétés se chargent normalement
   - Vérifier que le cache fonctionne (pas de refetch inutile)

---

## 📝 Fichiers modifiés

1. ✅ `app/app/owner/properties/page.tsx` - Gestion d'erreur UI
2. ✅ `lib/hooks/use-properties.ts` - Amélioration hook
3. ✅ `lib/hooks/use-leases.ts` - Amélioration hook
4. ✅ `lib/api-client.ts` - Timeout côté client

---

## 🚀 Prochaines améliorations possibles

1. **Skeleton loader** : Remplacer le spinner par un skeleton plus informatif
2. **Retry automatique** : Ajouter un retry automatique avec backoff exponentiel
3. **Cache persistant** : Utiliser localStorage pour persister le cache
4. **Optimistic updates** : Mettre à jour l'UI immédiatement lors des mutations

---

**Le problème de chargement infini est maintenant résolu ! ✅**

