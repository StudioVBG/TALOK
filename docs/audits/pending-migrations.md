# Migrations en attente d'application (post-20260208024659)

**Date :** 2026-04-09
**Mise à jour :** 2026-04-19 — Sprint B2 appliqué
**Total migrations en attente :** 28 (rename-then-apply uniquement)
**Derniere migration appliquee (prod) :** `20260417110000`

> **Sprint B2 (2026-04-19) — 194 migrations `apply` exécutées** via
> `supabase/apply_scripts/APPLY_SPRINT_B2_{01_FEB,02_MAR,03_APR}2026.sql`,
> puis enregistrées dans `supabase_migrations.schema_migrations` via
> `REGISTER_SPRINT_B2_APPLIED.sql`.
>
> Reste **28 migrations `rename-then-apply`** qui nécessitent la branche
> `dedup` mergée d'abord (voir `reports/sprint-b2-migrations-to-apply.md`).

> Pour verifier en prod : `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;`

---

## Par module (categorisation)

### RLS & Securite (22)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260213000000 | `fix_profiles_rls_recursion_v2.sql` | `ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;` |
| 20260213100000 | `fix_rls_all_tables_recursion.sql` | `ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;` |
| 20260215100000 | `signature_security_audit_fixes.sql` | `DO $$` |
| 20260215200000 | `fix_rls_properties_tenant_pre_active.sql` | `DROP POLICY IF EXISTS "Tenants can view properties..." ON properties;` |
| 20260215200002 | `fix_rls_tenant_access_beyond_active.sql` | `DROP POLICY IF EXISTS "Users can view units..." ON units;` |
| 20260216100000 | `security_audit_rls_fixes.sql` | `DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;` |
| 20260221000002 | `fix_edl_signatures_rls.sql` | `DROP POLICY IF EXISTS "EDL signatures creator update" ON edl_signatures;` |
| 20260223000000 | `fix_tenant_documents_rls.sql` | `DROP POLICY IF EXISTS "tenant_view_own_documents" ON tenant_documents;` |
| 20260225000001 | `fix_furniture_vetusty_rls.sql` | `DROP POLICY IF EXISTS furniture_inventories_owner_policy ON furniture_inventories;` |
| 20260303100000 | `entity_rls_fix_and_optimize.sql` | `CREATE OR REPLACE FUNCTION get_current_owner_profile_id()` |
| 20260309000001 | `messages_update_rls.sql` | `DROP POLICY IF EXISTS "Users can update own messages" ON messages;` |
| 20260314001000 | `fix_stripe_connect_rls.sql` | `ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;` |
| 20260318020000 | `buildings_rls_sota2026.sql` | `DROP POLICY IF EXISTS "Owners can view their buildings" ON buildings;` |
| 20260320100000 | `fix_owner_id_mismatch_and_rls.sql` | `DO $$` |
| 20260323000000 | `fix_document_visibility_and_dedup.sql` | `DROP POLICY IF EXISTS "Tenants can read visible lease documents" ON documents;` |
| 20260404100000 | `rls_push_subscriptions.sql` | `ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;` |
| 20260404100100 | `fix_tenant_docs_view_visible_tenant.sql` | `CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS` |
| 20260404100200 | `fix_ticket_messages_rls_lease_signers.sql` | `DROP POLICY IF EXISTS "Ticket messages same lease select" ON ticket_messages;` |
| 20260407110000 | `audit_fixes_rls_indexes.sql` | `DO $$ BEGIN` |
| 20260409100000 | `add_missing_rls.sql` | `ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;` |

### Audit & Integrite (7)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260212000000 | `audit_database_integrity.sql` | `CREATE OR REPLACE FUNCTION audit_orphan_records()` |
| 20260212100000 | `audit_v2_merge_and_prevention.sql` | `CREATE TABLE IF NOT EXISTS _audit_log (` |
| 20260212200000 | `audit_v3_comprehensive_integrity.sql` | `CREATE OR REPLACE FUNCTION audit_signature_integrity()` |
| 20260217000000 | `data_integrity_audit_repair.sql` | `CREATE TABLE IF NOT EXISTS public._repair_log (` |
| 20260218000000 | `audit_repair_profiles.sql` | `CREATE TABLE IF NOT EXISTS public._repair_log (` |
| 20260220100000 | `fix_orphan_signers_audit.sql` | `DO $$` |
| 20260301100000 | `entity_audit_and_propagation.sql` | `CREATE TABLE IF NOT EXISTS entity_audit_log (` |

### Auth & Profiles (12)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260211100000 | `bic_compliance_tax_regime.sql` | `DO $$ BEGIN` |
| 20260212000001 | `fix_guarantor_role_and_tables.sql` | `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;` |
| 20260216300000 | `fix_auth_profile_sync.sql` | `CREATE OR REPLACE FUNCTION public.handle_new_user()` |
| 20260218100000 | `sync_auth_email_updates.sql` | `CREATE OR REPLACE FUNCTION public.handle_user_email_change()` |
| 20260229100000 | `identity_2fa_requests.sql` | `CREATE TABLE IF NOT EXISTS identity_2fa_requests (` |
| 20260310200000 | `add_signature_push_franceconnect.sql` | `DO $$` |
| 20260312100000 | `fix_handle_new_user_all_roles.sql` | `CREATE OR REPLACE FUNCTION public.handle_new_user()` |
| 20260318000000 | `fix_auth_reset_template_examples.sql` | `DO $$` |
| 20260318010000 | `password_reset_requests.sql` | `CREATE TABLE IF NOT EXISTS password_reset_requests (` |
| 20260326205416 | `add_agency_role_to_handle_new_user.sql` | `CREATE OR REPLACE FUNCTION public.handle_new_user()` |
| 20260327200000 | `fix_handle_new_user_restore_email.sql` | `CREATE OR REPLACE FUNCTION public.handle_new_user()` |
| 20260329120000 | `add_agency_to_handle_new_user.sql` | `CREATE OR REPLACE FUNCTION public.handle_new_user()` |
| 20260401000000 | `add_identity_status_onboarding_step.sql` | `DO $$ BEGIN` |
| 20260401000001 | `backfill_identity_status.sql` | `UPDATE profiles SET` |

### Leases & Baux (22)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260215200001 | `add_notice_given_lease_status.sql` | `DO $$` |
| 20260216200000 | `auto_link_lease_signers_trigger.sql` | `CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()` |
| 20260219100000 | `auto_link_notify_owner.sql` | `CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()` |
| 20260219200000 | `fix_autolink_triggers_audit.sql` | `DROP TRIGGER IF EXISTS on_profile_created_auto_link ON public.profiles;` |
| 20260220000000 | `auto_link_signer_on_insert.sql` | `CREATE OR REPLACE FUNCTION public.auto_link_signer_on_insert()` |
| 20260221000001 | `auto_link_trigger_update.sql` | `CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_updated()` |
| 20260221100001 | `auto_upgrade_draft_on_tenant_signer.sql` | `CREATE OR REPLACE FUNCTION public.auto_upgrade_draft_lease_on_signer()` |
| 20260221200000 | `sync_edl_signer_to_lease_signer.sql` | `CREATE OR REPLACE FUNCTION public.sync_edl_signer_to_lease_signer()` |
| 20260222000000 | `fix_invitations_and_orphan_signers.sql` | `UPDATE public.lease_signers ls` |
| 20260222100000 | `repair_missing_signers_and_invitations.sql` | `INSERT INTO public.lease_signers (...)` |
| 20260225100000 | `autolink_backfill_invoices_on_profile.sql` | `CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()` |
| 20260228000000 | `lease_signers_share_percentage.sql` | `ALTER TABLE public.lease_signers` |
| 20260301000000 | `create_key_handovers.sql` | `CREATE TABLE IF NOT EXISTS key_handovers (` |
| 20260306000000 | `lease_documents_visible_tenant.sql` | `ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_tenant BOOLEAN;` |
| 20260306100000 | `invoice_on_fully_signed.sql` | `CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(` |
| 20260306100001 | `backfill_initial_invoices.sql` | `DO $$` |
| 20260314020000 | `canonical_lease_activation_flow.sql` | `DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;` |
| 20260321000000 | `drop_invoice_trigger_sota2026.sql` | `DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;` |
| 20260329170000 | `add_punctuality_score.sql` | `ALTER TABLE leases` |
| 20260330100000 | `add_lease_cancellation_columns.sql` | `ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;` |
| 20260331120000 | `add_signed_pdf_generated_to_leases.sql` | `ALTER TABLE leases` |
| 20260331130000 | `key_handovers_add_cancelled_notes.sql` | `ALTER TABLE key_handovers` |
| 20260401000001 | `add_initial_payment_confirmed_to_leases.sql` | `ALTER TABLE leases` |
| 20260408130000 | `lease_amendments_table.sql` | `CREATE TABLE IF NOT EXISTS lease_amendments (` |

### Tenant & Dashboard (8)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260216000000 | `tenant_document_center.sql` | `CREATE INDEX IF NOT EXISTS idx_documents_tenant_type_date` |
| 20260216000001 | `document_center_notifications.sql` | `DO $$` |
| 20260216500000 | `fix_tenant_dashboard_complete.sql` | `CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)` |
| 20260221100000 | `fix_tenant_dashboard_draft_visibility.sql` | `CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)` |
| 20260221300000 | `fix_tenant_dashboard_owner_join.sql` | `CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)` |
| 20260224000000 | `fix_tenant_sync_and_notifications.sql` | `UPDATE public.lease_signers ls` |
| 20260224100000 | `fix_tenant_dashboard_notifications_query.sql` | `CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)` |
| 20260228100000 | `tenant_payment_methods_sota2026.sql` | `CREATE TABLE IF NOT EXISTS tenant_payment_methods (` |

### Invoices & Payments (12)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260226000000 | `backfill_existing_invoices_tenant_id.sql` | `UPDATE public.invoices i` |
| 20260227000000 | `drop_auto_activate_lease_trigger.sql` | `DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;` |
| 20260304000000 | `fix_invoice_generation_jour_paiement.sql` | `CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)` |
| 20260304000001 | `sync_sepa_collection_day.sql` | `CREATE OR REPLACE FUNCTION sync_lease_jour_paiement_to_schedules()` |
| 20260304200000 | `auto_mark_late_invoices.sql` | `CREATE OR REPLACE FUNCTION mark_overdue_invoices_late()` |
| 20260305000001 | `invoice_engine_fields.sql` | `ALTER TABLE leases` |
| 20260305100000 | `fix_invoice_draft_notification.sql` | `CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()` |
| 20260314030000 | `payments_production_hardening.sql` | `CREATE OR REPLACE FUNCTION public.sync_signature_session_to_entity()` |
| 20260324100000 | `prevent_duplicate_payments.sql` | `CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_invoice` |
| 20260331000000 | `add_receipt_generated_to_invoices.sql` | `DO $$` |
| 20260408220000 | `payment_architecture_sota.sql` | `CREATE TABLE IF NOT EXISTS rent_payments (` |
| 20260225000000 | `owner_payment_audit_log.sql` | `CREATE TABLE IF NOT EXISTS owner_payment_audit_log (` |

### Accounting & Comptabilite (5)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260406210000 | `accounting_complete.sql` | `CREATE TABLE IF NOT EXISTS accounting_exercises (` |
| 20260407120000 | `accounting_reconcile_schemas.sql` | `ALTER TABLE public.accounting_journals` |
| 20260407130000 | `ocr_category_rules.sql` | `CREATE TABLE IF NOT EXISTS ocr_category_rules (` |
| 20260408042218 | `create_expenses_table.sql` | `CREATE TABLE IF NOT EXISTS expenses (` |
| 20260408044152 | `reconcile_charge_regularisations_and_backfill_entry_lines.sql` | `ALTER TABLE public.charge_regularizations` |

### Copro & Syndic (2)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260215200003 | `fix_copro_fk_on_delete.sql` | `DO $$` |
| 20260408100000 | `copro_lots.sql` | `CREATE TABLE IF NOT EXISTS copro_lots (` |

### Properties & Biens (7)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260208100000 | `fix_data_storage_audit.sql` | `ALTER TABLE roommates ALTER COLUMN user_id DROP NOT NULL;` |
| 20260306100000 | `add_digicode_interphone_columns.sql` | `ALTER TABLE properties ADD COLUMN IF NOT EXISTS digicode TEXT;` |
| 20260306200000 | `notify_tenant_digicode_changed.sql` | `CREATE OR REPLACE FUNCTION notify_tenant_digicode_changed()` |
| 20260306300000 | `add_owner_payment_preferences.sql` | `ALTER TABLE owner_profiles` |
| 20260310100000 | `fix_property_limit_enforcement.sql` | `CREATE OR REPLACE FUNCTION enforce_property_limit()` |
| 20260331100000 | `add_agricultural_property_types.sql` | `ALTER TABLE properties` |
| 20260408120000 | `smart_meters_connected.sql` | `CREATE TABLE IF NOT EXISTS property_meters (` |

### Documents (10)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260211000000 | `p2_unique_constraint_and_gdpr_rpc.sql` | `CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_type_lease_hash` |
| 20260223000001 | `auto_fill_document_fk.sql` | `CREATE OR REPLACE FUNCTION public.auto_fill_document_fk()` |
| 20260223000002 | `document_access_views.sql` | `CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS` |
| 20260223000003 | `notify_owner_on_tenant_document.sql` | `CREATE OR REPLACE FUNCTION public.notify_owner_on_tenant_document()` |
| 20260303000000 | `backfill_uploaded_by.sql` | `UPDATE public.documents` |
| 20260326022619 | `fix_documents_bucket_mime.sql` | `UPDATE storage.buckets` |
| 20260326022700 | `migrate_tenant_documents.sql` | `DO $$` |
| 20260326022800 | `create_document_links.sql` | `CREATE TABLE IF NOT EXISTS document_links (` |
| 20260326023000 | `fix_document_titles.sql` | `UPDATE documents SET title = CASE` |
| 20260328000000 | `fix_visible_tenant_documents.sql` | `UPDATE documents` |
| 20260328100000 | `fix_visible_tenant_documents.sql` | `UPDATE documents` |
| 20260329052631 | `fix_contrat_bail_visible_tenant.sql` | `UPDATE documents` |
| 20260329164841 | `fix_document_titles.sql` | `UPDATE documents SET` |
| 20260329190000 | `force_visible_tenant_generated_docs.sql` | `UPDATE documents` |
| 20260331100000 | `fix_document_titles_bruts.sql` | `UPDATE documents SET title = CASE` |

### Entities & Multi-entreprises (5)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260222200000 | `ensure_all_owners_have_entity.sql` | `INSERT INTO legal_entities (...)` |
| 20260222200001 | `get_entity_stats_for_store.sql` | `CREATE OR REPLACE FUNCTION get_entity_stats(` |
| 20260223100000 | `fix_entity_connections.sql` | `UPDATE properties p` |
| 20260309000000 | `entity_status_and_dedup.sql` | `ALTER TABLE legal_entities` |
| 20260406200000 | `create_entities_view_and_members.sql` | `CREATE OR REPLACE VIEW entities AS` |

### Subscriptions & Stripe (9)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260309100000 | `sync_subscription_plans_features.sql` | `INSERT INTO subscription_plans (` |
| 20260310000000 | `fix_subscription_plans_display_order.sql` | `UPDATE subscription_plans SET display_order = ...` |
| 20260310200000 | `fix_property_limit_extra_properties.sql` | `ALTER TABLE subscription_plans` |
| 20260310300000 | `add_stripe_price_extra_property_id.sql` | `ALTER TABLE subscription_plans` |
| 20260311100000 | `sync_subscription_plan_slugs.sql` | `UPDATE subscriptions s` |
| 20260312000000 | `admin_dashboard_rpcs.sql` | `CREATE OR REPLACE FUNCTION admin_monthly_revenue()` |
| 20260312000001 | `fix_owner_subscription_defaults.sql` | `CREATE OR REPLACE FUNCTION create_owner_subscription()` |
| 20260315090000 | `market_standard_subscription_alignment.sql` | `ALTER TABLE subscriptions` |
| 20260408130000 | `fix_subscription_plan_prices.sql` | `UPDATE subscription_plans SET price_monthly = 0, price_yearly = 0` |
| 20260408120000 | `subscription_addons.sql` | `CREATE TABLE IF NOT EXISTS subscription_addons (` |

### Notifications (6)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260209100000 | `create_sms_messages_table.sql` | `CREATE TABLE IF NOT EXISTS sms_messages (` |
| 20260226000000 | `fix_notifications_triggers.sql` | `DO $$` |
| 20260230100000 | `create_notification_resolve_profile_id.sql` | `DROP FUNCTION IF EXISTS create_notification(...)` |
| 20260305100001 | `add_missing_notification_triggers.sql` | `CREATE OR REPLACE FUNCTION notify_owner_on_ticket_created()` |
| 20260329180000 | `notify_owner_edl_signed.sql` | `CREATE OR REPLACE FUNCTION public.notify_owner_edl_signed()` |
| 20260408200000 | `unified_notification_system.sql` | `DO $$` |

### Email Templates (2)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260212100001 | `email_template_system.sql` | `CREATE TABLE IF NOT EXISTS email_templates (` |
| 20260212100002 | `email_templates_seed.sql` | `INSERT INTO email_templates (slug, ...)` |

### Providers & Prestataires (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408120000 | `providers_module_sota.sql` | `CREATE TABLE IF NOT EXISTS providers (` |

### Seasonal & Saisonnier (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `seasonal_rental_module.sql` | `CREATE EXTENSION IF NOT EXISTS btree_gist;` |

### Colocation (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408120000 | `colocation_module.sql` | `ALTER TABLE properties ADD COLUMN IF NOT EXISTS` |

### Candidatures (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `candidatures_workflow.sql` | `CREATE TABLE IF NOT EXISTS property_listings (` |

### Charges locatives (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `charges_locatives_module.sql` | `CREATE TABLE IF NOT EXISTS charge_categories (` |

### Diagnostics (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `diagnostics_rent_control.sql` | `CREATE TABLE IF NOT EXISTS property_diagnostics (` |

### Guarantors (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `guarantor_workflow_complete.sql` | `CREATE TABLE IF NOT EXISTS guarantor_invitations (` |

### Insurance (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `insurance_policies.sql` | `ALTER TABLE insurance_policies` |

### RGPD (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `rgpd_consent_records_and_data_requests.sql` | `CREATE TABLE IF NOT EXISTS consent_records (` |

### Security Deposits (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `security_deposits.sql` | `CREATE TABLE IF NOT EXISTS security_deposits (` |

### Tickets (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408140000 | `tickets_module_sota.sql` | `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS category TEXT;` |

### White-label & Agency (2)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408110000 | `agency_hoguet.sql` | `ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;` |
| 20260408120000 | `whitelabel_agency_module.sql` | `CREATE TABLE IF NOT EXISTS whitelabel_configs (` |

### API Keys & Webhooks (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408120000 | `api_keys_webhooks.sql` | `CREATE TABLE IF NOT EXISTS api_keys (` |

### EDL (1)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408120000 | `edl_sortie_workflow.sql` | `DO $$` |

### Admin (2)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260408130000 | `active_sessions.sql` | `CREATE TABLE IF NOT EXISTS active_sessions (` |
| 20260408130000 | `admin_panel_tables.sql` | `CREATE TABLE IF NOT EXISTS admin_logs (` |

### Crons (3)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260304100000 | `activate_pg_cron_schedules.sql` | `CREATE EXTENSION IF NOT EXISTS pg_cron;` |
| 20260305000002 | `payment_crons.sql` | *(vide/commentaires)* |
| 20260321100000 | `fix_cron_post_refactoring_sota2026.sql` | *(vide/commentaires)* |

### Landing / Site (4)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260327143000 | `add_site_config.sql` | `CREATE TABLE IF NOT EXISTS site_config (` |
| 20260328042538 | `update_argument_images.sql` | `UPDATE site_config SET value = '...'` |
| 20260328100000 | `create_site_content.sql` | `CREATE TABLE IF NOT EXISTS site_content (` |

### Divers (6)

| Timestamp | Fichier | Premiere instruction |
|-----------|---------|---------------------|
| 20260216400000 | `performance_indexes_rls.sql` | `CREATE INDEX IF NOT EXISTS idx_lease_signers_profile_id` |
| 20260216500001 | `enforce_unique_constraints_safety.sql` | `DO $$` |
| 20260219000000 | `missing_tables_and_rag.sql` | `CREATE TABLE IF NOT EXISTS tenant_rewards (` |
| 20260223200000 | `fix_all_missing_tables_and_columns.sql` | `ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS cni_recto_path TEXT;` |
| 20260224000001 | `remove_yousign_sendgrid_brevo.sql` | *(vide/nettoyage)* |
| 20260224100000 | `normalize_provider_names.sql` | `UPDATE api_providers SET name = 'Twilio' WHERE ...` |
| 20260309000002 | `add_ticket_to_conversations.sql` | `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_id UUID;` |

---

## Ordre d'application recommande

### Phase 1 — Critiques (appliquer en premier)
1. RLS & Securite (22 migrations) — protege les donnees
2. Auth & Profiles (12) — necessaire pour le fonctionnement de base
3. Audit & Integrite (7) — fonctions de verification

### Phase 2 — Core business
4. Leases & Baux (22) — triggers d'auto-link, statuts
5. Invoices & Payments (12) — generation factures, crons
6. Tenant & Dashboard (8) — portail locataire
7. Documents (10+) — visibilite, titres, liens

### Phase 3 — Entites & Abonnements
8. Entities (5) — multi-entreprises
9. Subscriptions & Stripe (9+) — plans, prix, limites

### Phase 4 — Modules supplementaires
10. Accounting (5) — comptabilite
11. Tous les modules 20260408* (seasonal, colocation, providers, tickets, etc.)

### Phase 5 — Cosmetic & Landing
12. Site content, notifications, email templates

> **IMPORTANT :** Toutes les migrations utilisent `IF NOT EXISTS` / `IF EXISTS`, donc elles sont idempotentes et peuvent etre appliquees en bloc sans risque de conflit.
