# Sprint B3 — PASS 3 : Storage buckets

## Statut

⏳ **En attente d'exécution utilisateur** — sections 3.1 et 3.2 du `sprint-b3-audit-pack.sql`.

## Buckets attendus

| Bucket | Public | Size limit | MIME types |
|---|---|---|---|
| `documents` | private | 50 MB (52428800) | `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, Word/Excel/ODT, `text/plain`, `text/csv` |
| `landing-images` | public | 10 MB | `image/*` |

## Action manuelle si manquants

Sprint B2 a wrappé tous les `INSERT INTO storage.buckets` en `DO/EXCEPTION` (le rôle SQL Editor ne peut pas écrire sur `storage.*`). Donc ces 2 buckets ne sont **probablement pas créés**. À vérifier via section 3.1.

### Si `documents` absent

**Dashboard Supabase** :
1. Project → **Storage** → `New bucket`
2. Name : `documents`
3. Public : **OFF** (private)
4. File size limit : `52428800` (50 MB)
5. Allowed MIME types : ajouter chacun :
   ```
   application/pdf
   image/jpeg
   image/png
   image/webp
   image/heic
   image/heif
   application/msword
   application/vnd.openxmlformats-officedocument.wordprocessingml.document
   application/vnd.oasis.opendocument.text
   application/vnd.ms-excel
   application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   text/plain
   text/csv
   ```

### Si `landing-images` absent

**Dashboard Supabase** :
1. Project → **Storage** → `New bucket`
2. Name : `landing-images`
3. Public : **ON**
4. File size limit : `10485760` (10 MB)
5. Allowed MIME types : `image/*` (laisser ouvert ou lister jpeg/png/webp/svg+xml)

## Policies attendues

### Sur `storage.objects` pour `documents`

| Policy name | Action | Definition (résumé) |
|---|---|---|
| Users can upload documents | INSERT | `bucket_id = 'documents' AND auth.role() = 'authenticated'` |
| Users can read own documents | SELECT | `bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]` (namespace user) |

### Sur `storage.objects` pour `landing-images`

| Policy name | Action | Definition (résumé) |
|---|---|---|
| Public read landing images | SELECT | `bucket_id = 'landing-images'` |
| Admin upload landing images | INSERT | `bucket_id = 'landing-images' AND profile.role IN ('admin','platform_admin')` |
| Admin delete landing images | DELETE | idem |

Si policies manquantes → créer manuellement via Dashboard → Storage → bucket → Policies.

## Output utilisateur attendu

- Liste des buckets actuels (résultat 3.1)
- Liste des policies storage actuelles (résultat 3.2)
- Confirmation des actions manuelles à faire au Dashboard

## Impact si buckets manquants

- **PASS 6.4 (upload document) sera skipped** — pas bloquant pour le smoke test global, mais à fixer avant la mise en service réelle des nouveaux propriétaires.
