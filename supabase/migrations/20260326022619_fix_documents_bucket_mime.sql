-- Fix: Aligner les MIME types du bucket storage avec lib/documents/constants.ts
-- Bug: Word/Excel etaient acceptes par le code mais rejetes par le bucket

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv'
]::text[],
file_size_limit = 52428800  -- 50 Mo
WHERE id = 'documents';
