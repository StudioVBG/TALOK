# Sprint A — PASS 8 : Red flags

Points bloquants ou inhabituels à valider par Thomas AVANT d'ouvrir Sprint B.

## 🚨 Écart entre comptage annoncé et réel

- Prompt : **168 pending**, last applied = `20260208024659`
- Réalité repo : **223 pending** (cutoff appliqué = 20260208024659)
- Écart : 55 migrations supplémentaires vs annoncé
- Fichier correspondant au cutoff `20260208024659` : ❌ **inexistant dans le repo**

**Action requise** : confirmer la valeur exacte retournée par `supabase migration list --linked` ou `SELECT max(version) FROM supabase_migrations.schema_migrations`.

## 🔴 Migrations touchant `auth.*` (schéma Supabase interne)

29 occurrences :
- `20260212000000_audit_database_integrity.sql` — auth.users
- `20260212200000_audit_v3_comprehensive_integrity.sql` — auth.users
- `20260216200000_auto_link_lease_signers_trigger.sql` — auth.users
- `20260216500000_fix_tenant_dashboard_complete.sql` — auth.users
- `20260217000000_data_integrity_audit_repair.sql` — auth.users
- `20260218000000_audit_repair_profiles.sql` — auth.users
- `20260218100000_sync_auth_email_updates.sql` — auth.users
- `20260219100000_auto_link_notify_owner.sql` — auth.users
- `20260219200000_fix_autolink_triggers_audit.sql` — auth.users
- `20260220000000_auto_link_signer_on_insert.sql` — auth.users
- `20260220100000_fix_orphan_signers_audit.sql` — auth.users
- `20260221000001_auto_link_trigger_update.sql` — auth.users
- `20260221100000_fix_tenant_dashboard_draft_visibility.sql` — auth.users
- `20260221100001_auto_upgrade_draft_on_tenant_signer.sql` — auth.users
- `20260221300000_fix_tenant_dashboard_owner_join.sql` — auth.users
- `20260222000000_fix_invitations_and_orphan_signers.sql` — auth.users
- `20260222100000_repair_missing_signers_and_invitations.sql` — auth.users
- `20260224000000_fix_tenant_sync_and_notifications.sql` — auth.users
- `20260224100000_fix_tenant_dashboard_notifications_query.sql` — auth.users
- `20260225100000_autolink_backfill_invoices_on_profile.sql` — auth.users
- _(+ 9 autres)_

## 🟠 Extensions requises par les migrations pending

| Extension | Fichiers | Action |
|---|---|---|
| `vector` | 1 | Vérifier `SELECT * FROM pg_extension WHERE extname='vector'` avant Phase 1 |
| `pg_cron` | 1 | Vérifier `SELECT * FROM pg_extension WHERE extname='pg_cron'` avant Phase 1 |
| `pg_net` | 1 | Vérifier `SELECT * FROM pg_extension WHERE extname='pg_net'` avant Phase 1 |

## 🟠 Grants / rôles inhabituels

✅ Aucun GRANT ALL ON SCHEMA ou ALTER ROLE détecté.

## 🟡 TODO / FIXME dans le SQL

4 migrations contiennent au moins un marqueur.

<details><summary>Extraits (cliquer)</summary>

- `20260408120000_api_keys_webhooks.sql` : _xxxx' (pour identification)_
- `20260408200000_unified_notification_system.sql` : _xxx)';_
- `20260415150000_upsert_building_with_units_rpc.sql` : _XXXX-XXXX (8 caractères random, charset alphanum majuscule)_ · _XXXX-XXXX unique dans la table properties.';_
- `20260417090500_epci_reference_seed_drom.sql` : _TODO Sprints ultérieurs :_

</details>

## 🟡 Commentaires AI non nettoyés

11 migrations mentionnent Claude / GPT / ChatGPT / Anthropic / OpenAI / Copilot / Cursor.
- `20260328100000_create_site_content.sql`
- `20260331100000_add_agricultural_property_types.sql`
- `20260411000000_create_cash_receipt_function.sql`
- `20260412000000_fix_cash_receipt_rpc_sota.sql`
- `20260412100000_stripe_connect_multi_entity.sql`
- `20260412110000_documents_copro_fk.sql`
- `20260412120000_copro_fund_call_lines_reminder_tracking.sql`
- `20260415121706_harden_sign_cash_receipt_as_tenant.sql`
- `20260415130000_fix_tenant_accessible_property_ids_security_definer.sql`
- `20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql`
- `20260417090400_charges_pcg_accounts_backfill.sql`

## 🟠 Timestamps dupliqués

13 paires/groupes :

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

**Risque** : l'ordre d'application entre deux fichiers avec même timestamp est déterminé par tri lexicographique du nom de fichier. À inspecter un par un pour confirmer que les deux fichiers ne se contredisent pas.

## 🟡 Fichiers non-.sql dans `supabase/migrations/`

✅ Dossier propre, que des .sql.

## 🟡 Références à des clés `PLAN_LIMITS` inconnues

✅ Aucune incohérence détectée.

## Red flags à valider avec Thomas avant Sprint B

1. **Cutoff réel** : confirmer la dernière migration appliquée en prod (via Supabase Dashboard).
2. **Staging** : Option A (projet dédié) vs B (shadow locale) vs C (direct prod avec backup) — décision business.
3. **Extensions** : s'assurer que les extensions requises sont actives en prod (pg_cron, pg_net, etc.).
4. **Phase files** : confirmer si les 5 scripts `APPLY_PENDING_*` sont obsolètes ou réapplicables.
5. **Timestamps dupliqués** : décider lesquels garder (risque de régression sinon).
6. **Migrations AI-generated** : relire au moins les CRITIQUE + DANGEREUX avant exécution.
7. **Window de maintenance** : planifier une fenêtre ≥2h pour la Phase 4 (CRITIQUE).

