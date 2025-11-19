# 🔄 Guide de synchronisation des variables d'environnement

## ⚠️ IMPORTANT : Variables identiques = Même base de données

Pour que localhost et Vercel utilisent la **même base de données Supabase**, 
les variables suivantes doivent être **identiques** dans les deux environnements :

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`

---

## 📋 Étape 1 : Configurer localhost (.env.local)

### 1.1 Créer le fichier .env.local

```bash
cp env.example .env.local
```

### 1.2 Remplir les variables

Éditez `.env.local` et ajoutez vos clés Supabase :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key_ici
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key_ici
```

**Où trouver ces valeurs ?**
- Allez sur https://app.supabase.com
- Sélectionnez votre projet
- Settings → API
- Copiez :
  - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
  - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

### 1.3 Vérifier la configuration locale

```bash
./scripts/check-env-local.sh
```

---

## 🌐 Étape 2 : Configurer Vercel

### 2.1 Via l'interface Vercel (Recommandé)

1. **Allez sur Vercel Dashboard**
   - https://vercel.com/dashboard
   - Connectez-vous

2. **Sélectionnez votre projet**
   - Cliquez sur "Gestion Locative" (ou votre projet)

3. **Accédez aux variables d'environnement**
   - Cliquez sur **Settings** (en haut)
   - Dans le menu de gauche, cliquez sur **Environment Variables**

4. **Ajoutez les variables**
   Pour chaque variable, cliquez sur **Add New** :
   
   | Variable | Valeur | Environnements |
   |----------|--------|----------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Copiez depuis `.env.local` | ✅ Production, ✅ Preview, ✅ Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Copiez depuis `.env.local` | ✅ Production, ✅ Preview, ✅ Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | Copiez depuis `.env.local` | ✅ Production, ✅ Preview, ✅ Development |

   ⚠️ **IMPORTANT** : Cochez les 3 environnements (Production, Preview, Development)

5. **Vérifiez les valeurs**
   - Assurez-vous que les valeurs sont **exactement identiques** à celles dans `.env.local`
   - Pas d'espaces avant/après
   - Pas de guillemets supplémentaires

### 2.2 Via Vercel CLI (Alternative)

```bash
# Voir les instructions de synchronisation
./scripts/sync-env-to-vercel.sh
```

---

## ✅ Étape 3 : Vérifier la synchronisation

### Comparer les deux environnements

```bash
./scripts/compare-env.sh
```

### Vérification manuelle

1. **Variables locales** : Ouvrez `.env.local`
2. **Variables Vercel** : Dashboard Vercel > Settings > Environment Variables
3. **Comparez** : Les valeurs doivent être identiques

---

## 🔧 Dépannage

### Les variables sont différentes ?

**Symptôme** : Les données ne sont pas synchronisées entre localhost et Vercel

**Solution** :
1. Vérifiez les valeurs dans `.env.local`
2. Vérifiez les valeurs dans Vercel Dashboard
3. Assurez-vous qu'elles sont identiques
4. Redéployez sur Vercel après modification

### Comment copier les valeurs ?

**Depuis localhost vers Vercel** :
```bash
# Afficher les valeurs (masquées)
cat .env.local | grep SUPABASE

# Copiez manuellement dans Vercel Dashboard
```

**Depuis Vercel vers localhost** :
1. Vercel Dashboard > Settings > Environment Variables
2. Cliquez sur chaque variable pour voir sa valeur
3. Copiez dans `.env.local`

### Vercel utilise des valeurs différentes ?

**Problème** : Vous avez plusieurs projets Supabase

**Solution** :
- **Option 1** : Utilisez le même projet Supabase pour localhost et Vercel (recommandé)
- **Option 2** : Configurez des variables différentes si vous voulez des bases séparées

---

## 📝 Checklist de vérification

Avant de déployer, vérifiez :

- [ ] `.env.local` existe et contient les 3 variables Supabase
- [ ] Les valeurs dans `.env.local` sont correctes
- [ ] Les variables sont ajoutées dans Vercel Dashboard
- [ ] Les valeurs dans Vercel sont **identiques** à celles dans `.env.local`
- [ ] Les 3 environnements sont cochés dans Vercel (Production, Preview, Development)
- [ ] Vous avez redéployé sur Vercel après modification des variables

---

## 🚀 Après configuration

Une fois les variables synchronisées :

1. **Testez en local** :
   ```bash
   npm run dev
   # → http://localhost:3000
   ```

2. **Déployez sur Vercel** :
   ```bash
   git push
   # → Vercel déploie automatiquement
   ```

3. **Vérifiez** :
   - Les données créées en local apparaissent sur Vercel
   - Les données créées sur Vercel apparaissent en local
   - ✅ Même base de données = Synchronisation parfaite !

---

## 🔗 Liens utiles

- [Dashboard Supabase](https://app.supabase.com) - Pour obtenir vos clés API
- [Dashboard Vercel](https://vercel.com/dashboard) - Pour configurer les variables
- [Documentation Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 📚 Scripts disponibles

- `./scripts/check-env-local.sh` - Vérifier les variables locales
- `./scripts/sync-env-to-vercel.sh` - Instructions pour synchroniser vers Vercel
- `./scripts/compare-env.sh` - Comparer localhost et Vercel
- `./scripts/check-env.sh` - Vérification générale (existant)

