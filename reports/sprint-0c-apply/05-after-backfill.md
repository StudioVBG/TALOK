# PASS 2 — Validation post-migration backfill PCG

Appliqué dans Supabase SQL Editor prod le **2026-04-18**.

---

## 2.1 — Output du Run

```
INSERT 0 3
INSERT 0 3
```

(3 rows × 2 INSERT = 6 rows ajoutées, une par entity pour chacun des 2 comptes.)

---

## 2.2 — Vérification

```sql
SELECT account_number, label, account_type,
       COUNT(DISTINCT entity_id) AS entity_count
FROM chart_of_accounts
WHERE account_number IN ('419100', '654000', '614100', '708000')
GROUP BY account_number, label, account_type
ORDER BY account_number;
```

**Output prod** :

| account_number | label | account_type | entity_count |
|---|---|---|---|
| 419100 | Provisions de charges recues | liability | 3 |
| 614100 | Charges reelles recuperables | expense | 3 |
| 654000 | Charges recuperables non recuperees | expense | 3 |
| 708000 | Charges recuperees / TEOM | income | 3 |

### Validation fine

- [x] 4 rows exactement
- [x] `entity_count = 3` sur les 4 rows
- [x] `entity_count` = `total_entities` (= 3, cf Snapshot 2 AVANT)
- [x] `708000` a `account_type = 'income'` (conforme à la contrainte CHECK)
- [x] Aucun doublon `(account_number, entity_id)` — query `HAVING COUNT(*) > 1` retourne 0 rows (attendu vu `ON CONFLICT DO NOTHING`)

---

## 2.3 — Enregistrement schema_migrations

Initialement 0 rows. INSERT manuel exécuté :

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260418150100', 'charges_pcg_accounts_backfill_p2')
ON CONFLICT (version) DO NOTHING;
```

**Confirmation** (re-query PASS 3) :

| version | name |
|---|---|
| 20260418150000 | fix_charges_contested_rls |
| 20260418150100 | charges_pcg_accounts_backfill_p2 |

Les 2 versions Sprint 0.c sont enregistrées.

---

## Verdict PASS 2

- [x] ✅ **Appliqué avec succès**
- [ ] ⚠️ Appliqué avec anomalie mineure
- [ ] 🔴 Échec — rollback PASS 2 exécuté

**Gap P0 #3 fermé en prod** — les 4 comptes PCG sont maintenant présents sur toutes les entities.
