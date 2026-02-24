-- Suppression des providers Yousign, SendGrid et Brevo (signature/email intégrés ou non utilisés)
-- Les credentials associées sont supprimées en premier (FK)

DELETE FROM api_credentials
WHERE provider_id IN (
  SELECT id FROM api_providers
  WHERE lower(name) IN ('yousign', 'brevo', 'sendgrid')
);

DELETE FROM api_providers
WHERE lower(name) IN ('yousign', 'brevo', 'sendgrid');
