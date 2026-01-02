# 🔍 Diagnostic : Erreur 500 sur POST /api/properties

## Problème
- `POST /api/properties` retourne une erreur 500 lors de la création d'un draft
- Message d'erreur : "Erreur serveur inattendue"
- Le wizard essaie de créer un draft mais échoue

## ✅ Actions Effectuées

### 1. Logs Améliorés
- ✅ Logs détaillés dans `createDraftProperty` avec JSON.stringify
- ✅ Logs détaillés dans le handler POST avec stack trace complète
- ✅ Affichage de tous les champs d'erreur (message, code, details, hint)

### 2. Policy Service Role
- ✅ Migration `allow_service_role_insert_properties` appliquée
- ✅ Policy créée pour permettre l'insertion avec service role
- ✅ Note: Le service role devrait déjà bypasser RLS, mais cette policy est une sécurité supplémentaire

## 🔍 Prochaines Étapes

### 1. Vérifier les Logs Serveur
**Ouvrir le terminal où `npm run dev` tourne** et chercher :
```
[createDraftProperty] ❌ Insert error:
[POST /api/properties] ❌ Error caught:
```

**Les logs doivent montrer :**
- Le message d'erreur exact
- Le code d'erreur Supabase (ex: 42501 pour RLS, 23503 pour FK, etc.)
- Les détails et hints

### 2. Causes Possibles

#### A. Problème RLS (peu probable avec service client)
- **Symptôme** : Code d'erreur `42501` ou `42P17`
- **Solution** : La policy service_role devrait résoudre ce problème

#### B. Colonne Manquante
- **Symptôme** : Message contenant "does not exist" ou "column"
- **Solution** : Vérifier le schéma de la table `properties`

#### C. Contrainte Violée
- **Symptôme** : Code d'erreur `23503` (FK) ou `23505` (unique)
- **Solution** : Vérifier les contraintes (ex: `unique_code` déjà existant)

#### D. Type de Données Incorrect
- **Symptôme** : Message contenant "invalid input" ou "type mismatch"
- **Solution** : Vérifier les types dans `insertPayload`

#### E. Problème de Configuration
- **Symptôme** : `SUPABASE_SERVICE_ROLE_KEY` manquante
- **Solution** : Vérifier `.env.local`

### 3. Tester la Création
1. Ouvrir `/owner/property/new`
2. Sélectionner un type de bien (ex: "appartement")
3. Observer les logs serveur
4. Partager les logs complets

## 📋 Checklist

- [ ] Logs serveur vérifiés
- [ ] Erreur exacte identifiée
- [ ] Solution appliquée
- [ ] Test de création réussi
- [ ] Propriété visible dans `/owner/properties`

---

**Date :** $(date)
**Status :** En attente des logs serveur pour diagnostic précis

