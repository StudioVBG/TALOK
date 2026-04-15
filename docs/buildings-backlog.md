# Module Buildings — Backlog différé (post audit 2026-04)

> Items identifiés par l'audit mais **volontairement non implémentés** par
> les phases 1-5 parce que :
> - le besoin métier n'est pas encore confirmé (#19), OU
> - le ROI MVP est trop faible (#23).
>
> À reprendre si les conditions de déclenchement listées ci-dessous sont
> atteintes.

---

## #19 — Route `POST /api/properties/[id]/associate-building`

**Effort estimé** : M (0.5–1j)
**Priorité audit** : P2
**Statut** : ❌ Non implémenté — **en attente de confirmation métier**

### Description

Permettre de rattacher une `property` existante (un bien unitaire déjà créé)
à un immeuble existant, transformant la property en lot. Concrètement :
- Body : `{ building_id: string }`
- Crée un `building_unit` lié au building + à la property source
- Met à jour `buildings.property_id` si c'est le premier rattachement
- Positionne `properties.parent_property_id` vers le wrapper de l'immeuble

### Conditions de déclenchement

Implémenter si **au moins un** de ces signaux émerge :
1. Un propriétaire demande à regrouper ses biens éparpillés dans une vue
   "immeuble" a posteriori (pas lors de la création)
2. Import d'un portefeuille existant depuis un concurrent qui expose les
   biens comme unitaires mais réellement groupés
3. Migration SCI : un propriétaire crée sa SCI après avoir déjà saisi ses
   biens en direct et veut les rattacher

### Risques / complexité

- **RLS** : la property source peut avoir un `owner_id` différent du
  `building.owner_id` → refuser le rattachement dans ce cas
- **Quota** : la property reste comptée dans le quota même après
  rattachement (les lots comptent dans le quota — cf. `check-limit.ts`)
- **Baux actifs** : si la property source a un bail actif, il faut
  décider si on le conserve et le lier au nouveau `building_unit.id`
  via `leases.building_unit_id`, ou si on refuse l'association

### Alternatives déjà en place

- Le workflow actuel suffit : créer l'immeuble, puis ajouter les lots
  via `/owner/buildings/[id]/units` (`UnitsManagementClient`)
- Pas de demande utilisateur remontée à date (avril 2026)

---

## #23 — Draft serveur pour édition lots

**Effort estimé** : L (1–3j)
**Priorité audit** : P2
**Statut** : ❌ Reporté — ROI MVP trop faible

### Description

Aujourd'hui, `UnitsManagementClient` garde les modifications en mémoire
React tant que l'utilisateur n'a pas cliqué "Enregistrer". Si la page est
fermée / rafraîchie / si le navigateur crashe, les modifications en cours
sont perdues.

La feature consisterait à :
- Auto-saver dans une table `building_drafts` à chaque changement
  (debounced), avec un état par `building_id` + `user_id`
- Proposer de restaurer le draft à l'ouverture de
  `/owner/buildings/[id]/units`
- Option "Abandonner le draft" pour nettoyer

### Conditions de déclenchement

Implémenter si **au moins un** de ces signaux :
1. Les utilisateurs rapportent des pertes de modifications (ticket
   support, NPS, analytics `page_abandonment_during_edit`)
2. Les sessions d'édition dépassent régulièrement 10 minutes (→ risque
   de perte plus élevé)
3. Demande récurrente en retours utilisateurs sur le hub immeuble

### Alternatives déjà en place

- Pour créer un immeuble complet : le wizard a déjà son propre draft
  serveur (via `initializeDraft` + `updateFormData` debounce dans
  `wizard-store.ts`)
- L'édition des lots via `UnitsManagementClient` reste relativement
  rapide (moins de 3 minutes pour 10 lots)
- Le risque de perte est tangible mais limité aux modifications
  pendant la session d'édition

---

## Note sur les items non-phasés

Tous les autres items du tableau Axe 6 de l'audit ont été livrés via les
Phases 1 à 5. Voir :
- Migrations : `supabase/migrations/20260415140000_*`,
  `20260415150000_*`, `20260415160000_*`
- Routes API : `app/api/properties/[id]/building-units/route.ts` (RPC),
  `app/api/properties/[id]/building-unit/route.ts` (Phase 5)
- Frontend : `BuildingConfigStep.tsx`, `BuildingDetailClient.tsx`,
  `LotCharacteristicsDrawer.tsx`, `LeaseWizard.tsx`,
  `PropertyDetailsClient.tsx`
- Doc : `docs/api-buildings.md`
