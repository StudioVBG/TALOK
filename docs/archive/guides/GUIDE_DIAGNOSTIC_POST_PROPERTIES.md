# 🔍 Guide de Diagnostic : Erreur 500 sur POST /api/properties

## ✅ Actions Effectuées

1. **Logs améliorés** dans `app/api/properties/route.ts`
   - Logs détaillés dans `createDraftProperty`
   - Logs détaillés dans le handler POST
   - Affichage JSON complet des erreurs

2. **Policy service_role créée**
   - Migration `allow_service_role_insert_properties` appliquée
   - Permet l'insertion avec le service role client

3. **Endpoint de test créé**
   - `GET /api/properties/test-create`
   - Isole chaque étape de la création
   - Affiche des logs détaillés pour chaque étape

---

## 🧪 Test 1 : Endpoint de Diagnostic

### Instructions

1. **Ouvrir dans le navigateur** (ou curl) :
   ```
   http://localhost:3000/api/properties/test-create
   ```

2. **Vérifier la réponse JSON** qui contient :
   - `success: true` si tout fonctionne
   - `error` + `logs` si une étape échoue
   - Chaque log contient : `step`, `status`, `timestamp`, `data`

3. **Identifier l'étape qui échoue** :
   - `1-auth` : Authentification
   - `2-env` : Variables d'environnement
   - `3-service-client` : Création du client Supabase
   - `4-profile` : Récupération du profil
   - `5-permissions` : Vérification des permissions
   - `6-unique-code` : Génération du code unique
   - `7-payload` : Préparation du payload
   - `8-insert` : Insertion dans la base de données

4. **Partager la réponse complète** pour diagnostic précis

---

## 🧪 Test 2 : Logs Serveur

### Instructions

1. **Ouvrir le terminal** où `npm run dev` tourne

2. **Créer un nouveau bien** via le wizard :
   - Aller sur `/app/owner/property/new`
   - Sélectionner un type de bien (ex: "appartement")

3. **Observer les logs** qui doivent afficher :
   ```
   [createDraftProperty] DEBUG: { profileId, type_bien, ... }
   [createDraftProperty] Insert payload owner_id: ...
   [createDraftProperty] ❌ Insert error: { ... }
   [POST /api/properties] ❌ Error caught: { ... }
   ```

4. **Copier les logs complets** et les partager

---

## 🔍 Causes Possibles

### A. Problème RLS (peu probable avec service client)
- **Code d'erreur** : `42501` ou `42P17`
- **Message** : "permission denied" ou "row-level security"
- **Solution** : La policy service_role devrait résoudre ce problème

### B. Colonne Manquante
- **Code d'erreur** : `42703`
- **Message** : "column ... does not exist"
- **Solution** : Vérifier le schéma de la table `properties`

### C. Contrainte Violée
- **Code d'erreur** : `23503` (FK) ou `23505` (unique)
- **Message** : "foreign key violation" ou "unique constraint violation"
- **Solution** : Vérifier les contraintes (ex: `unique_code` déjà existant)

### D. Type de Données Incorrect
- **Code d'erreur** : `22P02` ou `42804`
- **Message** : "invalid input" ou "type mismatch"
- **Solution** : Vérifier les types dans `insertPayload`

### E. Problème de Configuration
- **Erreur** : `SUPABASE_SERVICE_ROLE_KEY` manquante
- **Solution** : Vérifier `.env.local`

---

## 📋 Checklist

- [ ] Test 1 : Endpoint `/api/properties/test-create` exécuté
- [ ] Réponse JSON analysée
- [ ] Étape qui échoue identifiée
- [ ] Test 2 : Logs serveur vérifiés
- [ ] Erreur exacte identifiée
- [ ] Solution appliquée
- [ ] Test de création réussi
- [ ] Propriété visible dans `/app/owner/properties`

---

**Date :** $(date)
**Status :** En attente des résultats des tests

