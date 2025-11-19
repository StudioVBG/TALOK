# Guide de dépannage - Problèmes de connexion

## 🔍 Diagnostic rapide

### 1. Vérifier les logs dans la console
Ouvrez la console du navigateur (F12) et tentez de vous connecter. Vous devriez voir :
- `[SignIn] Tentative de connexion pour: votre@email.com`
- `[SignIn] Connexion réussie, utilisateur: xxx`
- `[SignIn] Récupération du profil...`
- `[AuthService] Profil récupéré: owner/tenant/admin`

### 2. Erreurs courantes et solutions

#### Erreur 400 - "Email ou mot de passe incorrect"
**Causes possibles :**
- Email ou mot de passe incorrect
- Email non confirmé
- Compte inexistant

**Solutions :**
1. Vérifiez que vous utilisez le bon email et mot de passe
2. Vérifiez votre boîte mail pour confirmer votre email
3. Utilisez "Mot de passe oublié" si nécessaire

#### Erreur - "Aucun profil trouvé"
**Causes possibles :**
- Le profil n'a pas été créé lors de l'inscription
- Problème RLS (Row Level Security)

**Solutions :**
1. Vérifiez dans Supabase que le profil existe dans la table `profiles`
2. Vérifiez que le `user_id` correspond à `auth.users.id`
3. Vérifiez que le rôle est bien défini (`owner`, `tenant`, etc.)

#### Erreur RLS (42501, 42P17)
**Causes possibles :**
- Politique RLS trop restrictive
- Récursion infinie dans les politiques

**Solutions :**
1. Le système essaie automatiquement via l'API `/api/me/profile`
2. Vérifiez les migrations RLS dans `supabase/migrations/`
3. Contactez le support si le problème persiste

### 3. Vérifications à faire

#### Variables d'environnement
Vérifiez que ces variables sont définies :
- `NEXT_PUBLIC_SUPABASE_URL` (doit être `https://xxxxx.supabase.co`, PAS le dashboard)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (pour l'API)

#### Dans Supabase Dashboard
1. Allez dans **Authentication** → **Users**
2. Vérifiez que votre utilisateur existe
3. Vérifiez que l'email est confirmé (`email_confirmed_at` n'est pas null)
4. Allez dans **Table Editor** → `profiles`
5. Vérifiez que votre profil existe avec le bon `user_id` et `role`

### 4. Test de connexion manuel

Si la connexion ne fonctionne toujours pas, testez directement avec Supabase :

```typescript
// Dans la console du navigateur (F12)
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  'VOTRE_SUPABASE_URL',
  'VOTRE_ANON_KEY'
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: 'votre@email.com',
  password: 'votre_mot_de_passe'
});

console.log('Résultat:', data, error);
```

### 5. Redirections après connexion

Selon votre rôle, vous serez redirigé vers :
- **Admin** → `/admin/dashboard`
- **Owner** → `/app/owner/dashboard`
- **Tenant** → `/app/tenant`
- **Autres** → `/dashboard`

Si vous êtes redirigé vers `/dashboard`, cela signifie que votre profil n'a pas de rôle défini ou n'existe pas.

## 🆘 Support

Si le problème persiste après ces vérifications :
1. Copiez les logs de la console (F12)
2. Notez le message d'erreur exact
3. Vérifiez votre email et mot de passe
4. Contactez le support avec ces informations

