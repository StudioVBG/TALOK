# 🚨 Correction des Erreurs de Déploiement Vercel

## Diagnostic

Les déploiements échouent car **les variables d'environnement Supabase ne sont pas configurées sur Vercel**.

Le build local fonctionne car vous avez `.env.local`, mais Vercel n'a pas accès à ces variables.

## ✅ Solution Immédiate

### 1. Configurer les variables sur Vercel

**Accès rapide** : https://vercel.com/studiovbgs-projects/gestion-immo/settings/environment-variables

#### Variables OBLIGATOIRES à ajouter :

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Valeur : Votre URL Supabase (ex: `https://xxxxx.supabase.co`)
   - Environnements : ✅ Production ✅ Preview ✅ Development

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Valeur : Votre clé anonyme Supabase
   - Environnements : ✅ Production ✅ Preview ✅ Development

3. **`SUPABASE_SERVICE_ROLE_KEY`** (recommandé)
   - Valeur : Votre clé service role Supabase
   - Environnements : ✅ Production ✅ Preview ✅ Development
   - ⚠️ **SECRET** : Ne jamais exposer publiquement

### 2. Où trouver ces valeurs ?

1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet
3. Allez dans **Settings** → **API**
4. Copiez :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Redéployer

Après avoir ajouté les variables :

**Option A : Redéployer le dernier commit**
1. Allez sur https://vercel.com/studiovbgs-projects/gestion-immo/deployments
2. Cliquez sur les **3 points** (⋯) du dernier déploiement
3. Cliquez sur **Redeploy**

**Option B : Pousser un nouveau commit**
```bash
git commit --allow-empty -m "chore: Trigger redeploy after env vars setup"
git push origin main
```

## 🔍 Vérification

Après le redéploiement, vérifiez :

1. ✅ Le build passe sans erreur
2. ✅ Le déploiement se termine avec succès
3. ✅ L'application est accessible sur votre URL Vercel

## 📋 Checklist Complète

- [ ] `NEXT_PUBLIC_SUPABASE_URL` ajoutée sur Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` ajoutée sur Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ajoutée sur Vercel (recommandé)
- [ ] Toutes les variables sont configurées pour **Production, Preview ET Development**
- [ ] Redéploiement lancé
- [ ] Build réussi ✅

## 🆘 Si ça ne fonctionne toujours pas

1. **Vérifiez les logs de build** dans Vercel pour voir l'erreur exacte
2. **Vérifiez les logs runtime** si le build passe mais l'app ne démarre pas
3. **Vérifiez que les valeurs sont correctes** (pas d'espaces, pas de guillemets supplémentaires)
4. **Vérifiez que votre projet Supabase est actif**

## 📚 Documentation

- Guide détaillé : Voir `VERCEL_ENV_SETUP.md`
- Variables requises : Voir `env.example`

