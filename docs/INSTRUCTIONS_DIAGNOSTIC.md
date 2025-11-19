# Instructions pour Capturer les Logs et Diagnostiquer l'Erreur 500

## 🎯 Méthode 1 : Endpoint de Diagnostic (RECOMMANDÉ)

### **Étape 1 : Accéder à l'endpoint de diagnostic**

1. Ouvrez votre navigateur
2. Assurez-vous d'être connecté (authentifié)
3. Accédez à : `http://localhost:3000/api/properties/diagnostic`
4. Copiez le JSON complet retourné
5. Partagez-le

**Cet endpoint teste chaque étape isolément et retourne un rapport détaillé avec :**
- ✅ Statut de chaque étape (succès/erreur)
- ✅ Durée de chaque étape
- ✅ Messages d'erreur détaillés avec code, details, hint
- ✅ Données de test (premiers éléments)

---

## 🎯 Méthode 2 : Logs Serveur (Alternative)

### **Étape 1 : Identifier le terminal du serveur**

Le serveur Next.js tourne dans un terminal. Vous devez voir les logs dans ce terminal.

### **Étape 2 : Déclencher la requête**

1. Ouvrez `http://localhost:3000/app/owner/properties` dans votre navigateur
2. OU faites une requête à `http://localhost:3000/api/properties` (avec authentification)

### **Étape 3 : Capturer les logs**

Dans le terminal où `npm run dev` tourne, recherchez tous les logs qui commencent par :
- `[api/properties]`

**Exemple de logs attendus :**
```
[api/properties] ▶️ handler called
[api/properties] 📦 Step 1: Creating Supabase client
[api/properties] ✅ Step 1: Client created successfully
[api/properties] 🔐 Step 2: Getting user
[api/properties] Step 2 result: { hasUser: true, userId: '...', ... }
...
```

### **Étape 4 : Copier et partager**

Copiez TOUS les logs `[api/properties]` et partagez-les.

---

## 🎯 Méthode 3 : Rediriger les Logs vers un Fichier

### **Option A : Redémarrer le serveur avec redirection**

```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis redémarrer avec :
npm run dev 2>&1 | tee server-logs.txt
```

Ensuite, accédez à `/app/owner/properties` et les logs seront dans `server-logs.txt`.

### **Option B : Utiliser le script de diagnostic**

```bash
# Le script capture automatiquement les erreurs
npx tsx scripts/diagnostic-routes-api.ts
```

---

## 📋 Checklist Rapide

- [ ] **Méthode 1** : Accéder à `/api/properties/diagnostic` et partager le JSON ✅ RECOMMANDÉ
- [ ] **Méthode 2** : Partager les logs `[api/properties]` du terminal serveur
- [ ] **Méthode 3** : Rediriger les logs vers un fichier et partager

---

## 🔍 Ce que nous cherchons

1. **Quelle étape échoue ?**
   - Step 1 : Création du client Supabase
   - Step 2 : Authentification utilisateur
   - Step 3 : Récupération du profil
   - Step 4 : Construction de la requête
   - Step 5 : Exécution de la requête Supabase

2. **Quel est le message d'erreur exact ?**
   - Message Supabase
   - Code d'erreur
   - Details et hint

3. **Quelles colonnes sont sélectionnées ?**
   - Vérifier si toutes les colonnes existent dans la table

---

## ⚡ Action Immédiate

**Utilisez la Méthode 1** : Accédez à `http://localhost:3000/api/properties/diagnostic` dans votre navigateur (connecté) et partagez le JSON retourné.

C'est la méthode la plus rapide et la plus complète pour identifier le problème !

