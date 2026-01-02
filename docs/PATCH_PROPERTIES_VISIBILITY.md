# 🔧 PATCH - Correction de la visibilité des propriétés

**Date** : 2025-02-18  
**Problème** : Les biens créés n'apparaissent pas dans `/owner/dashboard` et `/owner/properties`  
**Cause** : Problèmes RLS et manque de logs pour diagnostiquer

---

## ✅ CORRECTIONS APPLIQUÉES

### 1. Logs détaillés dans `fetchProperties.ts`

**Fichier** : `app/owner/_data/fetchProperties.ts`

**Ajouts** :
- ✅ Logs à chaque étape (début, auth, profil, requête)
- ✅ Diagnostic de `user_profile_id()` RPC
- ✅ Détection spécifique des erreurs RLS (code 42501)
- ✅ Log des propriétés trouvées avec leurs IDs
- ✅ Vérification si aucune propriété n'est trouvée

**Exemple de logs** :
```
[fetchProperties] Début - ownerId: xxx, options: {...}
[fetchProperties] Utilisateur authentifié: yyy
[fetchProperties] Profil trouvé: id=zzz, role=owner
[fetchProperties] user_profile_id() retourne: zzz
[fetchProperties] Tentative avec RPC owner_properties_with_status...
[fetchProperties] ✅ Requête directe réussie: 3 propriétés trouvées
```

### 2. Amélioration de la gestion d'erreur dans `layout.tsx`

**Fichier** : `app/owner/layout.tsx`

**Ajouts** :
- ✅ Logs d'erreur détaillés avec stack trace
- ✅ Log du profile ID utilisé pour diagnostic
- ✅ Log de succès avec nombre de propriétés chargées

### 3. Migration SQL pour corriger les conflits RLS

**Fichier** : `supabase/migrations/202502180001_fix_rls_conflicts.sql`

**Corrections** :
- ✅ Suppression de toutes les anciennes politiques en conflit
- ✅ Recréation des politiques avec noms standardisés
- ✅ Ajout des politiques pour locataires et admins

### 4. Script de diagnostic SQL

**Fichier** : `scripts/diagnose-properties-issue.sql`

**Contenu** :
- Vérification de `user_profile_id()`
- Vérification des propriétés existantes
- Vérification des politiques RLS actives
- Test de la requête exacte utilisée

---

## 🔍 DIAGNOSTIC

### Comment utiliser les logs

1. **Redémarrer le serveur** :
   ```bash
   npm run dev
   ```

2. **Aller sur `/owner/properties`**

3. **Vérifier les logs serveur** :
   - Chercher `[fetchProperties]` dans la console
   - Vérifier les messages d'erreur
   - Vérifier le nombre de propriétés trouvées

### Scénarios possibles

#### Scénario 1 : RLS bloque l'accès
```
[fetchProperties] ❌ Erreur requête directe: row-level security policy violation
[fetchProperties] ⚠️ ERREUR RLS DÉTECTÉE
```
**Solution** : Vérifier que `user_profile_id()` retourne bien le bon ID

#### Scénario 2 : Aucune propriété trouvée
```
[fetchProperties] ⚠️ AUCUNE PROPRIÉTÉ TROUVÉE pour owner_id=xxx
[fetchProperties] Exemples de propriétés en base: [...]
```
**Solution** : Vérifier que `owner_id` correspond bien au `profile.id`

#### Scénario 3 : Propriétés trouvées mais pas affichées
```
[fetchProperties] ✅ Requête directe réussie: 3 propriétés trouvées
[OwnerLayout] ✅ Propriétés chargées: 3
```
**Solution** : Le problème est dans le composant client, vérifier les filtres

---

## 🚀 DÉPLOIEMENT

### 1. Appliquer la migration SQL

```bash
# Via Supabase CLI
supabase migration up

# Ou via l'interface Supabase
# Aller dans SQL Editor et exécuter le contenu de 202502180001_fix_rls_conflicts.sql
```

### 2. Redémarrer le serveur

```bash
npm run dev
```

### 3. Tester

1. Créer un nouveau bien
2. Vérifier les logs serveur
3. Vérifier que le bien apparaît dans la liste

---

## 📋 CHECKLIST DE VÉRIFICATION

- [ ] Migration SQL appliquée
- [ ] Serveur redémarré
- [ ] Logs serveur vérifiés
- [ ] `user_profile_id()` fonctionne correctement
- [ ] Les propriétés sont trouvées dans les logs
- [ ] Les propriétés apparaissent dans l'UI

---

## 🔧 SI LE PROBLÈME PERSISTE

### Option 1 : Exécuter le script de diagnostic

```sql
-- Dans Supabase SQL Editor
-- Copier le contenu de scripts/diagnose-properties-issue.sql
```

### Option 2 : Vérifier manuellement

```sql
-- Vérifier que user_profile_id() fonctionne
SELECT public.user_profile_id();

-- Vérifier les propriétés
SELECT id, owner_id, adresse_complete 
FROM properties 
WHERE owner_id = public.user_profile_id();

-- Vérifier les politiques RLS
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'properties';
```

### Option 3 : Désactiver temporairement RLS (DEV UNIQUEMENT)

```sql
-- ⚠️ UNIQUEMENT EN DÉVELOPPEMENT
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;
```

---

## 📊 RÉSULTAT ATTENDU

Après application du patch :

1. ✅ Les logs montrent clairement où le problème se situe
2. ✅ Les politiques RLS sont cohérentes et fonctionnent
3. ✅ Les propriétés sont trouvées et affichées correctement
4. ✅ Le diagnostic est facilité grâce aux logs détaillés

---

**Note** : Les logs détaillés permettront d'identifier rapidement la cause exacte du problème. Si le problème persiste après application du patch, les logs indiqueront précisément où chercher.

