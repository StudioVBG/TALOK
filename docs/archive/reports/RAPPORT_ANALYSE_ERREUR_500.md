# Rapport d'Analyse : Erreur 500 Supabase sur Properties

## 🔍 Problème Identifié

L'erreur dans la console montre :
```
GET https://[PROJECT_ID].supabase.co/rest/v1/properties?select=id&owner_id=eq.[USER_UUID] 500 (Internal Server Error)
```

## 📊 Analyse du Code

### 1. Appels directs à Supabase identifiés

#### ✅ Hook `useProperties` - CORRECT
- **Fichier**: `lib/hooks/use-properties.ts`
- **Statut**: ✅ Utilise `apiClient.get("/properties")` - Pas d'appel direct
- **Conclusion**: Le hook est correctement implémenté

#### ⚠️ Service `PeopleService.getOwnerProperties()` - APPEL DIRECT
- **Fichier**: `features/admin/services/people.service.ts:212-260`
- **Problème**: Fait un appel direct à Supabase avec `.select("*")` et `.eq("owner_id", ownerId)`
- **Utilisation**: Utilisé dans `app/admin/people/owners/[id]/page.tsx` mais **PAS** dans `app/owner/page.tsx`
- **Conclusion**: Ne semble pas être la cause directe

### 2. Analyse de la Route API `/api/properties`

#### Route GET `/api/properties`
- **Fichier**: `app/api/properties/route.ts`
- **Statut**: ✅ Utilise `serviceClient` (service role) pour contourner RLS
- **Logique**: 
  - Pour les owners : `.select("*").eq("owner_id", profileData.id)`
  - Gestion d'erreur RLS : Retourne `[]` si erreur 42501
- **Conclusion**: La route API semble correcte

### 3. Analyse des Politiques RLS

#### Migration `20240101000011_fix_properties_rls_recursion.sql`
- **Politique "Owners can view own properties"**:
  ```sql
  CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (
    owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
  ```
- **Problème potentiel**: Cette politique utilise une sous-requête qui pourrait causer des problèmes de performance ou de récursion

#### Migration `20240101000001_rls_policies.sql`
- **Politique originale**:
  ```sql
  CREATE POLICY "Owners can view own properties"
  ON properties FOR SELECT
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  ```

### 4. Hypothèses sur l'Erreur 500

#### Hypothèse 1: Problème RLS avec sous-requête
- La politique RLS utilise `owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())`
- Si `profiles.id` n'existe pas ou si la relation est cassée, cela pourrait causer une erreur 500
- **Solution**: Vérifier que la colonne `profiles.id` existe et que la relation est correcte

#### Hypothèse 2: Appel Next.js RSC (React Server Component)
- Next.js pourrait faire un prefetch automatique avec `.select("id")` seulement
- L'erreur montre exactement `.select("id")` ce qui suggère un prefetch
- **Solution**: Vérifier les composants Server Components qui pourraient faire des appels

#### Hypothèse 3: Problème de colonne manquante
- L'erreur 500 pourrait être causée par une colonne manquante dans la table `properties`
- **Solution**: Vérifier que toutes les colonnes référencées existent

## 🔧 Solutions Recommandées

### Solution 1: Améliorer la gestion d'erreur dans l'API
```typescript
// Dans app/api/properties/route.ts
if (error) {
  console.error("Error fetching properties:", error);
  console.error("Error details:", {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  });
  
  // Retourner un tableau vide pour éviter l'erreur 500 côté client
  return NextResponse.json({ properties: [] });
}
```

### Solution 2: Vérifier les migrations RLS
- Vérifier que la politique RLS ne cause pas de récursion infinie
- Simplifier la politique si nécessaire

### Solution 3: Ajouter des logs détaillés
- Ajouter des logs dans `api-client.ts` pour voir toutes les requêtes
- Ajouter des logs dans la route API pour voir les erreurs exactes

### Solution 4: Vérifier les composants Server Components
- Chercher les composants qui pourraient faire des appels directs
- Vérifier les `Link` avec `prefetch={true}`

## 📝 Actions Immédiates

1. ✅ **Ajouter des logs détaillés** dans `api-client.ts` (FAIT)
2. ✅ **Améliorer la gestion d'erreur** dans `app/api/properties/route.ts` (FAIT)
3. ⏳ **Vérifier les logs serveur Vercel** pour voir l'erreur exacte
4. ⏳ **Vérifier les migrations RLS** pour s'assurer qu'elles sont correctes
5. ⏳ **Chercher les appels Next.js RSC** qui pourraient causer le problème

## 🎯 Prochaines Étapes

1. Vérifier les logs Vercel pour voir l'erreur exacte de Supabase
2. Tester la requête directement dans Supabase Dashboard → SQL Editor
3. Vérifier que la politique RLS fonctionne correctement
4. Si nécessaire, simplifier la politique RLS pour éviter les sous-requêtes complexes

