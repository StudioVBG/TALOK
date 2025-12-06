# 📋 Registre des Traitements - RGPD Article 30

**Responsable de traitement**: [Nom de la société]  
**DPO Contact**: dpo@gestion-locative.fr  
**Date de mise à jour**: 6 Décembre 2025  
**Version**: 1.0

---

## 📑 Table des matières

1. [Informations générales](#informations-générales)
2. [Traitements par finalité](#traitements-par-finalité)
3. [Catégories de données](#catégories-de-données)
4. [Durées de conservation](#durées-de-conservation)
5. [Sous-traitants](#sous-traitants)
6. [Transferts hors UE](#transferts-hors-ue)
7. [Mesures de sécurité](#mesures-de-sécurité)

---

## Informations générales

| Élément | Valeur |
|---------|--------|
| **Raison sociale** | [À compléter] |
| **SIRET** | [À compléter] |
| **Adresse** | [À compléter] |
| **Représentant légal** | [À compléter] |
| **DPO** | [À compléter ou "Non désigné"] |
| **Contact RGPD** | dpo@gestion-locative.fr |

---

## Traitements par finalité

### 1. Gestion des comptes utilisateurs

| Élément | Description |
|---------|-------------|
| **Finalité** | Création et gestion des comptes utilisateurs (propriétaires, locataires, prestataires) |
| **Base légale** | Exécution du contrat (Art. 6.1.b RGPD) |
| **Catégories de personnes** | Propriétaires, locataires, prestataires, garants |
| **Données collectées** | Nom, prénom, email, téléphone, date de naissance, adresse |
| **Durée de conservation** | Durée du compte + 3 ans après suppression |
| **Destinataires** | Équipe support, équipe technique |

### 2. Gestion des biens immobiliers

| Élément | Description |
|---------|-------------|
| **Finalité** | Création et suivi des biens immobiliers mis en location |
| **Base légale** | Exécution du contrat (Art. 6.1.b RGPD) |
| **Catégories de personnes** | Propriétaires |
| **Données collectées** | Adresse du bien, caractéristiques, photos, diagnostics |
| **Durée de conservation** | Durée de l'abonnement + 5 ans |
| **Destinataires** | Propriétaire concerné, locataires liés |

### 3. Gestion des baux

| Élément | Description |
|---------|-------------|
| **Finalité** | Création, signature et suivi des contrats de location |
| **Base légale** | Exécution du contrat + Obligation légale (Art. 6.1.b et 6.1.c) |
| **Catégories de personnes** | Propriétaires, locataires, garants |
| **Données collectées** | Identité complète, revenus, situation professionnelle, pièces justificatives |
| **Durée de conservation** | Durée du bail + 5 ans après fin |
| **Destinataires** | Parties au bail, prestataire signature électronique |

### 4. Gestion des paiements

| Élément | Description |
|---------|-------------|
| **Finalité** | Encaissement des loyers et émission des quittances |
| **Base légale** | Exécution du contrat + Obligation légale comptable |
| **Catégories de personnes** | Propriétaires, locataires |
| **Données collectées** | Coordonnées bancaires (IBAN), historique paiements, moyens de paiement |
| **Durée de conservation** | 10 ans (obligations comptables) |
| **Destinataires** | Prestataire paiement (Stripe), comptable |

### 5. Vérification d'identité

| Élément | Description |
|---------|-------------|
| **Finalité** | Vérification de l'identité des locataires et garants |
| **Base légale** | Exécution du contrat + Intérêt légitime (prévention fraude) |
| **Catégories de personnes** | Locataires, garants |
| **Données collectées** | CNI/Passeport, justificatifs de domicile, bulletins de salaire |
| **Durée de conservation** | Fin du bail + 1 an |
| **Destinataires** | Propriétaire concerné |

### 6. Gestion des tickets et maintenance

| Élément | Description |
|---------|-------------|
| **Finalité** | Suivi des demandes d'intervention et maintenance |
| **Base légale** | Exécution du contrat |
| **Catégories de personnes** | Propriétaires, locataires, prestataires |
| **Données collectées** | Description du problème, photos, échanges de messages |
| **Durée de conservation** | Durée du bail + 2 ans |
| **Destinataires** | Parties concernées, prestataires assignés |

### 7. Signature électronique

| Élément | Description |
|---------|-------------|
| **Finalité** | Signature dématérialisée des documents (baux, EDL, etc.) |
| **Base légale** | Exécution du contrat |
| **Catégories de personnes** | Propriétaires, locataires, garants |
| **Données collectées** | Email, téléphone, IP, preuve de signature |
| **Durée de conservation** | 10 ans (preuve légale) |
| **Destinataires** | Prestataire signature (Yousign) |

### 8. Analyse et statistiques

| Élément | Description |
|---------|-------------|
| **Finalité** | Amélioration du service et statistiques d'usage |
| **Base légale** | Intérêt légitime (Art. 6.1.f) + Consentement cookies |
| **Catégories de personnes** | Tous les utilisateurs |
| **Données collectées** | Données de navigation, actions effectuées, temps d'utilisation |
| **Durée de conservation** | 13 mois (cookies) |
| **Destinataires** | PostHog (analytics), Sentry (erreurs) |

### 9. Marketing et communication

| Élément | Description |
|---------|-------------|
| **Finalité** | Envoi de newsletters et communications commerciales |
| **Base légale** | Consentement (Art. 6.1.a) |
| **Catégories de personnes** | Utilisateurs ayant donné leur consentement |
| **Données collectées** | Email, préférences de communication |
| **Durée de conservation** | Jusqu'au retrait du consentement |
| **Destinataires** | Resend (service email) |

---

## Catégories de données

### Données d'identification

| Donnée | Obligatoire | Sensible |
|--------|-------------|----------|
| Nom | Oui | Non |
| Prénom | Oui | Non |
| Email | Oui | Non |
| Téléphone | Non | Non |
| Date de naissance | Non | Non |
| Adresse | Non | Non |

### Données financières

| Donnée | Obligatoire | Sensible |
|--------|-------------|----------|
| IBAN | Non | Oui |
| Revenus | Non | Oui |
| Historique paiements | Auto | Non |
| Avis d'imposition | Non | Oui |

### Documents d'identité

| Donnée | Obligatoire | Sensible |
|--------|-------------|----------|
| CNI / Passeport | Non | Oui |
| Justificatif domicile | Non | Non |
| Bulletins de salaire | Non | Oui |
| Contrat de travail | Non | Oui |

### Données de navigation

| Donnée | Obligatoire | Sensible |
|--------|-------------|----------|
| Adresse IP | Auto | Non |
| User-Agent | Auto | Non |
| Pages visitées | Auto | Non |
| Actions effectuées | Auto | Non |

---

## Durées de conservation

| Type de donnée | Durée active | Archive | Suppression |
|----------------|--------------|---------|-------------|
| **Compte utilisateur** | Durée abonnement | +3 ans | Anonymisation |
| **Profil propriétaire** | Durée abonnement | +3 ans | Anonymisation |
| **Profil locataire** | Durée bail | +3 ans | Anonymisation |
| **Biens immobiliers** | Durée abonnement | +5 ans | Suppression |
| **Baux** | Durée bail | +5 ans | Archive légale |
| **Factures/Quittances** | 10 ans | - | Suppression |
| **Paiements** | 10 ans | - | Anonymisation |
| **Documents identité** | Fin bail | +1 an | Suppression |
| **Photos biens** | Durée bien | - | Suppression |
| **Tickets/Messages** | Durée bail | +2 ans | Suppression |
| **Logs connexion** | 1 an | - | Suppression |
| **Logs audit** | 5 ans | +5 ans | Archive |
| **Cookies analytics** | 13 mois | - | Suppression |

---

## Sous-traitants

### Infrastructure & Hébergement

| Sous-traitant | Service | Localisation | Garanties |
|---------------|---------|--------------|-----------|
| **Vercel** | Hébergement application | USA (SCCs) | SOC 2, GDPR DPA |
| **Supabase** | Base de données | EU (Frankfurt) | SOC 2, GDPR compliant |

### Paiements

| Sous-traitant | Service | Localisation | Garanties |
|---------------|---------|--------------|-----------|
| **Stripe** | Paiements CB/SEPA | EU + USA | PCI-DSS, GDPR DPA |

### Communications

| Sous-traitant | Service | Localisation | Garanties |
|---------------|---------|--------------|-----------|
| **Resend** | Emails transactionnels | USA (SCCs) | GDPR DPA |
| **Twilio** | SMS | USA (SCCs) | GDPR DPA, SOC 2 |

### Signature électronique

| Sous-traitant | Service | Localisation | Garanties |
|---------------|---------|--------------|-----------|
| **Yousign** | Signature électronique | France | eIDAS, GDPR natif |

### Analytics & Monitoring

| Sous-traitant | Service | Localisation | Garanties |
|---------------|---------|--------------|-----------|
| **Sentry** | Monitoring erreurs | EU | GDPR DPA |
| **PostHog** | Analytics produit | EU Cloud | GDPR compliant |

---

## Transferts hors UE

| Destinataire | Pays | Mécanisme légal | Données concernées |
|--------------|------|-----------------|-------------------|
| Vercel | USA | SCCs + BCRs | Code application |
| Stripe | USA | SCCs | Données paiement |
| Resend | USA | SCCs | Emails |
| Twilio | USA | SCCs | Numéros téléphone |

**Note**: Tous les sous-traitants américains sont soumis aux Standard Contractual Clauses (SCCs) post-Schrems II.

---

## Mesures de sécurité

### Techniques

| Mesure | Implémentation |
|--------|----------------|
| Chiffrement en transit | TLS 1.3 |
| Chiffrement au repos | AES-256 (Supabase) |
| Authentification | Email/password + MFA optionnel |
| Contrôle d'accès | RLS (Row Level Security) |
| Sauvegarde | Point-in-time recovery 7j |
| Logs d'audit | Table audit_log |

### Organisationnelles

| Mesure | Implémentation |
|--------|----------------|
| Accès production | Réservé aux admins |
| Formation RGPD | Équipe sensibilisée |
| Procédure violation | Notification 72h CNIL |
| DPO | [Désigné / À désigner] |

### Droits des personnes

| Droit | Implémentation |
|-------|----------------|
| **Accès** (Art. 15) | Export via `/api/privacy/export` |
| **Rectification** (Art. 16) | Profil utilisateur |
| **Effacement** (Art. 17) | `/api/privacy/anonymize/cascade` |
| **Portabilité** (Art. 20) | Export JSON structuré |
| **Opposition** (Art. 21) | Contact DPO |
| **Limitation** (Art. 18) | Contact DPO |

---

## Historique des modifications

| Date | Version | Modification | Auteur |
|------|---------|--------------|--------|
| 06/12/2025 | 1.0 | Création initiale | [Auteur] |

---

## Contact

Pour toute question relative à ce registre ou exercer vos droits :

- **Email**: dpo@gestion-locative.fr
- **Formulaire**: /legal/privacy
- **Délai de réponse**: 30 jours maximum

---

*Document conforme à l'Article 30 du RGPD (UE) 2016/679*

