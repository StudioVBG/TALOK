# 🔴 URGENT : Correction des Timeouts de 300s

## Problème Critique

L'API `/api/properties` timeout toujours après 300 secondes malgré les optimisations précédentes.

## Solutions Appliquées

### 1. Timeout Global de Sécurité (25s)
- Vérification avant chaque étape
- Retourne une erreur 504 avant le timeout Vercel
- Évite les timeouts silencieux

### 2. Vérification Précoce
- Si > 20s écoulées avant les requêtes → retourne tableau vide
- Évite de lancer des requêtes qui vont timeout

### 3. Optimisation des Requêtes
- **Colonnes sélectionnées** : Seulement les colonnes essentielles au lieu de `*`
- **Limite réduite** : 50 propriétés au lieu de 100
- **Timeout réduit** : 5 secondes au lieu de 10

### 4. Colonnes Sélectionnées
```sql
id, owner_id, type, type_bien, adresse_complete, code_postal, ville, 
surface, nb_pieces, loyer_base, created_at, etat
```

## Déploiement

**IMPORTANT** : Ces changements doivent être déployés sur Vercel pour être effectifs.

```bash
git push origin main
```

Vercel déploiera automatiquement les changements.

## Vérification Post-Déploiement

1. Attendre le déploiement Vercel (2-3 minutes)
2. Recharger la page `/properties`
3. Vérifier les logs Vercel pour confirmer que les timeouts sont résolus
4. Vérifier la console navigateur pour les logs de debug

## Si le Problème Persiste

Si les timeouts continuent après le déploiement :

1. **Vérifier les logs Vercel** pour voir où la requête bloque
2. **Vérifier les politiques RLS** dans Supabase pour les récursions
3. **Vérifier les index** sur la table `properties` (owner_id, created_at)
4. **Considérer** une requête encore plus simple (juste `id, owner_id, adresse_complete`)

## Prochaines Étapes

1. ✅ Déployer les changements
2. ⏳ Tester après déploiement
3. ⏳ Analyser les logs si problème persiste
4. ⏳ Optimiser davantage si nécessaire

