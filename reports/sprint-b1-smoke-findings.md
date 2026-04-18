# Sprint B1 — PASS 8 : Smoke findings

## 🔴 Timestamps non parseable

2 fichier(s) avec timestamp malformé :

- `20260101000002a_add_invited_email_to_signers.sql`
- `20260221_fix_owner_data_chain.sql`

**Risque** : ordre d'application indéterministe. À renommer manuellement avec un timestamp 14-digit.

## 🟠 Variantes de format de timestamp

| Format | Nombre |
|---|---:|
| 14-digit | 408 |
| 12-digit | 32 |
| unknown | 2 |

Les **32** fichiers en format 12-digit (YYYYMMDDHHMM) sont des migrations Supabase legacy (novembre 2024). Supabase CLI les accepte mais l'ordre avec les 14-digit peut être surprenant. Normalisation recommandée en Sprint B suivant.

## 🟠 Noms dupliqués sur timestamps différents

3 slug(s) réutilisé(s) :

| Slug | Nombre | Fichiers |
|---|---:|---|
| `fix_edl_signatures_schema` | 2 | `20251231000008_fix_edl_signatures_schema.sql`<br>`20260102000006_fix_edl_signatures_schema.sql` |
| `fix_document_titles` | 2 | `20260326023000_fix_document_titles.sql`<br>`20260329164841_fix_document_titles.sql` |
| `fix_visible_tenant_documents` | 2 | `20260328000000_fix_visible_tenant_documents.sql`<br>`20260328100000_fix_visible_tenant_documents.sql` |

**Interprétation** : une même migration a été recréée avec un nouveau timestamp. Soit c'est volontaire (rollback puis re-apply), soit c'est un oubli (l'ancien aurait dû être supprimé). À reviewer au cas par cas.

## 🟡 Gaps temporels (> 7 jours)

10 gap(s) >7j :

| Depuis | Vers | Jours |
|---|---|---:|
| `20240101000026_fix_provider_rls.sql` | `202411140001_fix_auth_helper_functions.sql` | 318 |
| `202411151200_property_share_tokens.sql` | `20241128000001_scoring_and_automations.sql` | 12.5 |
| `20241201000003_quotes_table.sql` | `20250101000001_owner_dashboard_rpc.sql` | 31 |
| `20250101000001_owner_dashboard_rpc.sql` | `20250114120000_add_guarantor_role.sql` | 13.5 |
| `202501200000_fix_leases_rls_infinite_recursion.sql` | `20250204000000_add_property_investment_fields.sql` | 15 |
| `20250204000000_add_property_investment_fields.sql` | `202502141000_property_rooms_photos.sql` | 10.4 |
| `20250220000000_add_open_banking_tables.sql` | `20250601000000_legal_protocol_tracking.sql` | 101 |
| `20250601000000_legal_protocol_tracking.sql` | `20251119060000_property_details_rpc.sql` | 171.3 |
| `20251119093000_admin_stats_rpc_v2.sql` | `20251130000001_edl_media_section.sql` | 10.6 |
| `20251210100000_add_lease_payment_fields.sql` | `20251221000000_document_caching.sql` | 10.6 |

**Interprétation** : pauses de travail ou applications en batch manuelles. Sans conséquence technique, mais utile pour reconstituer l'historique si un audit RGPD le demande.

## 🟢 Migrations ajoutées après la date du doc (2026-04-09)

**55** fichier(s) avec timestamp ≥ 20260409.

Rappel : le doc `docs/audits/pending-migrations.md` comptait 168 pending au 2026-04-09. Sprint A a compté 223. Écart = **+55** → cohérent avec les 55 migrations ajoutées depuis.

## 🟠 Noms suspects

32 fichier(s) avec nommage atypique :

| Fichier | Raison |
|---|---|
| `202411140001_fix_auth_helper_functions.sql` | 12-digit timestamp (expected 14) |
| `202411140100_expand_commercial_capabilities.sql` | 12-digit timestamp (expected 14) |
| `202411140210_property_workflow_status.sql` | 12-digit timestamp (expected 14) |
| `202411140220_property_financial_diagnostics.sql` | 12-digit timestamp (expected 14) |
| `202411140221_fix_property_status_enum.sql` | 12-digit timestamp (expected 14) |
| `202411140230_documents_gallery.sql` | 12-digit timestamp (expected 14) |
| `202411140500_parking_details.sql` | 12-digit timestamp (expected 14) |
| `202411151200_property_share_tokens.sql` | 12-digit timestamp (expected 14) |
| `202411290001_add_etudiant_lease_type.sql` | 12-digit timestamp (expected 14) |
| `202411290002_add_studio_box_property_types.sql` | 12-digit timestamp (expected 14) |
| `202411290003_add_banking_columns.sql` | 12-digit timestamp (expected 14) |
| `202501170000_fix_lease_signers_recursion.sql` | 12-digit timestamp (expected 14) |
| `202501170001_fix_tenant_profiles_rls_recursion.sql` | 12-digit timestamp (expected 14) |
| `202501170002_fix_roommates_rls_recursion.sql` | 12-digit timestamp (expected 14) |
| `202501180000_normalize_existing_emails.sql` | 12-digit timestamp (expected 14) |
| `202501200000_fix_leases_rls_infinite_recursion.sql` | 12-digit timestamp (expected 14) |
| `202502141000_property_rooms_photos.sql` | 12-digit timestamp (expected 14) |
| `202502150000_property_model_v3.sql` | 12-digit timestamp (expected 14) |
| `202502150001_property_photos_storage_policies.sql` | 12-digit timestamp (expected 14) |
| `202502160000_fix_supabase_advisors_issues.sql` | 12-digit timestamp (expected 14) |
| `202502170000_optimize_generate_unique_code.sql` | 12-digit timestamp (expected 14) |
| `202502180000_rls_properties_units.sql` | 12-digit timestamp (expected 14) |
| `202502180001_fix_rls_conflicts.sql` | 12-digit timestamp (expected 14) |
| `202502180002_fix_rls_conflicts_final.sql` | 12-digit timestamp (expected 14) |
| `202502180003_ensure_user_profile_id_works.sql` | 12-digit timestamp (expected 14) |
| `202502190000_diagnostic_owner_id.sql` | 12-digit timestamp (expected 14) |
| `202502190001_fix_owner_id_mismatch.sql` | 12-digit timestamp (expected 14) |
| `202502190002_fix_existing_owner_id.sql` | 12-digit timestamp (expected 14) |
| `202502190003_diagnostic_owner_id_quick.sql` | 12-digit timestamp (expected 14) |
| `202502191200_document_verification.sql` | 12-digit timestamp (expected 14) |
| `202502191300_ticket_maintenance_ai.sql` | 12-digit timestamp (expected 14) |
| `202502191400_fix_property_details_rpc.sql` | 12-digit timestamp (expected 14) |

**Recommandation** : renommer pour uniformiser, surtout avant une réconciliation schema_migrations.

## 📉 Ce qu'il manque (limite shallow clone)

Les anomalies suivantes **ne peuvent pas être détectées** sans PASS 1 réel :

- Migrations dans `schema_migrations` avec `inserted_at` incohérent (avant création de la colonne sur Supabase antérieur)
- Écart `statements` prod vs fichier fs (HASH MISMATCH)
- Migrations exécutées via SQL Editor sans fichier (ghosts)
- Historique des suppressions antérieures au 2026-04-10 (repo shallow — 183 commits visibles seulement)
