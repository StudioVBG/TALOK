# Sprint A — PASS 3 : Les « 5 phase files »

## Verdict

✅ **Les 5 phase files sont localisés dans `supabase/apply_scripts/`**.

Ce sont des scripts SQL consolidés générés manuellement entre février et mars 2026 pour appliquer des groupes de migrations via le SQL Editor de Supabase. Ils sont explicitement préfixés `APPLY_PENDING_` ou `APPLY_ALL_PENDING_`, contiennent les migrations inline (copiées telles quelles), avec des `RAISE NOTICE` pour suivre la progression.

## Les 5 fichiers

| # | Fichier | Lignes | Migrations couvertes | Période |
|---|---|---:|---|---|
| 1 | `APPLY_PENDING_PART1_FEB16_21.sql` | 2 747 | ~12 | 16→21 fév 2026 |
| 2 | `APPLY_PENDING_PART2_FEB21_23.sql` | 1 604 | ~8 | 21→23 fév 2026 |
| 3 | `APPLY_PENDING_PART3_FEB23_28.sql` | 1 348 | ~7 | 23→28 fév 2026 |
| 4 | `APPLY_ALL_PENDING_FEB23.sql` | 5 850 | **32** (16→28 fév) | Consolidé = PART1+2+3 |
| 5 | `APPLY_PENDING_MARCH_2026.sql` | 1 804 | **15** | 29 fév → 06 mars 2026 |

**Total couvert : ~47 migrations uniques sur la période fév 16 → mars 6 2026.**

En-tête du consolidé FEB23 :
```
-- SCRIPT CONSOLIDÉ — 32 MIGRATIONS EN ATTENTE
-- Date de génération: 2026-02-23 00:20
```

En-tête MARCH 2026 :
```
-- SCRIPT CONSOLIDÉ — 15 MIGRATIONS EN ATTENTE
-- Date de génération: 2026-03-06
-- CONTENU (15 migrations, du 29/02 au 06/03)
```

## État d'application (présumé)

Les en-têtes annoncent qu'ils concernent des migrations « en attente » à leur date de génération. Aucun marqueur ne prouve qu'ils aient été exécutés en prod.

**Hypothèse** (à confirmer via PASS 6) :
- Si le cutoff d'application est `20260208024659` (info utilisateur), alors **AUCUN** de ces 5 phase files n'a été joué en prod — ils couvrent tous des migrations ≥ 20260216.
- Si les en-têtes correspondent à la réalité, il existe potentiellement un 6ᵉ script plus récent qui n'a pas été retrouvé.

## Fichiers voisins dans `supabase/apply_scripts/`

Autres scripts dans le même dossier (pas des "phase files" au sens strict mais à documenter) :

```
APPLY_NOW_ALL_PENDING.sql           (480 lignes)  → probablement un wrapper orchestrateur
APPLY_AUDIT_REPAIR_PROFILES.sql     (79 lignes)   → réparation ponctuelle
APPLY_TENANT_AUDIT_T33nc.sql        (266 lignes)  → audit ciblé
audit_integrity_all_in_one.sql      → script d'audit SELECT-only
batch_01.sql … batch_05.sql         → 5 autres batches (different naming — ~7k lignes chacun)
batch_pending_01.sql … 04.sql       → 4 batches "pending" distincts
FIX_PROFILES_RLS_NOW.sql            → fix RLS ad-hoc
```

Et dans `supabase/` (racine, hors `apply_scripts/`) :
```
apply-batch-01.sql  … apply-batch-07.sql   → 7 batches consolidés (~3.5k lignes chacun)
apply_20260215_all_fixes.sql               → consolidé fixes 15 fév
fix-expired-subscriptions.sql              → fix ponctuel
fix-lease-da2eb9da.sql                     → fix d'un bail précis
APPLY_FIX_MIGRATION.md                     → README accompagnant un fix
```

Dans `supabase/fixes/` (24 fichiers SQL) :
```
APPLY_ALL_MIGRATIONS.sql   → 29k+ lignes, dump intégral historique (référence)
CRITICAL_FIX.sql
FIX_AUTH_500_ERROR.sql     ... etc.
```

## Implications pour Sprint B

1. **Ne PAS rejouer bêtement** ces phase files : certains contenus ont peut-être été retouchés depuis dans les fichiers `supabase/migrations/*.sql` canoniques.
2. **Source de vérité = `supabase/migrations/*.sql`**, pas les consolidés. Les apply_scripts sont des archives.
3. **Risque de divergence** : si un phase file FEB23 contient une version V1 d'une migration et que le fichier `supabase/migrations/20260216500000_xxx.sql` a été édité post-génération (V2), rejouer le phase file applique V1 et rate V2.
4. **Ces fichiers peuvent servir de check de cohérence** : comparer leur contenu avec les `.sql` canoniques pour détecter des édits silencieux.

## Git log : phases mentionnées

Recherche `git log --grep="phase"` :
```
6a05b93 docs(buildings): phase 6 - backlog items différés #19 et #23
4242294 fix(buildings): phase 5 - bail, navigation et RLS entity_members
db4018e fix(buildings): phase 4 - hub immeuble complet
6cccbe9 fix(buildings): phase 3 - wizard immeuble complet
e9fd849 fix(buildings): phase 2 - RPC transactionnelle et garde baux actifs
160a504 Merge pull request #398 from StudioVBG/claude/buildings-phase-1-hub
```

Ces « phases » font référence au module **buildings** (6 phases de refactor), pas à un plan d'application de migrations.

Aucun commit ne référence un plan d'application phasé des migrations en attente.
