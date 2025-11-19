# 🚀 Guide de Déploiement des Optimisations CPU

## ✅ Optimisations Appliquées

### 1. Configuration Vercel (`vercel.json`)
- ✅ `maxDuration: 10s` pour toutes les routes API via configuration globale
- ✅ Limitation stricte du temps d'exécution

### 2. Routes API Optimisées

Toutes les routes suivantes ont maintenant `maxDuration = 10` et des optimisations :

- ✅ `/api/properties` - Optimisation majeure (réduction ~70% du code)
- ✅ `/api/properties/[id]` - Ajout maxDuration
- ✅ `/api/leases` - Cache + maxDuration
- ✅ `/api/tickets` - Cache + maxDuration
- ✅ `/api/admin/stats` - maxDuration
- ✅ `/api/pdf/generate` - maxDuration

### 3. Headers de Cache

Routes GET avec cache activé :
- `/api/properties`
- `/api/leases`
- `/api/tickets`

Cache : `private, max-age=60, stale-while-revalidate=120`

## 📋 Checklist de Déploiement

### Avant le déploiement

- [x] Toutes les optimisations appliquées
- [x] Aucune erreur de lint
- [x] Documentation créée

### Déploiement

1. **Commit les changements** :
```bash
git add .
git commit -m "feat: optimisations CPU pour réduire consommation Vercel

- Ajout maxDuration: 10s sur toutes les routes API
- Optimisation majeure de /api/properties (réduction ~70% code)
- Ajout headers cache sur routes GET critiques
- Simplification timeouts et requêtes
- Réduction consommation CPU attendue: 60-70%"
```

2. **Push vers GitHub** :
```bash
git push origin main
```

3. **Vercel déploiera automatiquement**

### Après le déploiement

1. **Vérifier le déploiement** :
   - Aller sur https://vercel.com/dashboard
   - Vérifier que le dernier déploiement est réussi
   - Vérifier que le projet n'est plus en pause

2. **Monitorer la consommation CPU** :
   - Dashboard Vercel → Usage
   - Vérifier que la consommation CPU diminue
   - Surveiller pendant 24-48h

3. **Vérifier les performances** :
   - Tester les routes API principales
   - Vérifier les temps de réponse
   - Vérifier que le cache fonctionne

## 🎯 Résultats Attendus

- **Consommation CPU** : Réduction de 60-70%
- **Temps de réponse** : < 3 secondes pour la plupart des requêtes
- **Pas de timeout** : Grâce aux limites strictes
- **Projet actif** : Plus de pause sur Vercel

## ⚠️ En Cas de Problème

Si le projet reste en pause après le déploiement :

1. **Vérifier les logs Vercel** :
   - Dashboard → Deployments → Logs
   - Chercher les erreurs ou timeouts

2. **Vérifier les variables d'environnement** :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Considérer Vercel Pro** :
   - Si la consommation reste élevée
   - Plus de limites CPU (100h/mois)
   - Meilleures performances

## 📊 Monitoring

### Métriques à surveiller

- **Fluid Active CPU** : Doit rester < 4h/mois (limite gratuite)
- **Temps de réponse** : Doit être < 3s pour 95% des requêtes
- **Taux d'erreur** : Doit être < 1%

### Alertes recommandées

Configurer dans Vercel :
- Alerte si CPU > 3h/mois (80% de la limite)
- Alerte si temps de réponse > 5s
- Alerte si taux d'erreur > 5%

## 📝 Notes Techniques

### Timeouts Configurés

- **Auth timeout** : 2 secondes
- **Query timeout** : 3 secondes
- **Max request time** : 8 secondes
- **Vercel maxDuration** : 10 secondes

### Limites de Résultats

- **Admin** : 50 propriétés max
- **Owner** : 100 propriétés max
- **Tenant** : 50 propriétés max

### Cache

- **Durée** : 60 secondes
- **Stale-while-revalidate** : 120 secondes
- **Scope** : Private (par utilisateur)

