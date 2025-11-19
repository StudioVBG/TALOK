# 🔧 Configuration des Variables d'Environnement sur Vercel

## ⚠️ Problème actuel

Les déploiements échouent car les variables d'environnement Supabase ne sont pas configurées sur Vercel.

## ✅ Solution : Configurer les variables d'environnement

### Étape 1 : Accéder aux paramètres du projet Vercel

1. Allez sur votre dashboard Vercel : https://vercel.com/dashboard
2. Sélectionnez votre projet **Gestion-Immo**
3. Cliquez sur **Settings** (Paramètres)
4. Dans le menu latéral, cliquez sur **Environment Variables** (Variables d'environnement)

### Étape 2 : Ajouter les variables obligatoires

Ajoutez les variables suivantes une par une :

#### 1. `NEXT_PUBLIC_SUPABASE_URL`
- **Valeur** : L'URL de votre projet Supabase
- **Exemple** : `https://xxxxx.supabase.co`
- **Environnements** : ✅ Production, ✅ Preview, ✅ Development
- **Où trouver** : Dashboard Supabase → Settings → API → Project URL

#### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Valeur** : La clé anonyme (publique) de votre projet Supabase
- **Exemple** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Environnements** : ✅ Production, ✅ Preview, ✅ Development
- **Où trouver** : Dashboard Supabase → Settings → API → anon public key

#### 3. `SUPABASE_SERVICE_ROLE_KEY` (optionnel mais recommandé)
- **Valeur** : La clé service role (secrète) de votre projet Supabase
- **Exemple** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Environnements** : ✅ Production, ✅ Preview, ✅ Development
- **Où trouver** : Dashboard Supabase → Settings → API → service_role key
- **⚠️ Important** : Ne jamais exposer cette clé publiquement !

### Étape 3 : Variables optionnelles (si nécessaire)

Si vous utilisez ces fonctionnalités, ajoutez également :

- `NEXT_PUBLIC_APP_URL` : URL de votre application (ex: `https://gestion-immo.vercel.app`)
- `STRIPE_SECRET_KEY` : Pour les paiements Stripe
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` : Clé publique Stripe
- `RESEND_API_KEY` : Pour l'envoi d'emails

### Étape 4 : Redéployer

Après avoir ajouté toutes les variables :

1. Retournez sur la page **Deployments**
2. Cliquez sur les **3 points** (⋯) du dernier déploiement
3. Sélectionnez **Redeploy**
4. Ou poussez un nouveau commit pour déclencher un nouveau déploiement

## 📋 Checklist rapide

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurée
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurée
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurée (recommandé)
- [ ] Variables ajoutées pour Production, Preview ET Development
- [ ] Nouveau déploiement lancé

## 🔍 Vérification

Après le redéploiement, vérifiez que :

1. Le build passe sans erreur
2. L'application démarre correctement
3. Les routes API fonctionnent (testez `/api/properties` par exemple)

## 🆘 En cas d'erreur persistante

Si les déploiements échouent encore après avoir configuré les variables :

1. Vérifiez les **logs de build** dans Vercel pour voir l'erreur exacte
2. Vérifiez que les variables sont bien configurées pour **tous les environnements**
3. Assurez-vous que les valeurs sont correctes (pas d'espaces avant/après)
4. Vérifiez que votre projet Supabase est actif et accessible

## 📚 Ressources

- [Documentation Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Documentation Supabase - API Keys](https://supabase.com/docs/guides/api/api-keys)

