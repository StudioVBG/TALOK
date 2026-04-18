#!/usr/bin/env bash
# Sprint B1 — PASS 5 : renommage des 13 groupes de timestamps dupliqués
#
# ⚠️ NE PAS EXÉCUTER SANS VALIDATION HUMAINE
# ⚠️ PRÉ-REQUIS :
#   1. PASS 1 (schema_migrations snapshot) exécuté et validé
#   2. Aucun des fichiers ci-dessous n'est MATCHED en prod (sinon le
#      renommage casserait `supabase_migrations.schema_migrations`)
#   3. Branche dédiée : `git checkout -b chore/migrations-dedup-timestamps`
#   4. Décommenter les lignes une par une et inspecter le diff
#
# Pour chaque rename, si le fichier source est déjà appliqué en prod :
#   UPDATE supabase_migrations.schema_migrations
#     SET version = '<nouveau>' WHERE version = '<ancien>';
# (cf. reports/sprint-b1-reconciliation-sql.sql — PASS 6)

set -euo pipefail

echo "This script is in dry-run mode by default. Exit to confirm you read it."
read -p "Press Enter to see the plan (no writes): "

# ========== 20260224100000 (2 fichiers) ==========
# keep:   supabase/migrations/20260224100000_fix_tenant_dashboard_notifications_query.sql
# rename: supabase/migrations/20260224100000_normalize_provider_names.sql
#     →   supabase/migrations/20260224100001_normalize_provider_names.sql
# git mv "supabase/migrations/20260224100000_normalize_provider_names.sql" "supabase/migrations/20260224100001_normalize_provider_names.sql"

# ========== 20260226000000 (2 fichiers) ==========
# keep:   supabase/migrations/20260226000000_backfill_existing_invoices_tenant_id.sql
# rename: supabase/migrations/20260226000000_fix_notifications_triggers.sql
#     →   supabase/migrations/20260226000001_fix_notifications_triggers.sql
# git mv "supabase/migrations/20260226000000_fix_notifications_triggers.sql" "supabase/migrations/20260226000001_fix_notifications_triggers.sql"

# ========== 20260306100000 (2 fichiers) ==========
# keep:   supabase/migrations/20260306100000_add_digicode_interphone_columns.sql
# rename: supabase/migrations/20260306100000_invoice_on_fully_signed.sql
#     →   supabase/migrations/20260306100002_invoice_on_fully_signed.sql
# git mv "supabase/migrations/20260306100000_invoice_on_fully_signed.sql" "supabase/migrations/20260306100002_invoice_on_fully_signed.sql"

# ========== 20260310200000 (2 fichiers) ==========
# keep:   supabase/migrations/20260310200000_add_signature_push_franceconnect.sql
# rename: supabase/migrations/20260310200000_fix_property_limit_extra_properties.sql
#     →   supabase/migrations/20260310200001_fix_property_limit_extra_properties.sql
# git mv "supabase/migrations/20260310200000_fix_property_limit_extra_properties.sql" "supabase/migrations/20260310200001_fix_property_limit_extra_properties.sql"

# ========== 20260328100000 (2 fichiers) ==========
# keep:   supabase/migrations/20260328100000_create_site_content.sql
# rename: supabase/migrations/20260328100000_fix_visible_tenant_documents.sql
#     →   supabase/migrations/20260328100001_fix_visible_tenant_documents.sql
# git mv "supabase/migrations/20260328100000_fix_visible_tenant_documents.sql" "supabase/migrations/20260328100001_fix_visible_tenant_documents.sql"

# ========== 20260331100000 (2 fichiers) ==========
# keep:   supabase/migrations/20260331100000_add_agricultural_property_types.sql
# rename: supabase/migrations/20260331100000_fix_document_titles_bruts.sql
#     →   supabase/migrations/20260331100001_fix_document_titles_bruts.sql
# git mv "supabase/migrations/20260331100000_fix_document_titles_bruts.sql" "supabase/migrations/20260331100001_fix_document_titles_bruts.sql"

# ========== 20260401000001 (2 fichiers) ==========
# keep:   supabase/migrations/20260401000001_add_initial_payment_confirmed_to_leases.sql
# rename: supabase/migrations/20260401000001_backfill_identity_status.sql
#     →   supabase/migrations/20260401000002_backfill_identity_status.sql
# git mv "supabase/migrations/20260401000001_backfill_identity_status.sql" "supabase/migrations/20260401000002_backfill_identity_status.sql"

# ========== 20260408100000 (2 fichiers) ==========
# keep:   supabase/migrations/20260408100000_copro_lots.sql
# rename: supabase/migrations/20260408100000_create_push_subscriptions.sql
#     →   supabase/migrations/20260408100001_create_push_subscriptions.sql
# git mv "supabase/migrations/20260408100000_create_push_subscriptions.sql" "supabase/migrations/20260408100001_create_push_subscriptions.sql"

# ========== 20260408120000 (7 fichiers) ==========
# keep:   supabase/migrations/20260408120000_api_keys_webhooks.sql
# rename: supabase/migrations/20260408120000_colocation_module.sql
#     →   supabase/migrations/20260408120001_colocation_module.sql
# git mv "supabase/migrations/20260408120000_colocation_module.sql" "supabase/migrations/20260408120001_colocation_module.sql"
# rename: supabase/migrations/20260408120000_edl_sortie_workflow.sql
#     →   supabase/migrations/20260408120002_edl_sortie_workflow.sql
# git mv "supabase/migrations/20260408120000_edl_sortie_workflow.sql" "supabase/migrations/20260408120002_edl_sortie_workflow.sql"
# rename: supabase/migrations/20260408120000_providers_module_sota.sql
#     →   supabase/migrations/20260408120003_providers_module_sota.sql
# git mv "supabase/migrations/20260408120000_providers_module_sota.sql" "supabase/migrations/20260408120003_providers_module_sota.sql"
# rename: supabase/migrations/20260408120000_smart_meters_connected.sql
#     →   supabase/migrations/20260408120004_smart_meters_connected.sql
# git mv "supabase/migrations/20260408120000_smart_meters_connected.sql" "supabase/migrations/20260408120004_smart_meters_connected.sql"
# rename: supabase/migrations/20260408120000_subscription_addons.sql
#     →   supabase/migrations/20260408120005_subscription_addons.sql
# git mv "supabase/migrations/20260408120000_subscription_addons.sql" "supabase/migrations/20260408120005_subscription_addons.sql"
# rename: supabase/migrations/20260408120000_whitelabel_agency_module.sql
#     →   supabase/migrations/20260408120006_whitelabel_agency_module.sql
# git mv "supabase/migrations/20260408120000_whitelabel_agency_module.sql" "supabase/migrations/20260408120006_whitelabel_agency_module.sql"

# ========== 20260408130000 (12 fichiers) ==========
# keep:   supabase/migrations/20260408130000_active_sessions.sql
# rename: supabase/migrations/20260408130000_admin_panel_tables.sql
#     →   supabase/migrations/20260408130001_admin_panel_tables.sql
# git mv "supabase/migrations/20260408130000_admin_panel_tables.sql" "supabase/migrations/20260408130001_admin_panel_tables.sql"
# rename: supabase/migrations/20260408130000_candidatures_workflow.sql
#     →   supabase/migrations/20260408130002_candidatures_workflow.sql
# git mv "supabase/migrations/20260408130000_candidatures_workflow.sql" "supabase/migrations/20260408130002_candidatures_workflow.sql"
# rename: supabase/migrations/20260408130000_charges_locatives_module.sql
#     →   supabase/migrations/20260408130003_charges_locatives_module.sql
# git mv "supabase/migrations/20260408130000_charges_locatives_module.sql" "supabase/migrations/20260408130003_charges_locatives_module.sql"
# rename: supabase/migrations/20260408130000_diagnostics_rent_control.sql
#     →   supabase/migrations/20260408130004_diagnostics_rent_control.sql
# git mv "supabase/migrations/20260408130000_diagnostics_rent_control.sql" "supabase/migrations/20260408130004_diagnostics_rent_control.sql"
# rename: supabase/migrations/20260408130000_fix_subscription_plan_prices.sql
#     →   supabase/migrations/20260408130005_fix_subscription_plan_prices.sql
# git mv "supabase/migrations/20260408130000_fix_subscription_plan_prices.sql" "supabase/migrations/20260408130005_fix_subscription_plan_prices.sql"
# rename: supabase/migrations/20260408130000_guarantor_workflow_complete.sql
#     →   supabase/migrations/20260408130006_guarantor_workflow_complete.sql
# git mv "supabase/migrations/20260408130000_guarantor_workflow_complete.sql" "supabase/migrations/20260408130006_guarantor_workflow_complete.sql"
# rename: supabase/migrations/20260408130000_insurance_policies.sql
#     →   supabase/migrations/20260408130007_insurance_policies.sql
# git mv "supabase/migrations/20260408130000_insurance_policies.sql" "supabase/migrations/20260408130007_insurance_policies.sql"
# rename: supabase/migrations/20260408130000_lease_amendments_table.sql
#     →   supabase/migrations/20260408130008_lease_amendments_table.sql
# git mv "supabase/migrations/20260408130000_lease_amendments_table.sql" "supabase/migrations/20260408130008_lease_amendments_table.sql"
# rename: supabase/migrations/20260408130000_rgpd_consent_records_and_data_requests.sql
#     →   supabase/migrations/20260408130009_rgpd_consent_records_and_data_requests.sql
# git mv "supabase/migrations/20260408130000_rgpd_consent_records_and_data_requests.sql" "supabase/migrations/20260408130009_rgpd_consent_records_and_data_requests.sql"
# rename: supabase/migrations/20260408130000_seasonal_rental_module.sql
#     →   supabase/migrations/20260408130010_seasonal_rental_module.sql
# git mv "supabase/migrations/20260408130000_seasonal_rental_module.sql" "supabase/migrations/20260408130010_seasonal_rental_module.sql"
# rename: supabase/migrations/20260408130000_security_deposits.sql
#     →   supabase/migrations/20260408130011_security_deposits.sql
# git mv "supabase/migrations/20260408130000_security_deposits.sql" "supabase/migrations/20260408130011_security_deposits.sql"

# ========== 20260411120000 (2 fichiers) ==========
# keep:   supabase/migrations/20260411120000_harden_payments_check_constraints.sql
# rename: supabase/migrations/20260411120000_schedule_onboarding_reminders_cron.sql
#     →   supabase/migrations/20260411120001_schedule_onboarding_reminders_cron.sql
# git mv "supabase/migrations/20260411120000_schedule_onboarding_reminders_cron.sql" "supabase/migrations/20260411120001_schedule_onboarding_reminders_cron.sql"

# ========== 20260415140000 (2 fichiers) ==========
# keep:   supabase/migrations/20260415140000_buildings_sota_fix_wave1.sql
# rename: supabase/migrations/20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql
#     →   supabase/migrations/20260415140001_fix_tenant_payment_signing_and_leases_recursion.sql
# git mv "supabase/migrations/20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql" "supabase/migrations/20260415140001_fix_tenant_payment_signing_and_leases_recursion.sql"

# ========== 20260416100000 (2 fichiers) ==========
# keep:   supabase/migrations/20260416100000_fix_messages_conversation_trigger.sql
# rename: supabase/migrations/20260416100000_fix_tickets_rls_recursion.sql
#     →   supabase/migrations/20260416100001_fix_tickets_rls_recursion.sql
# git mv "supabase/migrations/20260416100000_fix_tickets_rls_recursion.sql" "supabase/migrations/20260416100001_fix_tickets_rls_recursion.sql"

