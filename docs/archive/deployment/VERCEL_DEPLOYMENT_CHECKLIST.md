# ✅ Checklist de déploiement Vercel

Ce document liste toutes les vérifications nécessaires pour garantir que l'application fonctionne correctement sur Vercel.

## 🔐 Variables d'environnement requises

### Variables critiques (obligatoires)

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Format: `https://xxxxx.supabase.co`
   - ⚠️ **NE PAS** utiliser l'URL du dashboard (`https://supabase.com/dashboard/...`)
   - Où trouver: Supabase Dashboard → Settings → API → Project URL

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Clé publique anonyme Supabase
   - Où trouver: Supabase Dashboard → Settings → API → anon public key

3. **`SUPABASE_SERVICE_ROLE_KEY`**
   - Clé de service (privée, ne jamais exposer côté client)
   - Où trouver: Supabase Dashboard → Settings → API → service_role key
   - ⚠️ Ne doit être utilisée que côté serveur (API routes)

### Variables optionnelles (recommandées)

4. **`NEXT_PUBLIC_APP_URL`**
   - URL de l'application en production
   - Exemple: `https://gestion-immo-nine.vercel.app`
   - Utilisée pour les redirections d'email (confirmation, reset password, etc.)

## 📋 Checklist de vérification

### Avant le déploiement

- [ ] Toutes les variables d'environnement sont configurées sur Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` pointe vers l'API Supabase (pas le dashboard)
- [ ] `NEXT_PUBLIC_APP_URL` est configurée avec l'URL Vercel correcte
- [ ] Les migrations Supabase sont à jour (vérifier via `supabase migration list`)

### Après le déploiement

- [ ] L'application se charge correctement sur Vercel
- [ ] La connexion fonctionne avec un compte existant
- [ ] L'inscription fonctionne et crée bien un profil
- [ ] Les emails de confirmation arrivent et redirigent vers Vercel (pas localhost)
- [ ] La réinitialisation de mot de passe fonctionne
- [ ] Les redirections selon le rôle fonctionnent (owner → /app/owner/dashboard, etc.)

## 🔧 Commandes utiles

### Vérifier les variables d'environnement sur Vercel

```bash
# Lister toutes les variables
vercel env ls

# Vérifier les variables spécifiques
./scripts/verify-vercel-env.sh
```

### Normaliser les emails existants

Si vous avez des problèmes de connexion avec des emails en majuscules:

```bash
# Vérifier les emails non normalisés
# Via le dashboard Supabase SQL Editor:
SELECT * FROM public.check_non_normalized_emails();

# Normaliser les emails
SELECT * FROM public.normalize_auth_emails();
```

## 🐛 Problèmes courants

### "Invalid login credentials" même avec les bons identifiants

**Cause**: Email non normalisé (majuscules/minuscules)

**Solution**:
1. Vérifier que l'email dans Supabase est en minuscules
2. Exécuter la fonction de normalisation: `SELECT * FROM public.normalize_auth_emails();`
3. Réessayer de se connecter avec l'email en minuscules

### Redirection vers localhost après confirmation d'email

**Cause**: `NEXT_PUBLIC_APP_URL` non configurée ou incorrecte

**Solution**:
1. Vérifier que `NEXT_PUBLIC_APP_URL` est configurée sur Vercel
2. Vérifier que la valeur est `https://gestion-immo-nine.vercel.app` (sans slash final)
3. Redéployer l'application après avoir ajouté/modifié la variable

### Erreur 500 lors de la connexion

**Cause**: Variables d'environnement manquantes ou incorrectes

**Solution**:
1. Vérifier toutes les variables avec `./scripts/verify-vercel-env.sh`
2. Vérifier les logs Vercel pour plus de détails
3. Vérifier que `NEXT_PUBLIC_SUPABASE_URL` pointe bien vers l'API (pas le dashboard)

## 📞 Support

Si vous rencontrez des problèmes après avoir suivi cette checklist:

1. Vérifier les logs Vercel: Vercel Dashboard → Project → Deployments → Logs
2. Vérifier les logs Supabase: Supabase Dashboard → Logs
3. Vérifier la console du navigateur (F12) pour les erreurs côté client

