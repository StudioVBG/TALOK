# Sprint B1 — PASS 3 : Matrice de réconciliation

> ⚠️ **Mode dégradé** : `reports/sprint-b1-schema-migrations-prod.json` est un stub (PASS 1 bloqué).
> Les catégories MATCHED/PENDING sont déduites du cutoff \`20260208024659\` (Sprint A).
> **Aucune détection HASH MISMATCH possible** sans accès au contenu `statements` de la prod.
> Re-exécuter ce script après avoir peuplé le snapshot prod pour obtenir la matrice réelle.

## Compteurs par catégorie

| Catégorie | Nombre | % des fs | Définition |
|---|---:|---:|---|
| ✅ MATCHED | 218 | 49.3% | schema_migrations + fs + contenu cohérent |
| 👻 GHOST APPLIED | 1 | 0.2% | schema_migrations seul (pas de fichier) |
| ⏳ PENDING | 181 | 41.0% | fs seul (pas dans schema_migrations) |
| ⚠️ HASH MISMATCH | 0 | 0.0% | Contenu fs diverge de `statements` prod |
| 🔁 DUPLICATE TS | 41 | 9.3% | Plusieurs fichiers fs avec même timestamp |

## Vérification de cohérence

- Total fs : 442
- MATCHED + PENDING + HASH MISMATCH + DUPLICATE TS = 440
- (devrait ≈ total fs, écart possible : fichiers sans timestamp parseable = 2)

## 👻 GHOST APPLIED

| Version | Name | Inserted | Source |
|---|---|---|---|
| `20260208024659` | (unknown — assumption from Sprint A prompt) | - | Sprint A assumption |

## 🔁 DUPLICATE TS (détail)

Tous les groupes ont des hashes divergents — ce sont de vraies migrations distinctes à renommer.

| Timestamp | Nb fichiers | Fichiers |
|---|---:|---|
| `20260224100000` | 2 | `20260224100000_fix_tenant_dashboard_notifications_query.sql`<br>`20260224100000_normalize_provider_names.sql` |
| `20260226000000` | 2 | `20260226000000_backfill_existing_invoices_tenant_id.sql`<br>`20260226000000_fix_notifications_triggers.sql` |
| `20260306100000` | 2 | `20260306100000_add_digicode_interphone_columns.sql`<br>`20260306100000_invoice_on_fully_signed.sql` |
| `20260310200000` | 2 | `20260310200000_add_signature_push_franceconnect.sql`<br>`20260310200000_fix_property_limit_extra_properties.sql` |
| `20260328100000` | 2 | `20260328100000_create_site_content.sql`<br>`20260328100000_fix_visible_tenant_documents.sql` |
| `20260331100000` | 2 | `20260331100000_add_agricultural_property_types.sql`<br>`20260331100000_fix_document_titles_bruts.sql` |
| `20260401000001` | 2 | `20260401000001_add_initial_payment_confirmed_to_leases.sql`<br>`20260401000001_backfill_identity_status.sql` |
| `20260408100000` | 2 | `20260408100000_copro_lots.sql`<br>`20260408100000_create_push_subscriptions.sql` |
| `20260408120000` | 7 | `20260408120000_api_keys_webhooks.sql`<br>`20260408120000_colocation_module.sql`<br>`20260408120000_edl_sortie_workflow.sql`<br>`20260408120000_providers_module_sota.sql`<br>`20260408120000_smart_meters_connected.sql`<br>`20260408120000_subscription_addons.sql`<br>`20260408120000_whitelabel_agency_module.sql` |
| `20260408130000` | 12 | `20260408130000_active_sessions.sql`<br>`20260408130000_admin_panel_tables.sql`<br>`20260408130000_candidatures_workflow.sql`<br>`20260408130000_charges_locatives_module.sql`<br>`20260408130000_diagnostics_rent_control.sql`<br>`20260408130000_fix_subscription_plan_prices.sql`<br>`20260408130000_guarantor_workflow_complete.sql`<br>`20260408130000_insurance_policies.sql`<br>`20260408130000_lease_amendments_table.sql`<br>`20260408130000_rgpd_consent_records_and_data_requests.sql`<br>`20260408130000_seasonal_rental_module.sql`<br>`20260408130000_security_deposits.sql` |
| `20260411120000` | 2 | `20260411120000_harden_payments_check_constraints.sql`<br>`20260411120000_schedule_onboarding_reminders_cron.sql` |
| `20260415140000` | 2 | `20260415140000_buildings_sota_fix_wave1.sql`<br>`20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql` |
| `20260416100000` | 2 | `20260416100000_fix_messages_conversation_trigger.sql`<br>`20260416100000_fix_tickets_rls_recursion.sql` |

## ⏳ PENDING (aperçu)

181 fichiers. Aperçu des 20 premiers (ordre chronologique) :

| # | Fichier | Hash prefix |
|---:|---|---|
| 1 | `20260208100000_fix_data_storage_audit.sql` | `861d7a22bc63…` |
| 2 | `20260209100000_create_sms_messages_table.sql` | `5c360344dff0…` |
| 3 | `20260211000000_p2_unique_constraint_and_gdpr_rpc.sql` | `5a671770abfb…` |
| 4 | `20260211100000_bic_compliance_tax_regime.sql` | `fe7f2e0c3226…` |
| 5 | `20260212000000_audit_database_integrity.sql` | `21143d6c2b91…` |
| 6 | `20260212000001_fix_guarantor_role_and_tables.sql` | `8a16322e3840…` |
| 7 | `20260212100000_audit_v2_merge_and_prevention.sql` | `94da1eeda000…` |
| 8 | `20260212100001_email_template_system.sql` | `b15ed3b46320…` |
| 9 | `20260212100002_email_templates_seed.sql` | `9a513eab9440…` |
| 10 | `20260212200000_audit_v3_comprehensive_integrity.sql` | `094f97f7f1f2…` |
| 11 | `20260213000000_fix_profiles_rls_recursion_v2.sql` | `2ab5e1cd4b16…` |
| 12 | `20260213100000_fix_rls_all_tables_recursion.sql` | `a6b6d114748a…` |
| 13 | `20260215100000_signature_security_audit_fixes.sql` | `e571c7b1dbd2…` |
| 14 | `20260215200000_fix_rls_properties_tenant_pre_active.sql` | `5d5f8620305c…` |
| 15 | `20260215200001_add_notice_given_lease_status.sql` | `ccf28779588a…` |
| 16 | `20260215200002_fix_rls_tenant_access_beyond_active.sql` | `ddbda624df81…` |
| 17 | `20260215200003_fix_copro_fk_on_delete.sql` | `9a02e61a13b0…` |
| 18 | `20260216000000_tenant_document_center.sql` | `4b6c13de2e8f…` |
| 19 | `20260216000001_document_center_notifications.sql` | `fa7d15c5a2da…` |
| 20 | `20260216100000_security_audit_rls_fixes.sql` | `c5ab5fe5a778…` |

_Liste complète dans `reports/sprint-b1-reconciliation-matrix.json`._

## ✅ MATCHED (aperçu)

218 fichiers. Aperçu des 10 plus récents :

| Fichier | Hash prefix |
|---|---|
| `20260127010002_vetusty_grid_tables.sql` | `b712e4f12d34…` |
| `20260128000000_surface_carrez_rent_control.sql` | `364523daa815…` |
| `20260128000001_fix_edl_schema_500.sql` | `6512be524c04…` |
| `20260128010001_webhook_queue.sql` | `c8f366bbc5d5…` |
| `20260201000000_ged_system.sql` | `e2c101fc510f…` |
| `20260205000001_fix_edl_signatures_insert_rls.sql` | `78dd06d78822…` |
| `20260206000000_migrate_owner_profiles_to_legal_entities.sql` | `3699d07d6242…` |
| `20260207000000_apply_legal_entities_consolidated.sql` | `1ac8135e7ed4…` |
| `20260207100000_fix_audit_critical_issues.sql` | `0bb8a8814a7d…` |
| `20260207200000_audit_improvements_phase2.sql` | `d77a2df8d54e…` |

