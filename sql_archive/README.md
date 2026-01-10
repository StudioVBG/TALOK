# SQL Archive

Ces fichiers SQL sont des corrections manuelles historiques qui ont été appliquées directement en base de données pendant le développement.

**Ne pas réutiliser ces fichiers** - ils sont conservés uniquement pour référence historique.

Toutes les corrections ont été intégrées dans les migrations officielles dans `/supabase/migrations/`.

## Fichiers archivés

| Fichier | Description | Migration correspondante |
|---------|-------------|-------------------------|
| FIX_RLS_*.sql | Corrections de Row Level Security | 20251204500000_fix_rls_recursion_urgent.sql |
| FIX_AUTH_500_ERROR.sql | Correction erreur auth 500 | 202501170001_fix_tenant_profiles_rls_recursion.sql |
| FIX_TENANT_PROFILE_LINK.sql | Liaison profil-locataire | 20260101000002_fix_tenant_dashboard_signers.sql |
| APPLY_NOTIFICATIONS.sql | Système de notifications | 20251205100000_notifications_system.sql |
| APPLY_DOCUMENTS_FIX.sql | Correction documents | 20251204200000_ensure_documents_bucket.sql |
| APPLY_SIGNATURE_IMAGE.sql | Images de signature | 20260109100000_signature_tracking_enhanced.sql |
| CLEANUP_CNI_DUPLICATES.sql | Nettoyage CNI en double | 20251204220000_add_cni_document_types.sql |

## Date d'archivage

2026-01-10 - Migration SOTA 2026
