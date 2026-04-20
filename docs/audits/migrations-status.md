# Inventaire des migrations Supabase

**Date :** 2026-04-09
**Mise à jour :** 2026-04-19 — Sprint B2 appliqué (194 migrations)
**Total migrations :** 388 (448 après Sprint B2 — voir `supabase/migrations/`)

> **Sprint B2 clos** : 194 migrations du backlog appliquées en prod via
> `supabase/apply_scripts/APPLY_SPRINT_B2_*.sql` le 2026-04-19. Voir
> `supabase/apply_scripts/README_SPRINT_B2.md` pour la procédure utilisée
> et `scripts/migrations/` pour le tooling réutilisable.

---

## 20 dernières migrations (par date)

| Fichier | Description |
|---------|-------------|
| `20260409100000_add_missing_rls.sql` | RLS sur 8 tables manquantes (audit) |
| `20260408220000_payment_architecture_sota.sql` | Architecture paiements SOTA |
| `20260408200000_unified_notification_system.sql` | Systeme notifications unifie |
| `20260408140000_tickets_module_sota.sql` | Module tickets SOTA |
| `20260408130000_security_deposits.sql` | Depots de garantie |
| `20260408130000_seasonal_rental_module.sql` | Module location saisonniere |
| `20260408130000_rgpd_consent_records_and_data_requests.sql` | RGPD consentements |
| `20260408130000_lease_amendments_table.sql` | Avenants baux |
| `20260408130000_insurance_policies.sql` | Polices assurance |
| `20260408130000_guarantor_workflow_complete.sql` | Workflow garants |
| `20260408130000_fix_subscription_plan_prices.sql` | Fix prix abonnements |
| `20260408130000_diagnostics_rent_control.sql` | Diagnostics + encadrement loyers |
| `20260408130000_charges_locatives_module.sql` | Module charges locatives |
| `20260408130000_candidatures_workflow.sql` | Workflow candidatures |
| `20260408130000_admin_panel_tables.sql` | Tables panel admin |
| `20260408130000_active_sessions.sql` | Sessions actives |
| `20260408120000_whitelabel_agency_module.sql` | Module white-label agence |
| `20260408120000_subscription_addons.sql` | Add-ons abonnements |
| `20260408120000_smart_meters_connected.sql` | Compteurs connectes |
| `20260408120000_providers_module_sota.sql` | Module prestataires SOTA |

---

## Migrations par module fonctionnel

### Comptabilite (accounting)
- `20260110000001_accounting_tables.sql` — Tables initiales comptabilite
- `20260406210000_accounting_complete.sql` — Architecture comptabilite complete
- `20260407120000_accounting_reconcile_schemas.sql` — Reconciliation schemas
- `20260408042218_create_expenses_table.sql` — Table depenses

### Copro (syndic)
- `20260408100000_copro_lots.sql` — Lots copropriete

### Banque / Open Banking
- Tables dans `20260406210000_accounting_complete.sql` (bank_connections, bank_transactions)

### Depenses (expenses)
- `20260408042218_create_expenses_table.sql`

### Saisonnier (seasonal)
- `20260408130000_seasonal_rental_module.sql` — seasonal_listings, seasonal_rates, seasonal_blocked_dates, reservations

### Colocation
- `20260408120000_colocation_module.sql` — colocation_members, colocation_rooms, colocation_expenses, colocation_rules, colocation_tasks

### Prestataires (providers)
- `20251205200000_provider_compliance_sota.sql`
- `20251205700000_provider_missing_tables.sql`
- `20251206200000_provider_portfolio.sql`
- `20260408120000_providers_module_sota.sql`

### Work orders
- `20251205300000_work_order_reports.sql`
- `20251205800000_intervention_flow_complete.sql`

### API Keys / Webhooks
- `20241128000002_api_keys_management.sql`
- `20260408120000_api_keys_webhooks.sql`

### Notifications
- `20240101000021_add_notifications_table.sql`
- `20251205000001_notification_triggers.sql`
- `20251205600000_notifications_centralized.sql`
- `20260408200000_unified_notification_system.sql`

### Onboarding
- `20240101000004_onboarding_tables.sql`
- `20260114000000_first_login_and_onboarding_tracking.sql`

### Candidatures (applications)
- `20260408130000_candidatures_workflow.sql`

### Diagnostics
- `20260127000008_diagnostics_dom_tom.sql`
- `20260408130000_diagnostics_rent_control.sql`

### Assurances (insurance)
- `20260408130000_insurance_policies.sql`

### Garants (guarantors)
- `20260212000001_fix_guarantor_role_and_tables.sql`
- `20260408130000_guarantor_workflow_complete.sql`

### Admin
- `20240101000007_admin_architecture.sql`
- `20260110000000_admin_dashboard_sota2026.sql`
- `20260408130000_admin_panel_tables.sql`

---

## Risque de non-application

Les migrations `20260408*` et `20260409*` sont tres recentes (derniers jours).
**A verifier avec Thomas** : ces migrations ont-elles ete appliquees en production ?

```sql
-- Verifier les migrations appliquees en production
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 30;
```

Si les migrations `20260408*` ne sont pas appliquees, les tables suivantes n'existent pas en prod :
- `seasonal_listings`, `seasonal_rates`, `reservations` (saisonnier)
- `colocation_members`, `colocation_rooms`, etc. (colocation)
- `insurance_policies` (assurances)
- `provider_compliance_documents`, `provider_portfolio_items` (prestataires SOTA)
- `charges`, `charge_categories`, etc. (charges locatives)
- `ticket_comments` (tickets SOTA)
- etc.
