# ⚡ Déploiement rapide sur Vercel

## 🎯 En 3 étapes simples

### Étape 1 : Créer le dépôt GitHub

1. Aller sur https://github.com/new
2. Nom : `gestion-locative`
3. **Ne PAS** cocher "Initialize this repository with README"
4. Cliquer sur "Create repository"

### Étape 2 : Pousser le code

**Option A : Utiliser le script automatique**
```bash
./scripts/deploy-to-github.sh VOTRE_USERNAME_GITHUB
git push -u origin main
```

**Option B : Commandes manuelles**
```bash
git remote add origin https://github.com/VOTRE_USERNAME/gestion-locative.git
git branch -M main
git push -u origin main
```

### Étape 3 : Déployer sur Vercel

1. Aller sur https://vercel.com
2. Se connecter avec GitHub
3. Cliquer sur "Add New..." → "Project"
4. Sélectionner le dépôt `gestion-locative`
5. **Configurer les variables d'environnement** :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (à remplir après le premier déploiement)
6. Cliquer sur "Deploy"

## ✅ C'est tout !

Après le déploiement :
- Configurez Supabase avec l'URL Vercel
- Mettez à jour `NEXT_PUBLIC_APP_URL` dans Vercel
- Redéployez

📖 Pour plus de détails : voir `GITHUB_DEPLOYMENT.md`

