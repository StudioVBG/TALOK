# Sprint B2 — Index des batches à coller

**46 batches** à appliquer dans l'ordre.

| # | Phase | Batch | Fichier | Migrations | Taille |
|---:|---|---|---|---:|---:|
| 1 | SAFE | 1/10 | `phase1-safe-batch-01.sql` | 5 | 66.3 KB |
| 2 | SAFE | 2/10 | `phase1-safe-batch-02.sql` | 5 | 10.3 KB |
| 3 | SAFE | 3/10 | `phase1-safe-batch-03.sql` | 5 | 16.4 KB |
| 4 | SAFE | 4/10 | `phase1-safe-batch-04.sql` | 5 | 11.3 KB |
| 5 | SAFE | 5/10 | `phase1-safe-batch-05.sql` | 5 | 10.4 KB |
| 6 | SAFE | 6/10 | `phase1-safe-batch-06.sql` | 5 | 10.8 KB |
| 7 | SAFE | 7/10 | `phase1-safe-batch-07.sql` | 5 | 19.9 KB |
| 8 | SAFE | 8/10 | `phase1-safe-batch-08.sql` | 5 | 16.9 KB |
| 9 | SAFE | 9/10 | `phase1-safe-batch-09.sql` | 5 | 18.4 KB |
| 10 | SAFE | 10/10 | `phase1-safe-batch-10.sql` | 1 | 3.6 KB |
| 11 | MODERE | 1/15 | `phase2-modere-batch-01.sql` | 5 | 70.5 KB |
| 12 | MODERE | 2/15 | `phase2-modere-batch-02.sql` | 5 | 29.5 KB |
| 13 | MODERE | 3/15 | `phase2-modere-batch-03.sql` | 5 | 39.0 KB |
| 14 | MODERE | 4/15 | `phase2-modere-batch-04.sql` | 5 | 17.9 KB |
| 15 | MODERE | 5/15 | `phase2-modere-batch-05.sql` | 5 | 12.5 KB |
| 16 | MODERE | 6/15 | `phase2-modere-batch-06.sql` | 5 | 39.4 KB |
| 17 | MODERE | 7/15 | `phase2-modere-batch-07.sql` | 5 | 14.4 KB |
| 18 | MODERE | 8/15 | `phase2-modere-batch-08.sql` | 5 | 7.7 KB |
| 19 | MODERE | 9/15 | `phase2-modere-batch-09.sql` | 5 | 9.9 KB |
| 20 | MODERE | 10/15 | `phase2-modere-batch-10.sql` | 5 | 15.3 KB |
| 21 | MODERE | 11/15 | `phase2-modere-batch-11.sql` | 5 | 17.2 KB |
| 22 | MODERE | 12/15 | `phase2-modere-batch-12.sql` | 5 | 36.7 KB |
| 23 | MODERE | 13/15 | `phase2-modere-batch-13.sql` | 5 | 35.4 KB |
| 24 | MODERE | 14/15 | `phase2-modere-batch-14.sql` | 5 | 28.3 KB |
| 25 | MODERE | 15/15 | `phase2-modere-batch-15.sql` | 5 | 29.1 KB |
| 26 | DANGEREUX | 1/11 | `phase3-dangereux-batch-01.sql` | 5 | 45.5 KB |
| 27 | DANGEREUX | 2/11 | `phase3-dangereux-batch-02.sql` | 5 | 36.4 KB |
| 28 | DANGEREUX | 3/11 | `phase3-dangereux-batch-03.sql` | 5 | 37.0 KB |
| 29 | DANGEREUX | 4/11 | `phase3-dangereux-batch-04.sql` | 5 | 22.6 KB |
| 30 | DANGEREUX | 5/11 | `phase3-dangereux-batch-05.sql` | 5 | 23.1 KB |
| 31 | DANGEREUX | 6/11 | `phase3-dangereux-batch-06.sql` | 5 | 66.6 KB |
| 32 | DANGEREUX | 7/11 | `phase3-dangereux-batch-07.sql` | 5 | 33.6 KB |
| 33 | DANGEREUX | 8/11 | `phase3-dangereux-batch-08.sql` | 5 | 30.9 KB |
| 34 | DANGEREUX | 9/11 | `phase3-dangereux-batch-09.sql` | 5 | 47.4 KB |
| 35 | DANGEREUX | 10/11 | `phase3-dangereux-batch-10.sql` | 5 | 40.8 KB |
| 36 | DANGEREUX | 11/11 | `phase3-dangereux-batch-11.sql` | 1 | 2.8 KB |
| 37 | CRITIQUE | 1/10 | `phase4-critique-batch-01.sql` | 5 | 108.0 KB |
| 38 | CRITIQUE | 2/10 | `phase4-critique-batch-02.sql` | 5 | 64.2 KB |
| 39 | CRITIQUE | 3/10 | `phase4-critique-batch-03.sql` | 5 | 27.1 KB |
| 40 | CRITIQUE | 4/10 | `phase4-critique-batch-04.sql` | 5 | 38.6 KB |
| 41 | CRITIQUE | 5/10 | `phase4-critique-batch-05.sql` | 5 | 31.6 KB |
| 42 | CRITIQUE | 6/10 | `phase4-critique-batch-06.sql` | 5 | 18.5 KB |
| 43 | CRITIQUE | 7/10 | `phase4-critique-batch-07.sql` | 5 | 20.2 KB |
| 44 | CRITIQUE | 8/10 | `phase4-critique-batch-08.sql` | 5 | 54.6 KB |
| 45 | CRITIQUE | 9/10 | `phase4-critique-batch-09.sql` | 5 | 27.8 KB |
| 46 | CRITIQUE | 10/10 | `phase4-critique-batch-10.sql` | 5 | 62.5 KB |

## Protocole par batch

1. Ouvrir `reports/batches/<filename>`
2. Copier intégralement
3. Supabase Dashboard → SQL Editor → Run
4. Si succès (NOTICE "✓ Applied" pour chaque migration) → "suivant"
5. Si échec → rollback automatique (BEGIN/COMMIT), me signaler l'erreur
