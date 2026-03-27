# Rapport – Éléments non liés (espace locataire)

**Date :** 21 février 2026  
**Contexte :** Navigation sur https://talok.fr en tant que locataire (compte concerné : volberg.thomas@gmail.com), après rechargement de la page et parcours des principales URLs.  
**Objectif :** Constater et lister les éléments non liés ou manquants par page.

---

## 1. Synthèse

| Page | Éléments non liés / constats |
|------|------------------------------|
| **Dashboard** | Logement non lié ; onboarding 20 % ; message « Liez votre logement pour accéder à toutes les fonctionnalités » |
| **Documents** | Liste « Tous les documents » vide ; une action requise (attestation d’assurance) |
| **Paiements** | Historique factures vide (« Aucune facture ») |
| **Mon bail** | Aucun bail actif ; message d’attente d’invitation propriétaire |
| **Demandes** | Aucun ticket affiché |
| **Plus** | Navigation directe vers `/tenant/more` → **404** (route inexistante) |

**Cause principale :** Le compte locataire n’a **pas de logement (ni de bail) lié**. Tant que l’étape « Logement lié » n’est pas complétée (invitation propriétaire + liaison), les données liées au logement (baux, factures, documents, tickets) restent absentes ou non affichées.

---

## 2. Détail par page

### 2.1 Dashboard (`/tenant/dashboard`)

- **Onboarding :** Progression **20 %** (1/5 étapes).
- **Étape complétée :** « Compte créé » uniquement.
- **Étapes non complétées :** Logement lié, Assurance déposée, Identité vérifiée, Bail signé.
- **Message affiché :** « Liez votre logement pour accéder à toutes les fonctionnalités. »
- **Élément non lié :** Aucun logement ni bail associé au profil → tableau de bord limité et message explicite.

### 2.2 Documents (`/tenant/documents`)

- **Actions requises :** 1 – « Déposer l’attestation d’assurance » (obligatoire pour activer le bail).
- **Tous les documents :** Zone sous les filtres **vide** – aucun bail, quittance ou diagnostic listé.
- **Éléments non liés :** Les documents (baux, quittances, EDL, etc.) sont soit absents en base pour ce compte, soit non rattachés au `tenant_id` / au bail du locataire (cf. bugs 4 et 12 déjà corrigés côté code).

### 2.3 Paiements (`/tenant/payments`)

- **Reste à payer :** 0,00 € – « Vous êtes à jour ! »
- **Historique :** **Vide** – message « Aucune facture » / « Il n’y a pas encore de factures à afficher. »
- **Éléments non liés :** Aucune facture affichée ; cohérent avec l’absence de bail actif (pas de facturation générée ou pas de `tenant_id` sur les factures).

### 2.4 Mon bail (`/tenant/lease`)

- **Titre affiché :** « Aucun bail actif ».
- **Message :** « Vous n’avez pas encore de bail associé à votre compte. Attendez l’invitation de votre propriétaire pour commencer. »
- **Élément non lié :** Aucun bail actif lié au profil locataire.

### 2.5 Demandes (`/tenant/requests`)

- **Contenu :** Carte « Une assistance intelligente » (assistant Tom) + carte « Aucun ticket » avec « Tout fonctionne parfaitement ! ».
- **Élément non lié / vide :** Aucun ticket de maintenance affiché. Peut être dû à l’absence de logement lié (impossibilité de créer ou de lier des tickets à un bien) ou à l’absence de tickets créés.

### 2.6 Plus / Paramètres

- **Navigation directe vers `/tenant/more` :** Réponse **404 – Page introuvable**.
- **Constat :** La route `/tenant/more` n’existe pas. L’onglet « Plus » de la barre mobile ouvre vraisemblablement un menu (ex. « Mon Profil » → `/tenant/settings`) et ne correspond pas à une URL `/tenant/more`. À noter pour cohérence des liens (éviter de lier vers `/tenant/more`).

---

## 3. Causes probables (techniques)

1. **Absence de liaison logement / bail :** Pas d’invitation acceptée ou pas de `lease_signer` avec `profile_id` (ou `invited_email`) correctement relié au compte, d’où pas de bail « actif » côté locataire.
2. **Données dérivées :** Sans bail actif, pas de factures générées ni de documents (bail, quittances) associés au tenant ; les correctifs (Bugs 4, 10, 11, 12) visent à ce que, une fois le bail et le `profile_id` liés, les factures et documents soient bien créés et rattachés.
3. **404 sur `/tenant/more` :** Lien ou entrée de navigation pointant vers une URL inexistante ; la cible attendue pour « Plus » est `/tenant/settings` (ou un menu contenant ce lien).

---

## 4. Recommandations

1. **Côté produit / process :** S’assurer que le propriétaire envoie bien l’invitation au locataire (email) et que le locataire accepte (lien d’invitation) pour déclencher la liaison logement + bail + signers. Vérifier en base pour ce compte : `invitations`, `lease_signers`, `leases`, `invoices.tenant_id`.
2. **Côté technique :** Vérifier qu’aucun lien du front ne pointe vers `/tenant/more` ; utiliser uniquement `/tenant/settings` (ou sous-pages existantes) pour l’onglet « Plus ».
3. **Tests :** Après liaison effective du logement pour ce compte, refaire un parcours identique et vérifier que Documents, Paiements, Mon bail et Demandes affichent bien les données attendues.

---

*Rapport généré après navigation manuelle sur les URLs listées et capture d’écran de chaque page.*
