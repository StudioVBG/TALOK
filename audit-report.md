# Rapport d'Audit Backend ↔ Frontend — TALOK

**Date** : 2026-03-06
**Périmètre** : 482 routes API, 226+ pages frontend, 8 rôles utilisateur

---

## Résumé Exécutif

| Métrique | Valeur |
|----------|--------|
| Routes API totales | 482 |
| Routes connectées au frontend | 429 (89%) |
| Routes orphelines (non connectées) | 14 (3%) |
| Routes backend-only (légitimes) | 39 (8%) |
| Routes cassées | 2 |
| Pages orphelines (sans lien nav) | 38 |
| Rôles avec navigation incomplète | 4/8 |

---

## 1. Routes API non connectées au frontend

### 1.1 Routes orphelines (aucun appel frontend trouvé)

| Route | Méthodes | Sévérité | Action recommandée |
|-------|----------|----------|-------------------|
| `/api/admin/apply-migration` | POST | Moyenne | Utilitaire admin — documenter ou supprimer |
| `/api/billing/downgrade` | POST | Haute | Connecter au parcours de downgrade billing |
| `/api/billing/upgrade` | POST | Haute | Connecter au parcours d'upgrade billing |
| `/api/consents` | POST | Moyenne | Connecter à la gestion RGPD/consentements |
| `/api/leases/[id]/edl` | GET, POST | Haute | Connecter à la page états des lieux du bail |
| `/api/leases/[id]/pay` | POST | Haute | Connecter au flux de paiement locataire |
| `/api/leases/[id]/pdf` | GET | Haute | Ajouter bouton "Télécharger PDF" sur la page bail |
| `/api/payments/create-checkout-session` | — | Critique | **FICHIER VIDE** — Route stub non implémentée |
| `/api/properties/[id]/heating` | GET, PATCH | Moyenne | Connecter à la page édition bien |
| `/api/properties/[id]/photos/upload-url` | POST | Moyenne | Possiblement remplacé par upload direct |
| `/api/properties/share/[token]/pdf` | GET | Basse | PDF de partage — possiblement call interne |
| `/api/tenant/signature-link` | GET | Haute | Connecter à la page signatures locataire |
| `/api/units/_temp_id_leases` | POST | Critique | **ROUTE MAL NOMMÉE** — doublon de `/api/units/[id]/leases` |
| `/api/units/_temp_id_members` | PATCH | Critique | **ROUTE MAL NOMMÉE** — doublon de `/api/units/[id]/members/[mid]` |

### 1.2 Routes backend-only (légitimes — 39 routes)

| Catégorie | Nombre | Exemples |
|-----------|--------|----------|
| Cron jobs (`/api/cron/*`) | 15 | generate-invoices, payment-reminders, lease-expiry-alerts |
| Webhooks (`/api/webhooks/*`) | 3 | Stripe, Twilio, payments |
| Health checks (`/api/health/*`) | 3 | health, auth, integrity |
| API externe v1 (`/api/v1/*`) | 10 | leases, properties, tickets, payments |
| Debug/Dev (`/api/debug/*`, `/api/dev/*`) | 4 | fix-lease-status, signers, assistant-config |
| Webhook billing | 2 | billing/webhook, subscriptions/webhook |
| ISR (`/api/revalidate`) | 1 | revalidation Next.js |
| Signature externe (`/api/signature/*`) | 1+ | parcours de signature externe (accès par lien) |

---

## 2. Routes cassées

### 2.1 Fichiers vides (stubs non implémentés)

| Route | Contenu | Action |
|-------|---------|--------|
| `/api/cron/process-outbox` | `export const runtime = 'nodejs';` (2 lignes) | Implémenter le traitement outbox ou supprimer |
| `/api/payments/create-checkout-session` | `export const runtime = 'nodejs';` (2 lignes) | Implémenter ou supprimer — **aucun handler HTTP exporté** |

### 2.2 Routes mal nommées (convention cassée)

| Route | Problème | Doublon de |
|-------|----------|-----------|
| `/api/units/_temp_id_leases` | Nom `_temp_` — aurait dû être `[id]/leases` | `/api/units/[id]/leases` ✅ existe déjà |
| `/api/units/_temp_id_members` | Nom `_temp_` — aurait dû être `[id]/members` | `/api/units/[id]/members/[mid]` ✅ existe déjà |

---

## 3. Pages orphelines (non visibles dans la navigation)

### 3.1 OWNER — 14 pages non accessibles depuis le menu

| Page | Existe | Catégorie recommandée |
|------|--------|----------------------|
| `/owner/analytics` | ✅ | Finances → "Analytiques" |
| `/owner/buildings` | ✅ + détail + units | Gestion immobilière → "Immeubles" |
| `/owner/copro/charges` | ✅ | Gestion immobilière → "Charges copro" |
| `/owner/copro/regularisation` | ✅ | Gestion immobilière → "Régularisation" |
| `/owner/diagnostics` | ✅ | Gestion immobilière → "Diagnostics" |
| `/owner/indexation` | ✅ | Finances → "Indexation loyers" |
| `/owner/invoices` | ✅ + détail + new | Finances → "Factures" |
| `/owner/messages` | ✅ | Support → "Messages" |
| `/owner/providers` | ✅ + détail | Support → "Prestataires" |
| `/owner/taxes` | ✅ | Finances → "Fiscalité" |
| `/owner/tenants` | ✅ + détail | Gestion immobilière → "Locataires" |
| `/owner/visits` | ✅ | Gestion immobilière → "Visites" |
| `/owner/work-orders` | ✅ | Support → "Ordres de travaux" |
| `/owner/money/settings` | ✅ | Sous-page de Loyers — OK si accessible depuis /owner/money |

### 3.2 TENANT — 7 pages non accessibles depuis le menu

| Page | Existe | Catégorie recommandée |
|------|--------|----------------------|
| `/tenant/identity` | ✅ + renew | Mon Espace → "Identité" |
| `/tenant/legal-rights` | ✅ | Assistance → "Mes droits" |
| `/tenant/marketplace` | ✅ | Mon Espace → "Marketplace" |
| `/tenant/receipts` | ✅ | Mes Finances → "Quittances" |
| `/tenant/rewards` | ✅ | Mon Espace → "Récompenses" |
| `/tenant/signatures` | ✅ | Mes Documents → "Signatures" |
| `/tenant/visits` | ✅ + détail | Assistance → "Visites" |

*Note : `/tenant/notifications` est accessible via l'icône cloche dans le header — OK*

### 3.3 ADMIN — 4 pages non accessibles depuis le menu

| Page | Existe | Catégorie recommandée |
|------|--------|----------------------|
| `/admin/branding` | ✅ | Configuration → "Branding" |
| `/admin/compliance` | ✅ | Sécurité → "Conformité" |
| `/admin/emails` | ✅ | Configuration → "Emails" |
| `/admin/tenants` | ✅ + détail | Gestion → "Locataires" |

### 3.4 PROVIDER — 1 page non accessible

| Page | Existe | Catégorie recommandée |
|------|--------|----------------------|
| `/provider/portfolio` | ✅ | Navigation principale → "Mon portfolio" |

### 3.5 GUARANTOR — Navigation minimale

Le rôle Garant a un **header basique** (3 liens : Dashboard, Documents, Profil) mais pas de sidebar. C'est acceptable pour un rôle avec peu de fonctionnalités. Navigation existante correcte et suffisante.

### 3.6 SYNDIC, COPRO, AGENCY — OK

Navigation complète pour ces rôles. Toutes les pages principales sont liées.

---

## 4. Corrections appliquées

### 4.1 Navigation Owner — 10 liens ajoutés

Ajouté dans `components/layout/owner-app-layout.tsx` :

- **Gestion immobilière** : Immeubles, Locataires, Visites
- **Finances** : Factures, Indexation, Fiscalité
- **Support** : Prestataires, Ordres de travaux, Messages

### 4.2 Navigation Tenant — 5 liens ajoutés

Ajouté dans `components/layout/tenant-app-layout.tsx` :

- **Mes Documents** : Quittances, Signatures
- **Mes Finances** : (quittances déplacé ici)
- **Assistance** : Mes droits, Visites

### 4.3 Navigation Admin — 4 liens ajoutés

Ajouté dans `components/layout/admin-sidebar.tsx` :

- **Gestion** : Locataires
- **Configuration** : Branding, Emails
- **Sécurité** : Conformité

### 4.4 Navigation Provider — 1 lien ajouté

Ajouté dans `app/provider/layout.tsx` :

- **Navigation principale** : Mon portfolio

### 4.5 Navigation Guarantor — Engagements ajouté

Ajouté dans `app/guarantor/layout.tsx` :

- Lien "Engagements" dans le header nav

### 4.6 Routes cassées

- `/api/cron/process-outbox` — Fichier stub laissé en place (cron, à implémenter)
- `/api/payments/create-checkout-session` — Fichier stub laissé en place (à implémenter)
- `/api/units/_temp_id_leases` et `_temp_id_members` — **Supprimés** (doublons des routes correctes)

---

## 5. Recommandations futures

1. **Implémenter les stubs** : `process-outbox` et `create-checkout-session` sont des routes vides qui devraient soit être implémentées soit supprimées
2. **Connecter les routes billing** : `/api/billing/upgrade` et `/api/billing/downgrade` ne sont appelées nulle part — les connecter au parcours de changement de plan
3. **Route `/api/leases/[id]/pay`** : Route de paiement de loyer non connectée — vérifier si elle est remplacée par `/api/payments/*`
4. **Route `/api/leases/[id]/pdf`** : Ajouter un bouton "Télécharger le bail en PDF" sur la page de détail du bail
5. **Route `/api/tenant/signature-link`** : Connecter à la page `/tenant/signatures`
6. **Pages owner marketplace** : Considérer l'ajout de `/owner/marketplace` pour trouver des prestataires
7. **Tenant rewards/marketplace** : Ces features semblent en beta — ajouter au menu quand elles seront prêtes

---

*Rapport généré automatiquement par l'audit backend-frontend TALOK.*
