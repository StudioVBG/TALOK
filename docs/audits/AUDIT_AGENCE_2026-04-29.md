# 📋 Audit complet — Compte Agence Talok

**Date :** 29 avril 2026
**Branche :** `claude/audit-agency-account-vRinB`
**Périmètre audité :** `app/agency/`, `app/api/agency/`, `app/api/accounting/agency/`, `lib/accounting/`, `lib/rbac.ts`, `lib/subscriptions/`, `lib/stripe/`, `lib/hooks/use-agency-*`, migrations Supabase agency, white-label, IA TALO, schéma DB.

---

## 🚨 Score global : **3.5 / 10** — Module en alpha, NON-PRODUCTION

Le compte agence est une **coquille structurée** (navigation, routes, pages, migrations toutes présentes) mais :
- **7 pages sur 13 affichent du mock data hardcodé** ;
- **Les flux métier critiques** (reversement bancaire, commissions Stripe Connect, RBAC, plan tarifaire) **ne sont pas implémentés** ;
- **2 modèles de données** (`mandates` legacy + `agency_mandates` canonique) coexistent ;
- **4 fichiers de comptabilité agence sont en `@ts-nocheck`**.

---

## 🔴 Bloquants production (P0)

### 1. Sept pages affichent 100 % de données fictives

| Page | Tableau mock | Chemin |
|---|---|---|
| `/agency/commissions` | `mockCommissions` (84 lignes) | `app/agency/commissions/page.tsx:27-84` |
| `/agency/documents` | `mockDocuments` | `app/agency/documents/page.tsx:37-86` |
| `/agency/finances` | `mockTransactions` (sophir.bernard, lucas.petit) | `app/agency/finances/page.tsx:30-48` |
| `/agency/owners` | `mockOwners` (5 fictifs) | `app/agency/owners/page.tsx:32-89` |
| `/agency/tenants` | `mockTenants` | `app/agency/tenants/page.tsx:31-88` |
| `/agency/team` | `mockTeamMembers` | `app/agency/team/page.tsx:54-106` |
| `/agency/help` | `helpCategories` placeholder | `app/agency/help/page.tsx:18-63` |

Les filtres et stats sont calculés sur les mocks côté client — aucune API n'est appelée.

### 2. Reversement aux propriétaires : NON FONCTIONNEL

`app/api/agency/accounts/[id]/reverse/route.ts:99-100`

```
// TODO: Trigger actual bank transfer via payment provider
// TODO: Create accounting entry for the reversement
```

La balance est décrémentée en BDD mais **aucun virement n'est déclenché** et **aucune écriture comptable n'est créée**. ⚠️ **Non-conformité Hoguet totale** — impossible de prouver les flux mandants.

### 3. Aucun plan Stripe pour le rôle agency

- `lib/subscriptions/pricing-config.ts` (350 l.) ne contient **zéro mention "agency"** — pas de monétisation pour ce rôle.
- `lib/stripe/connect.service.ts:352-427` : la logique commission propriétaire est en commentaire, **aucun `stripe.transfers.create()` actif**.

### 4. RBAC : rôle "agency" absent de `ROLE_PERMISSIONS`

- `lib/rbac.ts` définit 12 rôles → **agency n'y est pas**.
- Conséquence : aucune feature (signature, IA, comptabilité, documents) n'est gatée par RBAC pour les agences.
- `lib/helpers/permissions.ts` (40 l.) ne contient pas non plus de helper agency.

### 5. Hook dashboard appelle des endpoints inexistants

`lib/hooks/use-agency-dashboard.ts` requête :
- `/agency/accounting/kpis`
- `/agency/accounting/mandants`
- `/agency/accounting/entries`

→ **Aucune de ces routes n'est implémentée dans `app/api/`** : KPIs et listes restent vides.

### 6. Settings agency : 100 % hardcodé, save factice

- `app/agency/settings/page.tsx:34-42` : `handleSave()` = `setTimeout(1000)` + toast succès → **rien n'est persisté**.
- `defaultValue` SIRET (`12345678901234`), TVA, e-mails, switches : tous fakes (l. 99-321).

### 7. Formulaire d'invitation collaborateur cassé

- `app/agency/team/page.tsx:157-182` : Dialog d'invitation soumet `setIsInviteDialogOpen(false)` — **aucun appel API**, l'invité ne reçoit jamais d'email.

---

## 🟠 Bugs graves (P1)

### 8. Deux tables de mandats coexistent

- `mandates` (migration `20251206700000_agency_module.sql`) — modèle legacy
- `agency_mandates` (migration `20260408120000_whitelabel_agency_module.sql`) — modèle canonique Hoguet

Le code API navigue entre les deux sans cohérence :
- `app/api/agency/dashboard/route.ts:60` lit `mandates`
- `app/api/agency/properties/route.ts:52` lit `mandates` + filtre `inclut_tous_biens` (champ legacy)
- `app/api/agency/accounts/[id]/reverse/route.ts:50-56` JOIN sur `agency_mandates` via FK incohérente

**Risque** : data leak inter-agences, résultats faux.

### 9. Rapport Hoguet : N+1 + tables fantômes

`app/api/accounting/agency/hoguet-report/route.ts`
- Boucle sur tous les mandants → 1 SELECT `crg_reports` par mandant (l. 307-318)
- Idem `accounting_entry_lines` (l. 226-256)
- Table `crg_reports` créée en migration mais **absente de `database.types.ts`** → résultats null silencieux + 50 mandants = 50 requêtes séquentielles.

### 10. CRG : charges hardcodées à 0

`app/api/agency/crg/generate/route.ts:138`

```
totalChargesPaidCents = 0; // À implémenter quand les dépenses owner seront tracées
```

→ **Tout CRG envoyé au mandant est faux** : aucune charge ne s'affiche.

### 11. Property matching CRG fragile

`lib/accounting/agency/crg-generator.ts:134-139` : extraction de `propertyId` depuis le label texte, **pas de FK lease ↔ mandate**. Échoue silencieusement si label malformé.

### 12. Cron mensuel reversement mal sécurisé

`app/api/cron/agency-monthly-reversements/route.ts:28-32` : `CRON_SECRET` optionnel, **dev mode = accès libre à `?dryRun=true`**.

### 13. Statut "pending_signature" UI / "draft" DB

`app/agency/mandates/page.tsx:94-96` + l. 260 : option UI "En attente signature" mais l'enum DB `agency_mandates` ne supporte pas ce statut → confusion legacy.

### 14. Quatre fichiers comptabilité agency en `@ts-nocheck`

| Fichier | Ligne |
|---|---|
| `app/agency/accounting/AgencyAccountingDashboardClient.tsx` | 2 |
| `app/agency/accounting/crg/CRGClient.tsx` | 2 |
| `app/agency/accounting/hoguet/HoguetClient.tsx` | 2 |
| `app/agency/accounting/mandants/[id]/MandantDetailClient.tsx` | 2 |

Commentaire commun : `TODO: remove once database.types.ts is regenerated`. **Toute la couche comptabilité agence est non-typée**.

### 15. `(supabase as any)` & `GenericRowType` partout

- `lib/accounting/mandant-reversement-entry.ts:110, 130, 184, 192`
- `lib/accounting/mandant-payment-entry.ts:106, 206, 349, 355, 362`
- `agency_commissions`, `agency_profiles`, `mandant_accounts` typés `Record<string, unknown>` dans `database.types.ts`.

### 16. Bug SELECT JOIN reversement

`app/api/agency/accounts/[id]/reverse/route.ts:50-56` : Join `agency_mandates!agency_mandant_accounts_mandate_id_fkey` mais la FK est définie côté `mandates` legacy → mismatch.

---

## 🟡 Fonctionnalités non terminées (P2)

### 17. Carte professionnelle "Carte G" non collectée

- Migrations exposent `legal_entities.carte_g_numero`, `caisse_garantie`
- L'**onboarding agency** (`app/agency/onboarding/profile/page.tsx`) ne demande **ni carte G, ni garantie financière**.
- Compliance Hoguet incomplet.

### 18. IA TALO : zéro intégration côté agency

- Aucun match dans `lib/ai/`, `lib/talo/` pour "agency".
- Le tour guidé annonce "Assistant TALO" mais la feature n'est **pas câblée pour ce rôle**.

### 19. Boutons sans handler (UI morte)

| Élément | Fichier:ligne |
|---|---|
| "Importer" documents | `app/agency/documents/page.tsx:123` |
| Dropdowns Aperçu / Télécharger documents | `app/agency/documents/page.tsx:194, 253` |
| "Exporter" finances | `app/agency/finances/page.tsx:79` |
| "Exporter" commissions | `app/agency/commissions/page.tsx:127` |
| Card "Chat en direct" support | `app/agency/help/page.tsx:84` |
| Card "Appelez-nous" | `app/agency/help/page.tsx:95` |
| Card "Email support" | `app/agency/help/page.tsx:106` |

### 20. Endpoints CRUD partiels

- Pas de `DELETE` pour `/api/agency/profile` — impossible de supprimer.
- Pas de `PUT/DELETE` propre pour `/api/agency/mandates` — soft-delete absent.
- Pas de `PATCH` pour corriger un CRG après génération.
- Pas de transition `expired` pour mandats (enum prévu, jamais posé).

### 21. Email d'invitation non bloquant

`app/api/agency/invitations/route.ts:140-188` : invitation marquée créée même si Resend échoue → **invité jamais notifié**, aucun retry.

### 22. Multi-entité ambigu

3 terminologies pour le même concept :
- UI utilise `owner.name` → `app/agency/mandates/page.tsx:59`
- Hooks parlent de `MandantCard` → `lib/hooks/use-agency-dashboard.ts:36`
- DB parle de `agency_mandant_accounts`

→ Risque de fuite de données entre agences si scoping mal fait.

### 23. Doublon RBAC

`lib/rbac.ts` (matrice complète) vs `lib/helpers/permissions.ts` (40 l., 6 helpers) — pas clair lequel fait foi pour agency.

### 24. DomainVerifier (white-label) non vérifié

`app/agency/_components/DomainVerifier.tsx` importé dans branding mais le contenu fonctionnel n'a pas pu être validé.

### 25. N+1 sur `/api/agency/properties`

`app/api/agency/properties/route.ts` charge mandates → filtre ownerIds → query properties → puis pour chaque property : appel séparé à `leases` (l. 119-140) + appel async `fetchPropertyCoverUrls` (l. 153-161).

### 26. Pas de validation Zod sur plusieurs POST

À auditer plus finement, mais plusieurs routes acceptent un body sans validation stricte (ex. `accounts/route.ts`).

---

## 🟢 Ce qui fonctionne bien

- ✅ Navigation sidebar complète (13 items, mappés aux 26 pages existantes)
- ✅ Onboarding signup → role → profile (validations SIRET 14 chiffres, CP 5 chiffres)
- ✅ 8 templates emails agency : `agency-daily-recap`, `agency-monthly-recap`, `agency-tracfin-alert`, `agency-carte-g-expiry`, `agency-crg-available`, `agency-reversal-late`
- ✅ Schéma DB white-label (`agency_white_labels` + custom domain via middleware)
- ✅ Détection custom domain dans `middleware.ts:84-101`
- ✅ Tour guidé agency configuré
- ✅ Pages onboarding mandates / team / review présentes
- ✅ Migrations `20260408110000_agency_hoguet.sql` + `20260408120000_whitelabel_agency_module.sql` en place
- ✅ Routes API `mandates`, `terminate`, `reversement`, `crg/generate`, `crg/[id]/send`, `invitations` correctement structurées (auth, Zod validés sur la majorité)

---

## 📊 Synthèse priorisée — Plan de remédiation

| # | Action | Effort | Priorité |
|---|---|---|---|
| 1 | Brancher les 7 pages mock sur les vraies APIs (owners, tenants, team, finances, commissions, documents, help) | 5-7 j | **P0** |
| 2 | Implémenter le virement Stripe + écriture comptable sur `/accounts/[id]/reverse` | 3 j | **P0** |
| 3 | Définir `ROLE_PERMISSIONS["agency"]` dans `lib/rbac.ts` | 1 j | **P0** |
| 4 | Créer un plan Stripe agency (Connect + commissions reversals) dans `pricing-config.ts` | 3-5 j | **P0** |
| 5 | Câbler `app/agency/settings` au backend (vraie mutation API) | 1 j | **P0** |
| 6 | Câbler `team/invite` à `/api/agency/invitations` | 0.5 j | **P0** |
| 7 | Décider `mandates` vs `agency_mandates`, supprimer le legacy | 2 j | **P1** |
| 8 | Régénérer `database.types.ts` → retirer 4 `@ts-nocheck` + casts `any` | 0.5 j | **P1** |
| 9 | Créer `/api/agency/accounting/{kpis,mandants,entries}` attendus par le hook dashboard | 2 j | **P1** |
| 10 | Implémenter charges réelles dans CRG (`crg/generate:138`) | 2 j | **P1** |
| 11 | Sécuriser cron `agency-monthly-reversements` (CRON_SECRET obligatoire) | 0.5 h | **P1** |
| 12 | Corriger N+1 sur `/api/agency/properties` et `/api/accounting/agency/hoguet-report` | 1 j | **P1** |
| 13 | Ajouter Carte G + garantie financière à l'onboarding | 1 j | **P2** |
| 14 | Brancher IA TALO pour le rôle agency | 3-5 j | **P2** |
| 15 | Câbler les ~10 boutons sans handler | 1 j | **P2** |
| 16 | Email invitation bloquant + retry Resend | 0.5 j | **P2** |
| 17 | Clarifier scoping multi-mandant (terminologie unifiée) | 1 j | **P2** |

**Estimation totale pour atteindre une production-ready agency** : **~25-30 j-homme**.

---

## Conclusion

Le module agence dispose d'un **squelette technique complet** (migrations, navigation, routes API squelettes, templates emails, tour guidé) mais **toute la chaîne de valeur métier — reversement, commissions, CRG, RBAC, monétisation — est soit mockée, soit absente, soit cassée**. À ce stade, il ne peut **pas** être proposé en production à des administrateurs de biens : risque réglementaire (Hoguet), risque comptable (écritures absentes), risque commercial (pas de plan).

Une refonte coordonnée backend + frontend de 25-30 j permettrait d'atteindre une v1 vendable, avec en priorité absolue : RBAC, plan Stripe, reversement réel, branchement des 7 pages mock.
