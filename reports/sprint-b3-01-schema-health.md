# Sprint B3 — PASS 1 : Santé schema & extensions

## Statut

⏳ **En attente d'exécution utilisateur** — `reports/sprint-b3-audit-pack.sql` à lancer en SQL Editor prod.

## Checks couverts (sections du pack)

| ID | Check | Critère OK |
|---|---|---|
| 1.1 | 21 tables core attendues | toutes en `status = OK` |
| 1.2 | 4 extensions (pg_cron, pg_net, pgcrypto, vault) | toutes `OK` avec version non-NULL |
| 1.3 | 14 colonnes critiques sur tables core | toutes `OK` |
| 1.4 | `properties_type_check` étendu agricole | contient `terrain_agricole` + `exploitation_agricole`, pas de `cave`/`garage` |

## Tables critiques surveillées

```
profiles, owner_profiles, legal_entities, property_ownership,
properties, leases, tenants, documents, invoices,
subscriptions, subscription_addons, sms_messages, sms_usage,
stripe_connect_accounts, otp_codes, identity_2fa_requests,
charge_categories, charge_entries, lease_charge_regularizations,
tax_notices, epci_reference
```

## Colonnes critiques surveillées

| Table | Colonne | Source |
|---|---|---|
| properties | `legal_entity_id` | migration legal_entities |
| properties | `parent_property_id` | hiérarchie biens |
| leases | `statut` (FR) | rename status→statut historique |
| leases | `building_unit_id` | module immeubles |
| subscriptions | `plan_slug` | rename plan→plan_slug |
| documents | `building_unit_id` | module immeubles |
| sms_messages | `territory` | Sprint 0 (DROM analytics) |
| sms_messages | `verify_sid` | Sprint 0 (Twilio Verify) |
| property_ownership | `legal_entity_id` | multi-mandant |

## Output utilisateur attendu

Coller les résultats des sections 1.1, 1.2, 1.3, 1.4 du pack. Tout `MISSING` ou `FLAG` est bloquant.
