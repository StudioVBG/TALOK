-- Normalise les noms des providers pour correspondre au code (Twilio, Stripe, etc.)
-- Le code credentials-service.ts cherche des noms capitalisés.

UPDATE api_providers SET name = 'Twilio' WHERE lower(name) = 'twilio';
UPDATE api_providers SET name = 'Stripe' WHERE lower(name) = 'stripe';
UPDATE api_providers SET name = 'GoCardless' WHERE lower(name) = 'gocardless';
UPDATE api_providers SET name = 'Mindee' WHERE lower(name) = 'mindee';
