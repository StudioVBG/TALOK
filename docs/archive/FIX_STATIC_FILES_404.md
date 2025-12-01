# 🔧 Solution pour les erreurs 404 sur les fichiers statiques

## Problème
Les fichiers statiques Next.js (`/_next/static/...`) retournent des erreurs 404.

## Solutions (dans l'ordre)

### 1. Redémarrer le serveur de développement ⚡

```bash
# Arrêter le serveur (Ctrl+C dans le terminal où il tourne)
# Puis relancer :
npm run dev
```

### 2. Nettoyer le cache Next.js 🧹

```bash
# Supprimer le cache Next.js
rm -rf .next/cache

# Relancer le serveur
npm run dev
```

### 3. Vider le cache du navigateur 🌐

**Chrome/Edge :**
- Appuyer sur `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows/Linux)
- Ou : DevTools (F12) → Network → Cocher "Disable cache" → Recharger

**Firefox :**
- Appuyer sur `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows/Linux)

**Safari :**
- Appuyer sur `Cmd + Option + R`

### 4. Navigation privée (test rapide) 🔒

Ouvrir une fenêtre de navigation privée et tester :
- Si ça fonctionne → problème de cache navigateur
- Si ça ne fonctionne pas → problème serveur Next.js

### 5. Rebuild complet (si rien ne fonctionne) 🔨

```bash
# Arrêter le serveur
# Supprimer complètement le dossier .next
rm -rf .next

# Relancer (Next.js va reconstruire)
npm run dev
```

## Vérification

Après avoir appliqué les solutions, vérifier dans la console du navigateur :
- ✅ Plus d'erreurs 404
- ✅ Les fichiers chargent avec `/_next/static/` (avec underscore)
- ✅ La page se charge correctement

## Note

Ces erreurs sont souvent dues à :
1. Un cache navigateur obsolète (le plus fréquent)
2. Un build Next.js incomplet après des changements
3. Un serveur qui a besoin d'être redémarré

La solution la plus rapide est généralement de faire un **hard refresh** (`Cmd + Shift + R`) dans le navigateur.

