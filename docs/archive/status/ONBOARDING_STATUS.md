# 📋 État d'avancement de l'onboarding

## ✅ Complété

### Infrastructure
- ✅ Schémas de validation Zod pour tous les parcours
- ✅ Services : invitations, onboarding, codes logement
- ✅ Migration SQL : tables invitations, onboarding_drafts, onboarding_progress, user_consents
- ✅ RLS configuré pour toutes les tables

### Tronc commun (tous rôles)
- ✅ `/signup/role` - Choix du rôle
- ✅ `/signup/account` - Création de compte (email/password ou magic link)
- ✅ `/signup/verify-email` - Vérification d'email
- ✅ `/signup/consents` - Consentements et cookies
- ✅ `/signup/profile` - Profil minimal

### Routes d'entrée
- ✅ `/invite/[token]` - Page d'invitation
- ✅ `/rejoindre-logement` - Rejoindre par code

### Parcours Propriétaire
- ✅ `/owner/onboarding/profile` - Profil propriétaire (particulier/société)

### Composants UI
- ✅ Composant Select créé

## 🚧 En cours / À compléter

### Parcours Propriétaire (4 étapes restantes)
- ⏳ `/owner/onboarding/finance` - Paramètres financiers (encaissements, versements, IBAN)
- ⏳ `/owner/onboarding/property` - Premier logement
- ⏳ `/owner/onboarding/automation` - Niveau d'automatisation
- ⏳ `/owner/onboarding/invite` - Invitations locataires

### Parcours Locataire (4 étapes)
- ⏳ `/tenant/onboarding/context` - Contexte logement & rôle
- ⏳ `/tenant/onboarding/file` - Dossier locataire
- ⏳ `/tenant/onboarding/payments` - Paiement & parts (coloc)
- ⏳ `/tenant/onboarding/sign` - Signature du bail & dépôt

### Parcours Garant (3 étapes)
- ⏳ `/guarantor/onboarding/context` - Contexte & identité
- ⏳ `/guarantor/onboarding/financial` - Capacité financière
- ⏳ `/guarantor/onboarding/sign` - Signature de l'acte

### Parcours Prestataire (4 étapes)
- ⏳ `/provider/onboarding/profile` - Profil pro
- ⏳ `/provider/onboarding/services` - Services & zones
- ⏳ `/provider/onboarding/ops` - Dispos & paiements
- ⏳ `/provider/onboarding/review` - Validation

### Gating Dashboard
- ⏳ Checklist de vérification pour chaque rôle
- ⏳ Banners d'alerte si étapes manquantes
- ⏳ Deep-links vers les étapes à compléter

### API Routes
- ✅ `/api/consents` - Sauvegarde des consentements
- ⏳ `/api/onboarding/*` - Routes pour sauvegarder le progrès
- ⏳ `/api/invites` - Gestion des invitations
- ⏳ `/api/property-codes` - Validation des codes

### Cas limites
- ⏳ Gestion des liens expirés
- ⏳ Emails déjà existants (409)
- ⏳ Brouillons automatiques
- ⏳ Multi-rôles

## 📝 Notes

- Les validations Zod sont complètes
- Les services de base sont créés
- La structure est prête pour l'extension
- Les migrations sont appliquées

## 🎯 Prochaines étapes prioritaires

1. Compléter les pages d'onboarding propriétaire (finance, property, automation, invite)
2. Créer les pages d'onboarding locataire
3. Implémenter le gating du dashboard
4. Créer les API routes manquantes
5. Tester le flux complet

