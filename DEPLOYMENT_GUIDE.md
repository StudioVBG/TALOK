# 🚀 Guide de Déploiement Vercel - Gestion Locative

## 📋 Prérequis

- ✅ Compte Vercel configuré
- ✅ Projet GitHub connecté à Vercel
- ✅ Projet Supabase créé et actif
- ✅ Variables d'environnement configurées

## 🔧 Configuration des Variables d'Environnement

### Variables OBLIGATOIRES

#### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Format** : `https://xxxxx.supabase.co`
- **⚠️ IMPORTANT** : Ne PAS utiliser l'URL du dashboard (`https://supabase.com/dashboard/...`)
- **Où trouver** : Supabase Dashboard → Settings → API → **Project URL**
- **Environnements** : ✅ Production, ✅ Preview, ✅ Development

#### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Format** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Où trouver** : Supabase Dashboard → Settings → API → **anon public** key
- **Environnements** : ✅ Production, ✅ Preview, ✅ Development

#### 3. `SUPABASE_SERVICE_ROLE_KEY`
- **Format** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Où trouver** : Supabase Dashboard → Settings → API → **service_role** key
- **⚠️ SECRET** : Ne jamais exposer publiquement
- **Environnements** : ✅ Production, ✅ Preview, ✅ Development

### Variables OPTIONNELLES

- `NEXT_PUBLIC_APP_URL` : URL de l'application (ex: `https://gestion-immo.vercel.app`)
- `STRIPE_SECRET_KEY` : Pour les paiements Stripe
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : Clé publique Stripe
- `RESEND_API_KEY` : Pour l'envoi d'emails

## 📝 Étapes de Déploiement

### Étape 1 : Vérifier le Build Local

```bash
npm run build
```

Si le build échoue localement, il échouera aussi sur Vercel. Corrigez les erreurs avant de pousser.

### Étape 2 : Vérifier les Variables d'Environnement

1. Allez sur : https://vercel.com/studiovbgs-projects/gestion-immo/settings/environment-variables
2. Vérifiez que toutes les variables obligatoires sont présentes
3. Vérifiez que les valeurs sont correctes (pas d'espaces, bon format)

### Étape 3 : Pousser les Changements

```bash
# Vérifier le statut Git
git status

# Ajouter les changements
git add .

# Commit
git commit -m "feat: Description des changements"

# Push vers GitHub (déclenche automatiquement un déploiement Vercel)
git push origin main
```

### Étape 4 : Suivre le Déploiement

1. Allez sur : https://vercel.com/studiovbgs-projects/gestion-immo/deployments
2. Surveillez le statut du déploiement
3. Consultez les logs en cas d'erreur

## 🔍 Vérification Post-Déploiement

### Checklist

- [ ] Le build passe sans erreur
- [ ] L'application démarre correctement
- [ ] Pas d'erreurs CORS dans la console
- [ ] L'URL Supabase est correcte (pas de référence au dashboard)
- [ ] La connexion Supabase fonctionne
- [ ] Les routes API répondent correctement

### Tests à Effectuer

1. **Page d'accueil** : `/`
   - Vérifier que la page se charge
   - Vérifier qu'il n'y a pas d'erreurs dans la console

2. **Authentification** : `/auth/signin`
   - Tester la connexion
   - Vérifier qu'il n'y a pas d'erreur CORS

3. **API Properties** : `/api/properties`
   - Vérifier que l'endpoint répond
   - Vérifier les permissions RLS

## 🐛 Résolution des Problèmes Courants

### Erreur CORS

**Symptôme** : `Access to fetch at 'https://supabase.com/dashboard/...' has been blocked by CORS policy`

**Cause** : `NEXT_PUBLIC_SUPABASE_URL` pointe vers le dashboard au lieu de l'API

**Solution** :
1. Vérifier la valeur de `NEXT_PUBLIC_SUPABASE_URL` sur Vercel
2. S'assurer qu'elle se termine par `.supabase.co`
3. Redéployer après correction

### Build Failed - TypeScript Errors

**Symptôme** : Erreurs TypeScript dans les logs de build

**Solution** :
1. Vérifier le build local : `npm run build`
2. Corriger les erreurs localement
3. Pousser les corrections

### Build Failed - Missing Environment Variables

**Symptôme** : `NEXT_PUBLIC_SUPABASE_URL is not defined`

**Solution** :
1. Vérifier que toutes les variables sont configurées sur Vercel
2. Vérifier qu'elles sont activées pour l'environnement concerné
3. Redéployer après correction

### Application Crashes on Startup

**Symptôme** : Erreur 500 ou page blanche

**Solution** :
1. Consulter les logs Vercel (Runtime Logs)
2. Vérifier les variables d'environnement
3. Vérifier la connexion Supabase
4. Vérifier les permissions RLS

## 🔄 Redéploiement Manuel

Si vous devez redéployer sans pousser de commit :

1. Allez sur : https://vercel.com/studiovbgs-projects/gestion-immo/deployments
2. Cliquez sur les **3 points** (⋯) du dernier déploiement
3. Cliquez sur **Redeploy**
4. Confirmez

## 📊 Monitoring

### Logs Vercel

- **Build Logs** : Disponibles pendant le build
- **Runtime Logs** : Disponibles en production
- **Function Logs** : Pour les API routes

### Supabase Logs

- **API Logs** : Supabase Dashboard → Logs → API
- **Auth Logs** : Supabase Dashboard → Logs → Auth
- **Database Logs** : Supabase Dashboard → Logs → Postgres

## 🎯 Bonnes Pratiques

1. **Toujours tester localement** avant de pousser
2. **Vérifier les variables d'environnement** avant chaque déploiement
3. **Suivre les logs** pendant le déploiement
4. **Tester l'application** après chaque déploiement
5. **Documenter les changements** dans les commits

## 📚 Ressources

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Supabase](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## 🆘 Support

En cas de problème persistant :

1. Consultez les logs Vercel
2. Consultez les logs Supabase
3. Vérifiez la documentation
4. Contactez le support si nécessaire

