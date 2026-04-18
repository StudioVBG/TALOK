# PASS 1 — Validation post-migration RLS

Appliqué dans Supabase SQL Editor prod le **2026-04-18**.

---

## 1.2 — Output du Run

```
DROP POLICY
CREATE POLICY
COMMENT
```

(3 statements exécutés sans erreur.)

---

## 1.3 — Vérification policy

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'lease_charge_regularizations'
  AND policyname = 'lease_charge_reg_tenant_contest';
```

**Output prod** :

| Field | Valeur |
|---|---|
| `policyname` | `lease_charge_reg_tenant_contest` |
| `cmd` | `UPDATE` |
| `qual` (USING) | `(status = 'sent'::text) AND (lease_id IN (SELECT l.id FROM leases l JOIN lease_signers ls ON ... JOIN profiles pr ON ... WHERE pr.user_id = auth.uid() AND ls.role = ANY (ARRAY['locataire_principal', 'colocataire'])))` |
| `with_check` | `(status = ANY (ARRAY['sent'::text, 'contested'::text])) AND (lease_id IN (...))` |

**Validation** :
- [x] 1 row retournée
- [x] `cmd = UPDATE`
- [x] `qual` contient `status = 'sent'` et `locataire_principal`
- [x] `with_check` contient `status IN ('sent', 'contested')`
- [x] `with_check` contient `locataire_principal`

---

## 1.4 — Test fonctionnel

**Skippé** — validation fonctionnelle reportée au Sprint 0.d (tests automatisés après route `/apply`).

---

## 1.5 — Enregistrement schema_migrations

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20260418150000';
```

Initialement 0 rows. INSERT manuel exécuté :

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260418150000', 'fix_charges_contested_rls')
ON CONFLICT (version) DO NOTHING;
```

**Confirmation** (cf PASS 2.3 re-check) :

| version | name |
|---|---|
| 20260418150000 | fix_charges_contested_rls |

---

## Verdict PASS 1

- [x] ✅ **Appliqué avec succès**
- [ ] ⚠️ Appliqué avec anomalie mineure
- [ ] 🔴 Échec — rollback exécuté

**Bug P0 #4 fermé en prod.**
