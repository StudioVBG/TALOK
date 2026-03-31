# ✅ Checklist de Déploiement Netlify - Talok

## 🎯 Résumé des Fonctionnalités
- [x] Next.js 14 App Router
- [x] Intégration Supabase (Auth, DB, Storage)
- [x] Paiements Stripe
- [x] Emails Resend
- [x] Système d'Export Sécurisé (Nouveau !)

## 📋 Avant le Déploiement

### 1. Variables d'Environnement (Netlify UI)
Configurez ces variables dans les paramètres de votre site Netlify :

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://votre-site.netlify.app
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

### 2. Plugin Next.js
Le fichier `netlify.toml` est déjà configuré pour utiliser `@netlify/plugin-nextjs`.

## 🚀 Déploiement

1. `git push origin main`
2. Netlify détecte automatiquement le changement et lance le build.
3. Surveillez le log de build dans le dashboard Netlify.

## 🆘 En cas de problème
- Vérifiez les logs dans **Site overview** > **Production deploys**.
- Assurez-vous que `NODE_VERSION` est définie sur `20` dans les variables d'environnement de build.
