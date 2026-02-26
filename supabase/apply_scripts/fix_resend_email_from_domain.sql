-- Correction one-shot : remplacer email_from @send.talok.fr par @talok.fr
-- Le domaine talok.fr est vérifié sur Resend ; send.talok.fr est un sous-domaine technique non utilisable comme expéditeur.
-- À exécuter dans Supabase SQL Editor si l'erreur "send.talok.fr domain is not verified" apparaît.

UPDATE api_credentials
SET scope = jsonb_set(
  COALESCE(scope::jsonb, '{}'::jsonb),
  '{email_from}',
  '"Talok <noreply@talok.fr>"'
)::text
WHERE provider_id IN (
  SELECT id FROM api_providers WHERE name ILIKE 'Resend'
)
AND scope IS NOT NULL
AND scope::jsonb ? 'email_from'
AND (scope::jsonb->>'email_from') LIKE '%send.talok%';
