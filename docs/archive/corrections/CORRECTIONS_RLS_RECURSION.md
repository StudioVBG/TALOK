# Corrections : Récursion infinie dans les politiques RLS

## Problèmes identifiés

### 1. **Récursion infinie dans la politique RLS pour profiles**
- **Erreur** : `infinite recursion detected in policy for relation "profiles"`
- **Cause** : La politique RLS "Admins can view all profiles" utilisait `public.user_role()` qui interroge la table `profiles`, déclenchant à nouveau la politique RLS, créant une boucle infinie.
- **Solution** : 
  - Création d'une fonction `is_admin()` avec `SECURITY DEFINER` qui désactive explicitement RLS temporairement
  - La fonction lit directement depuis la table sans passer par RLS
  - La politique RLS utilise maintenant `public.is_admin()` au lieu de `public.user_role()`

### 2. **Erreur 500 sur les requêtes client vers profiles**
- **Problème** : Les requêtes client (via `use-auth.ts`) échouaient avec une erreur de récursion
- **Solution** : 
  - Création d'une route API `/api/me/profile` qui utilise le service role
  - Modification du hook `use-auth.ts` pour utiliser cette route en fallback en cas d'erreur RLS

### 3. **Erreur 403 sur `/api/admin/stats`**
- **Problème** : L'API retournait 403 même pour les admins
- **Solution** : `requireAdmin` utilise maintenant le service role par défaut, contournant complètement RLS pour les routes API admin

## Fichiers modifiés

### Migrations
- `supabase/migrations/fix_rls_recursion_profiles.sql` (nouveau)
  - Supprime la politique RLS problématique
  - Crée la fonction `is_admin()` avec `SECURITY DEFINER`
  - Recrée la politique RLS en utilisant `public.is_admin()`

- `supabase/migrations/fix_is_admin_rls_disable.sql` (nouveau)
  - Améliore la fonction `is_admin()` pour désactiver explicitement RLS avec `SET LOCAL row_security = off`
  - Ajoute une gestion d'erreur pour restaurer RLS en cas d'exception

### API Routes
- `app/api/me/profile/route.ts` (nouveau)
  - Route API pour récupérer le profil de l'utilisateur connecté
  - Utilise le service role pour éviter les problèmes RLS

### Frontend
- `lib/hooks/use-auth.ts`
  - Ajout d'un fallback vers `/api/me/profile` en cas d'erreur de récursion RLS
  - Gestion de l'erreur `42P17` (infinite recursion)

### Helpers
- `lib/helpers/auth-helper.ts`
  - `requireAdmin` utilise maintenant le service role par défaut
  - Retourne le service client pour les requêtes suivantes

## Architecture de sécurité

### Pour les routes API admin
- Utilisation du **service role** qui contourne complètement RLS
- Vérification du rôle admin via le service role avant d'accorder l'accès
- Toutes les requêtes suivantes utilisent le service role

### Pour les requêtes client
- Utilisation du **client Supabase standard** avec RLS activé
- Fallback vers `/api/me/profile` (service role) en cas d'erreur RLS
- Les utilisateurs peuvent toujours voir leur propre profil via la politique "Users can view own profile"

### Pour les admins (requêtes client)
- La politique RLS "Admins can view all profiles" utilise `public.is_admin()`
- La fonction `is_admin()` désactive RLS temporairement pour éviter la récursion
- Les admins peuvent voir tous les profils via cette politique

## Tests à effectuer

1. **Client - Récupération du profil utilisateur**
   - [ ] Vérifier que `use-auth.ts` récupère correctement le profil
   - [ ] Vérifier que le fallback vers `/api/me/profile` fonctionne en cas d'erreur RLS

2. **Admin - Dashboard**
   - [ ] Vérifier que `/api/admin/stats` fonctionne sans erreur 403/500
   - [ ] Vérifier que les 3 comptes sont visibles dans les statistiques

3. **Admin - Validation des prestataires**
   - [ ] Vérifier que les prestataires sont visibles
   - [ ] Vérifier que l'approbation/rejet fonctionne correctement

4. **RLS - Pas de récursion**
   - [ ] Vérifier qu'il n'y a plus d'erreur "infinite recursion detected"
   - [ ] Vérifier que les requêtes client fonctionnent normalement

## Justification des solutions

### Pourquoi utiliser `SECURITY DEFINER` + `SET LOCAL row_security = off` ?
- `SECURITY DEFINER` permet à la fonction de s'exécuter avec les privilèges du propriétaire
- `SET LOCAL row_security = off` désactive explicitement RLS pour la session locale
- Cette combinaison garantit que la fonction peut lire directement depuis la table sans déclencher les politiques RLS

### Pourquoi créer une route API `/api/me/profile` ?
- Permet de récupérer le profil même en cas de problème RLS
- Utilise le service role, donc contourne complètement RLS
- Fournit un fallback fiable pour le hook `use-auth.ts`

### Pourquoi utiliser le service role dans `requireAdmin` ?
- Les routes API admin ont besoin d'un accès complet aux données
- Le service role contourne RLS, évitant tous les problèmes de récursion
- La vérification du rôle admin est faite avant d'accorder l'accès, donc la sécurité est maintenue





