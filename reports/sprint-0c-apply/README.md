# Sprint 0.c — Apply en prod

**Branche** : `feat/charges-regul-sprint-0c-rescue`
**Date préparation** : 2026-04-18
**Statut** : ⏸️ **PRÉPARATION LIVRÉE — EXÉCUTION PROD EN ATTENTE**

---

## ⚠️ Ce livrable n'a PAS exécuté les migrations en prod

La session Claude Code n'a **aucun outil MCP Supabase** (ni lecture ni écriture) disponible. Il ne peut donc pas cliquer "Run" dans le SQL Editor en prod, ni snapshotter l'état avant/après.

**Ce qui a été fait** (PASS 0) :
- ✅ Migrations localisées + dumps exacts sauvegardés (`01-migration-rls.sql`, `02-migration-backfill.sql`)
- ✅ Snapshots "avant" préparés sous forme de queries SQL prêtes à Run
- ✅ Templates de validation PASS 1 / PASS 2 / PASS 3 avec queries + grilles de check
- ✅ `rollback.sql` dormant avec 2 blocs (RLS + backfill) + garde-fou anti-restauration du bug P0 #4

**Ce qui reste à faire** (par Thomas, dans le SQL Editor prod) :
1. Lancer les 3 snapshots de `03-before.md` → coller les outputs
2. Coller + Run `01-migration-rls.sql` → remplir `04-after-rls.md`
3. Coller + Run `02-migration-backfill.sql` → remplir `05-after-backfill.md`
4. Relancer les snapshots → remplir le delta de `06-after-global.md`
5. Smoke test applicatif (section 3.2 de `06-after-global.md`)
6. Écrire le verdict final dans ce README (voir plus bas)
7. Commit d'update + push

---

## Contenu du dossier

| Fichier | Rôle | État |
|---|---|---|
| `01-migration-rls.sql` | Dump migration RLS (commit `7aac8ed`) | ✅ prêt |
| `02-migration-backfill.sql` | Dump migration PCG (commit `56ef301`) | ✅ prêt |
| `03-before.md` | Snapshots avant + checklist GO/NO-GO PASS 1 | ⏳ à compléter |
| `04-after-rls.md` | Validation post-RLS | ⏳ à compléter |
| `05-after-backfill.md` | Validation post-backfill | ⏳ à compléter |
| `06-after-global.md` | Delta global + smoke test | ⏳ à compléter |
| `rollback.sql` | Rollback dormant | ✅ prêt (NE PAS EXÉCUTER sauf pépin) |
| `README.md` | Ce fichier | ⏳ verdict à inscrire |

---

## Workflow d'exécution (rappel)

```
┌──────────────────────────────────────────────────────────┐
│ PASS 0 — Snapshots AVANT (03-before.md)                 │
│   Cliquer Run sur les 3 blocs SQL, coller les outputs    │
│   Valider la checklist GO/NO-GO                          │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼ GO
┌──────────────────────────────────────────────────────────┐
│ PASS 1 — Migration RLS (01-migration-rls.sql)           │
│   Coller + Run                                           │
│   Vérifier output = DROP POLICY / CREATE POLICY / COMMENT│
│   Lancer la query de vérification (04-after-rls.md §1.3) │
│   Remplir 04-after-rls.md                                │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼ ✅  (si ❌ → rollback PASS 1 + STOP)
┌──────────────────────────────────────────────────────────┐
│ PASS 2 — Migration backfill (02-migration-backfill.sql) │
│   Coller + Run                                           │
│   Vérifier output = INSERT 0 N / INSERT 0 N              │
│   Lancer la query de vérification (05-after-backfill.md) │
│   Remplir 05-after-backfill.md                           │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼ ✅  (si ❌ → rollback PASS 2 seul)
┌──────────────────────────────────────────────────────────┐
│ PASS 3 — Validation globale + smoke test                 │
│   Re-run snapshots pour delta (06-after-global.md)       │
│   Naviguer UI owner /owner/properties/[id]/charges/reg   │
│   Vérifier Sentry 30 min (42501, 42P17, 23514)          │
│   Remplir 06-after-global.md                             │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ PASS 4 — Verdict final + commit                          │
│   Inscrire le verdict dans ce README                     │
│   Commit: docs(sprint-0c-apply): ...                     │
│   Push sur feat/charges-regul-sprint-0c-rescue           │
└──────────────────────────────────────────────────────────┘
```

---

## Règles de rollback (rappel du prompt)

| Scénario | Action |
|---|---|
| PASS 1 échoue | STOP. Rollback PASS 1 via `rollback.sql` bloc RLS. Pas de PASS 2. Investigation. |
| PASS 2 échoue, PASS 1 OK | Garder PASS 1 appliqué (critique : fixe un bug RLS qui bloque des users). Rollback PASS 2 seul. Investigation. |
| Smoke test révèle une anomalie | Analyser selon la nature. Ne pas rollback automatiquement — la RLS assouplie et les comptes PCG sont deux corrections indépendantes et utiles. |

---

## Verdict final

> ⚠️ **À inscrire par Thomas après exécution.** Une des 3 phrases suivantes :

- [ ] ✅ **"Sprint 0.c appliqué avec succès en prod. P0 #3 et P0 #4 fermés. Prêt pour Sprint 0.d."**
- [ ] ⚠️ **"Sprint 0.c appliqué partiellement. Anomalies : [liste]. Investigation requise avant Sprint 0.d."**
- [ ] 🔴 **"Sprint 0.c échec. Rollback exécuté via rollback.sql. Investigation urgente."**

### Journal d'exécution (à compléter)

| Étape | Date / Heure | Résultat |
|---|---|---|
| PASS 0 snapshots avant | | |
| PASS 1 migration RLS | | |
| PASS 2 migration backfill | | |
| PASS 3 smoke test | | |

---

## Après verdict ✅

Si verdict ✅, démarrer Sprint 0.d (migration colonnes settle + route `/apply` canonique). Prompt Sprint 0.d reste à écrire — les pré-requis sont documentés dans `reports/audit-charges/07-settle-trigger-design.md`.
