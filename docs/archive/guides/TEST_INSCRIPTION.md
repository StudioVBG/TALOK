# 🧪 Guide de test - Inscription des différents comptes

## ✅ Correction appliquée

Le problème de validation du profil lors de la création du compte a été corrigé. Le service `auth.service.ts` ne valide plus les champs `prenom` et `nom` s'ils sont vides lors de la création initiale.

## 📋 Checklist de test par rôle

### 1. Test Propriétaire (Owner)

#### Étape 1 : Choix du rôle
- [ ] Aller sur `/signup/role`
- [ ] Cliquer sur "Choisir Propriétaire"
- [ ] Vérifier la redirection vers `/signup/account?role=owner`
- [ ] Vérifier que le titre affiche "En tant que propriétaire"

#### Étape 2 : Création de compte
- [ ] Saisir un email valide (ex: `owner@test.com`)
- [ ] Saisir un mot de passe valide (12+ caractères, maj/min/chiffre/spécial)
- [ ] Confirmer le mot de passe
- [ ] Cliquer sur "Créer mon compte"
- [ ] Vérifier le message "Compte créé"
- [ ] Vérifier la redirection vers `/signup/verify-email`

**Test avec lien magique** :
- [ ] Cocher "Utiliser un lien magique"
- [ ] Saisir un email
- [ ] Cliquer sur "Envoyer le lien magique"
- [ ] Vérifier le message de confirmation

#### Étape 3 : Vérification email
- [ ] Vérifier la réception de l'email de confirmation
- [ ] Cliquer sur le lien dans l'email
- [ ] Vérifier la redirection vers `/auth/callback` puis `/dashboard`
- [ ] OU utiliser le bouton "J'ai confirmé mon email" après avoir cliqué le lien

#### Étape 4 : Consentements
- [ ] Vérifier l'arrivée sur `/signup/consents`
- [ ] Accepter les CGU (obligatoire)
- [ ] Accepter la Politique de confidentialité (obligatoire)
- [ ] Configurer les cookies (optionnel)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/signup/profile`

#### Étape 5 : Profil minimal
- [ ] Saisir le prénom (ex: "Jean")
- [ ] Saisir le nom (ex: "Dupont")
- [ ] Sélectionner le pays (FR par défaut)
- [ ] Optionnel : Saisir le téléphone ou cocher "Je compléterai plus tard"
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/owner/onboarding/profile`

#### Étape 6 : Profil propriétaire
- [ ] Choisir "Particulier" ou "Société"
- [ ] Si Société : remplir SIREN, SIRET, TVA, UBO
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/owner/onboarding/finance`

#### Étape 7 : Paramètres financiers
- [ ] Choisir le mode d'encaissement préféré (ex: SEPA)
- [ ] Configurer les modes secondaires (optionnel)
- [ ] Saisir l'IBAN bénéficiaire (format valide, ex: `FR7612345678901234567890123`)
- [ ] Choisir la fréquence de versement
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/owner/onboarding/property`

#### Étape 8 : Premier logement
- [ ] Remplir l'adresse complète (ex: "123 Rue de la République")
- [ ] Saisir le code postal (ex: "75001")
- [ ] Saisir la ville (ex: "Paris")
- [ ] Saisir le département (ex: "75")
- [ ] Choisir le type de logement (Appartement, Maison, Immeuble)
- [ ] Saisir la surface (ex: "50")
- [ ] Saisir le nombre de pièces (ex: "3")
- [ ] Optionnel : Cocher "C'est une colocation" et remplir les infos
- [ ] Cliquer sur "Créer le logement"
- [ ] Vérifier la redirection vers `/owner/onboarding/automation`

#### Étape 9 : Automatisation
- [ ] Choisir un niveau d'automatisation (ex: Standard)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/owner/onboarding/invite`

#### Étape 10 : Invitations
- [ ] Optionnel : Ajouter des emails à inviter
- [ ] Cliquer sur "Envoyer les invitations" ou "Passer cette étape"
- [ ] Vérifier la redirection vers `/app/owner`
- [ ] Vérifier l'affichage du dashboard propriétaire

---

### 2. Test Locataire (Tenant)

#### Étape 1-5 : Identiques au propriétaire
- [ ] Choix du rôle → "Choisir Locataire"
- [ ] Création de compte (email différent, ex: `tenant@test.com`)
- [ ] Vérification email
- [ ] Consentements
- [ ] Profil minimal

#### Étape 6 : Contexte logement
- [ ] Vérifier l'arrivée sur `/tenant/onboarding/context`
- [ ] Option A : Saisir un code de logement
  - [ ] Saisir un code valide (obtenu depuis le dashboard propriétaire)
  - [ ] Cliquer sur "Valider"
  - [ ] Vérifier l'affichage des infos du logement
- [ ] Option B : Utiliser une invitation
  - [ ] Accéder via `/invite/[token]`
  - [ ] Vérifier le pré-remplissage du rôle
- [ ] Choisir le rôle (locataire principal, colocataire, garant)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/tenant/onboarding/file`

#### Étape 7 : Dossier locataire
- [ ] Sélectionner la situation professionnelle (ex: "Salarié")
- [ ] Saisir les revenus mensuels (ex: "2000")
- [ ] Indiquer le nombre d'adultes (ex: "1")
- [ ] Indiquer le nombre d'enfants (ex: "0")
- [ ] Cocher "Un garant est requis" si nécessaire
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/tenant/onboarding/payments`

#### Étape 8 : Paiement & parts
- [ ] Choisir le moyen d'encaissement préféré (ex: SEPA)
- [ ] Si SEPA : accepter le mandat
- [ ] Si colocation : définir la part (pourcentage ou montant)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/tenant/onboarding/sign`

#### Étape 9 : Signature du bail
- [ ] Cliquer sur "Signer le bail"
- [ ] Vérifier le message de confirmation
- [ ] Vérifier la redirection vers `/app/tenant`
- [ ] Vérifier l'affichage du dashboard locataire

---

### 3. Test Prestataire (Provider)

#### Étape 1-5 : Identiques
- [ ] Choix du rôle → "Choisir Prestataire"
- [ ] Création de compte (email différent, ex: `provider@test.com`)
- [ ] Vérification email
- [ ] Consentements
- [ ] Profil minimal

#### Étape 6 : Profil professionnel
- [ ] Vérifier l'arrivée sur `/provider/onboarding/profile`
- [ ] Choisir "Indépendant" ou "Entreprise"
- [ ] Remplir la raison sociale (ex: "Ma société de plomberie")
- [ ] Optionnel : Saisir SIREN (ex: "123456789")
- [ ] Optionnel : Saisir SIRET (ex: "12345678901234")
- [ ] Uploader la RC Pro (PDF, JPG, PNG)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/provider/onboarding/services`

#### Étape 7 : Services & zones
- [ ] Sélectionner au moins une spécialité (ex: Plomberie, Électricité)
- [ ] Ajouter des codes postaux d'intervention (ex: "75001", "75002")
- [ ] Optionnel : Définir un rayon d'intervention (ex: "50" km)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/provider/onboarding/ops`

#### Étape 8 : Disponibilités & paiements
- [ ] Sélectionner les jours disponibles (au moins un, ex: lundi, mardi, mercredi)
- [ ] Définir les horaires de début (ex: "09:00")
- [ ] Définir les horaires de fin (ex: "18:00")
- [ ] Choisir le SLA souhaité (ex: "48h")
- [ ] Saisir l'IBAN pour les versements (ex: `FR7612345678901234567890123`)
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/provider/onboarding/review`

#### Étape 9 : Validation
- [ ] Vérifier le récapitulatif
- [ ] Cliquer sur "Soumettre mon profil"
- [ ] Vérifier le message "En attente de validation"
- [ ] Vérifier la redirection vers `/app/provider`
- [ ] Vérifier le banner "Profil en attente de validation"

---

### 4. Test Garant (Guarantor)

#### Accès via invitation uniquement
- [ ] Créer une invitation garant depuis le dashboard propriétaire
- [ ] Cliquer sur le lien d'invitation reçu par email
- [ ] Vérifier l'arrivée sur `/invite/[token]`
- [ ] Vérifier l'affichage "Invitation reçue" avec le rôle "Garant"
- [ ] Cliquer sur "Accepter l'invitation"
- [ ] Suivre le flux d'inscription standard (compte, email, consentements, profil)

#### Étape 6 : Contexte & identité
- [ ] Vérifier l'arrivée sur `/guarantor/onboarding/context`
- [ ] Vérifier que le rôle est verrouillé sur "Garant"
- [ ] Remplir le prénom (ex: "Marie")
- [ ] Remplir le nom (ex: "Martin")
- [ ] Saisir la date de naissance (ex: "1980-01-15")
- [ ] Optionnel : Uploader la pièce d'identité
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/guarantor/onboarding/financial`

#### Étape 7 : Capacité financière
- [ ] Saisir les revenus mensuels (ex: "3000")
- [ ] Choisir le type de garantie (personnelle, Visale, dépôt bancaire)
- [ ] Uploader le justificatif de revenus
- [ ] Si Visale : uploader l'attestation Visale
- [ ] Si dépôt bancaire : saisir le montant (ex: "5000")
- [ ] Cliquer sur "Continuer"
- [ ] Vérifier la redirection vers `/guarantor/onboarding/sign`

#### Étape 8 : Signature
- [ ] Cliquer sur "Signer l'acte"
- [ ] Vérifier le message de confirmation
- [ ] Vérifier la redirection vers `/app/guarantor`
- [ ] Vérifier l'affichage du dashboard garant (lecture seule)

---

## 🐛 Tests des cas limites

### Email déjà utilisé
- [ ] Essayer de créer un compte avec un email existant
- [ ] Vérifier le message "Email déjà utilisé"
- [ ] Vérifier la redirection vers `/auth/signin?email=...&error=email_exists`
- [ ] Vérifier que l'email est pré-rempli dans le formulaire de connexion

### Lien d'invitation expiré
- [ ] Créer une invitation
- [ ] Modifier manuellement la date d'expiration dans la BDD (ou attendre 7 jours)
- [ ] Essayer d'accéder au lien
- [ ] Vérifier le message "Lien invalide ou expiré"
- [ ] Cliquer sur "Demander un nouveau lien"
- [ ] Vérifier la régénération du token

### Lien d'invitation déjà utilisé
- [ ] Utiliser un lien d'invitation pour créer un compte
- [ ] Essayer de réutiliser le même lien
- [ ] Vérifier le message "Lien déjà utilisé"

### Code de logement invalide
- [ ] Aller sur `/tenant/onboarding/context`
- [ ] Saisir un code invalide (ex: "INVALID")
- [ ] Cliquer sur "Valider"
- [ ] Vérifier le message d'erreur "Code de logement invalide"

### Mot de passe invalide
- [ ] Essayer de créer un compte avec un mot de passe trop court (< 12 caractères)
- [ ] Vérifier les messages de validation
- [ ] Essayer sans majuscule
- [ ] Essayer sans chiffre
- [ ] Essayer sans caractère spécial
- [ ] Vérifier que le formulaire bloque la soumission

### Rate limiting
- [ ] Faire plusieurs tentatives d'inscription rapidement
- [ ] Vérifier le message "Trop de tentatives" si applicable

### Brouillons
- [ ] Commencer une inscription
- [ ] Remplir quelques champs (ex: email, prénom)
- [ ] Fermer l'onglet/navigateur
- [ ] Revenir sur la même page
- [ ] Vérifier que les données sont récupérées automatiquement

---

## ✅ Points de vérification généraux

### Navigation
- [ ] Tous les boutons "Continuer" fonctionnent
- [ ] Les redirections sont correctes à chaque étape
- [ ] Le bouton "Retour" ou navigation arrière fonctionne (si présent)
- [ ] Les liens "Se connecter" redirigent correctement

### Validation
- [ ] Tous les champs obligatoires sont validés
- [ ] Les formats (email, téléphone, IBAN, etc.) sont vérifiés
- [ ] Les messages d'erreur sont clairs et actionnables

### UX
- [ ] Les toasts s'affichent correctement
- [ ] Les états de chargement sont visibles
- [ ] Les confirmations visuelles fonctionnent (checkmarks, etc.)
- [ ] Les messages de succès sont clairs

### Sécurité
- [ ] Les routes sont protégées (pas d'accès direct sans authentification)
- [ ] Les rôles sont vérifiés à chaque étape
- [ ] Les données sensibles ne sont pas exposées

### Base de données
- [ ] Les profils sont créés correctement dans `profiles`
- [ ] Les relations (owner_profiles, tenant_profiles, etc.) sont créées
- [ ] Les brouillons sont sauvegardés dans `onboarding_drafts`
- [ ] Le progrès d'onboarding est enregistré dans `onboarding_progress`

---

## 📊 Résultats attendus

Après chaque test réussi :
- ✅ Le compte est créé dans `auth.users`
- ✅ Le profil est créé dans `profiles` avec le bon rôle
- ✅ Le profil spécialisé est créé (owner_profiles, tenant_profiles, etc.)
- ✅ Le progrès d'onboarding est enregistré
- ✅ L'utilisateur peut accéder à son dashboard spécifique
- ✅ La checklist d'onboarding affiche les bonnes étapes complétées

---

## 🚀 Commandes pour tester

1. **Démarrer l'application** :
```bash
npm run dev
```

2. **Accéder à l'inscription** :
```
http://localhost:3000/signup/role
```

3. **Vérifier les logs** :
- Console du navigateur (F12)
- Logs du serveur Next.js
- Logs Supabase (Dashboard)

4. **Vérifier la base de données** :
- Table `auth.users`
- Table `profiles`
- Table `owner_profiles` / `tenant_profiles` / `provider_profiles`
- Table `onboarding_progress`
- Table `onboarding_drafts`

---

## 📝 Notes importantes

1. **Emails de test** : Utilisez des emails différents pour chaque test (owner@test.com, tenant@test.com, etc.)

2. **Vérification email** : En développement, vérifiez les emails dans la console Supabase ou configurez un service d'email de test

3. **Codes de logement** : Pour tester le locataire, créez d'abord un logement en tant que propriétaire et récupérez le code unique

4. **Invitations** : Pour tester le garant, créez une invitation depuis le dashboard propriétaire

5. **Fichiers upload** : Les fichiers uploadés sont stockés dans Supabase Storage (bucket `documents`)

---

**Le système est maintenant prêt pour les tests !** 🎉

