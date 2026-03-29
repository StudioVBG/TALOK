# 🚀 Guide de Déploiement Netlify - Talok

## 📋 Prérequis

- ✅ Compte Netlify configuré
- ✅ Projet GitHub connecté à Netlify
- ✅ Projet Supabase créé et actif
- ✅ Variables d'environnement configurées

## 🔧 Configuration des Variables d'Environnement

### Variables OBLIGATOIRES

#### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Format** : `https://xxxxx.supabase.co`
- **Où trouver** : Supabase Dashboard → Settings → API → **Project URL**

#### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Format** : Clé JWT
- **Où trouver** : Supabase Dashboard → Settings → API → **anon public** key

#### 3. `SUPABASE_SERVICE_ROLE_KEY`
- **⚠️ SECRET** : Ne jamais exposer publiquement
- **Où trouver** : Supabase Dashboard → Settings → API → **service_role** key

### Variables pour les Paiements (Stripe)

#### 4. `STRIPE_SECRET_KEY`
#### 5. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
#### 6. `STRIPE_WEBHOOK_SECRET`

### Variables pour les Emails (Resend)

#### 7. `RESEND_API_KEY`
#### 8. `RESEND_FROM_EMAIL`

## 📝 Étapes de Déploiement

### Étape 1 : Vérifier le Build Local

```bash
npm run build
```

### Étape 2 : Configurer Netlify

1. Allez sur votre dashboard Netlify.
2. Cliquez sur **Add new site** > **Import an existing project**.
3. Connectez votre compte GitHub et sélectionnez le dépôt.
4. **Build settings** :
   - Build command: `npm run build`
   - Publish directory: `.next` (géré par le plugin)
5. Ajoutez toutes les variables d'environnement dans **Site settings** > **Environment variables**.

### Étape 3 : Pousser les Changements

```bash
git add .
git commit -m "feat: Migration vers Netlify"
git push origin main
```

## 🔍 Vérification Post-Déploiement

- [ ] Le build passe sans erreur
- [ ] L'application démarre correctement
- [ ] La connexion Supabase fonctionne
- [ ] Les routes API répondent correctement
