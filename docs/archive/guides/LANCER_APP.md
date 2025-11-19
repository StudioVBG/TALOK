# 🚀 Lancer l'application

## Problème détecté

Node.js/npm n'est pas disponible dans votre terminal. Voici comment résoudre cela :

## Solution 1 : Installer Node.js (si non installé)

1. **Téléchargez Node.js** depuis [nodejs.org](https://nodejs.org/)
   - Choisissez la version LTS (Long Term Support)
   - Version recommandée : 18 ou supérieure

2. **Installez Node.js** :
   - Sur macOS : Utilisez le fichier `.pkg` téléchargé
   - Sur Linux : Utilisez votre gestionnaire de paquets
   - Sur Windows : Utilisez le fichier `.msi` téléchargé

3. **Vérifiez l'installation** :
   ```bash
   node --version
   npm --version
   ```

## Solution 2 : Utiliser nvm (Node Version Manager)

Si vous avez `nvm` installé :

```bash
# Installer Node.js 18
nvm install 18
nvm use 18

# Vérifier
node --version
npm --version
```

## Solution 3 : Ajouter Node.js au PATH

Si Node.js est installé mais pas dans le PATH :

### Sur macOS/Linux :
```bash
# Trouver où Node.js est installé
which node
# ou
whereis node

# Ajouter au PATH (ajoutez dans ~/.zshrc ou ~/.bashrc)
export PATH="/usr/local/bin:$PATH"
# ou le chemin où Node.js est installé
```

### Sur Windows :
1. Ouvrez "Variables d'environnement"
2. Ajoutez le chemin de Node.js au PATH système

## Une fois Node.js installé

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer les variables d'environnement

```bash
# Si .env.local n'existe pas
cp env.example .env.local

# Éditez .env.local et ajoutez vos clés Supabase
```

### 3. Lancer l'application

```bash
npm run dev
```

L'application sera accessible sur : **http://localhost:3000**

## Commandes rapides

```bash
# Vérifier la configuration
npm run check-env

# Lancer en mode développement
npm run dev

# Build de production
npm run build

# Lancer en production
npm run start
```

## Besoin d'aide ?

- Consultez `QUICK_START.md` pour un guide rapide
- Consultez `INSTALLATION.md` pour un guide complet
- Consultez `GETTING_STARTED.md` pour tous les détails

