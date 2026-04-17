# AUDIT — Backlog migrations Supabase

**Date :** 2026-04-17
**Branche :** `claude/audit-supabase-migrations-1C87Q`
**Scope :** migrations `supabase/migrations/` avec timestamp > `20260208024659` (dernière appliquée en prod)
**Mode :** lecture seule — aucune modification de code ou de DB.

---

## 1. Résumé exécutif

- **Total migrations pending :** 221 (repo dépasse de **53** les 168 fichiers listés dans `docs/audits/pending-migrations.md` daté du 2026-04-09).
- **Volume SQL :** 33,963 lignes (~157 lignes / fichier en moyenne, max 1 531).
- **Répartition risques :**
  - 🟢 **Safe** : 50 (23%) — pure création, additifs idempotents, DROP NOT NULL (relâchement de contrainte).
  - 🟡 **À surveiller** : 170 (77%) — contient au moins une opération non-triviale (DML, DROP+CREATE POLICY, DROP FUNCTION/TRIGGER, CHECK, contrainte).
  - 🔴 **Risqué** : 1 — **1 seule** (RENAME TABLE avec création de vue de compatibilité).

- **Structure DB préservée :** 0 DROP TABLE, 0 DROP COLUMN, 0 ALTER COLUMN TYPE, 0 SET NOT NULL détectés. 10 DROP NOT NULL (safe, relâche une contrainte), 2 RENAME (1 column `signature_image` → `_signature_image_deprecated`, 1 table `charge_regularisations` → `_legacy` + vue de compat).
- **Idempotence :** vaste majorité utilise `IF NOT EXISTS` / `IF EXISTS` (attesté dans doc existante `pending-migrations.md`).
- **Estimation temps d'application :** selon `supabase/apply_scripts/README.md`, le bloc ~29 000 lignes s'applique en ~5-10 min via psql sur pooler direct, plus 1-3 min par batch de 5 000-7 000 lignes via SQL Editor Dashboard.

**Verdict global :** backlog non-destructif, mais **170 migrations en 🟡** qui contiennent du DML ou des recréations de policies/triggers — l'ordre d'application importe pour les chaînes de dépendances (cf. §4).

> Note : intègre les 6 migrations Sprint 0 (20260417090000–090500) validées via PR #432, toutes classées 🟢 sauf 20260417090300 (DROP+CREATE POLICY, 🟡 safe).

---

## 2. Répartition par module

| Module | Total | 🟢 | 🟡 | 🔴 | Lignes |
|--------|------:|---:|---:|---:|-------:|
| RLS/Sécurité | 29 | 2 | 27 | 0 | 3,100 |
| Divers | 25 | 9 | 16 | 0 | 3,590 |
| Baux/Signatures | 19 | 2 | 17 | 0 | 1,986 |
| Documents | 19 | 3 | 16 | 0 | 2,106 |
| Auth/Profiles | 15 | 2 | 13 | 0 | 1,307 |
| Paiements | 15 | 4 | 11 | 0 | 2,148 |
| Invoices | 14 | 0 | 14 | 0 | 1,930 |
| Subscriptions/Stripe | 11 | 1 | 10 | 0 | 1,696 |
| Audit/Repair | 9 | 1 | 8 | 0 | 5,492 |
| Copro/Syndic | 7 | 2 | 5 | 0 | 1,248 |
| Notifications | 6 | 1 | 5 | 0 | 921 |
| Entities | 5 | 1 | 4 | 0 | 713 |
| Crons | 4 | 4 | 0 | 0 | 223 |
| Comptabilité | 4 | 1 | 2 | 1 | 1,441 |
| Buildings | 4 | 1 | 3 | 0 | 990 |
| Messaging | 3 | 0 | 3 | 0 | 973 |
| Candidatures/Garants | 3 | 0 | 3 | 0 | 644 |
| API/Providers | 3 | 1 | 2 | 0 | 610 |
| Admin | 3 | 1 | 2 | 0 | 403 |
| Site/Landing | 3 | 1 | 2 | 0 | 172 |
| RGPD | 2 | 1 | 1 | 0 | 358 |
| Tickets | 2 | 1 | 1 | 0 | 136 |
| Agence/White-label | 2 | 2 | 0 | 0 | 378 |
| Push/Notif | 1 | 1 | 0 | 0 | 86 |
| Colocation | 1 | 1 | 0 | 0 | 398 |
| IoT | 1 | 1 | 0 | 0 | 255 |
| Diagnostics | 1 | 0 | 1 | 0 | 151 |
| Insurance | 1 | 0 | 1 | 0 | 164 |
| Saisonnier | 1 | 1 | 0 | 0 | 173 |
| Dépôts | 1 | 0 | 1 | 0 | 138 |
| Onboarding | 1 | 0 | 1 | 0 | 33 |

---

## 3. Inventaire complet par phase temporelle

> Regroupement chronologique. Les "5 phase files ready to apply" mentionnées en mémoire projet correspondent aux **5 phases fonctionnelles** décrites dans `docs/audits/pending-migrations.md` (RLS → Core → Entités → Modules → Cosmetic). Elles ne sont **pas** matérialisées en 5 fichiers SQL distincts, mais réparties dans :
> - `supabase/apply_scripts/batch_01.sql` → `batch_05.sql` (découpage mécanique ~7 000 lignes/lot, 2026-04-09)
> - `supabase/apply_scripts/batch_pending_01..04` (groupes thématiques pour fév 2026)
> - `supabase/APPLY_ALL_MIGRATIONS.sql` (~29 000 lignes, all-in-one)
>
> **Ces fichiers sont DATÉS (pré-20260411) et ne couvrent PAS les 40+ migrations ajoutées depuis le 10/04/2026.** Il faudra régénérer les scripts ou passer par `supabase db push`.


### Phase 1 — Fév 2026 (RLS + Audit initial)
**62 migrations** — 🟢10 🟡52 🔴0

| Timestamp | Fichier | Module | Risk |
|-----------|---------|--------|------|
| 20260208100000 | `fix_data_storage_audit` | Audit/Repair | 🟡 |
| 20260209100000 | `create_sms_messages_table` | Messaging | 🟡 |
| 20260211000000 | `p2_unique_constraint_and_gdpr_rpc` | RGPD | 🟡 |
| 20260211100000 | `bic_compliance_tax_regime` | Divers | 🟡 |
| 20260212000000 | `audit_database_integrity` | Audit/Repair | 🟡 |
| 20260212000001 | `fix_guarantor_role_and_tables` | Candidatures/Garants | 🟡 |
| 20260212100000 | `audit_v2_merge_and_prevention` | Audit/Repair | 🟡 |
| 20260212100001 | `email_template_system` | Messaging | 🟡 |
| 20260212100002 | `email_templates_seed` | Messaging | 🟡 |
| 20260212200000 | `audit_v3_comprehensive_integrity` | Audit/Repair | 🟢 |
| 20260213000000 | `fix_profiles_rls_recursion_v2` | RLS/Sécurité | 🟡 |
| 20260213100000 | `fix_rls_all_tables_recursion` | RLS/Sécurité | 🟡 |
| 20260215100000 | `signature_security_audit_fixes` | RLS/Sécurité | 🟡 |
| 20260215200000 | `fix_rls_properties_tenant_pre_active` | RLS/Sécurité | 🟡 |
| 20260215200001 | `add_notice_given_lease_status` | Baux/Signatures | 🟡 |
| 20260215200002 | `fix_rls_tenant_access_beyond_active` | RLS/Sécurité | 🟡 |
| 20260215200003 | `fix_copro_fk_on_delete` | Copro/Syndic | 🟡 |
| 20260216000000 | `tenant_document_center` | Documents | 🟡 |
| 20260216000001 | `document_center_notifications` | Documents | 🟡 |
| 20260216100000 | `security_audit_rls_fixes` | RLS/Sécurité | 🟡 |
| 20260216200000 | `auto_link_lease_signers_trigger` | Baux/Signatures | 🟡 |
| 20260216300000 | `fix_auth_profile_sync` | Auth/Profiles | 🟡 |
| 20260216400000 | `performance_indexes_rls` | RLS/Sécurité | 🟢 |
| 20260216500000 | `fix_tenant_dashboard_complete` | Divers | 🟢 |
| 20260216500001 | `enforce_unique_constraints_safety` | Divers | 🟡 |
| 20260217000000 | `data_integrity_audit_repair` | Audit/Repair | 🟡 |
| 20260218000000 | `audit_repair_profiles` | Auth/Profiles | 🟡 |
| 20260218100000 | `sync_auth_email_updates` | Auth/Profiles | 🟡 |
| 20260219000000 | `missing_tables_and_rag` | Divers | 🟡 |
| 20260219100000 | `auto_link_notify_owner` | Baux/Signatures | 🟡 |
| 20260219200000 | `fix_autolink_triggers_audit` | Audit/Repair | 🟡 |
| 20260220000000 | `auto_link_signer_on_insert` | Baux/Signatures | 🟡 |
| 20260220100000 | `fix_orphan_signers_audit` | Baux/Signatures | 🟡 |
| 20260221 | `fix_owner_data_chain` | Divers | 🟡 |
| 20260221000001 | `auto_link_trigger_update` | Baux/Signatures | 🟡 |
| 20260221000002 | `fix_edl_signatures_rls` | RLS/Sécurité | 🟡 |
| 20260221100000 | `fix_tenant_dashboard_draft_visibility` | Divers | 🟢 |
| 20260221100001 | `auto_upgrade_draft_on_tenant_signer` | Baux/Signatures | 🟡 |
| 20260221200000 | `sync_edl_signer_to_lease_signer` | Baux/Signatures | 🟡 |
| 20260221300000 | `fix_tenant_dashboard_owner_join` | Divers | 🟢 |
| 20260222000000 | `fix_invitations_and_orphan_signers` | Baux/Signatures | 🟡 |
| 20260222100000 | `repair_missing_signers_and_invitations` | Baux/Signatures | 🟡 |
| 20260222200000 | `ensure_all_owners_have_entity` | Entities | 🟡 |
| 20260222200001 | `get_entity_stats_for_store` | Entities | 🟢 |
| 20260223000000 | `fix_tenant_documents_rls` | RLS/Sécurité | 🟡 |
| 20260223000001 | `auto_fill_document_fk` | Documents | 🟡 |
| 20260223000002 | `document_access_views` | Documents | 🟢 |
| 20260223000003 | `notify_owner_on_tenant_document` | Documents | 🟡 |
| 20260223100000 | `fix_entity_connections` | Entities | 🟡 |
| 20260223200000 | `fix_all_missing_tables_and_columns` | Divers | 🟡 |
| 20260224000000 | `fix_tenant_sync_and_notifications` | Notifications | 🟡 |
| 20260224000001 | `remove_yousign_sendgrid_brevo` | Divers | 🟡 |
| 20260224100000 | `fix_tenant_dashboard_notifications_query` | Notifications | 🟢 |
| 20260224100000 | `normalize_provider_names` | API/Providers | 🟡 |
| 20260225000000 | `owner_payment_audit_log` | Paiements | 🟢 |
| 20260225000001 | `fix_furniture_vetusty_rls` | RLS/Sécurité | 🟡 |
| 20260225100000 | `autolink_backfill_invoices_on_profile` | Invoices | 🟡 |
| 20260226000000 | `backfill_existing_invoices_tenant_id` | Invoices | 🟡 |
| 20260226000000 | `fix_notifications_triggers` | Notifications | 🟡 |
| 20260227000000 | `drop_auto_activate_lease_trigger` | Baux/Signatures | 🟡 |
| 20260228000000 | `lease_signers_share_percentage` | Baux/Signatures | 🟢 |
| 20260228100000 | `tenant_payment_methods_sota2026` | Paiements | 🟡 |

### Phase 2 — Mars 2026 (Stabilisation)
**66 migrations** — 🟢14 🟡52 🔴0

| Timestamp | Fichier | Module | Risk |
|-----------|---------|--------|------|
| 20260301000000 | `create_key_handovers` | Divers | 🟢 |
| 20260301100000 | `entity_audit_and_propagation` | Audit/Repair | 🟡 |
| 20260303000000 | `backfill_uploaded_by` | Audit/Repair | 🟡 |
| 20260303100000 | `entity_rls_fix_and_optimize` | RLS/Sécurité | 🟡 |
| 20260304000000 | `fix_invoice_generation_jour_paiement` | Invoices | 🟡 |
| 20260304000001 | `sync_sepa_collection_day` | Paiements | 🟡 |
| 20260304100000 | `activate_pg_cron_schedules` | Crons | 🟢 |
| 20260304200000 | `auto_mark_late_invoices` | Invoices | 🟡 |
| 20260305000001 | `invoice_engine_fields` | Invoices | 🟡 |
| 20260305000002 | `payment_crons` | Paiements | 🟢 |
| 20260305100000 | `fix_invoice_draft_notification` | Invoices | 🟡 |
| 20260305100001 | `add_missing_notification_triggers` | Notifications | 🟡 |
| 20260306000000 | `lease_documents_visible_tenant` | Baux/Signatures | 🟡 |
| 20260306100000 | `add_digicode_interphone_columns` | Divers | 🟢 |
| 20260306100000 | `invoice_on_fully_signed` | Invoices | 🟡 |
| 20260306100001 | `backfill_initial_invoices` | Invoices | 🟡 |
| 20260306200000 | `notify_tenant_digicode_changed` | Documents | 🟡 |
| 20260306300000 | `add_owner_payment_preferences` | Paiements | 🟢 |
| 20260309000000 | `entity_status_and_dedup` | Entities | 🟡 |
| 20260309000001 | `messages_update_rls` | RLS/Sécurité | 🟡 |
| 20260309000002 | `add_ticket_to_conversations` | Tickets | 🟢 |
| 20260309100000 | `sync_subscription_plans_features` | Subscriptions/Stripe | 🟡 |
| 20260310000000 | `fix_subscription_plans_display_order` | Subscriptions/Stripe | 🟡 |
| 20260310100000 | `fix_property_limit_enforcement` | Divers | 🟡 |
| 20260310200000 | `add_signature_push_franceconnect` | Push/Notif | 🟢 |
| 20260310200000 | `fix_property_limit_extra_properties` | Divers | 🟡 |
| 20260310300000 | `add_stripe_price_extra_property_id` | Subscriptions/Stripe | 🟢 |
| 20260311100000 | `sync_subscription_plan_slugs` | Subscriptions/Stripe | 🟡 |
| 20260312000000 | `admin_dashboard_rpcs` | Admin | 🟢 |
| 20260312000001 | `fix_owner_subscription_defaults` | Subscriptions/Stripe | 🟡 |
| 20260312100000 | `fix_handle_new_user_all_roles` | Auth/Profiles | 🟡 |
| 20260314001000 | `fix_stripe_connect_rls` | RLS/Sécurité | 🟡 |
| 20260314020000 | `canonical_lease_activation_flow` | Baux/Signatures | 🟡 |
| 20260314030000 | `payments_production_hardening` | Paiements | 🟡 |
| 20260315090000 | `market_standard_subscription_alignment` | Subscriptions/Stripe | 🟡 |
| 20260318000000 | `fix_auth_reset_template_examples` | Auth/Profiles | 🟡 |
| 20260318010000 | `password_reset_requests` | Auth/Profiles | 🟡 |
| 20260318020000 | `buildings_rls_sota2026` | RLS/Sécurité | 🟡 |
| 20260320100000 | `fix_owner_id_mismatch_and_rls` | RLS/Sécurité | 🟡 |
| 20260321000000 | `drop_invoice_trigger_sota2026` | Invoices | 🟡 |
| 20260321100000 | `fix_cron_post_refactoring_sota2026` | Crons | 🟢 |
| 20260323000000 | `fix_document_visibility_and_dedup` | Documents | 🟡 |
| 20260324100000 | `prevent_duplicate_payments` | Paiements | 🟢 |
| 20260326022619 | `fix_documents_bucket_mime` | Documents | 🟡 |
| 20260326022700 | `migrate_tenant_documents` | Documents | 🟡 |
| 20260326022800 | `create_document_links` | Documents | 🟢 |
| 20260326023000 | `fix_document_titles` | Documents | 🟡 |
| 20260326205416 | `add_agency_role_to_handle_new_user` | Auth/Profiles | 🟡 |
| 20260327143000 | `add_site_config` | Site/Landing | 🟡 |
| 20260327200000 | `fix_handle_new_user_restore_email` | Auth/Profiles | 🟡 |
| 20260328000000 | `fix_visible_tenant_documents` | Documents | 🟡 |
| 20260328042538 | `update_argument_images` | Site/Landing | 🟡 |
| 20260328100000 | `create_site_content` | Site/Landing | 🟢 |
| 20260328100000 | `fix_visible_tenant_documents` | Documents | 🟡 |
| 20260329052631 | `fix_contrat_bail_visible_tenant` | Documents | 🟡 |
| 20260329120000 | `add_agency_to_handle_new_user` | Auth/Profiles | 🟡 |
| 20260329164841 | `fix_document_titles` | Documents | 🟡 |
| 20260329170000 | `add_punctuality_score` | Divers | 🟡 |
| 20260329180000 | `notify_owner_edl_signed` | Baux/Signatures | 🟡 |
| 20260329190000 | `force_visible_tenant_generated_docs` | Documents | 🟡 |
| 20260330100000 | `add_lease_cancellation_columns` | Baux/Signatures | 🟡 |
| 20260331000000 | `add_receipt_generated_to_invoices` | Invoices | 🟡 |
| 20260331100000 | `add_agricultural_property_types` | Divers | 🟡 |
| 20260331100000 | `fix_document_titles_bruts` | Documents | 🟡 |
| 20260331120000 | `add_signed_pdf_generated_to_leases` | Divers | 🟡 |
| 20260331130000 | `key_handovers_add_cancelled_notes` | Divers | 🟢 |

### Phase 3 — Avr début (modules)
**57 migrations** — 🟢16 🟡40 🔴1

| Timestamp | Fichier | Module | Risk |
|-----------|---------|--------|------|
| 20260401000000 | `add_identity_status_onboarding_step` | Auth/Profiles | 🟢 |
| 20260401000001 | `add_initial_payment_confirmed_to_leases` | Paiements | 🟡 |
| 20260401000001 | `backfill_identity_status` | Auth/Profiles | 🟡 |
| 20260404100000 | `rls_push_subscriptions` | RLS/Sécurité | 🟡 |
| 20260404100100 | `fix_tenant_docs_view_visible_tenant` | Documents | 🟢 |
| 20260404100200 | `fix_ticket_messages_rls_lease_signers` | RLS/Sécurité | 🟡 |
| 20260406200000 | `create_entities_view_and_members` | Entities | 🟡 |
| 20260406210000 | `accounting_complete` | Comptabilité | 🟡 |
| 20260407110000 | `audit_fixes_rls_indexes` | RLS/Sécurité | 🟡 |
| 20260407120000 | `accounting_reconcile_schemas` | Comptabilité | 🟡 |
| 20260407130000 | `ocr_category_rules` | Divers | 🟢 |
| 20260408042218 | `create_expenses_table` | Divers | 🟢 |
| 20260408044152 | `reconcile_charge_regularisations_and_backfill_entry_lines` | Comptabilité | 🔴 |
| 20260408100000 | `copro_lots` | Copro/Syndic | 🟡 |
| 20260408100000 | `create_push_subscriptions` | Subscriptions/Stripe | 🟡 |
| 20260408110000 | `agency_hoguet` | Agence/White-label | 🟢 |
| 20260408120000 | `api_keys_webhooks` | API/Providers | 🟢 |
| 20260408120000 | `colocation_module` | Colocation | 🟢 |
| 20260408120000 | `edl_sortie_workflow` | Baux/Signatures | 🟡 |
| 20260408120000 | `providers_module_sota` | API/Providers | 🟡 |
| 20260408120000 | `smart_meters_connected` | IoT | 🟢 |
| 20260408120000 | `subscription_addons` | Subscriptions/Stripe | 🟡 |
| 20260408120000 | `whitelabel_agency_module` | Agence/White-label | 🟢 |
| 20260408130000 | `active_sessions` | Divers | 🟡 |
| 20260408130000 | `admin_panel_tables` | Admin | 🟡 |
| 20260408130000 | `candidatures_workflow` | Candidatures/Garants | 🟡 |
| 20260408130000 | `charges_locatives_module` | Divers | 🟢 |
| 20260408130000 | `diagnostics_rent_control` | Diagnostics | 🟡 |
| 20260408130000 | `fix_subscription_plan_prices` | Subscriptions/Stripe | 🟡 |
| 20260408130000 | `guarantor_workflow_complete` | Candidatures/Garants | 🟡 |
| 20260408130000 | `insurance_policies` | Insurance | 🟡 |
| 20260408130000 | `lease_amendments_table` | Baux/Signatures | 🟢 |
| 20260408130000 | `rgpd_consent_records_and_data_requests` | RGPD | 🟢 |
| 20260408130000 | `seasonal_rental_module` | Saisonnier | 🟢 |
| 20260408130000 | `security_deposits` | Dépôts | 🟡 |
| 20260408140000 | `tickets_module_sota` | Tickets | 🟡 |
| 20260408200000 | `unified_notification_system` | Notifications | 🟡 |
| 20260408220000 | `payment_architecture_sota` | Paiements | 🟡 |
| 20260409100000 | `add_missing_rls` | RLS/Sécurité | 🟢 |
| 20260409110000 | `fix_remaining_rls_recursion` | RLS/Sécurité | 🟡 |
| 20260409120000 | `fix_subscriptions_rls_recursion` | RLS/Sécurité | 🟡 |
| 20260409130000 | `fix_subscriptions_status_check` | Subscriptions/Stripe | 🟡 |
| 20260409140000 | `fix_addons_sms_rls_recursion` | RLS/Sécurité | 🟡 |
| 20260409150000 | `fix_signature_tracking_and_analytics` | Divers | 🟡 |
| 20260409160000 | `building_unit_lease_document_fk` | Baux/Signatures | 🟡 |
| 20260409170000 | `backfill_building_unit_properties` | Buildings | 🟡 |
| 20260409180000 | `buildings_site_id_nullable` | Buildings | 🟢 |
| 20260410100000 | `accounting_missing_indexes` | Comptabilité | 🟢 |
| 20260410110000 | `cleanup_orphan_analyses` | Divers | 🟡 |
| 20260410180000 | `fix_invoice_generation_sota` | Invoices | 🟡 |
| 20260410204528 | `extend_invoices_rls_for_sci_access` | RLS/Sécurité | 🟡 |
| 20260410210000 | `fix_protected_document_visibility` | Documents | 🟡 |
| 20260410210341 | `fix_notify_tenant_invoice_created_user_id` | Invoices | 🟡 |
| 20260410210342 | `fix_generate_monthly_invoices_fields` | Invoices | 🟡 |
| 20260410212232 | `fix_entity_members_policy_recursion` | RLS/Sécurité | 🟡 |
| 20260410213940 | `fix_properties_tenant_policy_recursion` | RLS/Sécurité | 🟡 |
| 20260410220000 | `cash_receipt_two_step_signature` | Paiements | 🟡 |

### Phase 4 — Avr mi (crons/copro/cash)
**17 migrations** — 🟢5 🟡12 🔴0

| Timestamp | Fichier | Module | Risk |
|-----------|---------|--------|------|
| 20260411000000 | `create_cash_receipt_function` | Paiements | 🟡 |
| 20260411100000 | `fix_work_orders_policy_recursion` | RLS/Sécurité | 🟡 |
| 20260411120000 | `harden_payments_check_constraints` | Paiements | 🟡 |
| 20260411120000 | `schedule_onboarding_reminders_cron` | Crons | 🟢 |
| 20260411130000 | `restore_handle_new_user_sota` | Auth/Profiles | 🟡 |
| 20260411130100 | `agency_profiles_raison_sociale_nullable` | Auth/Profiles | 🟢 |
| 20260411130200 | `create_syndic_profiles` | Auth/Profiles | 🟡 |
| 20260411130300 | `onboarding_role_constraints_allow_syndic_agency` | Onboarding | 🟡 |
| 20260411140000 | `copro_assemblies_module` | Copro/Syndic | 🟡 |
| 20260411140100 | `copro_governance_module` | Copro/Syndic | 🟡 |
| 20260412000000 | `fix_cash_receipt_rpc_sota` | Paiements | 🟡 |
| 20260412100000 | `stripe_connect_multi_entity` | Subscriptions/Stripe | 🟡 |
| 20260412110000 | `documents_copro_fk` | Copro/Syndic | 🟡 |
| 20260412120000 | `copro_fund_call_lines_reminder_tracking` | Copro/Syndic | 🟢 |
| 20260412130000 | `copro_cron_schedules` | Copro/Syndic | 🟢 |
| 20260412140000 | `close_admin_self_elevation` | Admin | 🟡 |
| 20260412150000 | `create_cron_logs` | Crons | 🟢 |

### Phase 5 — Avr fin (buildings/signup)
**11 migrations** — 🟢0 🟡11 🔴0

| Timestamp | Fichier | Module | Risk |
|-----------|---------|--------|------|
| 20260415000000 | `signup_integrity_guard` | Audit/Repair | 🟡 |
| 20260415121706 | `harden_sign_cash_receipt_as_tenant` | Paiements | 🟡 |
| 20260415124844 | `add_cheque_photo_to_payments` | Paiements | 🟡 |
| 20260415130000 | `fix_tenant_accessible_property_ids_security_definer` | Divers | 🟡 |
| 20260415140000 | `buildings_sota_fix_wave1` | Buildings | 🟡 |
| 20260415140000 | `fix_tenant_payment_signing_and_leases_recursion` | RLS/Sécurité | 🟡 |
| 20260415150000 | `upsert_building_with_units_rpc` | Buildings | 🟡 |
| 20260415160000 | `buildings_rls_entity_members_support` | RLS/Sécurité | 🟡 |
| 20260415230000 | `enforce_invoice_paid_has_payment` | Invoices | 🟡 |
| 20260416100000 | `fix_messages_conversation_trigger` | Divers | 🟡 |
| 20260416100000 | `fix_tickets_rls_recursion` | RLS/Sécurité | 🟡 |

---

## 4. Section risques 🔴

### 4.1 — `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql` (307 L)

**Module :** Comptabilité / Charges
**Classement :** 🔴 — **RENAME TABLE + backfill DML + création de vue de compatibilité**

**Ce qui se passe :**
```sql
-- Ligne 100-118 : backfills sur charge_regularizations (table cible normalisée)
UPDATE public.charge_regularizations SET entity_id = (...) WHERE entity_id IS NULL ...;
UPDATE public.charge_regularizations SET exercise_id = (...) WHERE exercise_id IS NULL ...;

-- Ligne 123 : RENAME de l'ancienne table legacy
ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;

-- Ligne 127 : création d'une VIEW pour compat code legacy
CREATE OR REPLACE VIEW public.charge_regularisations AS
SELECT ... (provisions_paid_cents / 100.0)::DECIMAL(15,2) AS provisions_versees, ...
FROM public.charge_regularizations;

-- Triggers INSTEAD OF pour INSERT/UPDATE/DELETE sur la vue
```

**Risques identifiés :**
1. **Non-idempotent sur RENAME** : si la migration a été ré-exécutée partiellement, `charge_regularisations` peut être soit une table, soit une vue, soit ne pas exister — la ré-exécution échouera sur le RENAME.
2. **Double nom quasi-identique** : `charge_regularisations` (FR) et `charge_regularizations` (EN) coexistent — risque de confusion dans le code.
3. **Perte de perf** : la vue émule l'API FR mais repose sur des triggers INSTEAD OF → les writes legacy passent par PL/pgSQL.
4. **Cascade FK** : vérifier qu'aucune FK ne pointe vers l'ancienne `charge_regularisations` avant de rename (sinon cascade rename non-automatique).

**Pré-requis application :**
- Confirmer en prod : `SELECT table_type FROM information_schema.tables WHERE table_name IN ('charge_regularisations','charge_regularizations');`
- Inspecter dépendances : `SELECT * FROM pg_constraint WHERE confrelid = 'charge_regularisations'::regclass;`
- Ajouter un `DO $$ IF` guard autour du RENAME (idempotence).

---

### 4.2 — Migrations 🟡 avec DML "lourd" à surveiller (top 10)

Classées 🟡 mais à revoir en priorité avant application :

| Fichier | UPD | DEL | INS | Pourquoi surveiller |
|---------|----:|----:|----:|---------------------|
| `20260212000000_audit_database_integrity.sql` | 3 | **13** | 9 | Audit d'intégrité : DELETE sur `lease_signers`, `invoices`, `payments` — **impact métier** |
| `20260212100000_audit_v2_merge_and_prevention.sql` | **27** | 6 | 8 | Fusion de doublons via fonctions DML (DELETE sur `invoices`, `documents`, `edl`) |
| `20260211000000_p2_unique_constraint_and_gdpr_rpc.sql` | 9 | **8** | 1 | RPC GDPR : DELETE cascade sur `user_consents`, `notifications`, `tenant_identity_documents` |
| `20260216500001_enforce_unique_constraints_safety.sql` | 0 | **4** | 0 | DELETE doublons via ROW_NUMBER sur `invoices`, `lease_signers`, `roommates`, `documents` — **pertinent pour contraintes UNIQUE** |
| `20260309100000_sync_subscription_plans_features.sql` | 5 | 0 | **10** | 820 L, seed + sync des 4 plans + features |
| `20260217000000_data_integrity_audit_repair.sql` | 6 | 0 | 9 | 841 L, repair_log + INSERT de données de référence |
| `20260315090000_market_standard_subscription_alignment.sql` | 9 | 0 | 0 | UPDATE prix des plans (alignement 35€/69€) |
| `20260310000000_fix_subscription_plans_display_order.sql` | 9 | 0 | 0 | UPDATE display_order + data |
| `20260408120000_providers_module_sota.sql` | 6 | 0 | 0 | 444 L, DROP POL×5, UPDATE backfill statuts |
| `20260415140000_buildings_sota_fix_wave1.sql` | 7 | 0 | 0 | 445 L, DROP POL×9, backfills buildings+units |

**Pattern commun :** ces migrations contiennent à la fois **CREATE/ALTER** structurels ET des **backfills DML**. Elles sont transactionnelles (`BEGIN; ... COMMIT;`) donc rollback possible, mais :
- volumétrie prod inconnue → `UPDATE` sans index peut être lent
- DELETE de doublons = destructif si l'ordre de priorité dans `ROW_NUMBER() OVER (ORDER BY created_at DESC)` n'est pas le bon

---

### 4.3 — Migrations avec gros remaniement de policies RLS (DROP×≥5 + CREATE×)

| Fichier | DROP POL | CREATE POL | Commentaire |
|---------|---------:|-----------:|-------------|
| `20260219000000_missing_tables_and_rag.sql` | **18** | 18 | Refonte complète RLS sur nouvelles tables `tenant_rewards`, `invoice_reminders` |
| `20260225000001_fix_furniture_vetusty_rls.sql` | 11 | 11 | Refonte policies `furniture_inventories` / `vetusty_grids` |
| `20260303100000_entity_rls_fix_and_optimize.sql` | 10 | 9 | -1 policy net (perte d'une policy ?) |
| `20260411140000_copro_assemblies_module.sql` | 10 | 10 | Module copro nouvel |
| `20260415140000_buildings_sota_fix_wave1.sql` | 9 | 7 | **-2 policies net** |
| `20260318020000_buildings_rls_sota2026.sql` | 8 | 12 | +4 policies |
| `20260216100000_security_audit_rls_fixes.sql` | 7 | 3 | **-4 policies net** — intentionnel (suppression de policies `USING(true)`) |
| `20260409110000_fix_remaining_rls_recursion.sql` | 8 | 8 | Fix récursions |
| `20260416100000_fix_tickets_rls_recursion.sql` | 5 | 2 | **-3 policies net** |

**Règle de vigilance :** différence `DROP - CREATE` négative (ex. -4 net) signifie suppression intentionnelle de policies permissives. Différence positive = élargissement. À faire valider case par case avec le diff git.

---

## 5. Dépendances identifiées (chaînes)

### 5.1 — `handle_new_user()` trigger (5 redéfinitions en backlog)

La fonction `public.handle_new_user()` est **redéfinie 5 fois** dans le backlog :

```
20260312100000  fix_handle_new_user_all_roles           (owner/tenant/guarantor)
20260326205416  add_agency_role_to_handle_new_user      (+ agency)
20260327200000  fix_handle_new_user_restore_email       (fix regression)
20260329120000  add_agency_to_handle_new_user           (idempotent avec la précédente ?)
20260411130000  restore_handle_new_user_sota            (version finale "SOTA")
```

**Ordre obligatoire :** chronologique strict — chaque migration remplace la précédente via `CREATE OR REPLACE FUNCTION`. Si l'ordre est cassé, la dernière gagne → heureusement `restore_handle_new_user_sota` est la plus récente, donc un **squash** serait possible mais n'est pas fait.

### 5.2 — Auto-link lease signers (trigger + backfills)

```
20260216200000  auto_link_lease_signers_trigger         (création trigger + fonction)
20260219100000  auto_link_notify_owner                  (ajoute notification)
20260219200000  fix_autolink_triggers_audit             (fix bugs détectés)
20260220000000  auto_link_signer_on_insert              (variante INSERT)
20260221000001  auto_link_trigger_update                (variante UPDATE)
20260221100001  auto_upgrade_draft_on_tenant_signer     (workflow)
20260222000000  fix_invitations_and_orphan_signers      (backfill orphelins)
20260222100000  repair_missing_signers_and_invitations  (backfill)
20260220100000  fix_orphan_signers_audit                (audit)
20260225100000  autolink_backfill_invoices_on_profile   (backfill factures)
```

**Chaîne critique :** 10 migrations en cascade sur le même système. Appliquer **dans l'ordre** impérativement — les backfills (`repair_missing_signers_and_invitations`) s'appuient sur le trigger créé au début.

### 5.3 — Invoices (15 migrations)

Chaîne : création colonnes → backfills → triggers → crons
```
20260225100000  autolink_backfill_invoices_on_profile
20260226000000  backfill_existing_invoices_tenant_id       (ajoute tenant_id, backfill)
20260304000000  fix_invoice_generation_jour_paiement       (fonction génération)
20260304200000  auto_mark_late_invoices                    (cron)
20260305000001  invoice_engine_fields                      (398 L, ADD cols + CHECK)
20260305100000  fix_invoice_draft_notification
20260305100001  add_missing_notification_triggers
20260306100000  invoice_on_fully_signed                    (trigger)
20260306100001  backfill_initial_invoices                  (backfill après ajout col)
20260321000000  drop_invoice_trigger_sota2026              (supprime un trigger)
20260331000000  add_receipt_generated_to_invoices
20260410180000  fix_invoice_generation_sota                (461 L, refonte)
20260410210341  fix_notify_tenant_invoice_created_user_id
20260410210342  fix_generate_monthly_invoices_fields
20260415230000  enforce_invoice_paid_has_payment           (contrainte + trigger)
```

**Dépendance :** `backfill_initial_invoices` nécessite `invoice_engine_fields` (ajoute les colonnes). `enforce_invoice_paid_has_payment` nécessite que tous les `paid` aient un `payment_id` — à vérifier avant.

### 5.4 — Identity status / onboarding

```
20260401000000  add_identity_status_onboarding_step    (ajoute colonne)
20260401000001  backfill_identity_status               (backfill la colonne)
```
Même timestamp millisec → ordre lexicographique OK, mais risque si le filesystem list trie différemment. À **vérifier** avant apply.

### 5.5 — Buildings / units (architecture multi-lots)

```
20260318020000  buildings_rls_sota2026
20260409160000  building_unit_lease_document_fk
20260409170000  backfill_building_unit_properties         (backfill)
20260409180000  buildings_site_id_nullable                (DROP NOT NULL)
20260415140000  buildings_sota_fix_wave1                  (445 L, fixes wave 1)
20260415150000  upsert_building_with_units_rpc            (RPC, contient DELETE)
20260415160000  buildings_rls_entity_members_support      (RLS étendu)
```
**Chaîne :** FK → backfill → RLS → RPC. `upsert_building_with_units_rpc` utilise `DELETE FROM building_units WHERE building_id = v_building_id;` dans le RPC — attendu (remplacement atomique), non-destructif en soi.

### 5.6 — Cash receipt signature (4 migrations)

```
20260410220000  cash_receipt_two_step_signature   (table + fonction)
20260411000000  create_cash_receipt_function      (v2)
20260412000000  fix_cash_receipt_rpc_sota         (365 L, DROP POL×6, fixes)
20260415121706  harden_sign_cash_receipt_as_tenant (sécurité)
```
**Ordre strict obligatoire** : chaque migration remplace les fonctions des précédentes.

### 5.7 — RLS recursion fixes (5 migrations)

```
20260213000000  fix_profiles_rls_recursion_v2
20260409110000  fix_remaining_rls_recursion
20260409120000  fix_subscriptions_rls_recursion
20260409140000  fix_addons_sms_rls_recursion
20260416100000  fix_tickets_rls_recursion
```
Indépendantes entre elles (tables différentes), mais **toutes** nécessaires pour éviter les infinite recursion sur profils/subscriptions/tickets.

### 5.8 — Charge regularisations (voir §4.1)

```
20260408044152  reconcile_charge_regularisations_and_backfill_entry_lines  🔴
```
Isolée, mais dépend de la présence de `charge_regularizations` (table normalisée créée ailleurs, probablement `20260408130000_charges_locatives_module.sql`).

---

## 6. Plan d'application proposé par phases

> **Basé sur la structure existante** `docs/audits/pending-migrations.md` (5 phases conceptuelles) **étendu** pour couvrir les 47 migrations ajoutées après le 10/04/2026.

### Phase 0 — Pré-requis (hors DB)

1. Snapshot Supabase (backup managé).
2. Exporter `supabase_migrations.schema_migrations` (vérifier `20260208024659` bien marqué appliqué).
3. Revue humaine de la migration 🔴 **4.1** (charge_regularisations RENAME).
4. Régénérer `APPLY_ALL_MIGRATIONS.sql` avec les migrations postérieures au 10/04/2026 (45 migrations manquantes dans les batch files existants).

### Phase 1 — Fév 2026 (62 migrations, batch_pending_01..04 OK)

Fichiers : `supabase/apply_scripts/batch_pending_01.sql` → `batch_pending_04_security_and_autolink.sql`
Couvre : RLS recursion, auto-link lease signers, audit integrity v1/v2/v3, document center, security deposits.

**Points de contrôle après Phase 1 :**
- `SELECT COUNT(*) FROM _audit_log` → table créée
- `SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'auto_link%'` → triggers en place
- Test signup nouveau user → `handle_new_user` fonctionne

### Phase 2 — Mars 2026 (66 migrations)

À regrouper manuellement depuis les fichiers individuels (pas de batch existant pour mars).
Couvre : invoices chain, entity status, subscription plans sync, document visibility, handle_new_user add agency role.

**Points de contrôle :**
- `SELECT * FROM subscription_plans ORDER BY display_order` → 4 plans (free, confort, pro, pro_plus) avec prix 0/35/69/149
- `SELECT COUNT(*) FROM invoices WHERE tenant_id IS NULL` → 0 (backfill réussi)
- Aucune récursion RLS : `SELECT * FROM profiles LIMIT 1` en tant qu'utilisateur authentifié

### Phase 3 — Avril 1-10 (57 migrations, dont la 🔴)

⚠ **Revue manuelle obligatoire** de `20260408044152_reconcile_charge_regularisations_and_backfill_entry_lines.sql` avant exécution.

Couvre : module accounting complet (880 L), modules métier (colocation, saisonnier, insurance, tickets SOTA, providers SOTA, candidatures, charges locatives, RGPD, etc.), RLS pour tables ajoutées, fix invoice generation SOTA.

**Points de contrôle :**
- `\dt` → toutes les nouvelles tables présentes
- `SELECT COUNT(*) FROM pg_policies WHERE schemaname='public'` → aucune régression
- Test flow comptabilité : création exercice → seed chart of accounts → création d'une entry

### Phase 4 — Avril 11-12 (17 migrations)

Couvre : cash_receipt (4), copro assemblies + governance, stripe_connect_multi_entity, syndic_profiles, cron_logs, close_admin_self_elevation.

**Points de contrôle :**
- `handle_new_user` retourné à sa version SOTA
- `cash_receipts` table existe et RPC fonctionne
- `copro_assemblies`, `copro_fund_calls` avec RLS entity-based

### Phase 5 — Avril 15-16 (11 migrations, toutes 🟡)

Couvre : signup_integrity_guard, buildings SOTA fix wave 1, enforce_invoice_paid_has_payment, fix tickets RLS recursion.

**Points de contrôle post-Phase 5 (GOLDEN PATH) :**
- Signup OK (owner/tenant/agency/syndic)
- Création bail + signature + paiement + quittance
- Dashboard loads sans erreur
- `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1` → dernier timestamp = `20260416100000`

---

## 7. Questions ouvertes

Points où la lecture seule ne permet pas de trancher. À valider humainement avant apply.

1. **Volumétrie prod** — Les migrations `audit_database_integrity`, `audit_v2_merge_and_prevention`, `data_integrity_audit_repair` (cumulé ~3 500 L avec beaucoup de DML) peuvent prendre longtemps selon le volume. Combien de lignes dans `invoices`, `lease_signers`, `documents` en prod ?

2. **État `charge_regularisations`** — Table legacy encore présente en prod ? Si oui, combien de lignes ? La migration 🔴 attend une table nommée `charge_regularisations` (avec "s" FR).
   ```sql
   SELECT table_name, COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'charge_regul%';
   ```

3. **Duplicate timestamps** — Plusieurs migrations partagent le même timestamp (ex. `20260408120000` × 7, `20260408130000` × 11, `20260328100000` × 2). Supabase CLI les applique par ordre alphabétique du nom → **ordre potentiellement différent de l'intention**. À vérifier dans `supabase_migrations.schema_migrations` après apply.

4. **Colonne `signature_image` deprecated** — La migration `20260215100000_signature_security_audit_fixes.sql` renomme `signature_image` → `_signature_image_deprecated`. Y a-t-il du code front/back qui lit encore cette colonne sous l'ancien nom ?

5. **Policies `USING(true)` retirées** — `20260216100000_security_audit_rls_fixes.sql` supprime 7 policies et en crée 3 (perte nette de -4). Les nouvelles policies restrictives couvrent-elles bien tous les cas d'usage métier ? Test requis.

6. **`remove_yousign_sendgrid_brevo.sql`** — 2 DELETE dans `api_credentials` et `api_providers`. Si ces enregistrements sont toujours utilisés par du code legacy, rupture.

7. **Sprint 1 `20260417090500` mentionné en mémoire projet** — **aucun fichier** ne correspond à ce timestamp dans le repo. Soit il n'a pas encore été créé, soit il s'agit d'un identifiant conceptuel (date prévue de l'apply). À clarifier.

8. **`20260415140000` timestamp dupliqué** — `buildings_sota_fix_wave1.sql` (445 L, 🟡) et `fix_tenant_payment_signing_and_leases_recursion.sql` (🟡) ont le même timestamp. Ordre d'exécution indéterminé entre les deux.

9. **Crons pg_cron** — `20260304100000_activate_pg_cron_schedules.sql` active `pg_cron`. L'extension est-elle activée côté Supabase prod ? Cela peut nécessiter une autorisation support.

10. **Tests d'intégration post-apply** — Existe-t-il un script de smoke test automatique pour vérifier que les golden paths (signup → bail → paiement → EDL → quittance) fonctionnent ? Sinon, validation manuelle obligatoire après chaque phase.

---

## 8. Annexe — Inventaire complet (table condensée)

Légende des opérations :
- `CT` = CREATE TABLE, `AC` = ADD COLUMN, `IDX` = CREATE INDEX
- `CP` / `DP` = CREATE / DROP POLICY
- `CFN` / `DFN` = CREATE OR REPLACE / DROP FUNCTION
- `CTRG` / `DTRG` = CREATE OR REPLACE / DROP TRIGGER
- `INS` / `UPD` / `DEL` = INSERT / UPDATE / DELETE
- `CHK` = ADD CHECK CONSTRAINT, `DROP NN` = DROP NOT NULL, `REN` = RENAME

| Timestamp | Fichier | L | Module | Risk | Ops détectées |
|-----------|---------|---|--------|------|---------------|
| 20260208100000 | `fix_data_storage_audit` | 75 | Audit/Repair | 🟡 | AC×5 DROP NN×4 IDX×2 |
| 20260209100000 | `create_sms_messages_table` | 109 | Messaging | 🟡 | CT×1 CP×3 CFN×1 CTRG×1 DTRG×1 IDX×3 |
| 20260211000000 | `p2_unique_constraint_and_gdpr_rpc` | 281 | RGPD | 🟡 | CFN×2 DFN×1 INS×1 UPD×9 DEL×8 IDX×1 |
| 20260211100000 | `bic_compliance_tax_regime` | 99 | Divers | 🟡 | AC×5 CFN×1 CTRG×1 DTRG×1 UPD×1 IDX×2 |
| 20260212000000 | `audit_database_integrity` | 1531 | Audit/Repair | 🟡 | CT×1 CFN×5 INS×9 UPD×3 DEL×13 IDX×3 |
| 20260212000001 | `fix_guarantor_role_and_tables` | 149 | Candidatures/Garants | 🟡 | CT×2 CP×6 DP×3 CFN×1 INS×1 UPD×1 CHK×2 IDX×1 |
| 20260212100000 | `audit_v2_merge_and_prevention` | 1210 | Audit/Repair | 🟡 | CT×1 CFN×15 CTRG×2 DTRG×2 INS×8 UPD×27 DEL×6 IDX×7 |
| 20260212100001 | `email_template_system` | 161 | Messaging | 🟡 | CT×3 CP×6 CFN×2 CTRG×2 DTRG×2 INS×1 IDX×9 |
| 20260212100002 | `email_templates_seed` | 703 | Messaging | 🟡 | INS×1 |
| 20260212200000 | `audit_v3_comprehensive_integrity` | 754 | Audit/Repair | 🟢 | CFN×6 |
| 20260213000000 | `fix_profiles_rls_recursion_v2` | 167 | RLS/Sécurité | 🟡 | CP×3 DP×1 CFN×7 |
| 20260213100000 | `fix_rls_all_tables_recursion` | 136 | RLS/Sécurité | 🟡 | CP×8 DP×5 |
| 20260215100000 | `signature_security_audit_fixes` | 116 | RLS/Sécurité | 🟡 | AC×1 REN COL CHK×1 IDX×3 |
| 20260215200000 | `fix_rls_properties_tenant_pre_active` | 39 | RLS/Sécurité | 🟡 | CP×1 DP×1 |
| 20260215200001 | `add_notice_given_lease_status` | 72 | Baux/Signatures | 🟡 | CHK×1 IDX×1 |
| 20260215200002 | `fix_rls_tenant_access_beyond_active` | 164 | RLS/Sécurité | 🟡 | CP×4 DP×6 |
| 20260215200003 | `fix_copro_fk_on_delete` | 99 | Copro/Syndic | 🟡 | - |
| 20260216000000 | `tenant_document_center` | 518 | Documents | 🟡 | CP×1 CFN×3 DFN×2 CTRG×1 DTRG×1 UPD×1 IDX×2 |
| 20260216000001 | `document_center_notifications` | 255 | Documents | 🟡 | CFN×3 DFN×3 CTRG×1 DTRG×2 INS×1 UPD×4 |
| 20260216100000 | `security_audit_rls_fixes` | 141 | RLS/Sécurité | 🟡 | CP×3 DP×7 |
| 20260216200000 | `auto_link_lease_signers_trigger` | 161 | Baux/Signatures | 🟡 | CFN×1 CTRG×1 DTRG×1 INS×1 UPD×3 |
| 20260216300000 | `fix_auth_profile_sync` | 347 | Auth/Profiles | 🟡 | CP×1 DP×1 CFN×7 CTRG×1 DTRG×1 INS×2 UPD×1 |
| 20260216400000 | `performance_indexes_rls` | 110 | RLS/Sécurité | 🟢 | IDX×16 |
| 20260216500000 | `fix_tenant_dashboard_complete` | 327 | Divers | 🟢 | CFN×1 |
| 20260216500001 | `enforce_unique_constraints_safety` | 141 | Divers | 🟡 | DEL×4 IDX×3 |
| 20260217000000 | `data_integrity_audit_repair` | 841 | Audit/Repair | 🟡 | CT×1 CFN×3 CTRG×2 DTRG×2 INS×9 UPD×6 |
| 20260218000000 | `audit_repair_profiles` | 79 | Auth/Profiles | 🟡 | CT×1 INS×4 UPD×2 |
| 20260218100000 | `sync_auth_email_updates` | 139 | Auth/Profiles | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×2 |
| 20260219000000 | `missing_tables_and_rag` | 459 | Divers | 🟡 | CT×10 AC×1 CP×18 DP×18 CFN×5 CTRG×1 DTRG×1 UPD×1 IDX×15 |
| 20260219100000 | `auto_link_notify_owner` | 102 | Baux/Signatures | 🟡 | CFN×1 INS×1 UPD×2 |
| 20260219200000 | `fix_autolink_triggers_audit` | 324 | Audit/Repair | 🟡 | DP×1 CFN×5 DFN×1 DTRG×1 INS×1 UPD×2 |
| 20260220000000 | `auto_link_signer_on_insert` | 132 | Baux/Signatures | 🟡 | CFN×2 CTRG×1 DTRG×1 UPD×1 |
| 20260220100000 | `fix_orphan_signers_audit` | 111 | Baux/Signatures | 🟡 | CFN×1 UPD×1 IDX×1 |
| 20260221000001 | `auto_link_trigger_update` | 53 | Baux/Signatures | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×1 |
| 20260221000002 | `fix_edl_signatures_rls` | 33 | RLS/Sécurité | 🟡 | CP×1 DP×1 |
| 20260221100000 | `fix_tenant_dashboard_draft_visibility` | 332 | Divers | 🟢 | CFN×1 |
| 20260221100001 | `auto_upgrade_draft_on_tenant_signer` | 196 | Baux/Signatures | 🟡 | CFN×1 CTRG×1 DTRG×1 INS×1 UPD×3 |
| 20260221200000 | `sync_edl_signer_to_lease_signer` | 89 | Baux/Signatures | 🟡 | CFN×1 CTRG×1 DTRG×1 INS×1 |
| 20260221300000 | `fix_tenant_dashboard_owner_join` | 345 | Divers | 🟢 | CFN×1 |
| 20260221 | `fix_owner_data_chain` | 157 | Divers | 🟡 | CFN×2 INS×9 UPD×1 IDX×1 |
| 20260222000000 | `fix_invitations_and_orphan_signers` | 62 | Baux/Signatures | 🟡 | INS×1 UPD×1 |
| 20260222100000 | `repair_missing_signers_and_invitations` | 176 | Baux/Signatures | 🟡 | INS×6 UPD×3 |
| 20260222200000 | `ensure_all_owners_have_entity` | 33 | Entities | 🟡 | INS×1 UPD×1 |
| 20260222200001 | `get_entity_stats_for_store` | 66 | Entities | 🟢 | CFN×1 |
| 20260223000000 | `fix_tenant_documents_rls` | 61 | RLS/Sécurité | 🟡 | CP×2 DP×2 UPD×1 |
| 20260223000001 | `auto_fill_document_fk` | 195 | Documents | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×3 |
| 20260223000002 | `document_access_views` | 85 | Documents | 🟢 | - |
| 20260223000003 | `notify_owner_on_tenant_document` | 95 | Documents | 🟡 | CFN×1 CTRG×1 DTRG×1 |
| 20260223100000 | `fix_entity_connections` | 276 | Entities | 🟡 | CFN×4 CTRG×3 DTRG×3 INS×1 UPD×6 |
| 20260223200000 | `fix_all_missing_tables_and_columns` | 231 | Divers | 🟡 | CT×2 AC×16 CP×6 DP×6 CFN×2 CTRG×1 DTRG×1 INS×1 UPD×3 IDX×8 |
| 20260224000000 | `fix_tenant_sync_and_notifications` | 108 | Notifications | 🟡 | INS×1 UPD×2 |
| 20260224000001 | `remove_yousign_sendgrid_brevo` | 12 | Divers | 🟡 | DEL×2 |
| 20260224100000 | `fix_tenant_dashboard_notifications_query` | 331 | Notifications | 🟢 | CFN×1 |
| 20260224100000 | `normalize_provider_names` | 8 | API/Providers | 🟡 | UPD×4 |
| 20260225000000 | `owner_payment_audit_log` | 34 | Paiements | 🟢 | CT×1 CP×3 IDX×1 |
| 20260225000001 | `fix_furniture_vetusty_rls` | 184 | RLS/Sécurité | 🟡 | CP×11 DP×11 |
| 20260225100000 | `autolink_backfill_invoices_on_profile` | 66 | Invoices | 🟡 | CFN×1 UPD×3 |
| 20260226000000 | `backfill_existing_invoices_tenant_id` | 33 | Invoices | 🟡 | UPD×1 |
| 20260226000000 | `fix_notifications_triggers` | 168 | Notifications | 🟡 | CFN×2 DFN×1 CTRG×1 DTRG×1 INS×2 |
| 20260227000000 | `drop_auto_activate_lease_trigger` | 5 | Baux/Signatures | 🟡 | DFN×1 DTRG×1 |
| 20260228000000 | `lease_signers_share_percentage` | 8 | Baux/Signatures | 🟢 | AC×1 |
| 20260228100000 | `tenant_payment_methods_sota2026` | 304 | Paiements | 🟡 | CT×4 AC×3 CP×15 CFN×2 CTRG×5 DTRG×1 UPD×2 CHK×1 IDX×14 |
| 20260229100000 | `identity_2fa_requests` | 35 | Auth/Profiles | 🟡 | CT×1 CP×1 DP×1 IDX×3 |
| 20260230100000 | `create_notification_resolve_profile_id` | 93 | Notifications | 🟡 | CFN×1 DFN×1 INS×2 |
| 20260301000000 | `create_key_handovers` | 75 | Divers | 🟢 | CT×1 CP×2 CTRG×1 IDX×3 |
| 20260301100000 | `entity_audit_and_propagation` | 313 | Audit/Repair | 🟡 | CT×1 CP×3 CFN×3 CTRG×2 DTRG×2 INS×3 UPD×4 IDX×4 |
| 20260303000000 | `backfill_uploaded_by` | 68 | Audit/Repair | 🟡 | UPD×4 |
| 20260303100000 | `entity_rls_fix_and_optimize` | 155 | RLS/Sécurité | 🟡 | CP×9 DP×10 CFN×1 CHK×1 |
| 20260304000000 | `fix_invoice_generation_jour_paiement` | 96 | Invoices | 🟡 | CFN×1 INS×1 |
| 20260304000001 | `sync_sepa_collection_day` | 34 | Paiements | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×1 |
| 20260304100000 | `activate_pg_cron_schedules` | 132 | Crons | 🟢 | - |
| 20260304200000 | `auto_mark_late_invoices` | 48 | Invoices | 🟡 | CFN×1 UPD×1 |
| 20260305000001 | `invoice_engine_fields` | 398 | Invoices | 🟡 | CT×4 AC×12 CP×9 CFN×2 CTRG×1 DTRG×1 INS×3 UPD×1 CHK×2 IDX×9 |
| 20260305000002 | `payment_crons` | 22 | Paiements | 🟢 | - |
| 20260305100000 | `fix_invoice_draft_notification` | 62 | Invoices | 🟡 | CFN×1 INS×1 |
| 20260305100001 | `add_missing_notification_triggers` | 129 | Notifications | 🟡 | CFN×2 CTRG×2 INS×2 |
| 20260306000000 | `lease_documents_visible_tenant` | 39 | Baux/Signatures | 🟡 | AC×1 CP×1 DP×1 IDX×1 |
| 20260306100000 | `add_digicode_interphone_columns` | 9 | Divers | 🟢 | AC×2 |
| 20260306100000 | `invoice_on_fully_signed` | 234 | Invoices | 🟡 | CFN×3 CTRG×1 DTRG×1 INS×2 |
| 20260306100001 | `backfill_initial_invoices` | 72 | Invoices | 🟡 | UPD×2 |
| 20260306200000 | `notify_tenant_digicode_changed` | 59 | Documents | 🟡 | CFN×1 CTRG×1 DTRG×1 |
| 20260306300000 | `add_owner_payment_preferences` | 27 | Paiements | 🟢 | AC×6 |
| 20260309000000 | `entity_status_and_dedup` | 155 | Entities | 🟡 | AC×1 CFN×2 CTRG×1 DTRG×1 UPD×6 DEL×2 IDX×2 |
| 20260309000001 | `messages_update_rls` | 19 | RLS/Sécurité | 🟡 | CP×1 DP×1 |
| 20260309000002 | `add_ticket_to_conversations` | 5 | Tickets | 🟢 | AC×1 IDX×1 |
| 20260309100000 | `sync_subscription_plans_features` | 820 | Subscriptions/Stripe | 🟡 | CFN×2 INS×10 UPD×5 |
| 20260310000000 | `fix_subscription_plans_display_order` | 22 | Subscriptions/Stripe | 🟡 | UPD×9 |
| 20260310100000 | `fix_property_limit_enforcement` | 184 | Divers | 🟡 | CFN×3 CTRG×1 DTRG×1 UPD×3 |
| 20260310200000 | `add_signature_push_franceconnect` | 86 | Push/Notif | 🟢 | CT×1 AC×4 CP×2 IDX×3 |
| 20260310200000 | `fix_property_limit_extra_properties` | 78 | Divers | 🟡 | AC×1 CFN×1 UPD×5 |
| 20260310300000 | `add_stripe_price_extra_property_id` | 9 | Subscriptions/Stripe | 🟢 | AC×1 |
| 20260311100000 | `sync_subscription_plan_slugs` | 47 | Subscriptions/Stripe | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×1 |
| 20260312000000 | `admin_dashboard_rpcs` | 113 | Admin | 🟢 | CFN×3 |
| 20260312000001 | `fix_owner_subscription_defaults` | 183 | Subscriptions/Stripe | 🟡 | CFN×1 CTRG×1 DTRG×1 INS×2 UPD×3 |
| 20260312100000 | `fix_handle_new_user_all_roles` | 55 | Auth/Profiles | 🟡 | CFN×1 INS×1 |
| 20260314001000 | `fix_stripe_connect_rls` | 66 | RLS/Sécurité | 🟡 | CP×6 DP×5 |
| 20260314020000 | `canonical_lease_activation_flow` | 206 | Baux/Signatures | 🟡 | CFN×3 DTRG×3 INS×1 UPD×1 |
| 20260314030000 | `payments_production_hardening` | 150 | Paiements | 🟡 | CT×1 AC×3 CP×2 DP×2 CFN×1 CTRG×1 DTRG×5 UPD×5 IDX×4 |
| 20260315090000 | `market_standard_subscription_alignment` | 82 | Subscriptions/Stripe | 🟡 | AC×6 UPD×9 IDX×2 |
| 20260318000000 | `fix_auth_reset_template_examples` | 30 | Auth/Profiles | 🟡 | UPD×1 |
| 20260318010000 | `password_reset_requests` | 53 | Auth/Profiles | 🟡 | CT×1 CFN×1 CTRG×1 DTRG×1 IDX×3 |
| 20260318020000 | `buildings_rls_sota2026` | 128 | RLS/Sécurité | 🟡 | AC×1 CP×12 DP×8 IDX×1 |
| 20260320100000 | `fix_owner_id_mismatch_and_rls` | 111 | RLS/Sécurité | 🟡 | CFN×1 UPD×2 |
| 20260321000000 | `drop_invoice_trigger_sota2026` | 10 | Invoices | 🟡 | DFN×1 DTRG×1 |
| 20260321100000 | `fix_cron_post_refactoring_sota2026` | 22 | Crons | 🟢 | - |
| 20260323000000 | `fix_document_visibility_and_dedup` | 76 | Documents | 🟡 | CP×1 DP×1 IDX×3 |
| 20260324100000 | `prevent_duplicate_payments` | 16 | Paiements | 🟢 | IDX×1 |
| 20260326022619 | `fix_documents_bucket_mime` | 17 | Documents | 🟡 | UPD×1 |
| 20260326022700 | `migrate_tenant_documents` | 80 | Documents | 🟡 | INS×1 |
| 20260326022800 | `create_document_links` | 42 | Documents | 🟢 | CT×1 CP×3 IDX×3 |
| 20260326023000 | `fix_document_titles` | 51 | Documents | 🟡 | UPD×1 |
| 20260326205416 | `add_agency_role_to_handle_new_user` | 55 | Auth/Profiles | 🟡 | CFN×1 INS×1 |
| 20260327143000 | `add_site_config` | 110 | Site/Landing | 🟡 | CT×1 CP×5 INS×2 |
| 20260327200000 | `fix_handle_new_user_restore_email` | 99 | Auth/Profiles | 🟡 | CFN×1 INS×1 UPD×1 |
| 20260328000000 | `fix_visible_tenant_documents` | 10 | Documents | 🟡 | UPD×1 |
| 20260328042538 | `update_argument_images` | 13 | Site/Landing | 🟡 | UPD×4 |
| 20260328100000 | `create_site_content` | 49 | Site/Landing | 🟢 | CT×1 CP×2 IDX×1 |
| 20260328100000 | `fix_visible_tenant_documents` | 19 | Documents | 🟡 | UPD×2 |
| 20260329052631 | `fix_contrat_bail_visible_tenant` | 22 | Documents | 🟡 | UPD×1 |
| 20260329120000 | `add_agency_to_handle_new_user` | 55 | Auth/Profiles | 🟡 | CFN×1 INS×1 |
| 20260329164841 | `fix_document_titles` | 45 | Documents | 🟡 | UPD×1 |
| 20260329170000 | `add_punctuality_score` | 88 | Divers | 🟡 | AC×1 CFN×2 CTRG×1 DTRG×1 UPD×2 |
| 20260329180000 | `notify_owner_edl_signed` | 85 | Baux/Signatures | 🟡 | CFN×1 CTRG×1 DTRG×1 |
| 20260329190000 | `force_visible_tenant_generated_docs` | 35 | Documents | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×1 |
| 20260330100000 | `add_lease_cancellation_columns` | 62 | Baux/Signatures | 🟡 | AC×4 CHK×1 IDX×3 |
| 20260331000000 | `add_receipt_generated_to_invoices` | 25 | Invoices | 🟡 | AC×1 UPD×1 |
| 20260331100000 | `add_agricultural_property_types` | 28 | Divers | 🟡 | CHK×1 |
| 20260331100000 | `fix_document_titles_bruts` | 35 | Documents | 🟡 | UPD×1 |
| 20260331120000 | `add_signed_pdf_generated_to_leases` | 21 | Divers | 🟡 | AC×1 UPD×1 IDX×1 |
| 20260331130000 | `key_handovers_add_cancelled_notes` | 16 | Divers | 🟢 | AC×2 IDX×1 |
| 20260401000000 | `add_identity_status_onboarding_step` | 47 | Auth/Profiles | 🟢 | AC×5 IDX×2 |
| 20260401000001 | `add_initial_payment_confirmed_to_leases` | 27 | Paiements | 🟡 | AC×3 UPD×1 IDX×1 |
| 20260401000001 | `backfill_identity_status` | 78 | Auth/Profiles | 🟡 | UPD×5 |
| 20260404100000 | `rls_push_subscriptions` | 26 | RLS/Sécurité | 🟡 | CP×1 DP×1 |
| 20260404100100 | `fix_tenant_docs_view_visible_tenant` | 50 | Documents | 🟢 | - |
| 20260404100200 | `fix_ticket_messages_rls_lease_signers` | 79 | RLS/Sécurité | 🟡 | CP×2 DP×2 |
| 20260406200000 | `create_entities_view_and_members` | 183 | Entities | 🟡 | CT×1 AC×1 CP×2 CFN×2 CTRG×2 DTRG×1 INS×3 IDX×3 |
| 20260406210000 | `accounting_complete` | 881 | Comptabilité | 🟡 | CT×19 CP×20 CFN×5 CTRG×4 DTRG×4 INS×2 IDX×24 |
| 20260407110000 | `audit_fixes_rls_indexes` | 43 | RLS/Sécurité | 🟡 | CHK×6 IDX×1 |
| 20260407120000 | `accounting_reconcile_schemas` | 186 | Comptabilité | 🟡 | CT×1 AC×20 CP×3 DP×3 UPD×2 IDX×3 |
| 20260407130000 | `ocr_category_rules` | 37 | Divers | 🟢 | CT×1 AC×4 CP×1 IDX×2 |
| 20260408042218 | `create_expenses_table` | 170 | Divers | 🟢 | CT×1 CP×5 CFN×1 CTRG×1 IDX×7 |
| 20260408044152 | `reconcile_charge_regularisations_and_backfill_entry_lines` | 307 | Comptabilité | 🔴 | AC×10 REN TBL CFN×3 CTRG×3 INS×3 UPD×4 DEL×1 |
| 20260408100000 | `copro_lots` | 63 | Copro/Syndic | 🟡 | CT×2 AC×4 DROP NN×3 CP×2 UPD×1 IDX×1 |
| 20260408100000 | `create_push_subscriptions` | 57 | Subscriptions/Stripe | 🟡 | CT×1 CP×1 DP×1 IDX×3 |
| 20260408110000 | `agency_hoguet` | 22 | Agence/White-label | 🟢 | AC×4 IDX×1 |
| 20260408120000 | `api_keys_webhooks` | 158 | API/Providers | 🟢 | CT×4 CP×9 CFN×1 CTRG×2 IDX×7 |
| 20260408120000 | `colocation_module` | 398 | Colocation | 🟢 | CT×5 AC×6 CP×12 CFN×2 CTRG×3 IDX×5 |
| 20260408120000 | `edl_sortie_workflow` | 227 | Baux/Signatures | 🟡 | CT×2 AC×21 CP×4 INS×1 CHK×1 IDX×4 |
| 20260408120000 | `providers_module_sota` | 444 | API/Providers | 🟡 | CT×2 AC×29 DROP NN×1 CP×5 DP×5 CFN×3 CTRG×4 DTRG×4 UPD×6 IDX×11 |
| 20260408120000 | `smart_meters_connected` | 255 | IoT | 🟢 | CT×3 CP×15 CFN×1 CTRG×1 IDX×10 |
| 20260408120000 | `subscription_addons` | 173 | Subscriptions/Stripe | 🟡 | CT×2 CP×4 CFN×3 CTRG×1 INS×1 UPD×1 IDX×5 |
| 20260408120000 | `whitelabel_agency_module` | 356 | Agence/White-label | 🟢 | CT×4 CP×19 CFN×2 CTRG×4 IDX×6 |
| 20260408130000 | `active_sessions` | 153 | Divers | 🟡 | CT×1 CP×4 CFN×3 CTRG×1 INS×1 UPD×3 IDX×3 |
| 20260408130000 | `admin_panel_tables` | 186 | Admin | 🟡 | CT×3 CP×7 CFN×1 CTRG×1 INS×2 IDX×11 |
| 20260408130000 | `candidatures_workflow` | 171 | Candidatures/Garants | 🟡 | CT×2 CP×5 CFN×2 CTRG×3 UPD×1 IDX×9 |
| 20260408130000 | `charges_locatives_module` | 219 | Divers | 🟢 | CT×3 CP×7 CFN×1 CTRG×3 IDX×10 |
| 20260408130000 | `diagnostics_rent_control` | 151 | Diagnostics | 🟡 | CT×2 CP×6 CFN×1 CTRG×1 INS×1 IDX×5 |
| 20260408130000 | `fix_subscription_plan_prices` | 32 | Subscriptions/Stripe | 🟡 | UPD×5 |
| 20260408130000 | `guarantor_workflow_complete` | 324 | Candidatures/Garants | 🟡 | CT×1 AC×27 CP×5 CFN×2 CTRG×1 DTRG×1 CHK×1 IDX×4 |
| 20260408130000 | `insurance_policies` | 164 | Insurance | 🟡 | AC×9 DROP NN×2 CP×6 DP×10 CFN×1 CTRG×1 DTRG×1 UPD×2 IDX×4 |
| 20260408130000 | `lease_amendments_table` | 124 | Baux/Signatures | 🟢 | CT×1 CP×4 CFN×1 CTRG×1 IDX×3 |
| 20260408130000 | `rgpd_consent_records_and_data_requests` | 77 | RGPD | 🟢 | CT×2 CP×5 IDX×4 |
| 20260408130000 | `seasonal_rental_module` | 173 | Saisonnier | 🟢 | CT×4 CP×4 CFN×1 CTRG×2 IDX×13 |
| 20260408130000 | `security_deposits` | 138 | Dépôts | 🟡 | CT×1 CP×3 CFN×1 CTRG×2 DTRG×1 INS×1 IDX×4 |
| 20260408140000 | `tickets_module_sota` | 131 | Tickets | 🟡 | CT×1 AC×10 CP×5 CFN×1 CTRG×1 DTRG×1 UPD×1 CHK×4 IDX×5 |
| 20260408200000 | `unified_notification_system` | 92 | Notifications | 🟡 | CT×1 AC×5 CP×3 DP×3 CFN×1 CTRG×1 DTRG×1 IDX×2 |
| 20260408220000 | `payment_architecture_sota` | 361 | Paiements | 🟡 | CT×2 AC×12 CP×6 CFN×2 CTRG×1 UPD×3 IDX×10 |
| 20260409100000 | `add_missing_rls` | 115 | RLS/Sécurité | 🟢 | CP×13 |
| 20260409110000 | `fix_remaining_rls_recursion` | 110 | RLS/Sécurité | 🟡 | CP×8 DP×8 |
| 20260409120000 | `fix_subscriptions_rls_recursion` | 46 | RLS/Sécurité | 🟡 | CP×3 DP×3 |
| 20260409130000 | `fix_subscriptions_status_check` | 26 | Subscriptions/Stripe | 🟡 | CHK×1 |
| 20260409140000 | `fix_addons_sms_rls_recursion` | 39 | RLS/Sécurité | 🟡 | CP×2 DP×2 |
| 20260409150000 | `fix_signature_tracking_and_analytics` | 171 | Divers | 🟡 | CFN×3 INS×1 IDX×1 |
| 20260409160000 | `building_unit_lease_document_fk` | 76 | Baux/Signatures | 🟡 | AC×3 CFN×1 CTRG×1 DTRG×1 UPD×2 IDX×3 |
| 20260409170000 | `backfill_building_unit_properties` | 214 | Buildings | 🟡 | CT×1 AC×27 CP×2 DP×2 CFN×2 DFN×1 CTRG×2 DTRG×2 INS×1 UPD×2 IDX×7 |
| 20260409180000 | `buildings_site_id_nullable` | 11 | Buildings | 🟢 | DROP NN×1 |
| 20260410100000 | `accounting_missing_indexes` | 67 | Comptabilité | 🟢 | IDX×6 |
| 20260410110000 | `cleanup_orphan_analyses` | 84 | Divers | 🟡 | CFN×1 DEL×1 |
| 20260410180000 | `fix_invoice_generation_sota` | 461 | Invoices | 🟡 | CFN×3 INS×2 UPD×1 |
| 20260410204528 | `extend_invoices_rls_for_sci_access` | 137 | RLS/Sécurité | 🟡 | CP×3 DP×3 |
| 20260410210000 | `fix_protected_document_visibility` | 417 | Documents | 🟡 | CFN×3 CTRG×2 DTRG×1 UPD×1 |
| 20260410210341 | `fix_notify_tenant_invoice_created_user_id` | 102 | Invoices | 🟡 | CFN×2 INS×1 |
| 20260410210342 | `fix_generate_monthly_invoices_fields` | 146 | Invoices | 🟡 | CFN×2 INS×1 |
| 20260410212232 | `fix_entity_members_policy_recursion` | 172 | RLS/Sécurité | 🟡 | CP×5 DP×4 CFN×2 |
| 20260410213940 | `fix_properties_tenant_policy_recursion` | 82 | RLS/Sécurité | 🟡 | CP×1 DP×2 CFN×2 |
| 20260410220000 | `cash_receipt_two_step_signature` | 213 | Paiements | 🟡 | AC×3 DROP NN×2 CFN×2 DFN×1 INS×2 UPD×2 CHK×1 IDX×1 |
| 20260411000000 | `create_cash_receipt_function` | 231 | Paiements | 🟡 | DROP NN×2 CFN×1 DFN×2 INS×1 CHK×1 |
| 20260411100000 | `fix_work_orders_policy_recursion` | 85 | RLS/Sécurité | 🟡 | CP×1 DP×2 CFN×2 |
| 20260411120000 | `harden_payments_check_constraints` | 94 | Paiements | 🟡 | CHK×2 |
| 20260411120000 | `schedule_onboarding_reminders_cron` | 33 | Crons | 🟢 | - |
| 20260411130000 | `restore_handle_new_user_sota` | 98 | Auth/Profiles | 🟡 | CFN×1 INS×1 UPD×1 |
| 20260411130100 | `agency_profiles_raison_sociale_nullable` | 19 | Auth/Profiles | 🟢 | DROP NN×1 |
| 20260411130200 | `create_syndic_profiles` | 118 | Auth/Profiles | 🟡 | CT×1 CP×3 DP×3 CTRG×1 DTRG×1 IDX×2 |
| 20260411130300 | `onboarding_role_constraints_allow_syndic_agency` | 33 | Onboarding | 🟡 | CHK×2 |
| 20260411140000 | `copro_assemblies_module` | 497 | Copro/Syndic | 🟡 | CT×5 CP×10 DP×10 CTRG×4 DTRG×4 IDX×18 |
| 20260411140100 | `copro_governance_module` | 332 | Copro/Syndic | 🟡 | CT×3 CP×6 DP×6 CTRG×3 DTRG×3 IDX×12 |
| 20260412000000 | `fix_cash_receipt_rpc_sota` | 365 | Paiements | 🟡 | CT×1 AC×4 DROP NN×2 CP×6 DP×6 CFN×1 DFN×3 INS×1 CHK×1 |
| 20260412100000 | `stripe_connect_multi_entity` | 245 | Subscriptions/Stripe | 🟡 | AC×1 CP×3 DP×3 CFN×1 IDX×3 |
| 20260412110000 | `documents_copro_fk` | 125 | Copro/Syndic | 🟡 | AC×1 CP×4 DP×4 IDX×1 |
| 20260412120000 | `copro_fund_call_lines_reminder_tracking` | 41 | Copro/Syndic | 🟢 | AC×2 IDX×1 |
| 20260412130000 | `copro_cron_schedules` | 91 | Copro/Syndic | 🟢 | - |
| 20260412140000 | `close_admin_self_elevation` | 104 | Admin | 🟡 | CFN×1 INS×1 |
| 20260412150000 | `create_cron_logs` | 36 | Crons | 🟢 | CT×1 CP×2 IDX×2 |
| 20260415000000 | `signup_integrity_guard` | 376 | Audit/Repair | 🟡 | CT×10 AC×8 DROP NN×1 CFN×1 CTRG×1 DTRG×1 INS×1 CHK×3 |
| 20260415121706 | `harden_sign_cash_receipt_as_tenant` | 187 | Paiements | 🟡 | CFN×1 DFN×2 INS×1 UPD×2 |
| 20260415124844 | `add_cheque_photo_to_payments` | 83 | Paiements | 🟡 | AC×1 DP×2 INS×1 |
| 20260415130000 | `fix_tenant_accessible_property_ids_security_definer` | 84 | Divers | 🟡 | CFN×1 DFN×1 |
| 20260415140000 | `buildings_sota_fix_wave1` | 445 | Buildings | 🟡 | AC×6 CP×7 DP×9 CFN×3 CTRG×1 DTRG×1 UPD×7 IDX×3 |
| 20260415140000 | `fix_tenant_payment_signing_and_leases_recursion` | 198 | RLS/Sécurité | 🟡 | CP×1 DP×2 CFN×1 CHK×2 |
| 20260415150000 | `upsert_building_with_units_rpc` | 320 | Buildings | 🟡 | CFN×2 INS×3 UPD×2 DEL×1 |
| 20260415160000 | `buildings_rls_entity_members_support` | 172 | RLS/Sécurité | 🟡 | CP×7 DP×7 CFN×1 |
| 20260415230000 | `enforce_invoice_paid_has_payment` | 177 | Invoices | 🟡 | CFN×1 DFN×1 CTRG×1 DTRG×2 UPD×1 |
| 20260416100000 | `fix_messages_conversation_trigger` | 70 | Divers | 🟡 | CFN×1 CTRG×1 DTRG×1 UPD×2 IDX×1 |
| 20260416100000 | `fix_tickets_rls_recursion` | 166 | RLS/Sécurité | 🟡 | CP×2 DP×5 CFN×3 |

---

_Audit généré le 2026-04-17 — lecture seule, aucune mutation effectuée._
