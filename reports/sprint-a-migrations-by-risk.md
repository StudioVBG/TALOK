# Sprint A — PASS 4 : Migrations pending par niveau de risque

Cutoff : appliquées = timestamp ≤ `20260208024659`.
Total pending analysées : **223**.

| Niveau | Nombre | % |
|---|---:|---:|
| CRITIQUE | 50 | 22.4% |
| DANGEREUX | 51 | 22.9% |
| MODERE | 76 | 34.1% |
| SAFE | 46 | 20.6% |

---

## 🔸 CRITIQUE (50)

| # | Migration | Raison |
|---:|---|---|
| 1 | `20260212000000_audit_database_integrity.sql` | Touche auth.users |
| 2 | `20260212000001_fix_guarantor_role_and_tables.sql` | Touche auth.users |
| 3 | `20260212100001_email_template_system.sql` | Touche auth.users |
| 4 | `20260212200000_audit_v3_comprehensive_integrity.sql` | Touche auth.users |
| 5 | `20260216200000_auto_link_lease_signers_trigger.sql` | Touche auth.users |
| 6 | `20260216300000_fix_auth_profile_sync.sql` | Touche auth.users |
| 7 | `20260216500000_fix_tenant_dashboard_complete.sql` | Touche auth.users |
| 8 | `20260217000000_data_integrity_audit_repair.sql` | Touche auth.users |
| 9 | `20260218000000_audit_repair_profiles.sql` | Touche auth.users |
| 10 | `20260218100000_sync_auth_email_updates.sql` | Touche auth.users |
| 11 | `20260219100000_auto_link_notify_owner.sql` | Touche auth.users |
| 12 | `20260219200000_fix_autolink_triggers_audit.sql` | Touche auth.users |
| 13 | `20260220000000_auto_link_signer_on_insert.sql` | Touche auth.users |
| 14 | `20260220100000_fix_orphan_signers_audit.sql` | Touche auth.users |
| 15 | `20260221000001_auto_link_trigger_update.sql` | Touche auth.users |
| 16 | `20260221000002_fix_edl_signatures_rls.sql` | Touche auth.users |
| 17 | `20260221100000_fix_tenant_dashboard_draft_visibility.sql` | Touche auth.users |
| 18 | `20260221100001_auto_upgrade_draft_on_tenant_signer.sql` | Touche auth.users |
| 19 | `20260221300000_fix_tenant_dashboard_owner_join.sql` | Touche auth.users |
| 20 | `20260222000000_fix_invitations_and_orphan_signers.sql` | Touche auth.users |
| 21 | `20260222100000_repair_missing_signers_and_invitations.sql` | Touche auth.users |
| 22 | `20260223000000_fix_tenant_documents_rls.sql` | Touche auth.users |
| 23 | `20260224000000_fix_tenant_sync_and_notifications.sql` | Touche auth.users |
| 24 | `20260224100000_fix_tenant_dashboard_notifications_query.sql` | Touche auth.users |
| 25 | `20260225100000_autolink_backfill_invoices_on_profile.sql` | Touche auth.users |
| 26 | `20260310200000_add_signature_push_franceconnect.sql` | Touche auth.users |
| 27 | `20260310200000_fix_property_limit_extra_properties.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 28 | `20260310300000_add_stripe_price_extra_property_id.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 29 | `20260314001000_fix_stripe_connect_rls.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 30 | `20260314030000_payments_production_hardening.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 31 | `20260315090000_market_standard_subscription_alignment.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 32 | `20260318010000_password_reset_requests.sql` | Touche auth.users |
| 33 | `20260327200000_fix_handle_new_user_restore_email.sql` | Touche auth.users |
| 34 | `20260330100000_add_lease_cancellation_columns.sql` | Touche auth.users |
| 35 | `20260406200000_create_entities_view_and_members.sql` | Touche auth.users |
| 36 | `20260406210000_accounting_complete.sql` | Touche auth.users |
| 37 | `20260407110000_audit_fixes_rls_indexes.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 38 | `20260407120000_accounting_reconcile_schemas.sql` | Touche auth.users |
| 39 | `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql` | Touche auth.users |
| 40 | `20260408100000_create_push_subscriptions.sql` | Touche auth.users |
| 41 | `20260408120000_subscription_addons.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 42 | `20260408130000_guarantor_workflow_complete.sql` | Touche auth.users |
| 43 | `20260408130000_lease_amendments_table.sql` | Touche auth.users |
| 44 | `20260409130000_fix_subscriptions_status_check.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 45 | `20260411130000_restore_handle_new_user_sota.sql` | Touche auth.users |
| 46 | `20260411140000_copro_assemblies_module.sql` | Touche auth.users |
| 47 | `20260411140100_copro_governance_module.sql` | Touche auth.users |
| 48 | `20260412100000_stripe_connect_multi_entity.sql` | ALTER/DROP sur table billing (stripe_* / subscriptions*) |
| 49 | `20260412140000_close_admin_self_elevation.sql` | Touche auth.users |
| 50 | `20260415000000_signup_integrity_guard.sql` | Touche auth.users |

## 🔸 DANGEREUX (51)

| # | Migration | Raison |
|---:|---|---|
| 1 | `20260209100000_create_sms_messages_table.sql` | UPDATE sans WHERE : on |
| 2 | `20260213100000_fix_rls_all_tables_recursion.sql` | UPDATE sans WHERE : to |
| 3 | `20260216000000_tenant_document_center.sql` | UPDATE sans WHERE : of |
| 4 | `20260223000001_auto_fill_document_fk.sql` | UPDATE sans WHERE : on |
| 5 | `20260223200000_fix_all_missing_tables_and_columns.sql` | UPDATE sans WHERE : on,own,own |
| 6 | `20260228100000_tenant_payment_methods_sota2026.sql` | UPDATE sans WHERE : using,on,of,using,on,on,invoices,of |
| 7 | `20260301000000_create_key_handovers.sql` | UPDATE sans WHERE : on |
| 8 | `20260301100000_entity_audit_and_propagation.sql` | UPDATE sans WHERE : on,or |
| 9 | `20260303100000_entity_rls_fix_and_optimize.sql` | UPDATE sans WHERE : their,their |
| 10 | `20260304000001_sync_sepa_collection_day.sql` | UPDATE sans WHERE : of |
| 11 | `20260305000001_invoice_engine_fields.sql` | UPDATE sans WHERE : on |
| 12 | `20260305100001_add_missing_notification_triggers.sql` | UPDATE sans WHERE : of |
| 13 | `20260306100000_invoice_on_fully_signed.sql` | UPDATE sans WHERE : on |
| 14 | `20260306200000_notify_tenant_digicode_changed.sql` | UPDATE sans WHERE : on |
| 15 | `20260309000000_entity_status_and_dedup.sql` | UPDATE sans WHERE : on |
| 16 | `20260309000001_messages_update_rls.sql` | UPDATE sans WHERE : own |
| 17 | `20260310100000_fix_property_limit_enforcement.sql` | UPDATE sans WHERE : or,deleted_at |
| 18 | `20260311100000_sync_subscription_plan_slugs.sql` | UPDATE sans WHERE : on |
| 19 | `20260312000001_fix_owner_subscription_defaults.sql` | UPDATE sans WHERE : of |
| 20 | `20260318020000_buildings_rls_sota2026.sql` | UPDATE sans WHERE : their,their,to |
| 21 | `20260329170000_add_punctuality_score.sql` | UPDATE sans WHERE : of |
| 22 | `20260329180000_notify_owner_edl_signed.sql` | UPDATE sans WHERE : of |
| 23 | `20260329190000_force_visible_tenant_generated_docs.sql` | UPDATE sans WHERE : on |
| 24 | `20260408042218_create_expenses_table.sql` | UPDATE sans WHERE : on |
| 25 | `20260408120000_api_keys_webhooks.sql` | UPDATE sans WHERE : on,on |
| 26 | `20260408120000_colocation_module.sql` | UPDATE sans WHERE : on,on,on |
| 27 | `20260408120000_edl_sortie_workflow.sql` | UPDATE sans WHERE : using |
| 28 | `20260408120000_providers_module_sota.sql` | UPDATE sans WHERE : own,on,on,of,of |
| 29 | `20260408120000_smart_meters_connected.sql` | UPDATE sans WHERE : on |
| 30 | `20260408120000_whitelabel_agency_module.sql` | UPDATE sans WHERE : on,on,on,on |
| 31 | `20260408130000_active_sessions.sql` | UPDATE sans WHERE : own,on |
| 32 | `20260408130000_admin_panel_tables.sql` | UPDATE sans WHERE : on |
| 33 | `20260408130000_candidatures_workflow.sql` | UPDATE sans WHERE : on,on,of |
| 34 | `20260408130000_charges_locatives_module.sql` | UPDATE sans WHERE : on,on,on |
| 35 | `20260408130000_diagnostics_rent_control.sql` | UPDATE sans WHERE : on |
| 36 | `20260408130000_insurance_policies.sql` | UPDATE sans WHERE : own,on |
| 37 | `20260408130000_seasonal_rental_module.sql` | UPDATE sans WHERE : on,on |
| 38 | `20260408130000_security_deposits.sql` | UPDATE sans WHERE : on,on |
| 39 | `20260408140000_tickets_module_sota.sql` | UPDATE sans WHERE : on |
| 40 | `20260408200000_unified_notification_system.sql` | UPDATE sans WHERE : on |
| 41 | `20260408220000_payment_architecture_sota.sql` | UPDATE sans WHERE : on |
| 42 | `20260409110000_fix_remaining_rls_recursion.sql` | UPDATE sans WHERE : to |
| 43 | `20260409160000_building_unit_lease_document_fk.sql` | UPDATE sans WHERE : on |
| 44 | `20260409170000_backfill_building_unit_properties.sql` | UPDATE sans WHERE : on,on |
| 45 | `20260410210000_fix_protected_document_visibility.sql` | UPDATE sans WHERE : on |
| 46 | `20260411130200_create_syndic_profiles.sql` | UPDATE sans WHERE : on |
| 47 | `20260415140000_buildings_sota_fix_wave1.sql` | UPDATE sans WHERE : on,to |
| 48 | `20260415160000_buildings_rls_entity_members_support.sql` | UPDATE sans WHERE : to |
| 49 | `20260415230000_enforce_invoice_paid_has_payment.sql` | UPDATE sans WHERE : of |
| 50 | `20260417090100_tax_notices_table.sql` | UPDATE sans WHERE : on |
| 51 | `20260417100000_drop_phone_otp_codes_refs.sql` | DROP TABLE : phone_otp_codes |

## 🔸 MODERE (76)

| # | Migration | Raison |
|---:|---|---|
| 1 | `20260208100000_fix_data_storage_audit.sql` | ALTER column (type/constraint) |
| 2 | `20260211000000_p2_unique_constraint_and_gdpr_rpc.sql` | UPDATE |
| 3 | `20260211100000_bic_compliance_tax_regime.sql` | +1 triggers, UPDATE |
| 4 | `20260212100000_audit_v2_merge_and_prevention.sql` | +2 triggers, UPDATE |
| 5 | `20260213000000_fix_profiles_rls_recursion_v2.sql` | +3 policies |
| 6 | `20260215100000_signature_security_audit_fixes.sql` | RENAME column |
| 7 | `20260215200000_fix_rls_properties_tenant_pre_active.sql` | +1 policies, -1 policies |
| 8 | `20260215200002_fix_rls_tenant_access_beyond_active.sql` | +4 policies, -6 policies |
| 9 | `20260216000001_document_center_notifications.sql` | +1 triggers, UPDATE |
| 10 | `20260216100000_security_audit_rls_fixes.sql` | +3 policies, -7 policies |
| 11 | `20260219000000_missing_tables_and_rag.sql` | +18 policies, -18 policies, +1 triggers, UPDATE |
| 12 | `20260221200000_sync_edl_signer_to_lease_signer.sql` | +1 triggers |
| 13 | `20260221_fix_owner_data_chain.sql` | UPDATE |
| 14 | `20260222200000_ensure_all_owners_have_entity.sql` | UPDATE |
| 15 | `20260223000003_notify_owner_on_tenant_document.sql` | +1 triggers |
| 16 | `20260223100000_fix_entity_connections.sql` | +3 triggers, UPDATE |
| 17 | `20260224100000_normalize_provider_names.sql` | UPDATE |
| 18 | `20260225000000_owner_payment_audit_log.sql` | +3 policies |
| 19 | `20260225000001_fix_furniture_vetusty_rls.sql` | +11 policies, -11 policies, UPDATE |
| 20 | `20260226000000_backfill_existing_invoices_tenant_id.sql` | UPDATE |
| 21 | `20260226000000_fix_notifications_triggers.sql` | +1 triggers, ALTER column (type/constraint) |
| 22 | `20260229100000_identity_2fa_requests.sql` | +1 policies, -1 policies |
| 23 | `20260303000000_backfill_uploaded_by.sql` | UPDATE |
| 24 | `20260304200000_auto_mark_late_invoices.sql` | UPDATE |
| 25 | `20260306000000_lease_documents_visible_tenant.sql` | +1 policies, -1 policies |
| 26 | `20260306100001_backfill_initial_invoices.sql` | UPDATE |
| 27 | `20260309100000_sync_subscription_plans_features.sql` | UPDATE |
| 28 | `20260310000000_fix_subscription_plans_display_order.sql` | UPDATE |
| 29 | `20260314020000_canonical_lease_activation_flow.sql` | UPDATE |
| 30 | `20260318000000_fix_auth_reset_template_examples.sql` | UPDATE |
| 31 | `20260320100000_fix_owner_id_mismatch_and_rls.sql` | UPDATE |
| 32 | `20260323000000_fix_document_visibility_and_dedup.sql` | +1 policies, -1 policies |
| 33 | `20260326022619_fix_documents_bucket_mime.sql` | UPDATE |
| 34 | `20260326022800_create_document_links.sql` | +3 policies |
| 35 | `20260326023000_fix_document_titles.sql` | UPDATE |
| 36 | `20260327143000_add_site_config.sql` | +5 policies |
| 37 | `20260328000000_fix_visible_tenant_documents.sql` | UPDATE |
| 38 | `20260328042538_update_argument_images.sql` | UPDATE |
| 39 | `20260328100000_create_site_content.sql` | +2 policies |
| 40 | `20260328100000_fix_visible_tenant_documents.sql` | ALTER column (type/constraint), UPDATE |
| 41 | `20260329052631_fix_contrat_bail_visible_tenant.sql` | UPDATE |
| 42 | `20260329164841_fix_document_titles.sql` | UPDATE |
| 43 | `20260331000000_add_receipt_generated_to_invoices.sql` | UPDATE |
| 44 | `20260331100000_fix_document_titles_bruts.sql` | UPDATE |
| 45 | `20260331120000_add_signed_pdf_generated_to_leases.sql` | UPDATE |
| 46 | `20260401000001_add_initial_payment_confirmed_to_leases.sql` | UPDATE |
| 47 | `20260401000001_backfill_identity_status.sql` | UPDATE |
| 48 | `20260404100000_rls_push_subscriptions.sql` | +1 policies, -1 policies |
| 49 | `20260404100200_fix_ticket_messages_rls_lease_signers.sql` | +2 policies, -2 policies |
| 50 | `20260407130000_ocr_category_rules.sql` | +1 policies |
| 51 | `20260408100000_copro_lots.sql` | +2 policies, ALTER column (type/constraint), UPDATE |
| 52 | `20260408130000_fix_subscription_plan_prices.sql` | UPDATE |
| 53 | `20260408130000_rgpd_consent_records_and_data_requests.sql` | +5 policies, UPDATE |
| 54 | `20260409100000_add_missing_rls.sql` | +13 policies |
| 55 | `20260409120000_fix_subscriptions_rls_recursion.sql` | +3 policies, -3 policies |
| 56 | `20260409140000_fix_addons_sms_rls_recursion.sql` | +2 policies, -2 policies |
| 57 | `20260409180000_buildings_site_id_nullable.sql` | ALTER column (type/constraint) |
| 58 | `20260410180000_fix_invoice_generation_sota.sql` | UPDATE |
| 59 | `20260410204528_extend_invoices_rls_for_sci_access.sql` | +3 policies, -3 policies |
| 60 | `20260410212232_fix_entity_members_policy_recursion.sql` | +4 policies, -4 policies |
| 61 | `20260410213940_fix_properties_tenant_policy_recursion.sql` | +1 policies, -1 policies |
| 62 | `20260410220000_cash_receipt_two_step_signature.sql` | ALTER column (type/constraint), UPDATE |
| 63 | `20260411000000_create_cash_receipt_function.sql` | ALTER column (type/constraint) |
| 64 | `20260411100000_fix_work_orders_policy_recursion.sql` | +1 policies, -1 policies |
| 65 | `20260411130100_agency_profiles_raison_sociale_nullable.sql` | ALTER column (type/constraint) |
| 66 | `20260412000000_fix_cash_receipt_rpc_sota.sql` | +6 policies, -6 policies, ALTER column (type/constraint), UPDATE |
| 67 | `20260412110000_documents_copro_fk.sql` | +4 policies, -4 policies, UPDATE |
| 68 | `20260412150000_create_cron_logs.sql` | +2 policies |
| 69 | `20260415121706_harden_sign_cash_receipt_as_tenant.sql` | UPDATE |
| 70 | `20260415124844_add_cheque_photo_to_payments.sql` | -2 policies |
| 71 | `20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql` | +1 policies, -2 policies |
| 72 | `20260415150000_upsert_building_with_units_rpc.sql` | UPDATE |
| 73 | `20260416100000_fix_messages_conversation_trigger.sql` | +1 triggers, UPDATE |
| 74 | `20260416100000_fix_tickets_rls_recursion.sql` | +2 policies, -4 policies |
| 75 | `20260417090200_epci_reference_table.sql` | +1 policies, -1 policies |
| 76 | `20260417090300_fix_tenant_contest_rls.sql` | +1 policies, -1 policies, UPDATE |

## 🔸 SAFE (46)

| # | Migration | Raison |
|---:|---|---|
| 1 | `20260212100002_email_templates_seed.sql` | Idempotent / structural only |
| 2 | `20260215200001_add_notice_given_lease_status.sql` | Idempotent / structural only |
| 3 | `20260215200003_fix_copro_fk_on_delete.sql` | Idempotent / structural only |
| 4 | `20260216400000_performance_indexes_rls.sql` | Idempotent / structural only |
| 5 | `20260216500001_enforce_unique_constraints_safety.sql` | Idempotent / structural only |
| 6 | `20260222200001_get_entity_stats_for_store.sql` | Idempotent / structural only |
| 7 | `20260223000002_document_access_views.sql` | Idempotent / structural only |
| 8 | `20260224000001_remove_yousign_sendgrid_brevo.sql` | Idempotent / structural only |
| 9 | `20260227000000_drop_auto_activate_lease_trigger.sql` | Idempotent / structural only |
| 10 | `20260228000000_lease_signers_share_percentage.sql` | Idempotent / structural only |
| 11 | `20260230100000_create_notification_resolve_profile_id.sql` | Idempotent / structural only |
| 12 | `20260304000000_fix_invoice_generation_jour_paiement.sql` | Idempotent / structural only |
| 13 | `20260304100000_activate_pg_cron_schedules.sql` | Idempotent / structural only |
| 14 | `20260305000002_payment_crons.sql` | Idempotent / structural only |
| 15 | `20260305100000_fix_invoice_draft_notification.sql` | Idempotent / structural only |
| 16 | `20260306100000_add_digicode_interphone_columns.sql` | Idempotent / structural only |
| 17 | `20260306300000_add_owner_payment_preferences.sql` | Idempotent / structural only |
| 18 | `20260309000002_add_ticket_to_conversations.sql` | Idempotent / structural only |
| 19 | `20260312000000_admin_dashboard_rpcs.sql` | Idempotent / structural only |
| 20 | `20260312100000_fix_handle_new_user_all_roles.sql` | Idempotent / structural only |
| 21 | `20260321000000_drop_invoice_trigger_sota2026.sql` | Idempotent / structural only |
| 22 | `20260321100000_fix_cron_post_refactoring_sota2026.sql` | Idempotent / structural only |
| 23 | `20260324100000_prevent_duplicate_payments.sql` | Idempotent / structural only |
| 24 | `20260326022700_migrate_tenant_documents.sql` | Idempotent / structural only |
| 25 | `20260326205416_add_agency_role_to_handle_new_user.sql` | Idempotent / structural only |
| 26 | `20260329120000_add_agency_to_handle_new_user.sql` | Idempotent / structural only |
| 27 | `20260331100000_add_agricultural_property_types.sql` | Idempotent / structural only |
| 28 | `20260331130000_key_handovers_add_cancelled_notes.sql` | Idempotent / structural only |
| 29 | `20260401000000_add_identity_status_onboarding_step.sql` | Idempotent / structural only |
| 30 | `20260404100100_fix_tenant_docs_view_visible_tenant.sql` | Idempotent / structural only |
| 31 | `20260408110000_agency_hoguet.sql` | Idempotent / structural only |
| 32 | `20260409150000_fix_signature_tracking_and_analytics.sql` | Idempotent / structural only |
| 33 | `20260410100000_accounting_missing_indexes.sql` | Idempotent / structural only |
| 34 | `20260410110000_cleanup_orphan_analyses.sql` | Idempotent / structural only |
| 35 | `20260410210341_fix_notify_tenant_invoice_created_user_id.sql` | Idempotent / structural only |
| 36 | `20260410210342_fix_generate_monthly_invoices_fields.sql` | Idempotent / structural only |
| 37 | `20260411120000_harden_payments_check_constraints.sql` | Idempotent / structural only |
| 38 | `20260411120000_schedule_onboarding_reminders_cron.sql` | Idempotent / structural only |
| 39 | `20260411130300_onboarding_role_constraints_allow_syndic_agency.sql` | Idempotent / structural only |
| 40 | `20260412120000_copro_fund_call_lines_reminder_tracking.sql` | Idempotent / structural only |
| 41 | `20260412130000_copro_cron_schedules.sql` | Idempotent / structural only |
| 42 | `20260415130000_fix_tenant_accessible_property_ids_security_definer.sql` | Idempotent / structural only |
| 43 | `20260417090000_charges_reg_invoice_link.sql` | Idempotent / structural only |
| 44 | `20260417090400_charges_pcg_accounts_backfill.sql` | Idempotent / structural only |
| 45 | `20260417090500_epci_reference_seed_drom.sql` | Idempotent / structural only |
| 46 | `20260417110000_purge_identity_2fa_cron.sql` | Idempotent / structural only |

