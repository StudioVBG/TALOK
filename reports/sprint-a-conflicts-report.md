# Sprint A — PASS 5 : Conflits détectés

## 5.1 — Conflits internes (entre migrations pending)

### Tables avec CREATE répété ou CREATE/DROP oscillation

| Table | Événements |
|---|---|
| `guarantor_profiles` | CREATE@20260212000001_fix_guarantor_role_and_tables.sql → CREATE@20260415000000_signup_integrity_guard.sql |
| `_repair_log` | CREATE@20260217000000_data_integrity_audit_repair.sql → CREATE@20260218000000_audit_repair_profiles.sql |
| `legal_embeddings` | CREATE@20260219000000_missing_tables_and_rag.sql → CREATE@20260219000000_missing_tables_and_rag.sql |
| `platform_knowledge` | CREATE@20260219000000_missing_tables_and_rag.sql → CREATE@20260219000000_missing_tables_and_rag.sql |
| `user_context_embeddings` | CREATE@20260219000000_missing_tables_and_rag.sql → CREATE@20260219000000_missing_tables_and_rag.sql |
| `accounting_entry_lines` | CREATE@20260406210000_accounting_complete.sql → CREATE@20260407120000_accounting_reconcile_schemas.sql |
| `security_deposits` | CREATE@20260408130000_security_deposits.sql → CREATE@20260408220000_payment_architecture_sota.sql |
| `syndic_profiles` | CREATE@20260411130200_create_syndic_profiles.sql → CREATE@20260415000000_signup_integrity_guard.sql |

### Colonnes avec ADD répété ou ADD/DROP oscillation

| Colonne | Événements |
|---|---|
| `invoices.period_start` | ADD@20260305000001_invoice_engine_fields.sql → ADD@20260408220000_payment_architecture_sota.sql |
| `invoices.period_end` | ADD@20260305000001_invoice_engine_fields.sql → ADD@20260408220000_payment_architecture_sota.sql |
| `invoices.paid_at` | ADD@20260305000001_invoice_engine_fields.sql → ADD@20260408220000_payment_architecture_sota.sql |
| `building_units.property_id` | ADD@20260318020000_buildings_rls_sota2026.sql → ADD@20260409170000_backfill_building_unit_properties.sql |
| `cash_receipts.tenant_signature_latitude` | ADD@20260410220000_cash_receipt_two_step_signature.sql → ADD@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts.tenant_signature_longitude` | ADD@20260410220000_cash_receipt_two_step_signature.sql → ADD@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts.tenant_device_info` | ADD@20260410220000_cash_receipt_two_step_signature.sql → ADD@20260412000000_fix_cash_receipt_rpc_sota.sql |

### Policies créées/droppées plusieurs fois

| Policy (table:name) | Événements |
|---|---|
| `guarantor_profiles:guarantor_profiles_select_own` | CREATE@20260212000001_fix_guarantor_role_and_tables.sql → DROP@20260212000001_fix_guarantor_role_and_tables.sql |
| `guarantor_profiles:guarantor_profiles_insert_own` | CREATE@20260212000001_fix_guarantor_role_and_tables.sql → DROP@20260212000001_fix_guarantor_role_and_tables.sql |
| `guarantor_profiles:guarantor_profiles_update_own` | CREATE@20260212000001_fix_guarantor_role_and_tables.sql → DROP@20260212000001_fix_guarantor_role_and_tables.sql |
| `subscriptions:owners can view their subscription` | CREATE@20260213100000_fix_rls_all_tables_recursion.sql → DROP@20260213100000_fix_rls_all_tables_recursion.sql → CREATE@20260409120000_fix_subscriptions_rls_recursion.sql → DROP@20260409120000_fix_subscriptions_rls_recursion.sql |
| `subscriptions:admins can view all subscriptions` | CREATE@20260213100000_fix_rls_all_tables_recursion.sql → DROP@20260213100000_fix_rls_all_tables_recursion.sql → CREATE@20260409120000_fix_subscriptions_rls_recursion.sql → DROP@20260409120000_fix_subscriptions_rls_recursion.sql |
| `subscription_invoices:owners can view their invoices` | CREATE@20260213100000_fix_rls_all_tables_recursion.sql → DROP@20260213100000_fix_rls_all_tables_recursion.sql |
| `subscription_usage:owners can view their usage` | CREATE@20260213100000_fix_rls_all_tables_recursion.sql → DROP@20260213100000_fix_rls_all_tables_recursion.sql |
| `notifications:notifications_insert_system` | CREATE@20260213100000_fix_rls_all_tables_recursion.sql → DROP@20260216100000_security_audit_rls_fixes.sql |
| `properties:tenants can view linked properties` | CREATE@20260215200000_fix_rls_properties_tenant_pre_active.sql → CREATE@20260410213940_fix_properties_tenant_policy_recursion.sql → DROP@20260410213940_fix_properties_tenant_policy_recursion.sql → CREATE@20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql → DROP@20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql |
| `units:users can view units of accessible properties` | CREATE@20260215200002_fix_rls_tenant_access_beyond_active.sql → DROP@20260215200002_fix_rls_tenant_access_beyond_active.sql |
| `tickets:users can view tickets of accessible properties` | CREATE@20260215200002_fix_rls_tenant_access_beyond_active.sql → DROP@20260215200002_fix_rls_tenant_access_beyond_active.sql → CREATE@20260416100000_fix_tickets_rls_recursion.sql → DROP@20260416100000_fix_tickets_rls_recursion.sql |
| `tickets:users can create tickets for accessible properties` | CREATE@20260215200002_fix_rls_tenant_access_beyond_active.sql → DROP@20260215200002_fix_rls_tenant_access_beyond_active.sql → CREATE@20260416100000_fix_tickets_rls_recursion.sql → DROP@20260416100000_fix_tickets_rls_recursion.sql |
| `tickets:tickets_select_policy` | DROP@20260215200002_fix_rls_tenant_access_beyond_active.sql → DROP@20260416100000_fix_tickets_rls_recursion.sql |
| `tickets:tickets_insert_policy` | DROP@20260215200002_fix_rls_tenant_access_beyond_active.sql → DROP@20260416100000_fix_tickets_rls_recursion.sql |
| `profiles:profiles_insert_own` | CREATE@20260216300000_fix_auth_profile_sync.sql → DROP@20260216300000_fix_auth_profile_sync.sql |
| `tenant_rewards:tenant_rewards_select_own` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `tenant_rewards:tenant_rewards_insert_own` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `tenant_rewards:tenant_rewards_admin` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `invoice_reminders:invoice_reminders_select_owner` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `invoice_reminders:invoice_reminders_insert_owner` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `invoice_reminders:invoice_reminders_admin` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `webhook_logs:webhook_logs_admin` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `webhook_logs:webhook_logs_service_insert` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `ai_conversations:ai_conversations_select_own` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `ai_conversations:ai_conversations_insert_own` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `ai_conversations:ai_conversations_admin` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `legal_embeddings:legal_embeddings_select_authenticated` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `legal_embeddings:legal_embeddings_admin_manage` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `platform_knowledge:platform_knowledge_select_authenticated` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `platform_knowledge:platform_knowledge_admin_manage` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `user_context_embeddings:user_context_select_own` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `user_context_embeddings:user_context_manage_own` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `user_context_embeddings:user_context_admin` | CREATE@20260219000000_missing_tables_and_rag.sql → DROP@20260219000000_missing_tables_and_rag.sql |
| `tenant_documents:tenant_view_own_documents` | CREATE@20260223000000_fix_tenant_documents_rls.sql → DROP@20260223000000_fix_tenant_documents_rls.sql |
| `tenant_documents:tenant_insert_own_documents` | CREATE@20260223000000_fix_tenant_documents_rls.sql → DROP@20260223000000_fix_tenant_documents_rls.sql |
| `conversations:users can view own conversations` | CREATE@20260223200000_fix_all_missing_tables_and_columns.sql → DROP@20260223200000_fix_all_missing_tables_and_columns.sql |
| `conversations:users can insert conversations` | CREATE@20260223200000_fix_all_missing_tables_and_columns.sql → DROP@20260223200000_fix_all_missing_tables_and_columns.sql |
| `conversations:users can update own conversations` | CREATE@20260223200000_fix_all_missing_tables_and_columns.sql → DROP@20260223200000_fix_all_missing_tables_and_columns.sql |
| `messages:users can view messages of own conversations` | CREATE@20260223200000_fix_all_missing_tables_and_columns.sql → DROP@20260223200000_fix_all_missing_tables_and_columns.sql |
| `messages:users can insert messages in own conversations` | CREATE@20260223200000_fix_all_missing_tables_and_columns.sql → DROP@20260223200000_fix_all_missing_tables_and_columns.sql |
| `storage:users can upload documents` | CREATE@20260223200000_fix_all_missing_tables_and_columns.sql → DROP@20260223200000_fix_all_missing_tables_and_columns.sql |
| `furniture_inventories:furniture_inventories_owner_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `furniture_inventories:furniture_inventories_tenant_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `furniture_items:furniture_items_owner_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `furniture_items:furniture_items_tenant_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_reports:vetusty_reports_select_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_reports:vetusty_reports_insert_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_reports:vetusty_reports_update_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_items:vetusty_items_select_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_items:vetusty_items_insert_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_items:vetusty_items_update_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `vetusty_items:vetusty_items_delete_policy` | CREATE@20260225000001_fix_furniture_vetusty_rls.sql → DROP@20260225000001_fix_furniture_vetusty_rls.sql |
| `identity_2fa_requests:identity_2fa_requests_tenant_own` | CREATE@20260229100000_identity_2fa_requests.sql → DROP@20260229100000_identity_2fa_requests.sql |
| `entity_audit_log:users can view audit logs of their entities` | CREATE@20260301100000_entity_audit_and_propagation.sql → CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `entity_audit_log:users can insert audit logs for their entities` | CREATE@20260301100000_entity_audit_and_propagation.sql → CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `entity_associates:users can manage associates of their entities` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `legal_entities:users can view their own entities` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `legal_entities:users can insert their own entities` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `legal_entities:users can update their own entities` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `legal_entities:users can delete their own entities` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `property_ownership:users can view ownership of their properties` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `property_ownership:users can manage ownership of their properties` | CREATE@20260303100000_entity_rls_fix_and_optimize.sql → DROP@20260303100000_entity_rls_fix_and_optimize.sql |
| `documents:tenants can read visible lease documents` | CREATE@20260306000000_lease_documents_visible_tenant.sql → DROP@20260306000000_lease_documents_visible_tenant.sql → CREATE@20260323000000_fix_document_visibility_and_dedup.sql → DROP@20260323000000_fix_document_visibility_and_dedup.sql |
| `messages:users can update own messages` | CREATE@20260309000001_messages_update_rls.sql → DROP@20260309000001_messages_update_rls.sql |
| `stripe_connect_accounts:owners can view own connect account` | CREATE@20260314001000_fix_stripe_connect_rls.sql → DROP@20260314001000_fix_stripe_connect_rls.sql |
| `stripe_connect_accounts:owners can create own connect account` | CREATE@20260314001000_fix_stripe_connect_rls.sql → DROP@20260314001000_fix_stripe_connect_rls.sql |
| `stripe_connect_accounts:service role full access connect` | CREATE@20260314001000_fix_stripe_connect_rls.sql → DROP@20260314001000_fix_stripe_connect_rls.sql |
| `stripe_transfers:owners can view own transfers` | CREATE@20260314001000_fix_stripe_connect_rls.sql → DROP@20260314001000_fix_stripe_connect_rls.sql |
| `stripe_transfers:service role full access transfers` | CREATE@20260314001000_fix_stripe_connect_rls.sql → DROP@20260314001000_fix_stripe_connect_rls.sql |
| `stripe_payouts:owners can view own payouts` | CREATE@20260314030000_payments_production_hardening.sql → DROP@20260314030000_payments_production_hardening.sql |
| `stripe_payouts:service role full access payouts` | CREATE@20260314030000_payments_production_hardening.sql → DROP@20260314030000_payments_production_hardening.sql |
| `buildings:buildings_owner_select` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `buildings:buildings_owner_update` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `buildings:buildings_owner_delete` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `building_units:building_units_owner_select` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `building_units:building_units_owner_insert` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `building_units:building_units_owner_update` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `building_units:building_units_owner_delete` | CREATE@20260318020000_buildings_rls_sota2026.sql → CREATE@20260415140000_buildings_sota_fix_wave1.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql → CREATE@20260415160000_buildings_rls_entity_members_support.sql → DROP@20260415160000_buildings_rls_entity_members_support.sql |
| `push_subscriptions:push_subs_own_access` | CREATE@20260404100000_rls_push_subscriptions.sql → DROP@20260404100000_rls_push_subscriptions.sql → CREATE@20260408100000_create_push_subscriptions.sql → DROP@20260408100000_create_push_subscriptions.sql |
| `ticket_messages:ticket messages same lease select` | CREATE@20260404100200_fix_ticket_messages_rls_lease_signers.sql → DROP@20260404100200_fix_ticket_messages_rls_lease_signers.sql |
| `ticket_messages:ticket messages same lease insert` | CREATE@20260404100200_fix_ticket_messages_rls_lease_signers.sql → DROP@20260404100200_fix_ticket_messages_rls_lease_signers.sql |
| `entity_members:entity_members_admin_manage` | CREATE@20260406200000_create_entities_view_and_members.sql → CREATE@20260410212232_fix_entity_members_policy_recursion.sql → DROP@20260410212232_fix_entity_members_policy_recursion.sql |
| `accounting_entries:entries_entity_access` | CREATE@20260406210000_accounting_complete.sql → CREATE@20260407120000_accounting_reconcile_schemas.sql → DROP@20260407120000_accounting_reconcile_schemas.sql |
| `accounting_entry_lines:entry_lines_via_entry` | CREATE@20260406210000_accounting_complete.sql → CREATE@20260407120000_accounting_reconcile_schemas.sql → DROP@20260407120000_accounting_reconcile_schemas.sql |
| `mandant_accounts:mandant_entity_access` | CREATE@20260407120000_accounting_reconcile_schemas.sql → DROP@20260407120000_accounting_reconcile_schemas.sql |
| `providers:owners see own providers and marketplace` | CREATE@20260408120000_providers_module_sota.sql → DROP@20260408120000_providers_module_sota.sql |
| `providers:owners can add providers` | CREATE@20260408120000_providers_module_sota.sql → DROP@20260408120000_providers_module_sota.sql |
| `providers:owners update own providers` | CREATE@20260408120000_providers_module_sota.sql → DROP@20260408120000_providers_module_sota.sql |
| `providers:admins full access providers` | CREATE@20260408120000_providers_module_sota.sql → DROP@20260408120000_providers_module_sota.sql |
| `owner_providers:owners manage own provider links` | CREATE@20260408120000_providers_module_sota.sql → DROP@20260408120000_providers_module_sota.sql |
| `subscription_addons:users can view their own addons` | CREATE@20260408120000_subscription_addons.sql → CREATE@20260409140000_fix_addons_sms_rls_recursion.sql → DROP@20260409140000_fix_addons_sms_rls_recursion.sql |
| `sms_usage:users can view their own sms usage` | CREATE@20260408120000_subscription_addons.sql → CREATE@20260409140000_fix_addons_sms_rls_recursion.sql → DROP@20260409140000_fix_addons_sms_rls_recursion.sql |
| `lease_charge_regularizations:lease_charge_reg_tenant_contest` | CREATE@20260408130000_charges_locatives_module.sql → CREATE@20260417090300_fix_tenant_contest_rls.sql → DROP@20260417090300_fix_tenant_contest_rls.sql |
| `insurance_policies:insurance_owner_view_tenants` | CREATE@20260408130000_insurance_policies.sql → DROP@20260408130000_insurance_policies.sql |
| `notification_event_preferences:users can view own event preferences` | CREATE@20260408200000_unified_notification_system.sql → DROP@20260408200000_unified_notification_system.sql |
| `notification_event_preferences:users can manage own event preferences` | CREATE@20260408200000_unified_notification_system.sql → DROP@20260408200000_unified_notification_system.sql |
| `notification_event_preferences:service can manage event preferences` | CREATE@20260408200000_unified_notification_system.sql → DROP@20260408200000_unified_notification_system.sql |
| `api_webhook_deliveries:webhook_deliveries_owner_access` | CREATE@20260409100000_add_missing_rls.sql → CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `subscription_usage_metrics:owner can view own usage metrics` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `rgpd_consent_records:consent_records_select_own` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `rgpd_consent_records:consent_records_insert_own` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `rgpd_data_requests:data_requests_select_own` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `rgpd_data_requests:data_requests_insert_own` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `rgpd_data_requests:data_requests_update_own` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `rgpd_processing_activities:processing_activities_select_own` | CREATE@20260409110000_fix_remaining_rls_recursion.sql → DROP@20260409110000_fix_remaining_rls_recursion.sql |
| `subscription_addon_subscriptions:addon_subs_owner_select` | CREATE@20260409120000_fix_subscriptions_rls_recursion.sql → DROP@20260409120000_fix_subscriptions_rls_recursion.sql |
| `buildings:service role full access buildings` | CREATE@20260409170000_backfill_building_unit_properties.sql → DROP@20260409170000_backfill_building_unit_properties.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql |
| `building_units:service role full access building_units` | CREATE@20260409170000_backfill_building_unit_properties.sql → DROP@20260409170000_backfill_building_unit_properties.sql → DROP@20260415140000_buildings_sota_fix_wave1.sql |
| `properties:owners can view own properties` | CREATE@20260410204528_extend_invoices_rls_for_sci_access.sql → DROP@20260410204528_extend_invoices_rls_for_sci_access.sql → CREATE@20260410212232_fix_entity_members_policy_recursion.sql → DROP@20260410212232_fix_entity_members_policy_recursion.sql |
| `leases:owners can view leases of own properties` | CREATE@20260410204528_extend_invoices_rls_for_sci_access.sql → DROP@20260410204528_extend_invoices_rls_for_sci_access.sql → CREATE@20260410212232_fix_entity_members_policy_recursion.sql → DROP@20260410212232_fix_entity_members_policy_recursion.sql |
| `invoices:owners can view invoices of own properties` | CREATE@20260410204528_extend_invoices_rls_for_sci_access.sql → DROP@20260410204528_extend_invoices_rls_for_sci_access.sql → CREATE@20260410212232_fix_entity_members_policy_recursion.sql → DROP@20260410212232_fix_entity_members_policy_recursion.sql |
| `work_orders:owners can view work orders of own properties` | CREATE@20260411100000_fix_work_orders_policy_recursion.sql → DROP@20260411100000_fix_work_orders_policy_recursion.sql |
| `syndic_profiles:syndic_profiles_select_own` | CREATE@20260411130200_create_syndic_profiles.sql → DROP@20260411130200_create_syndic_profiles.sql |
| `syndic_profiles:syndic_profiles_insert_own` | CREATE@20260411130200_create_syndic_profiles.sql → DROP@20260411130200_create_syndic_profiles.sql |
| `syndic_profiles:syndic_profiles_update_own` | CREATE@20260411130200_create_syndic_profiles.sql → DROP@20260411130200_create_syndic_profiles.sql |
| `copro_assemblies:copro_assemblies_syndic_all` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_assemblies:copro_assemblies_coproprietaire_select` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_convocations:copro_convocations_syndic_all` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_convocations:copro_convocations_recipient_select` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_resolutions:copro_resolutions_syndic_all` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_resolutions:copro_resolutions_coproprietaire_select` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_votes:copro_votes_syndic_all` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_votes:copro_votes_voter_own` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_minutes:copro_minutes_syndic_all` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `copro_minutes:copro_minutes_coproprietaire_select` | CREATE@20260411140000_copro_assemblies_module.sql → DROP@20260411140000_copro_assemblies_module.sql |
| `syndic_mandates:syndic_mandates_syndic_all` | CREATE@20260411140100_copro_governance_module.sql → DROP@20260411140100_copro_governance_module.sql |
| `syndic_mandates:syndic_mandates_coproprietaire_select` | CREATE@20260411140100_copro_governance_module.sql → DROP@20260411140100_copro_governance_module.sql |
| `copro_councils:copro_councils_syndic_all` | CREATE@20260411140100_copro_governance_module.sql → DROP@20260411140100_copro_governance_module.sql |
| `copro_councils:copro_councils_member_select` | CREATE@20260411140100_copro_governance_module.sql → DROP@20260411140100_copro_governance_module.sql |
| `copro_fonds_travaux:copro_fonds_travaux_syndic_all` | CREATE@20260411140100_copro_governance_module.sql → DROP@20260411140100_copro_governance_module.sql |
| `copro_fonds_travaux:copro_fonds_travaux_coproprietaire_select` | CREATE@20260411140100_copro_governance_module.sql → DROP@20260411140100_copro_governance_module.sql |
| `cash_receipts:cash_receipts_owner_select` | CREATE@20260412000000_fix_cash_receipt_rpc_sota.sql → DROP@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts:cash_receipts_owner_insert` | CREATE@20260412000000_fix_cash_receipt_rpc_sota.sql → DROP@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts:cash_receipts_owner_update` | CREATE@20260412000000_fix_cash_receipt_rpc_sota.sql → DROP@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts:cash_receipts_tenant_select` | CREATE@20260412000000_fix_cash_receipt_rpc_sota.sql → DROP@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts:cash_receipts_tenant_update` | CREATE@20260412000000_fix_cash_receipt_rpc_sota.sql → DROP@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `cash_receipts:cash_receipts_admin_select` | CREATE@20260412000000_fix_cash_receipt_rpc_sota.sql → DROP@20260412000000_fix_cash_receipt_rpc_sota.sql |
| `stripe_connect_accounts:stripe_connect_entity_access` | CREATE@20260412100000_stripe_connect_multi_entity.sql → DROP@20260412100000_stripe_connect_multi_entity.sql |
| `stripe_connect_accounts:stripe_connect_entity_insert` | CREATE@20260412100000_stripe_connect_multi_entity.sql → DROP@20260412100000_stripe_connect_multi_entity.sql |
| `stripe_connect_accounts:stripe_connect_entity_update` | CREATE@20260412100000_stripe_connect_multi_entity.sql → DROP@20260412100000_stripe_connect_multi_entity.sql |
| `documents:documents_syndic_copro_select` | CREATE@20260412110000_documents_copro_fk.sql → DROP@20260412110000_documents_copro_fk.sql |
| `documents:documents_syndic_copro_insert` | CREATE@20260412110000_documents_copro_fk.sql → DROP@20260412110000_documents_copro_fk.sql |
| `documents:documents_syndic_copro_update` | CREATE@20260412110000_documents_copro_fk.sql → DROP@20260412110000_documents_copro_fk.sql |
| `documents:documents_coproprietaire_select` | CREATE@20260412110000_documents_copro_fk.sql → DROP@20260412110000_documents_copro_fk.sql |
| `tax_notices:tax_notices_owner_access` | CREATE@20260417090100_tax_notices_table.sql → DROP@20260417090100_tax_notices_table.sql |
| `epci_reference:epci_reference_public_read` | CREATE@20260417090200_epci_reference_table.sql → DROP@20260417090200_epci_reference_table.sql |

## 5.2 — Conflits avec état DB actuel

⚠️ **Non vérifiable dans cet audit** : aucune connexion MCP Supabase disponible. Requêtes SQL prêtes dans `reports/sprint-a-schema-actual-queries.sql` pour exécution manuelle avant Sprint B.

## 5.3 — Conflits avec migrations Sprint 0+1

Migrations Sprint 0+1 détectées : 2
- `20260417100000_drop_phone_otp_codes_refs.sql` — DANGEREUX — DROP TABLE : phone_otp_codes
- `20260417110000_purge_identity_2fa_cron.sql` — SAFE — Idempotent / structural only

**Re-création de `phone_otp_codes` ?**
- ✅ Aucune migration pending ne re-crée `phone_otp_codes`.

**Conflit cron `cleanup-identity-2fa-expired` ?**
- ✅ Aucun conflit sur le nom du cron.

## 5.4 — Patterns connus Talok

### Policies RLS supposément droppées (recursion 42P17)

| Policy | Fichiers qui la créent (pending) | Verdict |
|---|---|---|
| `profiles_owner_read_tenants` | 20260213000000_fix_profiles_rls_recursion_v2.sql | 🚨 recréée |
| `subscriptions_owner_select_own` | - | ✅ pas recréée |

### Colonnes phantomes (supposément supprimées)

| Colonne | Fichiers qui l'ajoutent (pending) | Verdict |
|---|---|---|
| `usage_principal` | - | ✅ pas ré-ajoutée |
| `type_bien` | - | ✅ pas ré-ajoutée |
| `building_floors` | - | ✅ pas ré-ajoutée |

### Renames critiques (leases.status↔statut, subscriptions.plan↔plan_slug)

✅ Aucun RENAME COLUMN sur `status`/`statut`/`plan`/`plan_slug` dans les pending.

### Table `property_owners` (supposée inexistante)

✅ Aucune migration pending ne crée `property_owners`.

## 5.5 — Timestamps dupliqués

**13** timestamps avec ≥2 fichiers. Certains doublons sont des pendants "same second, different slug", d'autres sont du content divergent.

| Timestamp | Fichiers |
|---|---|
| `20260224100000` | `20260224100000_fix_tenant_dashboard_notifications_query.sql`<br>`20260224100000_normalize_provider_names.sql` |
| `20260226000000` | `20260226000000_backfill_existing_invoices_tenant_id.sql`<br>`20260226000000_fix_notifications_triggers.sql` |
| `20260306100000` | `20260306100000_add_digicode_interphone_columns.sql`<br>`20260306100000_invoice_on_fully_signed.sql` |
| `20260310200000` | `20260310200000_add_signature_push_franceconnect.sql`<br>`20260310200000_fix_property_limit_extra_properties.sql` |
| `20260328100000` | `20260328100000_create_site_content.sql`<br>`20260328100000_fix_visible_tenant_documents.sql` |
| `20260331100000` | `20260331100000_add_agricultural_property_types.sql`<br>`20260331100000_fix_document_titles_bruts.sql` |
| `20260401000001` | `20260401000001_add_initial_payment_confirmed_to_leases.sql`<br>`20260401000001_backfill_identity_status.sql` |
| `20260408100000` | `20260408100000_copro_lots.sql`<br>`20260408100000_create_push_subscriptions.sql` |
| `20260408120000` | `20260408120000_api_keys_webhooks.sql`<br>`20260408120000_colocation_module.sql`<br>`20260408120000_edl_sortie_workflow.sql`<br>`20260408120000_providers_module_sota.sql`<br>`20260408120000_smart_meters_connected.sql`<br>`20260408120000_subscription_addons.sql`<br>`20260408120000_whitelabel_agency_module.sql` |
| `20260408130000` | `20260408130000_active_sessions.sql`<br>`20260408130000_admin_panel_tables.sql`<br>`20260408130000_candidatures_workflow.sql`<br>`20260408130000_charges_locatives_module.sql`<br>`20260408130000_diagnostics_rent_control.sql`<br>`20260408130000_fix_subscription_plan_prices.sql`<br>`20260408130000_guarantor_workflow_complete.sql`<br>`20260408130000_insurance_policies.sql`<br>`20260408130000_lease_amendments_table.sql`<br>`20260408130000_rgpd_consent_records_and_data_requests.sql`<br>`20260408130000_seasonal_rental_module.sql`<br>`20260408130000_security_deposits.sql` |
| `20260411120000` | `20260411120000_harden_payments_check_constraints.sql`<br>`20260411120000_schedule_onboarding_reminders_cron.sql` |
| `20260415140000` | `20260415140000_buildings_sota_fix_wave1.sql`<br>`20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql` |
| `20260416100000` | `20260416100000_fix_messages_conversation_trigger.sql`<br>`20260416100000_fix_tickets_rls_recursion.sql` |

