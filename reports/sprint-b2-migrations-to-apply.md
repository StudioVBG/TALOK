# Migrations à appliquer — Sprint B2

**Total : 222** migrations (194 apply + 28 rename-then-apply)

## Répartition par risque

| Niveau | Nombre |
|---|---:|
| SAFE | 46 |
| MODERE | 75 |
| DANGEREUX | 51 |
| CRITIQUE | 50 |

## Liste ordonnée (par timestamp effectif après dédup)

| # | Effective ts | Fichier actuel | Risque | Action |
|---:|---|---|---|---|
| 1 | `20260208100000` | `20260208100000_fix_data_storage_audit.sql` | MODERE | apply |
| 2 | `20260209100000` | `20260209100000_create_sms_messages_table.sql` | DANGEREUX | apply |
| 3 | `20260211000000` | `20260211000000_p2_unique_constraint_and_gdpr_rpc.sql` | MODERE | apply |
| 4 | `20260211100000` | `20260211100000_bic_compliance_tax_regime.sql` | MODERE | apply |
| 5 | `20260212000000` | `20260212000000_audit_database_integrity.sql` | CRITIQUE | apply |
| 6 | `20260212000001` | `20260212000001_fix_guarantor_role_and_tables.sql` | CRITIQUE | apply |
| 7 | `20260212100000` | `20260212100000_audit_v2_merge_and_prevention.sql` | MODERE | apply |
| 8 | `20260212100001` | `20260212100001_email_template_system.sql` | CRITIQUE | apply |
| 9 | `20260212100002` | `20260212100002_email_templates_seed.sql` | SAFE | apply |
| 10 | `20260212200000` | `20260212200000_audit_v3_comprehensive_integrity.sql` | CRITIQUE | apply |
| 11 | `20260213000000` | `20260213000000_fix_profiles_rls_recursion_v2.sql` | MODERE | apply |
| 12 | `20260213100000` | `20260213100000_fix_rls_all_tables_recursion.sql` | DANGEREUX | apply |
| 13 | `20260215100000` | `20260215100000_signature_security_audit_fixes.sql` | MODERE | apply |
| 14 | `20260215200000` | `20260215200000_fix_rls_properties_tenant_pre_active.sql` | MODERE | apply |
| 15 | `20260215200001` | `20260215200001_add_notice_given_lease_status.sql` | SAFE | apply |
| 16 | `20260215200002` | `20260215200002_fix_rls_tenant_access_beyond_active.sql` | MODERE | apply |
| 17 | `20260215200003` | `20260215200003_fix_copro_fk_on_delete.sql` | SAFE | apply |
| 18 | `20260216000000` | `20260216000000_tenant_document_center.sql` | DANGEREUX | apply |
| 19 | `20260216000001` | `20260216000001_document_center_notifications.sql` | MODERE | apply |
| 20 | `20260216100000` | `20260216100000_security_audit_rls_fixes.sql` | MODERE | apply |
| 21 | `20260216200000` | `20260216200000_auto_link_lease_signers_trigger.sql` | CRITIQUE | apply |
| 22 | `20260216300000` | `20260216300000_fix_auth_profile_sync.sql` | CRITIQUE | apply |
| 23 | `20260216400000` | `20260216400000_performance_indexes_rls.sql` | SAFE | apply |
| 24 | `20260216500000` | `20260216500000_fix_tenant_dashboard_complete.sql` | CRITIQUE | apply |
| 25 | `20260216500001` | `20260216500001_enforce_unique_constraints_safety.sql` | SAFE | apply |
| 26 | `20260217000000` | `20260217000000_data_integrity_audit_repair.sql` | CRITIQUE | apply |
| 27 | `20260218000000` | `20260218000000_audit_repair_profiles.sql` | CRITIQUE | apply |
| 28 | `20260218100000` | `20260218100000_sync_auth_email_updates.sql` | CRITIQUE | apply |
| 29 | `20260219000000` | `20260219000000_missing_tables_and_rag.sql` | MODERE | apply |
| 30 | `20260219100000` | `20260219100000_auto_link_notify_owner.sql` | CRITIQUE | apply |
| 31 | `20260219200000` | `20260219200000_fix_autolink_triggers_audit.sql` | CRITIQUE | apply |
| 32 | `20260220000000` | `20260220000000_auto_link_signer_on_insert.sql` | CRITIQUE | apply |
| 33 | `20260220100000` | `20260220100000_fix_orphan_signers_audit.sql` | CRITIQUE | apply |
| 34 | `20260221000001` | `20260221000001_auto_link_trigger_update.sql` | CRITIQUE | apply |
| 35 | `20260221000002` | `20260221000002_fix_edl_signatures_rls.sql` | CRITIQUE | apply |
| 36 | `20260221100000` | `20260221100000_fix_tenant_dashboard_draft_visibility.sql` | CRITIQUE | apply |
| 37 | `20260221100001` | `20260221100001_auto_upgrade_draft_on_tenant_signer.sql` | CRITIQUE | apply |
| 38 | `20260221200000` | `20260221200000_sync_edl_signer_to_lease_signer.sql` | MODERE | apply |
| 39 | `20260221300000` | `20260221300000_fix_tenant_dashboard_owner_join.sql` | CRITIQUE | apply |
| 40 | `20260222000000` | `20260222000000_fix_invitations_and_orphan_signers.sql` | CRITIQUE | apply |
| 41 | `20260222100000` | `20260222100000_repair_missing_signers_and_invitations.sql` | CRITIQUE | apply |
| 42 | `20260222200000` | `20260222200000_ensure_all_owners_have_entity.sql` | MODERE | apply |
| 43 | `20260222200001` | `20260222200001_get_entity_stats_for_store.sql` | SAFE | apply |
| 44 | `20260223000000` | `20260223000000_fix_tenant_documents_rls.sql` | CRITIQUE | apply |
| 45 | `20260223000001` | `20260223000001_auto_fill_document_fk.sql` | DANGEREUX | apply |
| 46 | `20260223000002` | `20260223000002_document_access_views.sql` | SAFE | apply |
| 47 | `20260223000003` | `20260223000003_notify_owner_on_tenant_document.sql` | MODERE | apply |
| 48 | `20260223100000` | `20260223100000_fix_entity_connections.sql` | MODERE | apply |
| 49 | `20260223200000` | `20260223200000_fix_all_missing_tables_and_columns.sql` | DANGEREUX | apply |
| 50 | `20260224000000` | `20260224000000_fix_tenant_sync_and_notifications.sql` | CRITIQUE | apply |
| 51 | `20260224000001` | `20260224000001_remove_yousign_sendgrid_brevo.sql` | SAFE | apply |
| 52 | `20260224100000` | `20260224100000_fix_tenant_dashboard_notifications_query.sql` | CRITIQUE | apply |
| 53 | `20260224100001` | `20260224100000_normalize_provider_names.sql`<br>→ `20260224100001_normalize_provider_names.sql` | MODERE | rename-then-apply |
| 54 | `20260225000000` | `20260225000000_owner_payment_audit_log.sql` | MODERE | apply |
| 55 | `20260225000001` | `20260225000001_fix_furniture_vetusty_rls.sql` | MODERE | apply |
| 56 | `20260225100000` | `20260225100000_autolink_backfill_invoices_on_profile.sql` | CRITIQUE | apply |
| 57 | `20260226000000` | `20260226000000_backfill_existing_invoices_tenant_id.sql` | MODERE | apply |
| 58 | `20260226000001` | `20260226000000_fix_notifications_triggers.sql`<br>→ `20260226000001_fix_notifications_triggers.sql` | MODERE | rename-then-apply |
| 59 | `20260227000000` | `20260227000000_drop_auto_activate_lease_trigger.sql` | SAFE | apply |
| 60 | `20260228000000` | `20260228000000_lease_signers_share_percentage.sql` | SAFE | apply |
| 61 | `20260228100000` | `20260228100000_tenant_payment_methods_sota2026.sql` | DANGEREUX | apply |
| 62 | `20260229100000` | `20260229100000_identity_2fa_requests.sql` | MODERE | apply |
| 63 | `20260230100000` | `20260230100000_create_notification_resolve_profile_id.sql` | SAFE | apply |
| 64 | `20260301000000` | `20260301000000_create_key_handovers.sql` | DANGEREUX | apply |
| 65 | `20260301100000` | `20260301100000_entity_audit_and_propagation.sql` | DANGEREUX | apply |
| 66 | `20260303000000` | `20260303000000_backfill_uploaded_by.sql` | MODERE | apply |
| 67 | `20260303100000` | `20260303100000_entity_rls_fix_and_optimize.sql` | DANGEREUX | apply |
| 68 | `20260304000000` | `20260304000000_fix_invoice_generation_jour_paiement.sql` | SAFE | apply |
| 69 | `20260304000001` | `20260304000001_sync_sepa_collection_day.sql` | DANGEREUX | apply |
| 70 | `20260304100000` | `20260304100000_activate_pg_cron_schedules.sql` | SAFE | apply |
| 71 | `20260304200000` | `20260304200000_auto_mark_late_invoices.sql` | MODERE | apply |
| 72 | `20260305000001` | `20260305000001_invoice_engine_fields.sql` | DANGEREUX | apply |
| 73 | `20260305000002` | `20260305000002_payment_crons.sql` | SAFE | apply |
| 74 | `20260305100000` | `20260305100000_fix_invoice_draft_notification.sql` | SAFE | apply |
| 75 | `20260305100001` | `20260305100001_add_missing_notification_triggers.sql` | DANGEREUX | apply |
| 76 | `20260306000000` | `20260306000000_lease_documents_visible_tenant.sql` | MODERE | apply |
| 77 | `20260306100000` | `20260306100000_add_digicode_interphone_columns.sql` | SAFE | apply |
| 78 | `20260306100001` | `20260306100001_backfill_initial_invoices.sql` | MODERE | apply |
| 79 | `20260306100002` | `20260306100000_invoice_on_fully_signed.sql`<br>→ `20260306100002_invoice_on_fully_signed.sql` | DANGEREUX | rename-then-apply |
| 80 | `20260306200000` | `20260306200000_notify_tenant_digicode_changed.sql` | DANGEREUX | apply |
| 81 | `20260306300000` | `20260306300000_add_owner_payment_preferences.sql` | SAFE | apply |
| 82 | `20260309000000` | `20260309000000_entity_status_and_dedup.sql` | DANGEREUX | apply |
| 83 | `20260309000001` | `20260309000001_messages_update_rls.sql` | DANGEREUX | apply |
| 84 | `20260309000002` | `20260309000002_add_ticket_to_conversations.sql` | SAFE | apply |
| 85 | `20260309100000` | `20260309100000_sync_subscription_plans_features.sql` | MODERE | apply |
| 86 | `20260310000000` | `20260310000000_fix_subscription_plans_display_order.sql` | MODERE | apply |
| 87 | `20260310100000` | `20260310100000_fix_property_limit_enforcement.sql` | DANGEREUX | apply |
| 88 | `20260310200000` | `20260310200000_add_signature_push_franceconnect.sql` | CRITIQUE | apply |
| 89 | `20260310200001` | `20260310200000_fix_property_limit_extra_properties.sql`<br>→ `20260310200001_fix_property_limit_extra_properties.sql` | CRITIQUE | rename-then-apply |
| 90 | `20260310300000` | `20260310300000_add_stripe_price_extra_property_id.sql` | CRITIQUE | apply |
| 91 | `20260311100000` | `20260311100000_sync_subscription_plan_slugs.sql` | DANGEREUX | apply |
| 92 | `20260312000000` | `20260312000000_admin_dashboard_rpcs.sql` | SAFE | apply |
| 93 | `20260312000001` | `20260312000001_fix_owner_subscription_defaults.sql` | DANGEREUX | apply |
| 94 | `20260312100000` | `20260312100000_fix_handle_new_user_all_roles.sql` | SAFE | apply |
| 95 | `20260314001000` | `20260314001000_fix_stripe_connect_rls.sql` | CRITIQUE | apply |
| 96 | `20260314020000` | `20260314020000_canonical_lease_activation_flow.sql` | MODERE | apply |
| 97 | `20260314030000` | `20260314030000_payments_production_hardening.sql` | CRITIQUE | apply |
| 98 | `20260315090000` | `20260315090000_market_standard_subscription_alignment.sql` | CRITIQUE | apply |
| 99 | `20260318000000` | `20260318000000_fix_auth_reset_template_examples.sql` | MODERE | apply |
| 100 | `20260318010000` | `20260318010000_password_reset_requests.sql` | CRITIQUE | apply |
| 101 | `20260318020000` | `20260318020000_buildings_rls_sota2026.sql` | DANGEREUX | apply |
| 102 | `20260320100000` | `20260320100000_fix_owner_id_mismatch_and_rls.sql` | MODERE | apply |
| 103 | `20260321000000` | `20260321000000_drop_invoice_trigger_sota2026.sql` | SAFE | apply |
| 104 | `20260321100000` | `20260321100000_fix_cron_post_refactoring_sota2026.sql` | SAFE | apply |
| 105 | `20260323000000` | `20260323000000_fix_document_visibility_and_dedup.sql` | MODERE | apply |
| 106 | `20260324100000` | `20260324100000_prevent_duplicate_payments.sql` | SAFE | apply |
| 107 | `20260326022619` | `20260326022619_fix_documents_bucket_mime.sql` | MODERE | apply |
| 108 | `20260326022700` | `20260326022700_migrate_tenant_documents.sql` | SAFE | apply |
| 109 | `20260326022800` | `20260326022800_create_document_links.sql` | MODERE | apply |
| 110 | `20260326023000` | `20260326023000_fix_document_titles.sql` | MODERE | apply |
| 111 | `20260326205416` | `20260326205416_add_agency_role_to_handle_new_user.sql` | SAFE | apply |
| 112 | `20260327143000` | `20260327143000_add_site_config.sql` | MODERE | apply |
| 113 | `20260327200000` | `20260327200000_fix_handle_new_user_restore_email.sql` | CRITIQUE | apply |
| 114 | `20260328000000` | `20260328000000_fix_visible_tenant_documents.sql` | MODERE | apply |
| 115 | `20260328042538` | `20260328042538_update_argument_images.sql` | MODERE | apply |
| 116 | `20260328100000` | `20260328100000_create_site_content.sql` | MODERE | apply |
| 117 | `20260328100001` | `20260328100000_fix_visible_tenant_documents.sql`<br>→ `20260328100001_fix_visible_tenant_documents.sql` | MODERE | rename-then-apply |
| 118 | `20260329052631` | `20260329052631_fix_contrat_bail_visible_tenant.sql` | MODERE | apply |
| 119 | `20260329120000` | `20260329120000_add_agency_to_handle_new_user.sql` | SAFE | apply |
| 120 | `20260329164841` | `20260329164841_fix_document_titles.sql` | MODERE | apply |
| 121 | `20260329170000` | `20260329170000_add_punctuality_score.sql` | DANGEREUX | apply |
| 122 | `20260329180000` | `20260329180000_notify_owner_edl_signed.sql` | DANGEREUX | apply |
| 123 | `20260329190000` | `20260329190000_force_visible_tenant_generated_docs.sql` | DANGEREUX | apply |
| 124 | `20260330100000` | `20260330100000_add_lease_cancellation_columns.sql` | CRITIQUE | apply |
| 125 | `20260331000000` | `20260331000000_add_receipt_generated_to_invoices.sql` | MODERE | apply |
| 126 | `20260331100000` | `20260331100000_add_agricultural_property_types.sql` | SAFE | apply |
| 127 | `20260331100001` | `20260331100000_fix_document_titles_bruts.sql`<br>→ `20260331100001_fix_document_titles_bruts.sql` | MODERE | rename-then-apply |
| 128 | `20260331120000` | `20260331120000_add_signed_pdf_generated_to_leases.sql` | MODERE | apply |
| 129 | `20260331130000` | `20260331130000_key_handovers_add_cancelled_notes.sql` | SAFE | apply |
| 130 | `20260401000000` | `20260401000000_add_identity_status_onboarding_step.sql` | SAFE | apply |
| 131 | `20260401000001` | `20260401000001_add_initial_payment_confirmed_to_leases.sql` | MODERE | apply |
| 132 | `20260401000002` | `20260401000001_backfill_identity_status.sql`<br>→ `20260401000002_backfill_identity_status.sql` | MODERE | rename-then-apply |
| 133 | `20260404100000` | `20260404100000_rls_push_subscriptions.sql` | MODERE | apply |
| 134 | `20260404100100` | `20260404100100_fix_tenant_docs_view_visible_tenant.sql` | SAFE | apply |
| 135 | `20260404100200` | `20260404100200_fix_ticket_messages_rls_lease_signers.sql` | MODERE | apply |
| 136 | `20260406200000` | `20260406200000_create_entities_view_and_members.sql` | CRITIQUE | apply |
| 137 | `20260406210000` | `20260406210000_accounting_complete.sql` | CRITIQUE | apply |
| 138 | `20260407110000` | `20260407110000_audit_fixes_rls_indexes.sql` | CRITIQUE | apply |
| 139 | `20260407120000` | `20260407120000_accounting_reconcile_schemas.sql` | CRITIQUE | apply |
| 140 | `20260407130000` | `20260407130000_ocr_category_rules.sql` | MODERE | apply |
| 141 | `20260408042218` | `20260408042218_create_expenses_table.sql` | DANGEREUX | apply |
| 142 | `20260408044152` | `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql` | CRITIQUE | apply |
| 143 | `20260408100000` | `20260408100000_copro_lots.sql` | MODERE | apply |
| 144 | `20260408100001` | `20260408100000_create_push_subscriptions.sql`<br>→ `20260408100001_create_push_subscriptions.sql` | CRITIQUE | rename-then-apply |
| 145 | `20260408110000` | `20260408110000_agency_hoguet.sql` | SAFE | apply |
| 146 | `20260408120000` | `20260408120000_api_keys_webhooks.sql` | DANGEREUX | apply |
| 147 | `20260408120001` | `20260408120000_colocation_module.sql`<br>→ `20260408120001_colocation_module.sql` | DANGEREUX | rename-then-apply |
| 148 | `20260408120002` | `20260408120000_edl_sortie_workflow.sql`<br>→ `20260408120002_edl_sortie_workflow.sql` | DANGEREUX | rename-then-apply |
| 149 | `20260408120003` | `20260408120000_providers_module_sota.sql`<br>→ `20260408120003_providers_module_sota.sql` | DANGEREUX | rename-then-apply |
| 150 | `20260408120004` | `20260408120000_smart_meters_connected.sql`<br>→ `20260408120004_smart_meters_connected.sql` | DANGEREUX | rename-then-apply |
| 151 | `20260408120005` | `20260408120000_subscription_addons.sql`<br>→ `20260408120005_subscription_addons.sql` | CRITIQUE | rename-then-apply |
| 152 | `20260408120006` | `20260408120000_whitelabel_agency_module.sql`<br>→ `20260408120006_whitelabel_agency_module.sql` | DANGEREUX | rename-then-apply |
| 153 | `20260408130000` | `20260408130000_active_sessions.sql` | DANGEREUX | apply |
| 154 | `20260408130001` | `20260408130000_admin_panel_tables.sql`<br>→ `20260408130001_admin_panel_tables.sql` | DANGEREUX | rename-then-apply |
| 155 | `20260408130002` | `20260408130000_candidatures_workflow.sql`<br>→ `20260408130002_candidatures_workflow.sql` | DANGEREUX | rename-then-apply |
| 156 | `20260408130003` | `20260408130000_charges_locatives_module.sql`<br>→ `20260408130003_charges_locatives_module.sql` | DANGEREUX | rename-then-apply |
| 157 | `20260408130004` | `20260408130000_diagnostics_rent_control.sql`<br>→ `20260408130004_diagnostics_rent_control.sql` | DANGEREUX | rename-then-apply |
| 158 | `20260408130005` | `20260408130000_fix_subscription_plan_prices.sql`<br>→ `20260408130005_fix_subscription_plan_prices.sql` | MODERE | rename-then-apply |
| 159 | `20260408130006` | `20260408130000_guarantor_workflow_complete.sql`<br>→ `20260408130006_guarantor_workflow_complete.sql` | CRITIQUE | rename-then-apply |
| 160 | `20260408130007` | `20260408130000_insurance_policies.sql`<br>→ `20260408130007_insurance_policies.sql` | DANGEREUX | rename-then-apply |
| 161 | `20260408130008` | `20260408130000_lease_amendments_table.sql`<br>→ `20260408130008_lease_amendments_table.sql` | CRITIQUE | rename-then-apply |
| 162 | `20260408130009` | `20260408130000_rgpd_consent_records_and_data_requests.sql`<br>→ `20260408130009_rgpd_consent_records_and_data_requests.sql` | MODERE | rename-then-apply |
| 163 | `20260408130010` | `20260408130000_seasonal_rental_module.sql`<br>→ `20260408130010_seasonal_rental_module.sql` | DANGEREUX | rename-then-apply |
| 164 | `20260408130011` | `20260408130000_security_deposits.sql`<br>→ `20260408130011_security_deposits.sql` | DANGEREUX | rename-then-apply |
| 165 | `20260408140000` | `20260408140000_tickets_module_sota.sql` | DANGEREUX | apply |
| 166 | `20260408200000` | `20260408200000_unified_notification_system.sql` | DANGEREUX | apply |
| 167 | `20260408220000` | `20260408220000_payment_architecture_sota.sql` | DANGEREUX | apply |
| 168 | `20260409100000` | `20260409100000_add_missing_rls.sql` | MODERE | apply |
| 169 | `20260409110000` | `20260409110000_fix_remaining_rls_recursion.sql` | DANGEREUX | apply |
| 170 | `20260409120000` | `20260409120000_fix_subscriptions_rls_recursion.sql` | MODERE | apply |
| 171 | `20260409130000` | `20260409130000_fix_subscriptions_status_check.sql` | CRITIQUE | apply |
| 172 | `20260409140000` | `20260409140000_fix_addons_sms_rls_recursion.sql` | MODERE | apply |
| 173 | `20260409150000` | `20260409150000_fix_signature_tracking_and_analytics.sql` | SAFE | apply |
| 174 | `20260409160000` | `20260409160000_building_unit_lease_document_fk.sql` | DANGEREUX | apply |
| 175 | `20260409170000` | `20260409170000_backfill_building_unit_properties.sql` | DANGEREUX | apply |
| 176 | `20260409180000` | `20260409180000_buildings_site_id_nullable.sql` | MODERE | apply |
| 177 | `20260410100000` | `20260410100000_accounting_missing_indexes.sql` | SAFE | apply |
| 178 | `20260410110000` | `20260410110000_cleanup_orphan_analyses.sql` | SAFE | apply |
| 179 | `20260410180000` | `20260410180000_fix_invoice_generation_sota.sql` | MODERE | apply |
| 180 | `20260410204528` | `20260410204528_extend_invoices_rls_for_sci_access.sql` | MODERE | apply |
| 181 | `20260410210000` | `20260410210000_fix_protected_document_visibility.sql` | DANGEREUX | apply |
| 182 | `20260410210341` | `20260410210341_fix_notify_tenant_invoice_created_user_id.sql` | SAFE | apply |
| 183 | `20260410210342` | `20260410210342_fix_generate_monthly_invoices_fields.sql` | SAFE | apply |
| 184 | `20260410212232` | `20260410212232_fix_entity_members_policy_recursion.sql` | MODERE | apply |
| 185 | `20260410213940` | `20260410213940_fix_properties_tenant_policy_recursion.sql` | MODERE | apply |
| 186 | `20260410220000` | `20260410220000_cash_receipt_two_step_signature.sql` | MODERE | apply |
| 187 | `20260411000000` | `20260411000000_create_cash_receipt_function.sql` | MODERE | apply |
| 188 | `20260411100000` | `20260411100000_fix_work_orders_policy_recursion.sql` | MODERE | apply |
| 189 | `20260411120000` | `20260411120000_harden_payments_check_constraints.sql` | SAFE | apply |
| 190 | `20260411120001` | `20260411120000_schedule_onboarding_reminders_cron.sql`<br>→ `20260411120001_schedule_onboarding_reminders_cron.sql` | SAFE | rename-then-apply |
| 191 | `20260411130000` | `20260411130000_restore_handle_new_user_sota.sql` | CRITIQUE | apply |
| 192 | `20260411130100` | `20260411130100_agency_profiles_raison_sociale_nullable.sql` | MODERE | apply |
| 193 | `20260411130200` | `20260411130200_create_syndic_profiles.sql` | DANGEREUX | apply |
| 194 | `20260411130300` | `20260411130300_onboarding_role_constraints_allow_syndic_agency.sql` | SAFE | apply |
| 195 | `20260411140000` | `20260411140000_copro_assemblies_module.sql` | CRITIQUE | apply |
| 196 | `20260411140100` | `20260411140100_copro_governance_module.sql` | CRITIQUE | apply |
| 197 | `20260412000000` | `20260412000000_fix_cash_receipt_rpc_sota.sql` | MODERE | apply |
| 198 | `20260412100000` | `20260412100000_stripe_connect_multi_entity.sql` | CRITIQUE | apply |
| 199 | `20260412110000` | `20260412110000_documents_copro_fk.sql` | MODERE | apply |
| 200 | `20260412120000` | `20260412120000_copro_fund_call_lines_reminder_tracking.sql` | SAFE | apply |
| 201 | `20260412130000` | `20260412130000_copro_cron_schedules.sql` | SAFE | apply |
| 202 | `20260412140000` | `20260412140000_close_admin_self_elevation.sql` | CRITIQUE | apply |
| 203 | `20260412150000` | `20260412150000_create_cron_logs.sql` | MODERE | apply |
| 204 | `20260415000000` | `20260415000000_signup_integrity_guard.sql` | CRITIQUE | apply |
| 205 | `20260415121706` | `20260415121706_harden_sign_cash_receipt_as_tenant.sql` | MODERE | apply |
| 206 | `20260415124844` | `20260415124844_add_cheque_photo_to_payments.sql` | MODERE | apply |
| 207 | `20260415130000` | `20260415130000_fix_tenant_accessible_property_ids_security_definer.sql` | SAFE | apply |
| 208 | `20260415140000` | `20260415140000_buildings_sota_fix_wave1.sql` | DANGEREUX | apply |
| 209 | `20260415140001` | `20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql`<br>→ `20260415140001_fix_tenant_payment_signing_and_leases_recursion.sql` | MODERE | rename-then-apply |
| 210 | `20260415150000` | `20260415150000_upsert_building_with_units_rpc.sql` | MODERE | apply |
| 211 | `20260415160000` | `20260415160000_buildings_rls_entity_members_support.sql` | DANGEREUX | apply |
| 212 | `20260415230000` | `20260415230000_enforce_invoice_paid_has_payment.sql` | DANGEREUX | apply |
| 213 | `20260416100000` | `20260416100000_fix_messages_conversation_trigger.sql` | MODERE | apply |
| 214 | `20260416100001` | `20260416100000_fix_tickets_rls_recursion.sql`<br>→ `20260416100001_fix_tickets_rls_recursion.sql` | MODERE | rename-then-apply |
| 215 | `20260417090000` | `20260417090000_charges_reg_invoice_link.sql` | SAFE | apply |
| 216 | `20260417090100` | `20260417090100_tax_notices_table.sql` | DANGEREUX | apply |
| 217 | `20260417090200` | `20260417090200_epci_reference_table.sql` | MODERE | apply |
| 218 | `20260417090300` | `20260417090300_fix_tenant_contest_rls.sql` | MODERE | apply |
| 219 | `20260417090400` | `20260417090400_charges_pcg_accounts_backfill.sql` | SAFE | apply |
| 220 | `20260417090500` | `20260417090500_epci_reference_seed_drom.sql` | SAFE | apply |
| 221 | `20260417100000` | `20260417100000_drop_phone_otp_codes_refs.sql` | DANGEREUX | apply |
| 222 | `20260417110000` | `20260417110000_purge_identity_2fa_cron.sql` | SAFE | apply |

## Protocole d'application recommandé

1. **Préalable** : exécuter `scripts/audit/apply-dedup-renames.sh` (après validation) pour les 28 fichiers à renommer
2. Commit + merge de la branche `chore/migrations-dedup-timestamps`
3. Appliquer les 194 migrations dans l'ordre du tableau ci-dessus
4. Ordre d'exécution : SAFE → MODÉRÉ → DANGEREUX → CRITIQUE (cf. `sprint-a-application-plan.md` v2)

