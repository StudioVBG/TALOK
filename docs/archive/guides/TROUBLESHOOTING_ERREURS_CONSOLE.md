# Troubleshooting : Erreurs Console Navigateur

## 🔍 Analyse des Erreurs

Les erreurs affichées dans la console sont **principalement liées aux extensions du navigateur** et non au code de l'application.

### Erreurs Identifiées

1. **Extensions de Navigateur**
   - `background.js`, `extensionState.js`, `utils.js`, `heuristicsRedefinitions.js`
   - `content_script.js` - Scripts d'extensions qui tentent d'interagir avec les formulaires
   - Ces fichiers sont chargés par des extensions (gestionnaire de mots de passe, outils de productivité, etc.)
   - **Erreurs courantes** :
     - `Cannot read properties of undefined (reading 'control')` - Extension qui essaie d'accéder à une propriété inexistante
     - `ERR_FILE_NOT_FOUND` sur des fichiers d'extensions
   - **Impact** : Aucun sur l'application (ces erreurs sont ignorables)

2. **Erreurs 400 sur Supabase Auth**
   - `grant_type=password` retourne 400
   - Peut être lié à des tentatives d'authentification échouées
   - **Impact** : Potentiel problème d'authentification

3. **Erreurs de Frames**
   - `FrameDoesNotExistError: Frame X does not exist`
   - Lié au cache du navigateur (back/forward cache)
   - **Impact** : Aucun sur l'application

## ✅ Solutions

### 1. Nettoyer le Cache du Navigateur

```bash
# Dans Chrome/Edge :
# 1. Ouvrir DevTools (F12)
# 2. Clic droit sur le bouton Refresh
# 3. Sélectionner "Empty Cache and Hard Reload"
```

### 2. Désactiver Temporairement les Extensions

1. Ouvrir `chrome://extensions/` (ou équivalent)
2. Désactiver temporairement les extensions (surtout gestionnaires de mots de passe)
3. Recharger la page
4. Vérifier si les erreurs persistent

### 3. Vérifier les Erreurs Réelles de l'Application

Les erreurs importantes à surveiller sont celles qui mentionnent :
- `/api/properties` (notre API)
- `/api/` en général
- Erreurs réseau avec notre domaine Vercel

### 4. Vérifier les Logs Vercel

Les optimisations que nous avons appliquées devraient avoir résolu les timeouts de 300s.
Vérifier dans les logs Vercel :
- Temps de réponse de `/api/properties`
- Absence de timeouts
- Erreurs d'authentification réelles

## 🔧 Actions Correctives

### Si les Erreurs 400 Persistent

1. **Vérifier les Variables d'Environnement**
   - `NEXT_PUBLIC_SUPABASE_URL` est correcte
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` est valide

2. **Vérifier les Cookies de Session**
   - Les cookies Supabase peuvent être expirés
   - Se déconnecter et se reconnecter

3. **Vérifier les Politiques RLS**
   - Les politiques RLS peuvent bloquer certaines requêtes
   - Vérifier dans Supabase Dashboard → Authentication → Policies

## 📊 Monitoring

Pour surveiller les vraies erreurs de l'application :

1. **Console Navigateur** : Filtrer par `/api/` ou le nom de votre domaine
2. **Network Tab** : Vérifier les requêtes qui retournent des erreurs
3. **Logs Vercel** : Surveiller les erreurs serveur

## ⚠️ Erreurs à Ignorer

Ces erreurs peuvent être ignorées en toute sécurité :
- `FrameDoesNotExistError` (cache navigateur)
- Erreurs d'extensions (`background.js`, `extensionState.js`, `content_script.js`, etc.)
- `ERR_FILE_NOT_FOUND` sur des fichiers d'extensions
- `Cannot read properties of undefined (reading 'control')` dans `content_script.js` - Extension qui essaie d'interagir avec les formulaires
- `Cannot read properties of null (reading 'deref')` dans `content_script.js` - Extension qui essaie d'observer le DOM
- `runtime.lastError: The page keeping the extension port is moved into back/forward cache` - Cache navigateur et extensions
- `shouldOfferCompletionListForField`, `elementWasFocused`, `processInputEvent` - Fonctions d'extensions de gestionnaire de mots de passe
- `/favicon.ico 404` - Normal si aucun favicon n'est configuré (peut être ignoré)

### Comment masquer ces erreurs dans la console

**Chrome/Edge DevTools** :
1. Ouvrir DevTools (F12)
2. Aller dans l'onglet **Console**
3. Cliquer sur l'icône **⚙️ Settings** (en haut à droite)
4. Cocher **"Hide messages from extensions"**
5. Les erreurs d'extensions seront masquées automatiquement

## 🎯 Prochaines Étapes

1. ✅ Nettoyer le cache du navigateur
2. ✅ Désactiver temporairement les extensions
3. ✅ Vérifier les logs Vercel pour confirmer que les timeouts sont résolus
4. ✅ Tester l'authentification et la récupération des propriétés

