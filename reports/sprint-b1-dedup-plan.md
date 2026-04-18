# Sprint B1 — PASS 5 : Plan de dédup des timestamps dupliqués

## Stratégie

Tous les 13 groupes ont des **hashes divergents** → ce sont de vraies migrations distinctes, aucune à supprimer. Le plan est donc uniquement un **renommage** :

1. Dans chaque groupe, trier les fichiers par nom (alphabétique) → détermine l'ordre d'exécution logique
2. Le premier garde son timestamp
3. Les suivants sont décalés de +1s, +2s, ...
4. Éviter les collisions avec d'autres timestamps existants (pas un cas rencontré ici)
5. **Renommages non exécutés** — voir `scripts/audit/apply-dedup-renames.sh`

> ⚠️ **Mode dégradé** (PASS 1 stub) : on ne peut pas savoir si l'une des files d'un groupe est déjà dans `supabase_migrations.schema_migrations`. Si c'est le cas, elle **doit** garder son timestamp (ne pas renommer), sinon `schema_migrations` pointerait vers un fichier inexistant.
>
> **Pré-requis avant d'appliquer** : re-run ce script après PASS 1 peuplé pour privilégier les fichiers MATCHED.

## Aperçu par groupe

### `20260224100000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260224100000_fix_tenant_dashboard_notifications_query.sql` | _(inchangé)_ | `b862393da0da…` |
| rename | `20260224100000_normalize_provider_names.sql` | `20260224100001_normalize_provider_names.sql` | `dd491df0273f…` |

### `20260226000000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260226000000_backfill_existing_invoices_tenant_id.sql` | _(inchangé)_ | `8da7b09dbcd1…` |
| rename | `20260226000000_fix_notifications_triggers.sql` | `20260226000001_fix_notifications_triggers.sql` | `94f6b20dde56…` |

### `20260306100000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260306100000_add_digicode_interphone_columns.sql` | _(inchangé)_ | `73b1f1a118ba…` |
| rename | `20260306100000_invoice_on_fully_signed.sql` | `20260306100002_invoice_on_fully_signed.sql` | `5b7d5d373fe8…` |

### `20260310200000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260310200000_add_signature_push_franceconnect.sql` | _(inchangé)_ | `3c64db87b7e4…` |
| rename | `20260310200000_fix_property_limit_extra_properties.sql` | `20260310200001_fix_property_limit_extra_properties.sql` | `c9577440057d…` |

### `20260328100000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260328100000_create_site_content.sql` | _(inchangé)_ | `88932cd764b5…` |
| rename | `20260328100000_fix_visible_tenant_documents.sql` | `20260328100001_fix_visible_tenant_documents.sql` | `0723d1a0671a…` |

### `20260331100000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260331100000_add_agricultural_property_types.sql` | _(inchangé)_ | `46243cb1d5b5…` |
| rename | `20260331100000_fix_document_titles_bruts.sql` | `20260331100001_fix_document_titles_bruts.sql` | `111702102b57…` |

### `20260401000001` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260401000001_add_initial_payment_confirmed_to_leases.sql` | _(inchangé)_ | `6c5f8cfaacd4…` |
| rename | `20260401000001_backfill_identity_status.sql` | `20260401000002_backfill_identity_status.sql` | `40fd9e214dff…` |

### `20260408100000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260408100000_copro_lots.sql` | _(inchangé)_ | `97ef6b234a76…` |
| rename | `20260408100000_create_push_subscriptions.sql` | `20260408100001_create_push_subscriptions.sql` | `171db7e6077f…` |

### `20260408120000` — 7 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260408120000_api_keys_webhooks.sql` | _(inchangé)_ | `b0af5a52014f…` |
| rename | `20260408120000_colocation_module.sql` | `20260408120001_colocation_module.sql` | `e26e563fe912…` |
| rename | `20260408120000_edl_sortie_workflow.sql` | `20260408120002_edl_sortie_workflow.sql` | `9caabed1dc8e…` |
| rename | `20260408120000_providers_module_sota.sql` | `20260408120003_providers_module_sota.sql` | `758a53936ba8…` |
| rename | `20260408120000_smart_meters_connected.sql` | `20260408120004_smart_meters_connected.sql` | `60c898664e34…` |
| rename | `20260408120000_subscription_addons.sql` | `20260408120005_subscription_addons.sql` | `9522c3a88616…` |
| rename | `20260408120000_whitelabel_agency_module.sql` | `20260408120006_whitelabel_agency_module.sql` | `8fdbe8a013f4…` |

### `20260408130000` — 12 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260408130000_active_sessions.sql` | _(inchangé)_ | `082b0efd85df…` |
| rename | `20260408130000_admin_panel_tables.sql` | `20260408130001_admin_panel_tables.sql` | `b737e2cbc4f4…` |
| rename | `20260408130000_candidatures_workflow.sql` | `20260408130002_candidatures_workflow.sql` | `a1fb98f13259…` |
| rename | `20260408130000_charges_locatives_module.sql` | `20260408130003_charges_locatives_module.sql` | `cd52e4788d84…` |
| rename | `20260408130000_diagnostics_rent_control.sql` | `20260408130004_diagnostics_rent_control.sql` | `94e2ee0ad523…` |
| rename | `20260408130000_fix_subscription_plan_prices.sql` | `20260408130005_fix_subscription_plan_prices.sql` | `ddd4b72a5e3c…` |
| rename | `20260408130000_guarantor_workflow_complete.sql` | `20260408130006_guarantor_workflow_complete.sql` | `9c559d9f792a…` |
| rename | `20260408130000_insurance_policies.sql` | `20260408130007_insurance_policies.sql` | `3e72af2f0d7f…` |
| rename | `20260408130000_lease_amendments_table.sql` | `20260408130008_lease_amendments_table.sql` | `1f93a06d2e1d…` |
| rename | `20260408130000_rgpd_consent_records_and_data_requests.sql` | `20260408130009_rgpd_consent_records_and_data_requests.sql` | `e0f4c36875ce…` |
| rename | `20260408130000_seasonal_rental_module.sql` | `20260408130010_seasonal_rental_module.sql` | `ac03ecbaa8f7…` |
| rename | `20260408130000_security_deposits.sql` | `20260408130011_security_deposits.sql` | `7e0e7e2cd0fb…` |

### `20260411120000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260411120000_harden_payments_check_constraints.sql` | _(inchangé)_ | `61afd7d30974…` |
| rename | `20260411120000_schedule_onboarding_reminders_cron.sql` | `20260411120001_schedule_onboarding_reminders_cron.sql` | `d97f98a08d13…` |

### `20260415140000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260415140000_buildings_sota_fix_wave1.sql` | _(inchangé)_ | `c734324cf4eb…` |
| rename | `20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql` | `20260415140001_fix_tenant_payment_signing_and_leases_recursion.sql` | `6f9291bfeb18…` |

### `20260416100000` — 2 fichiers

| Rôle | Fichier actuel | Nouveau nom | Hash prefix |
|---|---|---|---|
| keep | `20260416100000_fix_messages_conversation_trigger.sql` | _(inchangé)_ | `fa033399a566…` |
| rename | `20260416100000_fix_tickets_rls_recursion.sql` | `20260416100001_fix_tickets_rls_recursion.sql` | `dcad7ec93f37…` |

## Plan consolidé

- Total fichiers concernés : **41**
- Action `keep` : **13**
- Action `rename` : **28**

## Exécution proposée (pour Thomas)

Le script `scripts/audit/apply-dedup-renames.sh` contient les commandes `git mv` **commentées**. Protocole :

1. PASS 1 exécuté → confirmer qu'aucun des fichiers "rename" n'est déjà dans `schema_migrations` avec ce timestamp
2. Ouvrir `apply-dedup-renames.sh`, décommenter les lignes une par une
3. Créer une branche `chore/migrations-dedup-timestamps`
4. Exécuter les `git mv`
5. Pour chaque renommage, si le fichier source est déjà dans `schema_migrations` prod : ajouter une ligne `UPDATE supabase_migrations.schema_migrations SET version = '<nouveau>' WHERE version = '<ancien>';` dans `sprint-b1-reconciliation-sql.sql` (PASS 6)
6. Commit + review + merge

