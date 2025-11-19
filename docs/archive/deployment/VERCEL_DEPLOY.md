# Guide de redéploiement sur Vercel

## 🚀 Méthode 1 : Via l'interface Vercel (Recommandé)

### Étape 1 : Vider le cache Vercel

1. **Connectez-vous à Vercel Dashboard**
   - Allez sur https://vercel.com/dashboard
   - Connectez-vous avec votre compte

2. **Sélectionnez votre projet**
   - Cliquez sur le projet "Gestion Locative" (ou le nom de votre projet)

3. **Accédez aux paramètres**
   - Cliquez sur l'onglet **"Settings"** en haut
   - Dans le menu de gauche, cliquez sur **"General"**

4. **Videz le cache de build**
   - Faites défiler jusqu'à la section **"Build & Development Settings"**
   - Cliquez sur le bouton **"Clear Build Cache"** ou **"Purge Cache"**
   - Confirmez l'action

### Étape 2 : Redéployer

**Option A : Redéploiement automatique (si Git est connecté)**
- Faites un commit et push de vos changements :
  ```bash
  git add .
  git commit -m "Update tenant dashboard V2"
  git push
  ```
- Vercel redéploiera automatiquement après le push

**Option B : Redéploiement manuel**
- Dans le Dashboard Vercel, allez dans l'onglet **"Deployments"**
- Cliquez sur les **"..."** (trois points) du dernier déploiement
- Sélectionnez **"Redeploy"**
- Confirmez le redéploiement

---

## 🛠️ Méthode 2 : Via Vercel CLI

### Prérequis
```bash
npm i -g vercel
vercel login
```

### Commandes
```bash
# Vider le cache local d'abord
./scripts/clear-cache.sh

# Redéployer
vercel --prod

# Ou utiliser le script automatique
./scripts/deploy-vercel.sh
```

---

## 🔧 Méthode 3 : Via l'API Vercel (Avancé)

### Vider le cache via API

1. **Obtenez votre token Vercel**
   - Allez dans Settings > Tokens
   - Créez un nouveau token

2. **Utilisez l'API pour purger le cache**
   ```bash
   curl -X POST "https://api.vercel.com/v1/deployments/{deployment-id}/cache" \
     -H "Authorization: Bearer YOUR_VERCEL_TOKEN"
   ```

---

## ✅ Vérification après déploiement

1. **Vérifiez le nouveau déploiement**
   - Dans Vercel Dashboard > Deployments
   - Vérifiez que le dernier déploiement est récent

2. **Testez le dashboard**
   - Allez sur votre URL de production
   - Accédez à `/app/tenant`
   - Videz le cache du navigateur (`Cmd+Shift+R` sur Mac)
   - Vérifiez que le nouveau dashboard V2 s'affiche

3. **Vérifiez les logs**
   - Dans Vercel Dashboard > Deployments > [votre déploiement] > Logs
   - Vérifiez qu'il n'y a pas d'erreurs

---

## 🐛 Dépannage

### Le cache ne se vide pas ?
- Attendez quelques minutes après avoir vidé le cache
- Vérifiez que vous avez bien vidé le cache dans les paramètres du projet
- Essayez de créer un nouveau déploiement plutôt que de redéployer l'ancien

### Le dashboard n'affiche toujours pas la V2 ?
- Videz le cache du navigateur (`Cmd+Shift+R`)
- Vérifiez l'URL : doit être `/app/tenant` (pas `/tenant`)
- Vérifiez dans les DevTools (F12) quelle version du code est chargée
- Vérifiez les logs Vercel pour des erreurs de build

### Erreurs de build ?
- Vérifiez que tous les fichiers sont commités
- Vérifiez les variables d'environnement dans Vercel Settings > Environment Variables
- Consultez les logs de build dans Vercel Dashboard

---

## 📝 Notes importantes

- **Cache Vercel** : Le cache de build Vercel est différent du cache du navigateur
- **Déploiements** : Chaque push sur la branche principale déclenche un nouveau déploiement
- **Environnement** : Vérifiez que les variables d'environnement sont bien configurées dans Vercel

---

## 🔗 Liens utiles

- [Documentation Vercel - Cache](https://vercel.com/docs/concepts/builds/build-cache)
- [Documentation Vercel - Redéploiement](https://vercel.com/docs/concepts/deployments/redeploy)
- [Dashboard Vercel](https://vercel.com/dashboard)
