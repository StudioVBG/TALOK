# AUDIT COMPLET — Espace Locataire Talok
**Date** : 2 avril 2026
**Périmètre** : `app/tenant/`, API routes `/api/tenant/*`, composants, hooks, services
**Stack** : Next.js 14 App Router, Supabase, TypeScript, Tailwind, Zustand, Framer Motion

---

## SECTION 1 — Inventaire des routes

### Pages locataire (`app/tenant/`)

| Route | Fichier | Statut | Lien sidebar |
|---|---|---|---|
| `/tenant` | `page.tsx` | Redirect → `/tenant/dashboard` | — |
| `/tenant/dashboard` | `dashboard/page.tsx` + `DashboardClient.tsx` | **Existe** | Oui |
| `/tenant/lease` | `lease/page.tsx` | **Existe** (gros client ~700 lignes) | Oui |
| `/tenant/documents` | `documents/page.tsx` | **Existe** (Document Center complet) | Oui |
| `/tenant/inspections` | `inspections/page.tsx` | **Existe** | Oui |
| `/tenant/inspections/[id]` | `inspections/[id]/page.tsx` + `TenantEDLDetailClient.tsx` | **Existe** | — |
| `/tenant/payments` | `payments/page.tsx` + `TenantPaymentsClient.tsx` | **Existe** | Oui |
| `/tenant/meters` | `meters/page.tsx` | **Existe** (~596 lignes) | Oui |
| `/tenant/requests` | `requests/page.tsx` | **Existe** (tickets + sinistres) | Oui |
| `/tenant/requests/new` | `requests/new/page.tsx` | **Existe** (mode Tom IA + classique) | — |
| `/tenant/messages` | `messages/page.tsx` | **Existe** | Oui |
| `/tenant/legal-rights` | `legal-rights/page.tsx` + `LegalRightsClient.tsx` | **Existe** | Oui |
| `/tenant/visits` | `visits/page.tsx` | **Existe** | Oui |
| `/tenant/visits/[id]` | `visits/[id]/page.tsx` | **Existe** | — |
| `/tenant/applications` | `applications/page.tsx` | **Existe** | Oui |
| `/tenant/colocation` | `colocation/page.tsx` | **Existe** | Non (absent sidebar) |
| `/tenant/receipts` | `receipts/page.tsx` | Redirect → `/tenant/documents?type=quittance` | Non (retiré) |
| `/tenant/signatures` | `signatures/page.tsx` | Redirect → `/tenant/documents` | Non (retiré) |
| `/tenant/settings` | `settings/page.tsx` + `TenantSettingsClient.tsx` | **Existe** | Oui (footer) |
| `/tenant/settings/payments` | `settings/payments/page.tsx` + `TenantPaymentSettingsClient.tsx` | **Existe** | — |
| `/tenant/identity` | `identity/page.tsx` | **Existe** (~606 lignes) | Non |
| `/tenant/identity/renew` | `identity/renew/page.tsx` | **Existe** | — |
| `/tenant/notifications` | `notifications/page.tsx` | **Existe** | Non |
| `/tenant/rewards` | `rewards/page.tsx` | **Existe** | Non |
| `/tenant/marketplace` | `marketplace/page.tsx` | **Existe** | Non |
| `/tenant/help` | `help/page.tsx` | **Existe** | Oui (footer) |
| `/tenant/onboarding/context` | `onboarding/context/page.tsx` | **Existe** | — |
| `/tenant/onboarding/file` | `onboarding/file/page.tsx` | **Existe** | — |
| `/tenant/onboarding/identity` | `onboarding/identity/page.tsx` | **Existe** | — |
| `/tenant/onboarding/payments` | `onboarding/payments/page.tsx` | **Existe** | — |
| `/tenant/onboarding/sign` | `onboarding/sign/page.tsx` | **Existe** | — |

### Pages ABSENTES (demandées mais inexistantes)

| Route attendue | Statut |
|---|---|
| `/tenant/profile` | **ABSENT** — Redirigé implicitement vers `/tenant/settings` |
| `/tenant/tickets` | **ABSENT** — Le contenu est dans `/tenant/requests` |

### Sidebar Navigation (source de vérité : `tenant-app-layout.tsx` L71-88)

**Groupe "Mon Espace"** :
- Tableau de bord → `/tenant/dashboard`
- Mon Logement → `/tenant/lease`
- Candidatures → `/tenant/applications`

**Groupe "Mes Documents"** :
- Documents → `/tenant/documents`
- États des lieux → `/tenant/inspections`

**Groupe "Mes Finances"** :
- Loyers & Paiements → `/tenant/payments`
- Compteurs → `/tenant/meters`

**Groupe "Assistance"** :
- Demandes → `/tenant/requests`
- Messages → `/tenant/messages`
- Mes droits → `/tenant/legal-rights`
- Visites → `/tenant/visits`

**Footer** :
- Aide → `/tenant/help`
- Mon Profil → `/tenant/settings`

---

### Routes API locataire (`/api/tenant/*`)

| Route API | Méthodes | Rôle |
|---|---|---|
| `/api/tenant/dashboard` | GET | Dashboard complet (leases, invoices, tickets, stats, meters, EDLs) |
| `/api/tenant/lease` | GET | Bail actif + propriété via RPC `tenant_dashboard` |
| `/api/tenant/lease/[id]/documents` | GET | Documents liés à un bail spécifique |
| `/api/tenant/profile` | GET, PUT | Profil personnel + profil locataire |
| `/api/tenant/identity/upload` | POST | Upload CNI recto/verso avec OCR |
| `/api/tenant/identity/check-access` | GET | Vérification accès identité |
| `/api/tenant/identity/my-leases` | GET | Liste baux du locataire |
| `/api/tenant/identity/request-2fa` | POST | Demande OTP 2FA |
| `/api/tenant/identity/verify-2fa` | POST | Vérification OTP 2FA |
| `/api/tenant/consumption` | GET | Données consommation (elec/eau/gaz) |
| `/api/tenant/pending-signatures` | GET | Baux en attente de signature |
| `/api/tenant/payment-methods` | GET, POST, PATCH, DELETE | Moyens de paiement (SEPA, CB) |
| `/api/tenant/nav-badges` | GET | Compteurs badges (messages, demandes) |
| `/api/tenant/signature-link` | GET | Liens de signature avec tokens |
| `/api/tenant/tips` | GET | Conseil personnalisé (priorité haute→basse) |
| `/api/tenant/credit-score` | GET | Score crédit locataire (300-850) |
| `/api/tenant/link-property` | POST | Liaison locataire ↔ propriété |
| `/api/meters/[id]/readings` | GET, POST | Relevés de compteur (lecture/saisie) |
| `/api/meters/[id]/history` | GET | Historique compteur avec estimations |
| `/api/meters/readings` | GET, POST | Relevés par meter_id (admin/owner) |

---

## SECTION 2 — Bugs critiques (P0)

### BUG-01 : Dashboard — Espace blanc massif / overflow vertical

**Fichier** : `app/tenant/dashboard/DashboardClient.tsx`
**Symptôme** : Le dashboard affiche un grand espace blanc en dessous du contenu.
**Cause probable** : Le composant principal utilise une structure flex avec `min-h-screen` combiné à un layout parent qui impose déjà `h-full`. Le conteneur grid 2 colonnes (`grid-cols-1 lg:grid-cols-3`) avec le panneau latéral "Secondaire" peut ne pas avoir de contenu suffisant, créant un vide.
**Correction** : Retirer `min-h-screen` du wrapper principal et s'assurer que le conteneur utilise `min-h-0` et `overflow-y-auto` au lieu de forcer une hauteur minimale.

### BUG-02 : `/tenant/lease` — Pas de redirection en chaîne mais UX confuse

**Fichier** : `app/tenant/lease/page.tsx`
**Symptôme** : Si le locataire n'a aucun bail, la page affiche un état "Aucun bail trouvé" mais ne redirige pas vers le dashboard — ce qui peut donner l'impression que la page est cassée.
**Cause** : La page est un client component qui fetch `/api/tenant/lease` et affiche un empty state statique si `leases.length === 0`.
**Impact** : Pour les nouveaux inscrits sans bail, naviguer vers "Mon Logement" donne une page quasi-vide.

### BUG-03 : Documents — "Invalid Date" sur les cards

**Fichier** : `app/tenant/documents/page.tsx`
**Cause racine** : La fonction de formatage de date utilise `new Date(doc.created_at)` sans vérifier que `created_at` n'est pas `null` ou une chaîne vide. Certains documents générés automatiquement (quittances, annexes) peuvent avoir `created_at = null` en base.
**Correction** : Ajouter un guard `if (!date || isNaN(new Date(date).getTime())) return "—"` dans la fonction de formatage.

### BUG-04 : Documents — Titres génériques "Document"

**Fichier** : `app/tenant/documents/page.tsx`
**Symptôme** : Certains documents affichent "Document" comme titre au lieu de leur vrai nom.
**Cause** : La fonction `detectType()` se base sur `doc.category` ou `doc.name` pour classer les documents. Si aucun ne matche, le fallback est "Document". Le champ `title` ou `display_name` de la base n'est pas utilisé en priorité.
**Correction** : Prioriser `doc.title || doc.display_name || doc.name` avant le fallback.

### BUG-05 : "Loyer mensuel CC" — Libellé ambigu

**Fichier** : `app/tenant/dashboard/DashboardClient.tsx`, `app/tenant/lease/page.tsx`
**Symptôme** : L'affichage "CC" (charges comprises) n'est pas explicite pour les utilisateurs.
**Correction** : Remplacer "CC" par "charges comprises" ou afficher séparément "Loyer : X € + Charges : Y € = Total : Z €".

### BUG-06 : Legal Rights — Page potentiellement blanche

**Fichier** : `app/tenant/legal-rights/page.tsx` (server) → `LegalRightsClient.tsx`
**Symptôme** : La page peut s'afficher blanche si le locataire n'a pas de bail actif (pas d'adresse de propriété disponible).
**Cause** : `page.tsx` fetch le profil et le bail. Si `lease` est null, `propertyAddress` est undefined. `LegalRightsClient` reçoit une prop `propertyAddress` vide → les contacts géolocalisés (préfecture, ADIL) ne s'affichent pas, mais le reste du contenu devrait s'afficher. Le problème est probablement un crash silencieux dans le rendu conditionnel.
**Correction** : Ajouter un fallback pour `propertyAddress` (afficher les ressources nationales si pas d'adresse locale) et vérifier qu'il n'y a pas de `.split()` ou `.match()` sur `undefined`.

### BUG-07 : Meters — L'API POST `/api/meters/readings` est réservée owner/admin

**Fichier** : `app/api/meters/readings/route.ts`
**Symptôme** : Le locataire utilise la page `/tenant/meters` pour saisir un relevé, mais l'API POST `/api/meters/readings` vérifie `is owner of property OR is admin`. Le locataire n'est pas autorisé.
**Cause** : L'API `/api/meters/[id]/readings` (POST) vérifie bien tenant + active lease, mais la page meters pourrait appeler la mauvaise route.
**Correction** : Vérifier que `meters/page.tsx` appelle bien `/api/meters/{meterId}/readings` (avec l'ID) et non `/api/meters/readings` (collection route).

---

## SECTION 3 — Problèmes UX/UI par page

### Dashboard (`/tenant/dashboard`)

**Ce qui fonctionne** :
- Multi-bail avec sélecteur
- Centre de commandes avec actions en attente (signer bail, payer loyer, EDL, assurance)
- Carte propriété avec image de couverture et DPE
- Fil d'activité combinant factures, tickets, notifications
- Score crédit locataire (CreditBuilder)
- Graphique de consommation
- Coordonnées du bailleur
- Tips personnalisés par "Tom"
- Synchronisation temps réel

**Ce qui manque** :
- Prochain loyer dû : date exacte + montant + countdown (absent du centre de commandes)
- CTA "Payer mon loyer" en position proéminente (actuellement noyé dans les actions)
- Résumé des 3 derniers paiements (pas d'historique récent visible)
- Alerte si relevé de compteur en retard (absent — l'API tips le détecte mais pas affiché en bannière)
- Alerte si document en attente de signature (partiellement via centre de commandes mais pas de badge urgent)
- Date de fin de bail + durée restante (absente du dashboard)
- Quick stats en haut de page : jours restants avant loyer, impayés, documents en attente

**Problèmes UX** :
- Espace blanc excessif en bas (BUG-01)
- "CC" ambigu (BUG-05)
- Le panneau latéral (col 3) est trop chargé en desktop mais invisible en mobile (pas de scroll horizontal → contenu perdu)

---

### Mon Logement (`/tenant/lease`)

**Ce qui fonctionne** :
- Sélecteur multi-bail
- Onglets Contrat / Vie Pratique
- Détails du bail (type, durée, loyer, charges)
- Checklist conformité
- Annexes et diagnostics
- Passeport technique avec identité du bien, accès, compteurs

**Ce qui manque** :
- Bouton "Saisir un relevé de compteur" directement accessible (il faut aller sur `/tenant/meters`)
- Coordonnées du propriétaire (téléphone/email) visibles sur cette page
- Lien vers le bail PDF en téléchargement rapide (le PDF est accessible via l'API mais pas de bouton dédié)
- Module de congé/préavis : le `TenantNoticeWizard` existe dans `features/tenant/components/` mais n'est pas clairement accessible

**Problèmes UX** :
- La page est très longue (~700 lignes de client component) sans ancres de navigation
- L'onglet "Vie Pratique" n'est pas immédiatement compréhensible

---

### Documents (`/tenant/documents`)

**Ce qui fonctionne** :
- Architecture 3 zones (À faire / Documents clés / Tous les documents)
- Détection intelligente du type de document
- Filtres par type, source, période
- Modes grille et cascade
- Prévisualisation PDF modale

**Ce qui manque** :
- Bouton d'upload visible pour le locataire (attestation d'assurance par ex.)
- Notification "X documents en attente de votre action" en badge

**Problèmes UX** :
- "Invalid Date" sur certaines cards (BUG-03)
- Titres génériques "Document" (BUG-04)
- La zone "Documents clés" affiche 4 slots fixes mais si le locataire n'a pas encore d'EDL ou d'assurance, les slots vides ne guident pas vers l'action

---

### États des lieux (`/tenant/inspections`)

**Ce qui fonctionne** :
- Liste des EDL avec badges type (entrée/sortie)
- Compteur de signatures en attente
- Liens vers la signature ou les détails
- Note informative sur l'importance de l'EDL

**Ce qui manque** :
- Comparaison entrée/sortie pour préparer la restitution du dépôt de garantie
- Photos de l'EDL accessibles depuis cette page
- Export PDF de l'EDL depuis l'espace locataire

---

### Loyers & Paiements (`/tenant/payments`)

**Ce qui fonctionne** :
- Historique des factures avec statuts
- Recherche par période
- Synchronisation temps réel
- Pull-to-refresh

**Ce qui manque** :
- Bouton de paiement Stripe Checkout visible et proéminent
- Téléchargement de quittance par mois (actuellement accessible via Documents mais pas depuis Paiements)
- Prélèvement automatique : configuration depuis cette page
- Résumé en haut : montant dû / prochain prélèvement / historique des 3 derniers

**Problèmes UX** :
- La page délègue tout au `TenantPaymentsClient` mais les CTA de paiement ne sont pas visibles sans scroller

---

### Compteurs (`/tenant/meters`)

**Ce qui fonctionne** :
- Affichage des compteurs par type (elec, gaz, eau, chauffage)
- Dernier relevé avec date
- Dialog de saisie avec photo, validation numérique, alerte sur-consommation
- Historique des 24 derniers relevés
- Estimation de consommation
- Tips Linky/Gazpar
- Design glassmorphism avec animations

**Ce qui manque** :
- **Graphique d'évolution** de la consommation sur 12 mois (le composant `consumption-chart.tsx` existe dans features mais n'est pas utilisé sur cette page)
- **Alerte relevé en attente** si > 3 mois sans saisie (l'API tips le détecte mais pas affiché ici)
- **Comparaison avec relevé précédent** dans le dialogue de saisie (partiellement fait avec la validation "doit être supérieur" mais pas de delta affiché)
- Rappel par notification push/email pour saisir un relevé

**Problèmes UX** :
- Le formulaire de saisie est un Dialog, pas une page dédiée → perte possible sur mobile
- Pas de mode OCR automatique depuis la photo (le hook `use-edl-meters.ts` supporte l'OCR mais ce n'est pas branché sur la page meters locataire)

---

### Demandes (`/tenant/requests`)

**Ce qui fonctionne** :
- Liste des tickets avec statuts
- Section sinistres séparée
- Mode de création "Tom" (IA) + "Classique"
- Brouillon auto-sauvegardé en localStorage
- Upload de pièces jointes (5 fichiers, 10Mo max)
- Catégories avec icônes
- Niveaux d'urgence

**Ce qui manque** :
- Suivi du ticket en temps réel (messages du prestataire, devis)
- Historique des échanges sur un ticket existant (la route API existe mais pas l'UI côté locataire)

---

### Messages (`/tenant/messages`)

**Ce qui fonctionne** :
- Interface de messagerie avec le propriétaire
- Rendu via `MessagesPageContent`

**Ce qui manque** :
- Notification de nouveau message (partiellement via nav badges)
- Envoi de pièces jointes dans les messages

---

### Mes droits (`/tenant/legal-rights`)

**Ce qui fonctionne** :
- Contacts géolocalisés (préfecture, ADIL, tribunal, commissariat)
- Numéros d'urgence avec boutons d'appel
- Protocole en cas d'expulsion illégale
- Informations sur les droits du locataire

**Ce qui manque** :
- Modèles de lettres (mise en demeure, contestation de charges)
- Guide interactif "Que faire si..." pour les situations courantes

**Problèmes UX** :
- Page blanche si pas de bail actif (BUG-06)

---

### Visites (`/tenant/visits`)

**Ce qui fonctionne** :
- Stats de visites (en attente, confirmées, terminées)
- Liste des réservations

**Ce qui manque** :
- Calendrier visuel pour voir les créneaux
- Confirmation/annulation de visite depuis la page

---

### Candidatures (`/tenant/applications`)

**Ce qui fonctionne** :
- Saisie de code propriété pour postuler
- Statuts colorés (démarré, en examen, prêt à signer, signé, refusé)
- Liens vers la complétion de dossier ou la signature

**Ce qui manque** :
- Score de dossier / progression du dossier en %
- Notifications de changement de statut

---

### Colocation (`/tenant/colocation`)

**Ce qui fonctionne** :
- Interface complète avec tableau de bord colocation, tâches ménagères, partage de dépenses, règlement intérieur

**Problème** :
- **Non accessible depuis la sidebar** — le lien n'existe pas dans `allNavItems`

---

### Autres pages (non dans sidebar)

| Page | Commentaire |
|---|---|
| `/tenant/notifications` | Liste de notifications — accessible via la cloche mais pas dans la sidebar |
| `/tenant/rewards` | Programme de fidélité locataire — non lié dans la sidebar |
| `/tenant/marketplace` | Marketplace de services — non lié dans la sidebar |
| `/tenant/identity` | Gestion identité/CNI — accessible depuis settings mais pas dans la sidebar |

---

## SECTION 4 — Fonctionnalités manquantes

### Compteurs (PRIORITE HAUTE)

| Fonctionnalité | Statut | Détail |
|---|---|---|
| Formulaire de saisie de relevé | **Existe** (Dialog) | Fonctionnel mais pas de page dédiée |
| Historique des relevés | **Existe** (Modal) | Affiche les 24 derniers relevés |
| Graphique d'évolution 12 mois | **MANQUANT** | Le composant `consumption-chart.tsx` existe mais pas branché |
| Alertes relevé en attente | **MANQUANT** | L'API tips détecte >3 mois mais pas de bannière dédiée |
| Comparaison avec relevé précédent | **PARTIEL** | Validation "supérieur" mais pas de delta affiché |
| OCR automatique depuis photo | **MANQUANT** | Le hook existe (`use-edl-meters.ts`) mais non branché |
| Notification push si relevé à faire | **MANQUANT** | Pas de cron/notification pour ça |

### Dashboard

| Fonctionnalité | Statut |
|---|---|
| Prochain loyer : date + montant + countdown | **MANQUANT** |
| CTA "Payer mon loyer" proéminent | **MANQUANT** (noyé dans les actions) |
| 3 derniers paiements résumés | **MANQUANT** |
| Alerte relevé compteur en retard | **MANQUANT** (tips le sait mais pas de bannière) |
| Alerte document en attente de signature | **PARTIEL** (centre de commandes) |
| Date fin de bail + durée restante | **MANQUANT** |

### Loyers & Paiements

| Fonctionnalité | Statut |
|---|---|
| Bouton paiement Stripe Checkout | **MANQUANT** côté page paiements (existe dans l'API) |
| Téléchargement quittance par mois | **MANQUANT** sur cette page (dans Documents) |
| Historique avec statuts payé/attente/retard | **EXISTE** |
| Configuration prélèvement auto | **EXISTE** dans `/tenant/settings/payments` |

### Documents

| Fonctionnalité | Statut |
|---|---|
| Vrais noms au lieu de "Document" | **BUG** (voir BUG-04) |
| "Invalid Date" corrigé | **BUG** (voir BUG-03) |
| Upload attestation assurance | **PARTIEL** (zone "À faire" guide vers l'action) |

### Mon Logement

| Fonctionnalité | Statut |
|---|---|
| Bouton "Saisir un relevé" depuis cette page | **MANQUANT** |
| Contact propriétaire visible | **MANQUANT** sur cette page (dans Dashboard) |
| Lien bail PDF | **MANQUANT** (API existe) |

### Autres manquants

| Fonctionnalité | Statut | Priorité |
|---|---|---|
| Notification push/email loyer dû dans 3 jours | **MANQUANT** | P1 |
| Module congé/préavis depuis l'app | **PARTIEL** (`TenantNoticeWizard` existe, peu visible) | P1 |
| Liste des colocataires si colocation | **EXISTE** mais page non dans sidebar | P1 |
| Export historique paiements en PDF | **MANQUANT** | P2 |
| Rappel saisie compteur par email | **MANQUANT** | P2 |
| Modèles de lettres (mise en demeure, etc.) | **MANQUANT** | P2 |

---

## SECTION 5 — Plan de correction priorisé

### P0 — Bloquant (corriger immédiatement)

| # | Problème | Fichier | Correction |
|---|---|---|---|
| 1 | "Invalid Date" sur documents | `app/tenant/documents/page.tsx` | Guard : `if (!date \|\| isNaN(new Date(date).getTime())) return "—"` dans la fonction de formatage de date |
| 2 | Titres "Document" génériques | `app/tenant/documents/page.tsx` | Prioriser `doc.title \|\| doc.display_name \|\| doc.name` avant le fallback `detectType()` |
| 3 | Legal Rights page blanche sans bail | `app/tenant/legal-rights/LegalRightsClient.tsx` | Ajouter fallback : afficher ressources nationales (ANIL, 3044) si `propertyAddress` est undefined |
| 4 | Vérifier route API meters pour locataire | `app/tenant/meters/page.tsx` | S'assurer que les POST appellent `/api/meters/{id}/readings` (autorisé tenant) et non `/api/meters/readings` (owner only) |
| 5 | Dashboard overflow espace blanc | `app/tenant/dashboard/DashboardClient.tsx` | Retirer `min-h-screen`, utiliser `min-h-0 flex-1 overflow-y-auto` |
| 6 | "CC" ambigu | `DashboardClient.tsx`, `lease/page.tsx` | Remplacer "CC" par "charges comprises" ou séparer loyer/charges |

### P1 — Important (UX dégradée)

| # | Problème | Fichier | Correction |
|---|---|---|---|
| 7 | Pas de CTA "Payer mon loyer" proéminent | `DashboardClient.tsx` | Ajouter un bandeau en haut : "Prochain loyer : X € dû le JJ/MM — [Payer]" avec bouton Stripe |
| 8 | Pas de date fin de bail / durée restante | `DashboardClient.tsx` | Ajouter un badge "Bail jusqu'au JJ/MM/AAAA (X mois restants)" dans la carte propriété |
| 9 | Graphique consommation absent sur Meters | `app/tenant/meters/page.tsx` | Brancher `consumption-chart.tsx` existant sous le tableau des compteurs |
| 10 | Colocation absent de la sidebar | `tenant-app-layout.tsx` | Ajouter conditionnellement "Colocation" dans le groupe "Mon Espace" si le bail est de type colocation |
| 11 | Module préavis peu visible | `app/tenant/lease/page.tsx` | Ajouter un bouton "Donner mon préavis" visible dans l'onglet Contrat, lié au `TenantNoticeWizard` |
| 12 | Pas de bouton paiement sur /payments | `TenantPaymentsClient.tsx` | Ajouter en haut un résumé : montant dû + bouton "Payer maintenant" appelant `/api/payments/checkout` |
| 13 | Contact propriétaire absent de /lease | `app/tenant/lease/page.tsx` | Ajouter une section "Votre bailleur" avec nom, téléphone, email |
| 14 | Pas de lien bail PDF sur /lease | `app/tenant/lease/page.tsx` | Ajouter bouton "Télécharger mon bail" appelant `/api/leases/{id}/pdf` |
| 15 | Notification loyer dû dans 3 jours | `app/api/cron/payment-reminders/route.ts` | Vérifier que le cron envoie bien un email/push 3 jours avant échéance |
| 16 | Alerte relevé compteur en retard | `app/tenant/meters/page.tsx` | Ajouter bannière "Relevé en attente depuis X jours" si dernier relevé > 90 jours |

### P2 — Amélioration (roadmap)

| # | Fonctionnalité | Effort | Valeur |
|---|---|---|---|
| 17 | OCR automatique sur relevé compteur (photo → valeur) | Moyen (hook existe) | Haute — réduit les erreurs de saisie |
| 18 | Modèles de lettres (mise en demeure, contestation) | Moyen | Moyenne — différenciateur fort |
| 19 | Export historique paiements PDF | Faible | Moyenne — besoin fiscal |
| 20 | Rappel saisie compteur par email/push | Faible | Moyenne — engagement utilisateur |
| 21 | Calendrier visuel pour visites | Moyen | Faible — peu de visites par locataire |
| 22 | Score dossier candidature en % | Faible | Moyenne — feedback candidat |
| 23 | Téléchargement quittance depuis /payments | Faible | Haute — raccourci attendu |
| 24 | Réponse aux tickets depuis l'espace locataire | Moyen | Haute — suivi complet |
| 25 | Programme rewards visible dans sidebar | Faible | Faible — feature secondaire |

---

## SECTION 6 — Architecture cible du Dashboard Locataire

```
┌──────────────────────────────────────────────────────────────────┐
│  TenantDashboardPage (Server Component)                          │
│  ├── fetchTenantDashboard() → données complètes                  │
│  ├── fetchPendingEDLs() → signatures en attente                  │
│  └── DashboardClient (Client Component)                          │
│       │                                                          │
│       ├── [ZONE 1] BanniereUrgente                               │
│       │   ├── Si impayé > 0 → "Vous avez X € d'impayés"         │
│       │   ├── Si loyer dû < 3j → "Loyer dû le JJ/MM — [Payer]" │
│       │   ├── Si bail à signer → "Bail en attente de signature"  │
│       │   └── Si EDL à signer → "EDL à signer"                  │
│       │                                                          │
│       ├── [ZONE 2] ProchainLoyer                                 │
│       │   ├── Montant : X € (loyer Y € + charges Z €)           │
│       │   ├── Date d'échéance : JJ/MM/AAAA                      │
│       │   ├── Countdown : "dans X jours"                         │
│       │   └── [CTA] "Payer mon loyer" → Stripe Checkout          │
│       │                                                          │
│       ├── [ZONE 3] CartePropriete                                │
│       │   ├── Adresse + photo couverture                         │
│       │   ├── Type de bail + durée restante                      │
│       │   ├── DPE badge                                          │
│       │   └── Contact bailleur (nom, tel, email)                 │
│       │                                                          │
│       ├── [ZONE 4] HistoriquePaiements (3 derniers)              │
│       │   ├── Mois | Montant | Statut (payé/attente/retard)     │
│       │   └── Lien "Voir tout" → /tenant/payments                │
│       │                                                          │
│       ├── [ZONE 5] CentreDeCommandes                             │
│       │   ├── Actions en attente (badges compteurs)              │
│       │   │   ├── Signer bail                                    │
│       │   │   ├── Déposer assurance                              │
│       │   │   ├── Signer EDL                                     │
│       │   │   └── Saisir relevé compteur                         │
│       │   └── Progression onboarding (si nouveau locataire)      │
│       │                                                          │
│       ├── [ZONE 6] Consommation                                  │
│       │   ├── ConsumptionChart (graphique 12 mois)               │
│       │   ├── Dernier relevé par compteur                        │
│       │   ├── Alerte si relevé > 90 jours                        │
│       │   └── [CTA] "Saisir un relevé" → Dialog ou /meters      │
│       │                                                          │
│       ├── [ZONE 7] FilActivite                                   │
│       │   ├── Événements temps réel (Supabase Realtime)          │
│       │   ├── Factures, tickets, notifications, documents        │
│       │   └── Liens contextuels vers chaque section              │
│       │                                                          │
│       └── [ZONE 8] PanneauSecondaire                             │
│           ├── CreditBuilderCard (score crédit)                   │
│           ├── Tips "Tom" (conseil personnalisé)                   │
│           └── QuickActions (raccourcis)                           │
│               ├── Nouvelle demande                                │
│               ├── Envoyer un message                              │
│               ├── Mes documents                                   │
│               └── Donner mon préavis                              │
└──────────────────────────────────────────────────────────────────┘
```

### Hooks et services cibles

```typescript
// Hooks existants à réutiliser
useTenantData()         // TenantDataProvider — données dashboard
useTenantRealtime()     // Supabase Realtime — événements live
useTenantNavBadges()    // Badges sidebar — messages/demandes
useTenantPaymentMethods()  // Moyens de paiement SEPA/CB
useTenantPendingActions()  // Actions en attente centralisées

// Hooks à créer
useNextRentDue()        // Calcul prochain loyer + countdown
useRecentPayments(3)    // 3 derniers paiements avec statuts
useMeterAlerts()        // Alertes relevés > 90 jours
useLeaseCountdown()     // Durée restante du bail
```

### Data flow cible

```
Server Component (page.tsx)
  └── fetchTenantDashboard() → RPC tenant_dashboard
       └── Returns: leases[], invoices[], tickets[], meters[],
                    notifications[], pending_edls[], insurance,
                    stats { unpaid_amount, monthly_rent }

  └── Passe à DashboardClient via TenantDataProvider
       └── Client Components utilisent useTenantData()
            └── Refresh via /api/tenant/dashboard (SWR/polling)
            └── Realtime via Supabase channels
```

---

## Annexe — Fichiers clés de l'architecture locataire

| Fichier | Rôle |
|---|---|
| `app/tenant/layout.tsx` | Layout serveur : auth, auto-linking, CSRF, data provider |
| `app/tenant/_data/TenantDataProvider.tsx` | Context React pour données dashboard |
| `app/tenant/_data/fetchTenantDashboard.ts` | Fetcher principal (~793 lignes) avec RPC + fallback direct |
| `components/layout/tenant-app-layout.tsx` | Sidebar/navigation (~445 lignes) |
| `features/tenant/services/meters.service.ts` | Service compteurs |
| `features/tenant/components/consumption-chart.tsx` | Graphique consommation (non branché sur /meters) |
| `features/tenant/components/TenantNoticeWizard.tsx` | Wizard préavis |
| `features/tenant/components/credit-builder-card.tsx` | Score crédit |
| `features/billing/services/payments.service.ts` | Service paiements |
| `features/tickets/services/tickets.service.ts` | Service tickets |
| `lib/hooks/use-tenant-pending-actions.ts` | Actions en attente centralisées |
| `lib/hooks/use-tenant-payment-methods.ts` | Gestion moyens de paiement |
| `lib/hooks/use-edl-meters.ts` | Hook EDL meters avec OCR |
| `middleware.ts` | Guard auth edge : cookie check, redirect |
