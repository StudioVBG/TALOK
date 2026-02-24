# Rapport des corrections — Audit SOTA 2026

**Date :** 2026-02-30  
**Périmètre :** Corrections issues des rapports d'audit (phases 1 à 4).

---

## 1. Résumé exécutif

- **15 corrections** planifiées ont été réalisées.
- **291 tests unitaires** passent (dont les nouveaux et les mis à jour).
- Aucune régression constatée sur les fichiers modifiés (lints OK).

---

## 2. Phase 1 — Corrections critiques (P0)

### 2.1 Inconsistance des statuts de bail

- **Fichier :** `lib/types/status.ts`
- **Modifications :** Ajout des statuts `sent`, `pending_owner_signature`, `amended`, `cancelled` au type `LeaseStatus`, et mise à jour de `LEASE_STATUS_LABELS` et `LEASE_STATUS_VARIANTS`.
- **Impact :** Alignement avec `lib/constants/roles.ts` et `lib/validations/index.ts` ; badges et filtres cohérents partout.

### 2.2 Notification ID (profile_id / user_id)

- **Fichiers :**
  - `supabase/migrations/20260230100000_create_notification_resolve_profile_id.sql` : la RPC `create_notification` résout désormais `user_id` à partir de `profile_id` quand un profil correspond à `p_recipient_id`, et remplit les deux colonnes.
  - `lib/services/notification-service.ts` : résolution `profile_id` → `user_id` avant insert, et utilisation de `is_read`.
  - `app/api/tenant/link-property/route.ts` : passage de `ownerProfile.user_id` (au lieu de `property.owner_id`) à la RPC.
- **Impact :** Les notifications créées par les triggers (tenant) et par le lien logement sont correctement visibles (RLS et cloche).

### 2.3 Notification à l’acceptation d’invitation

- **Fichier :** `app/api/invitations/accept/route.ts`
- **Modifications :** Après liaison du `lease_signers`, envoi d’une notification au propriétaire (type `tenant_invitation_accepted`) avec récupération de l’owner via lease → property.
- **Impact :** Le propriétaire est notifié quand un locataire accepte l’invitation.

---

## 3. Phase 2 — Corrections hautes (P1)

### 3.1 N+1 sur fetchOwnerTenants

- **Fichier :** `app/owner/tenants/page.tsx`
- **Modifications :** Une seule requête batch sur `invoices` pour tous les `lease_id` concernés ; agrégation en mémoire par clé `lease_id-tenant_id`.
- **Impact :** Moins de requêtes DB, meilleures perfs sur la page « Mes locataires ».

### 3.2 Message d’état vide

- **Fichier :** `app/owner/tenants/TenantsClient.tsx`
- **Modifications :** Texte remplacé par : « Aucun locataire pour le moment. Créez un bail et invitez vos locataires pour les voir ici. »
- **Impact :** Message adapté (bail + invitation), plus de confusion avec le cas « bail signé ».

### 3.3 Typage (suppression des any)

- **Fichier :** `app/owner/tenants/page.tsx`
- **Modifications :** Interfaces `LeaseSignerRow`, `LeaseSignerProfile`, `InvoiceRow` ; typage explicite des signers et des lignes factures.
- **Impact :** Meilleure sécurité de typage et maintenabilité.

### 3.4 Gestion d’erreur sur les factures

- **Fichier :** `app/owner/tenants/page.tsx`
- **Modifications :** `console.warn` en cas d’erreur sur la requête batch `invoices`.
- **Impact :** Erreurs visibles en log sans faire échouer la page.

---

## 4. Phase 3 — Corrections moyennes (P2)

### 4.1 CTA inactifs

- **Fichiers :** `app/tenant/rewards/page.tsx`, `app/tenant/marketplace/page.tsx`, `app/tenant/help/page.tsx`, `app/tenant/meters/page.tsx`
- **Modifications :** Boutons / cartes concernés désactivés ou en lecture seule, avec tooltip « Bientôt disponible » (TooltipProvider + TooltipTrigger + TooltipContent).
- **Impact :** L’utilisateur comprend que la fonctionnalité est à venir au lieu de cliquer sans effet.

### 4.2 Déduplication messages owner/tenant

- **Fichiers :**
  - `components/messages/MessagesPageContent.tsx` (nouveau) : composant partagé avec `subtitle` et `onNotAuthenticated` optionnel.
  - `app/tenant/messages/page.tsx` et `app/owner/messages/page.tsx` : réécrits pour utiliser ce composant (sous-titres et redirect signin côté owner).
- **Impact :** Une seule source de vérité pour la messagerie ; maintenance simplifiée.

### 4.3 Stats mockées (visites)

- **Fichier :** `app/tenant/visits/page.tsx`
- **Modifications :** Les trois cartes (En attente, Confirmées, Effectuées) affichent « Aucune donnée » au lieu de « - ».
- **Impact :** Libellé plus clair tant que les stats ne sont pas branchées au backend.

---

## 5. Phase 4 — Tests unitaires

### 5.1 Status helpers

- **Fichier :** `tests/unit/status-helpers.test.ts`
- **Modifications :** Ajout de tests pour `sent`, `pending_owner_signature`, `amended`, `cancelled` ; mise à jour du jeu de statuts dans le test de cohérence.

### 5.2 resolveTenantDisplay

- **Fichier :** `tests/unit/resolve-tenant-display.test.ts` (nouveau)
- **Couverture :** Signer null/undefined, profil complet, `invited_name` seul, `invited_email` seul (vrai email et placeholder), `resolveTenantFullName`.

### 5.3 Logique de transformation (score, id, statut)

- **Fichiers :**
  - `lib/helpers/tenant-score.ts` (nouveau) : `computeTenantScore`, `getTenantDisplayId`, `getTenantLeaseStatus`.
  - `tests/unit/tenant-score.test.ts` (nouveau) : tests pour ces trois fonctions.
  - `app/owner/tenants/page.tsx` : utilisation de ces helpers pour centraliser la logique.
- **Impact :** Comportement de la liste locataires couvert par les tests et factorisé.

---

## 6. Résultats des tests

```
Test Files  20 passed (20)
     Tests  291 passed (291)
  Duration  ~1.8s
```

- Aucun test en échec.
- Nouveaux fichiers de tests : `resolve-tenant-display.test.ts`, `tenant-score.test.ts`.
- Fichier mis à jour : `status-helpers.test.ts`.

---

## 7. Fichiers créés ou modifiés (liste)

| Fichier | Action |
|--------|--------|
| `lib/types/status.ts` | Modifié |
| `supabase/migrations/20260230100000_create_notification_resolve_profile_id.sql` | Créé |
| `lib/services/notification-service.ts` | Modifié |
| `app/api/tenant/link-property/route.ts` | Modifié |
| `app/api/invitations/accept/route.ts` | Modifié |
| `app/owner/tenants/page.tsx` | Modifié |
| `app/owner/tenants/TenantsClient.tsx` | Modifié |
| `app/tenant/rewards/page.tsx` | Modifié |
| `app/tenant/marketplace/page.tsx` | Modifié |
| `app/tenant/help/page.tsx` | Modifié |
| `app/tenant/meters/page.tsx` | Modifié |
| `app/tenant/visits/page.tsx` | Modifié |
| `components/messages/MessagesPageContent.tsx` | Créé |
| `app/tenant/messages/page.tsx` | Modifié |
| `app/owner/messages/page.tsx` | Modifié |
| `lib/helpers/tenant-score.ts` | Créé |
| `tests/unit/status-helpers.test.ts` | Modifié |
| `tests/unit/resolve-tenant-display.test.ts` | Créé |
| `tests/unit/tenant-score.test.ts` | Créé |

---

## 8. Corrections différées (hors périmètre)

- Refactoring des très gros fichiers (ex. DashboardClient, billing).
- Pagination serveur des listes.
- Migration SSR/CSR (pages actuellement en "use client").
- 2FA, backend marketplace, cron de réconciliation.

---

## 9. Recommandations post-déploiement

1. **Migration SQL :** Exécuter `20260230100000_create_notification_resolve_profile_id.sql` sur l’environnement cible (Supabase).
2. **Notifications :** Vérifier en staging que les notifications « Invitation acceptée » et « Nouveau locataire lié » s’affichent bien pour le propriétaire.
3. **Page locataires :** Contrôler avec plusieurs baux/factures que la liste et les scores s’affichent correctement et que les perfs restent bonnes.
