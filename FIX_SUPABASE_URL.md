# 🔧 Correction de l'URL Supabase sur Vercel

## 🚨 Problème détecté

L'erreur dans la console montre que l'URL Supabase est incorrecte :

```
https://supabase.com/dashboard/project/poeijjosocmqlhgsacud/settings/api-keys/new/auth/v1/token
```

Cette URL pointe vers le **dashboard Supabase** au lieu de l'**API Supabase**.

## ✅ Solution

### 1. Trouver la bonne URL Supabase

1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet (ID: `poeijjosocmqlhgsacud`)
3. Allez dans **Settings** → **API**
4. Dans la section **Project URL**, vous devriez voir quelque chose comme :
   ```
   https://poeijjosocmqlhgsacud.supabase.co
   ```
   ⚠️ **C'est cette URL qu'il faut utiliser**, PAS l'URL du dashboard !

### 2. Corriger sur Vercel

1. Allez sur : https://vercel.com/studiovbgs-projects/gestion-immo/settings/environment-variables
2. Trouvez la variable `NEXT_PUBLIC_SUPABASE_URL`
3. **Supprimez-la** si elle existe avec une mauvaise valeur
4. **Ajoutez-la à nouveau** avec la bonne valeur :
   - **Nom** : `NEXT_PUBLIC_SUPABASE_URL`
   - **Valeur** : `https://poeijjosocmqlhgsacud.supabase.co` (remplacez par votre vraie URL)
   - **Environnements** : ✅ Production ✅ Preview ✅ Development

### 3. Format correct vs incorrect

❌ **INCORRECT** (URL du dashboard) :
```
https://supabase.com/dashboard/project/poeijjosocmqlhgsacud/settings/api-keys/new
```

✅ **CORRECT** (URL de l'API) :
```
https://poeijjosocmqlhgsacud.supabase.co
```

### 4. Redéployer

Après avoir corrigé la variable :

1. Allez sur https://vercel.com/studiovbgs-projects/gestion-immo/deployments
2. Cliquez sur les **3 points** (⋯) du dernier déploiement
3. Cliquez sur **Redeploy**

Ou poussez un nouveau commit :
```bash
git commit --allow-empty -m "chore: Fix Supabase URL configuration"
git push origin main
```

## 🔍 Vérification

Après le redéploiement :

1. ✅ L'erreur CORS devrait disparaître
2. ✅ La connexion devrait fonctionner
3. ✅ Plus d'erreur "Failed to fetch"

## 📋 Checklist

- [ ] URL Supabase récupérée depuis Settings → API → Project URL
- [ ] Variable `NEXT_PUBLIC_SUPABASE_URL` mise à jour sur Vercel
- [ ] Format de l'URL vérifié (doit se terminer par `.supabase.co`)
- [ ] Variable configurée pour Production, Preview ET Development
- [ ] Redéploiement effectué
- [ ] Test de connexion réussi ✅

