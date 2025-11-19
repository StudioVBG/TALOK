# 🔗 Configuration des Redirections d'Email

**Problème résolu** : Les liens magiques redirigeaient vers `localhost` au lieu de l'URL de production.

---

## ✅ Corrections Appliquées

Tous les endroits qui utilisaient `window.location.origin` pour les redirections d'email ont été corrigés pour utiliser `NEXT_PUBLIC_APP_URL` en production.

### Fichiers modifiés :

1. ✅ `features/auth/services/auth.service.ts`
   - `sendMagicLink()` - Lien magique
   - `resetPassword()` - Réinitialisation mot de passe
   - `resendConfirmationEmail()` - Renvoi email confirmation

2. ✅ `app/auth/verify-email/page.tsx`
   - Renvoi email de vérification

3. ✅ `app/signup/verify-email/page.tsx`
   - Renvoi email de vérification onboarding

4. ✅ `app/auth/forgot-password/page.tsx`
   - Réinitialisation mot de passe

---

## 🔧 Configuration Requise sur Vercel

### Étape 1 : Ajouter la variable d'environnement

1. Aller sur : https://vercel.com/studiovbgs-projects/gestion-immo/settings/environment-variables

2. Ajouter ou modifier la variable :
   - **Nom** : `NEXT_PUBLIC_APP_URL`
   - **Valeur** : `https://gestion-immo-nine.vercel.app`
   - **Environnement** : Production, Preview, Development

3. Cliquer sur **"Save"**

### Étape 2 : Configurer les Redirect URLs dans Supabase

1. Aller sur : https://supabase.com/dashboard/project/[votre-projet]/auth/url-configuration

2. Dans **"Redirect URLs"**, ajouter :
   ```
   https://gestion-immo-nine.vercel.app/**
   ```

3. Vérifier que ces URLs sont présentes :
   - `https://gestion-immo-nine.vercel.app/auth/callback`
   - `https://gestion-immo-nine.vercel.app/auth/reset-password`
   - `https://gestion-immo-nine.vercel.app/**` (wildcard pour toutes les routes)

4. Cliquer sur **"Save"**

### Étape 3 : Redéployer l'application

Après avoir ajouté `NEXT_PUBLIC_APP_URL` sur Vercel :

1. Vercel redéploiera automatiquement (ou déclencher un nouveau déploiement)
2. Attendre 2-3 minutes pour le déploiement
3. Tester un nouveau lien magique

---

## 🧪 Test

### Test 1 : Lien magique

1. Aller sur : https://gestion-immo-nine.vercel.app/signup/account?role=tenant
2. Cocher "Utiliser un lien magique"
3. Entrer un email
4. Cliquer sur "Envoyer le lien magique"
5. Vérifier l'email reçu
6. Cliquer sur le lien dans l'email
7. ✅ Le lien doit rediriger vers `https://gestion-immo-nine.vercel.app/auth/callback` (pas localhost)

### Test 2 : Réinitialisation mot de passe

1. Aller sur : https://gestion-immo-nine.vercel.app/auth/forgot-password
2. Entrer un email
3. Cliquer sur "Envoyer le lien"
4. Vérifier l'email reçu
5. Cliquer sur le lien dans l'email
6. ✅ Le lien doit rediriger vers `https://gestion-immo-nine.vercel.app/auth/reset-password` (pas localhost)

---

## 📝 Code Modifié

### Avant (❌ Problème)
```typescript
emailRedirectTo: `${window.location.origin}/auth/callback`
// Retourne http://localhost:3000 en développement
```

### Après (✅ Solution)
```typescript
const redirectUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
emailRedirectTo: `${redirectUrl}/auth/callback`
// Utilise https://gestion-immo-nine.vercel.app en production
```

---

## ⚠️ Important

1. **Variable d'environnement** : `NEXT_PUBLIC_APP_URL` doit être configurée sur Vercel
2. **Redirect URLs Supabase** : L'URL de production doit être dans la liste des URLs autorisées
3. **Redéploiement** : Après avoir ajouté la variable, Vercel redéploiera automatiquement

---

## 🔍 Vérification

Pour vérifier que la configuration est correcte :

1. **Vercel** : Vérifier que `NEXT_PUBLIC_APP_URL` est définie
2. **Supabase** : Vérifier que l'URL de production est dans Redirect URLs
3. **Test** : Envoyer un nouveau lien magique et vérifier l'URL dans l'email

---

**Dernière mise à jour** : Novembre 2025  
**Commit** : `fb0946d`

