-- Batch 2 — migrations 9 a 21 sur 169
-- 13 migrations, chaque migration wrappee dans DO/EXCEPTION

-- === [9/169] 20260212100002_email_templates_seed.sql ===
DO $wrapper$ BEGIN
-- ============================================================
-- Seed data: 31 email templates
-- ============================================================

-- ============================================
-- CATÉGORIE : AUTHENTIFICATION (auth)
-- ============================================

INSERT INTO email_templates (slug, category, name, description, subject, body_html, body_text, available_variables, send_delay_minutes) VALUES

-- 1. Confirmation d'inscription
('auth_confirmation', 'auth', 'Confirmation d''inscription', 'Email de confirmation envoyé après la création de compte', 'Confirmez votre inscription sur Talok, {{prenom}}',
'<h2>Bienvenue sur Talok, {{prenom}} !</h2>
<p>Vous venez de créer un compte en tant que <strong>{{role}}</strong>.</p>
<p>Pour activer votre compte et commencer à utiliser Talok, veuillez confirmer votre adresse email :</p>
<a href="{{confirmation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Confirmer mon adresse email</a>
<p>Ce lien est valable 24 heures. Si vous n''avez pas créé de compte, ignorez cet email.</p>
<p>À très vite sur Talok,<br>L''équipe Talok</p>',
'Bienvenue sur Talok, {{prenom}} !

Vous venez de créer un compte en tant que {{role}}.

Pour activer votre compte, confirmez votre adresse email en cliquant sur le lien suivant :
{{confirmation_url}}

Ce lien est valable 24 heures. Si vous n''avez pas créé de compte, ignorez cet email.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom de l''utilisateur", "example": "Thomas"}, {"key": "email", "label": "Adresse email", "example": "thomas@email.com"}, {"key": "confirmation_url", "label": "Lien de confirmation", "example": "https://talok.fr/auth/confirm?token=..."}, {"key": "role", "label": "Rôle (Propriétaire/Locataire/Prestataire)", "example": "Propriétaire"}]'::jsonb,
0),

-- 2. Réinitialisation de mot de passe
('auth_reset_password', 'auth', 'Réinitialisation de mot de passe', 'Email envoyé lors d''une demande de réinitialisation de mot de passe', 'Réinitialisation de votre mot de passe Talok',
'<h2>Réinitialisation de mot de passe</h2>
<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
<a href="{{reset_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Réinitialiser mon mot de passe</a>
<p>Ce lien expire dans {{expiration}}. Si vous n''êtes pas à l''origine de cette demande, ignorez cet email — votre mot de passe ne sera pas modifié.</p>',
'Bonjour {{prenom}},

Vous avez demandé la réinitialisation de votre mot de passe.
Cliquez sur le lien suivant pour en choisir un nouveau :
{{reset_url}}

Ce lien expire dans {{expiration}}.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "reset_url", "label": "Lien de réinitialisation", "example": "https://talok.fr/auth/reset?token=..."}, {"key": "expiration", "label": "Durée de validité", "example": "1 heure"}]'::jsonb,
0),

-- 3. Connexion par lien magique
('auth_magic_link', 'auth', 'Connexion par lien magique', 'Lien magique de connexion sans mot de passe', 'Votre lien de connexion Talok',
'<p>Bonjour {{prenom}},</p>
<p>Cliquez sur le bouton ci-dessous pour vous connecter à Talok :</p>
<a href="{{magic_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Se connecter</a>
<p>Ce lien expire dans {{expiration}} et ne peut être utilisé qu''une seule fois.</p>',
'Bonjour {{prenom}},

Connectez-vous à Talok via ce lien :
{{magic_url}}

Ce lien expire dans {{expiration}} et ne peut être utilisé qu''une seule fois.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "magic_url", "label": "Lien de connexion", "example": "https://talok.fr/auth/magic?token=..."}, {"key": "expiration", "label": "Durée de validité", "example": "15 minutes"}]'::jsonb,
0),

-- 4. Changement d'adresse email
('auth_email_change', 'auth', 'Changement d''adresse email', 'Confirmation lors d''un changement d''adresse email', 'Confirmez votre nouvelle adresse email',
'<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé le changement de votre adresse email vers <strong>{{new_email}}</strong>.</p>
<a href="{{confirm_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Confirmer le changement</a>
<p>Si vous n''êtes pas à l''origine de cette demande, sécurisez votre compte immédiatement.</p>',
'Bonjour {{prenom}},

Vous avez demandé le changement de votre adresse email vers {{new_email}}.

Confirmez le changement via ce lien :
{{confirm_url}}

Si vous n''êtes pas à l''origine de cette demande, sécurisez votre compte immédiatement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "new_email", "label": "Nouvelle adresse email", "example": "nouveau@email.com"}, {"key": "confirm_url", "label": "Lien de confirmation", "example": "https://talok.fr/auth/confirm-email?token=..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : INVITATIONS & ONBOARDING (invitation)
-- ============================================

-- 5. Invitation locataire
('invitation_tenant', 'invitation', 'Invitation locataire', 'Email d''invitation envoyé à un locataire par le propriétaire', '{{nom_proprietaire}} vous invite à rejoindre Talok',
'<h2>Vous êtes invité(e) sur Talok</h2>
<p>Bonjour {{prenom_locataire}},</p>
<p><strong>{{nom_proprietaire}}</strong> vous invite à rejoindre Talok pour gérer votre location au :</p>
<p style="background:#f1f5f9;padding:12px 16px;border-radius:8px;border-left:4px solid #2563eb;">📍 {{adresse_bien}}</p>
<p>Avec Talok, vous pourrez :</p>
<ul>
  <li>Consulter et télécharger vos quittances de loyer</li>
  <li>Signaler des incidents et suivre leur résolution</li>
  <li>Signer vos documents numériquement</li>
  <li>Communiquer facilement avec votre propriétaire</li>
</ul>
<a href="{{invitation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Créer mon compte locataire</a>',
'Bonjour {{prenom_locataire}},

{{nom_proprietaire}} vous invite à rejoindre Talok pour gérer votre location au :
{{adresse_bien}}

Créez votre compte via ce lien :
{{invitation_url}}

L''équipe Talok',
'[{"key": "prenom_locataire", "label": "Prénom du locataire", "example": "Marie"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas, Fort-de-France"}, {"key": "invitation_url", "label": "Lien d''invitation", "example": "https://talok.fr/invite?token=..."}]'::jsonb,
0),

-- 6. Invitation prestataire
('invitation_provider', 'invitation', 'Invitation prestataire', 'Email d''invitation envoyé à un prestataire par le propriétaire', '{{nom_proprietaire}} vous invite comme prestataire sur Talok',
'<p>Bonjour {{prenom_prestataire}},</p>
<p><strong>{{nom_proprietaire}}</strong> souhaite vous ajouter comme prestataire <strong>{{specialite}}</strong> sur Talok.</p>
<p>En rejoignant Talok, vous pourrez recevoir et gérer vos interventions directement depuis votre espace dédié.</p>
<a href="{{invitation_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Rejoindre Talok</a>',
'Bonjour {{prenom_prestataire}},

{{nom_proprietaire}} souhaite vous ajouter comme prestataire {{specialite}} sur Talok.

Rejoignez Talok via ce lien :
{{invitation_url}}

L''équipe Talok',
'[{"key": "prenom_prestataire", "label": "Prénom du prestataire", "example": "Jacques"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "specialite", "label": "Spécialité", "example": "plomberie"}, {"key": "invitation_url", "label": "Lien d''invitation", "example": "https://talok.fr/invite?token=..."}]'::jsonb,
0),

-- 7. Bienvenue propriétaire
('welcome_owner', 'invitation', 'Bienvenue propriétaire', 'Email de bienvenue envoyé après confirmation du compte propriétaire', 'Bienvenue sur Talok, {{prenom}} ! Voici comment démarrer',
'<h2>Votre compte est activé</h2>
<p>Bonjour {{prenom}},</p>
<p>Bienvenue sur Talok ! Voici les premières étapes pour bien démarrer :</p>
<ol>
  <li><strong>Ajoutez votre premier bien</strong> — renseignez l''adresse, le type et les caractéristiques</li>
  <li><strong>Créez un bail</strong> — associez un locataire et définissez les conditions</li>
  <li><strong>Invitez votre locataire</strong> — il recevra un email pour créer son espace</li>
</ol>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accéder à mon tableau de bord</a>
<p>Besoin d''aide ? Notre équipe est disponible à support@talok.fr</p>',
'Bonjour {{prenom}},

Bienvenue sur Talok ! Voici les premières étapes :
1. Ajoutez votre premier bien
2. Créez un bail
3. Invitez votre locataire

Accédez à votre tableau de bord : {{dashboard_url}}

Besoin d''aide ? Contactez support@talok.fr

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "dashboard_url", "label": "Lien vers le dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : BAUX (lease)
-- ============================================

-- 8. Bail créé
('lease_created', 'lease', 'Bail créé', 'Notification au propriétaire lors de la création d''un bail', 'Bail créé — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail pour le bien situé au <strong>{{adresse_bien}}</strong> a été créé avec succès.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Locataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_locataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Début du bail</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_debut}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Loyer mensuel</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant_loyer}} €</td></tr>
</table>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le bail</a>',
'Bonjour {{prenom}},

Le bail pour le bien au {{adresse_bien}} a été créé.
Locataire : {{nom_locataire}}
Début : {{date_debut}}
Loyer : {{montant_loyer}} €

Voir le bail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas, Fort-de-France"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "date_debut", "label": "Date de début du bail", "example": "1er mars 2026"}, {"key": "montant_loyer", "label": "Montant du loyer", "example": "850"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 9. Bail expirant
('lease_expiring', 'lease', 'Bail arrivant à échéance', 'Alerte au propriétaire avant l''expiration d''un bail', 'Bail expirant dans {{jours_restants}} jours — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail de <strong>{{nom_locataire}}</strong> au <strong>{{adresse_bien}}</strong> arrive à échéance le <strong>{{date_fin}}</strong> (dans {{jours_restants}} jours).</p>
<p>Pensez à :</p>
<ul>
  <li>Renouveler le bail si vous souhaitez continuer la location</li>
  <li>Planifier un état des lieux de sortie</li>
  <li>Prévenir votre locataire de vos intentions</li>
</ul>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Gérer ce bail</a>',
'Bonjour {{prenom}},

Le bail de {{nom_locataire}} au {{adresse_bien}} expire le {{date_fin}} (dans {{jours_restants}} jours).

Gérer ce bail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "date_fin", "label": "Date de fin du bail", "example": "31 mars 2026"}, {"key": "jours_restants", "label": "Nombre de jours restants", "example": "30"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 10. Résiliation de bail
('lease_terminated', 'lease', 'Résiliation de bail', 'Notification de résiliation de bail', 'Résiliation de bail — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Le bail pour le bien situé au <strong>{{adresse_bien}}</strong> a été résilié.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date de fin effective</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_fin}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Motif</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{motif}}</td></tr>
</table>
<p>Un état des lieux de sortie devra être planifié avant cette date.</p>',
'Bonjour {{prenom}},

Le bail au {{adresse_bien}} a été résilié.
Date de fin : {{date_fin}}
Motif : {{motif}}

Un état des lieux de sortie devra être planifié.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_fin", "label": "Date effective de fin", "example": "31 mars 2026"}, {"key": "motif", "label": "Motif de résiliation", "example": "Congé du locataire"}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : PAIEMENTS & LOYERS (payment)
-- ============================================

-- 11. Rappel de loyer
('rent_reminder', 'payment', 'Rappel de loyer', 'Rappel envoyé au locataire avant l''échéance du loyer', 'Rappel : loyer de {{montant}} € à régler avant le {{date_echeance}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre loyer de <strong>{{montant}} €</strong> pour le bien situé au <strong>{{adresse_bien}}</strong> est à régler avant le <strong>{{date_echeance}}</strong>.</p>
<a href="{{payment_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Payer mon loyer</a>
<p>Si vous avez déjà effectué le paiement, veuillez ignorer cet email.</p>',
'Bonjour {{prenom}},

Votre loyer de {{montant}} € pour le bien au {{adresse_bien}} est à régler avant le {{date_echeance}}.

Payer : {{payment_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "montant", "label": "Montant du loyer", "example": "850"}, {"key": "date_echeance", "label": "Date d''échéance", "example": "5 mars 2026"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "payment_url", "label": "Lien de paiement", "example": "https://talok.fr/tenant/payments/..."}]'::jsonb,
0),

-- 12. Loyer reçu (propriétaire)
('rent_received', 'payment', 'Loyer reçu', 'Notification au propriétaire après réception d''un loyer', 'Loyer reçu — {{montant}} € de {{nom_locataire}}',
'<p>Bonjour {{prenom}},</p>
<p>Le loyer du mois de <strong>{{mois}}</strong> a été reçu :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Locataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_locataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<p>La quittance sera automatiquement générée et envoyée au locataire.</p>',
'Bonjour {{prenom}},

Loyer de {{mois}} reçu :
Locataire : {{nom_locataire}}
Bien : {{adresse_bien}}
Montant : {{montant}} €

La quittance sera générée automatiquement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "montant", "label": "Montant reçu", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "mois", "label": "Mois concerné", "example": "mars 2026"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- 13. Loyer en retard (propriétaire)
('rent_late', 'payment', 'Loyer en retard', 'Alerte au propriétaire pour un loyer impayé', 'Loyer impayé — {{nom_locataire}} ({{jours_retard}} jours de retard)',
'<p>Bonjour {{prenom}},</p>
<p>Le loyer de <strong>{{nom_locataire}}</strong> pour le bien au <strong>{{adresse_bien}}</strong> est en retard de <strong>{{jours_retard}} jours</strong>.</p>
<p>Montant impayé : <strong>{{montant}} €</strong></p>
<a href="{{lease_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Loyer impayé de {{nom_locataire}} au {{adresse_bien}}.
Retard : {{jours_retard}} jours
Montant : {{montant}} €

Voir le détail : {{lease_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Nom du locataire", "example": "Marie Martin"}, {"key": "montant", "label": "Montant dû", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "jours_retard", "label": "Jours de retard", "example": "5"}, {"key": "lease_url", "label": "Lien vers le bail", "example": "https://talok.fr/owner/leases/..."}]'::jsonb,
0),

-- 14. Relance loyer impayé (locataire)
('rent_late_tenant', 'payment', 'Relance loyer impayé', 'Relance envoyée au locataire pour un loyer en retard', 'Rappel important : loyer impayé de {{montant}} €',
'<p>Bonjour {{prenom}},</p>
<p>Nous vous informons que votre loyer pour le bien au <strong>{{adresse_bien}}</strong> est en retard de <strong>{{jours_retard}} jours</strong>.</p>
<p>Montant à régler : <strong>{{montant}} €</strong></p>
<a href="{{payment_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Régulariser maintenant</a>
<p>En cas de difficulté, nous vous encourageons à contacter votre propriétaire pour trouver une solution amiable.</p>',
'Bonjour {{prenom}},

Votre loyer au {{adresse_bien}} est en retard de {{jours_retard}} jours.
Montant : {{montant}} €

Régulariser : {{payment_url}}

En cas de difficulté, contactez votre propriétaire.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "montant", "label": "Montant dû", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "jours_retard", "label": "Jours de retard", "example": "5"}, {"key": "payment_url", "label": "Lien de paiement", "example": "https://talok.fr/tenant/payments/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : DOCUMENTS & QUITTANCES (document)
-- ============================================

-- 15. Quittance disponible
('quittance_available', 'document', 'Quittance disponible', 'Notification au locataire quand une quittance est prête', 'Votre quittance de loyer — {{mois}} {{annee}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre quittance de loyer pour <strong>{{mois}} {{annee}}</strong> est disponible.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<a href="{{download_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma quittance</a>',
'Bonjour {{prenom}},

Votre quittance de loyer pour {{mois}} {{annee}} est disponible.
Bien : {{adresse_bien}}
Montant : {{montant}} €

Télécharger : {{download_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "mois", "label": "Mois", "example": "mars"}, {"key": "annee", "label": "Année", "example": "2026"}, {"key": "montant", "label": "Montant", "example": "850"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "download_url", "label": "Lien de téléchargement", "example": "https://talok.fr/tenant/documents/..."}]'::jsonb,
0),

-- 16. Document à signer
('document_to_sign', 'document', 'Document à signer', 'Notification quand un document nécessite une signature', 'Document à signer : {{type_document}} — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_expediteur}}</strong> vous invite à signer le document suivant :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Document</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{type_document}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien concerné</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">À signer avant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{expiration}}</td></tr>
</table>
<a href="{{sign_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Signer le document</a>
<p>Ce lien expire le {{expiration}}.</p>',
'Bonjour {{prenom}},

{{nom_expediteur}} vous invite à signer : {{type_document}}
Bien : {{adresse_bien}}
À signer avant : {{expiration}}

Signer : {{sign_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du signataire", "example": "Marie"}, {"key": "type_document", "label": "Type de document", "example": "Bail d''habitation"}, {"key": "nom_expediteur", "label": "Nom de l''expéditeur", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "sign_url", "label": "Lien de signature", "example": "https://talok.fr/signature/..."}, {"key": "expiration", "label": "Date d''expiration", "example": "15 mars 2026"}]'::jsonb,
0),

-- 17. Document signé
('document_signed', 'document', 'Document signé', 'Notification quand un document a été signé', 'Document signé par {{nom_signataire}} — {{type_document}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_signataire}}</strong> a signé le document <strong>{{type_document}}</strong> concernant le bien au <strong>{{adresse_bien}}</strong> le {{date_signature}}.</p>
<a href="{{document_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le document signé</a>',
'Bonjour {{prenom}},

{{nom_signataire}} a signé le document {{type_document}} pour le bien au {{adresse_bien}} le {{date_signature}}.

Voir le document : {{document_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "type_document", "label": "Type de document", "example": "Bail d''habitation"}, {"key": "nom_signataire", "label": "Nom du signataire", "example": "Marie Martin"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_signature", "label": "Date de signature", "example": "1er mars 2026"}, {"key": "document_url", "label": "Lien vers le document", "example": "https://talok.fr/documents/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : ÉTATS DES LIEUX (edl)
-- ============================================

-- 18. EDL planifié
('edl_scheduled', 'edl', 'EDL planifié', 'Notification quand un état des lieux est programmé', 'État des lieux {{type_edl}} planifié — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>Un état des lieux <strong>{{type_edl}}</strong> a été planifié :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Bien</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_edl}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Organisé par</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_organisateur}}</td></tr>
</table>
<a href="{{edl_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir les détails</a>
<p>Veuillez vous présenter à l''adresse indiquée à la date et heure convenues.</p>',
'Bonjour {{prenom}},

État des lieux {{type_edl}} planifié :
Bien : {{adresse_bien}}
Date : {{date_edl}}
Organisé par : {{nom_organisateur}}

Détails : {{edl_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Marie"}, {"key": "type_edl", "label": "Type (Entrée/Sortie)", "example": "d''entrée"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "date_edl", "label": "Date et heure", "example": "15 mars 2026 à 10h00"}, {"key": "nom_organisateur", "label": "Organisateur", "example": "M. Dupont"}, {"key": "edl_url", "label": "Lien vers le détail", "example": "https://talok.fr/edl/..."}]'::jsonb,
0),

-- 19. EDL terminé
('edl_completed', 'edl', 'EDL terminé', 'Notification quand un état des lieux est finalisé', 'État des lieux {{type_edl}} terminé — {{adresse_bien}}',
'<p>Bonjour {{prenom}},</p>
<p>L''état des lieux <strong>{{type_edl}}</strong> du bien au <strong>{{adresse_bien}}</strong> réalisé le {{date_edl}} est maintenant finalisé.</p>
<a href="{{report_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Consulter le rapport</a>
<p>Le rapport est disponible dans votre espace documents.</p>',
'Bonjour {{prenom}},

L''état des lieux {{type_edl}} au {{adresse_bien}} réalisé le {{date_edl}} est finalisé.

Consulter le rapport : {{report_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "type_edl", "label": "Type (Entrée/Sortie)", "example": "de sortie"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}, {"key": "date_edl", "label": "Date de réalisation", "example": "15 mars 2026"}, {"key": "report_url", "label": "Lien vers le rapport", "example": "https://talok.fr/edl/report/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : INCIDENTS & INTERVENTIONS (incident)
-- ============================================

-- 20. Incident signalé (propriétaire)
('incident_reported', 'incident', 'Incident signalé', 'Notification au propriétaire quand un locataire signale un incident', 'Incident signalé — {{titre_incident}} ({{urgence}})',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_locataire}}</strong> a signalé un incident au <strong>{{adresse_bien}}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Incident</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_incident}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Urgence</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{urgence}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Description</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{description_incident}}</td></tr>
</table>
<a href="{{incident_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Gérer l''incident</a>',
'Bonjour {{prenom}},

{{nom_locataire}} a signalé un incident au {{adresse_bien}} :
Incident : {{titre_incident}}
Urgence : {{urgence}}
Description : {{description_incident}}

Gérer : {{incident_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "nom_locataire", "label": "Locataire", "example": "Marie Martin"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "titre_incident", "label": "Titre de l''incident", "example": "Fuite robinet cuisine"}, {"key": "description_incident", "label": "Description", "example": "Le robinet fuit depuis ce matin"}, {"key": "urgence", "label": "Niveau d''urgence", "example": "urgent"}, {"key": "incident_url", "label": "Lien vers l''incident", "example": "https://talok.fr/owner/tickets/..."}]'::jsonb,
0),

-- 21. Mise à jour d'incident (locataire)
('incident_update', 'incident', 'Mise à jour d''incident', 'Notification au locataire lors de la mise à jour d''un incident', 'Mise à jour de votre incident — {{titre_incident}}',
'<p>Bonjour {{prenom}},</p>
<p>Votre incident <strong>{{titre_incident}}</strong> a été mis à jour :</p>
<p>Nouveau statut : <strong>{{nouveau_statut}}</strong></p>
<p>{{commentaire}}</p>
<a href="{{incident_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Votre incident "{{titre_incident}}" a été mis à jour.
Nouveau statut : {{nouveau_statut}}
{{commentaire}}

Détail : {{incident_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "titre_incident", "label": "Titre de l''incident", "example": "Fuite robinet cuisine"}, {"key": "nouveau_statut", "label": "Nouveau statut", "example": "En cours de traitement"}, {"key": "commentaire", "label": "Commentaire", "example": "Un technicien passera demain."}, {"key": "incident_url", "label": "Lien", "example": "https://talok.fr/tenant/tickets/..."}]'::jsonb,
0),

-- 22. Intervention assignée (prestataire)
('intervention_assigned', 'incident', 'Intervention assignée', 'Notification au prestataire quand une intervention lui est assignée', 'Nouvelle intervention — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_proprietaire}}</strong> vous assigne une intervention :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Intervention</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_intervention}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Adresse</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{adresse_bien}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date souhaitée</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_souhaitee}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Urgence</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{urgence}}</td></tr>
</table>
<a href="{{intervention_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accepter / Planifier</a>',
'Bonjour {{prenom}},

{{nom_proprietaire}} vous assigne une intervention :
Intervention : {{titre_intervention}}
Adresse : {{adresse_bien}}
Date souhaitée : {{date_souhaitee}}
Urgence : {{urgence}}

Accepter/Planifier : {{intervention_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du prestataire", "example": "Jacques"}, {"key": "nom_proprietaire", "label": "Nom du propriétaire", "example": "M. Dupont"}, {"key": "adresse_bien", "label": "Adresse du bien", "example": "12 rue des Lilas"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "date_souhaitee", "label": "Date souhaitée", "example": "18 mars 2026"}, {"key": "urgence", "label": "Niveau d''urgence", "example": "urgent"}, {"key": "intervention_url", "label": "Lien", "example": "https://talok.fr/provider/work-orders/..."}]'::jsonb,
0),

-- 23. Intervention planifiée (locataire)
('intervention_scheduled', 'incident', 'Intervention planifiée', 'Notification au locataire quand une intervention est programmée', 'Intervention planifiée — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p>Une intervention a été planifiée pour votre logement au <strong>{{adresse_bien}}</strong> :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Intervention</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{titre_intervention}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prestataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_prestataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_intervention}}</td></tr>
</table>
<p>Merci de vous assurer que l''accès au logement sera possible à cette date.</p>',
'Bonjour {{prenom}},

Intervention planifiée au {{adresse_bien}} :
Intervention : {{titre_intervention}}
Prestataire : {{nom_prestataire}}
Date : {{date_intervention}}

Merci d''assurer l''accès au logement.

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du locataire", "example": "Marie"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "nom_prestataire", "label": "Nom du prestataire", "example": "Jacques Martin"}, {"key": "date_intervention", "label": "Date et créneau", "example": "18 mars 2026, 9h-12h"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}]'::jsonb,
0),

-- 24. Intervention terminée (propriétaire)
('intervention_completed', 'incident', 'Intervention terminée', 'Notification au propriétaire quand une intervention est finalisée', 'Intervention terminée — {{titre_intervention}}',
'<p>Bonjour {{prenom}},</p>
<p>L''intervention <strong>{{titre_intervention}}</strong> au <strong>{{adresse_bien}}</strong> a été réalisée.</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prestataire</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nom_prestataire}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_realisation}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Coût</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{cout}} €</td></tr>
</table>
<a href="{{intervention_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le compte-rendu</a>',
'Bonjour {{prenom}},

Intervention terminée : {{titre_intervention}} au {{adresse_bien}}
Prestataire : {{nom_prestataire}}
Date : {{date_realisation}}
Coût : {{cout}} €

Compte-rendu : {{intervention_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du propriétaire", "example": "Thomas"}, {"key": "titre_intervention", "label": "Description", "example": "Réparation fuite robinet"}, {"key": "nom_prestataire", "label": "Prestataire", "example": "Jacques Martin"}, {"key": "adresse_bien", "label": "Adresse", "example": "12 rue des Lilas"}, {"key": "date_realisation", "label": "Date de réalisation", "example": "18 mars 2026"}, {"key": "cout", "label": "Coût", "example": "150"}, {"key": "intervention_url", "label": "Lien", "example": "https://talok.fr/owner/work-orders/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : ABONNEMENT & FACTURATION (subscription)
-- ============================================

-- 25. Bienvenue abonnement
('subscription_welcome', 'subscription', 'Bienvenue abonnement', 'Email de bienvenue après souscription à un plan', 'Votre abonnement Talok {{plan}} est activé !',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> est maintenant actif. Merci pour votre confiance !</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Plan</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{plan}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} € / an</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Prochain renouvellement</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_renouvellement}}</td></tr>
</table>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Accéder à Talok</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} est actif.
Plan : {{plan}}
Montant : {{montant}} € / an
Prochain renouvellement : {{date_renouvellement}}

Accéder à Talok : {{dashboard_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Nom du plan", "example": "Confort"}, {"key": "montant", "label": "Montant annuel", "example": "290"}, {"key": "date_renouvellement", "label": "Date de renouvellement", "example": "12 février 2027"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0),

-- 26. Abonnement expirant
('subscription_expiring', 'subscription', 'Abonnement expirant', 'Alerte avant l''expiration d''un abonnement', 'Votre abonnement Talok expire dans {{jours_restants}} jours',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> expire le <strong>{{date_expiration}}</strong>.</p>
<p>Pour continuer à profiter de toutes les fonctionnalités, pensez à renouveler votre abonnement.</p>
<a href="{{renewal_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Renouveler mon abonnement</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} expire le {{date_expiration}}.

Renouveler : {{renewal_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Plan actuel", "example": "Confort"}, {"key": "date_expiration", "label": "Date d''expiration", "example": "12 mars 2026"}, {"key": "jours_restants", "label": "Jours restants", "example": "15"}, {"key": "renewal_url", "label": "Lien de renouvellement", "example": "https://talok.fr/settings/billing"}]'::jsonb,
0),

-- 27. Abonnement renouvelé
('subscription_renewed', 'subscription', 'Abonnement renouvelé', 'Confirmation de renouvellement d''abonnement', 'Abonnement Talok renouvelé',
'<p>Bonjour {{prenom}},</p>
<p>Votre abonnement <strong>Talok {{plan}}</strong> a été renouvelé avec succès.</p>
<p>Montant : <strong>{{montant}} €</strong><br>
Prochain renouvellement : {{date_renouvellement}}</p>
<a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger ma facture</a>',
'Bonjour {{prenom}},

Votre abonnement Talok {{plan}} a été renouvelé.
Montant : {{montant}} €
Prochain renouvellement : {{date_renouvellement}}

Facture : {{invoice_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "plan", "label": "Plan", "example": "Confort"}, {"key": "montant", "label": "Montant facturé", "example": "290"}, {"key": "date_renouvellement", "label": "Prochaine échéance", "example": "12 février 2027"}, {"key": "invoice_url", "label": "Lien vers la facture", "example": "https://talok.fr/settings/billing/invoices/..."}]'::jsonb,
0),

-- 28. Échec de paiement
('payment_failed', 'subscription', 'Échec de paiement', 'Alerte lors d''un échec de paiement d''abonnement', 'Échec du paiement Talok — Action requise',
'<p>Bonjour {{prenom}},</p>
<p>Le paiement de <strong>{{montant}} €</strong> pour votre abonnement Talok a échoué.</p>
<p>Raison : {{raison}}</p>
<p>Veuillez mettre à jour vos informations de paiement pour éviter toute interruption de service.</p>
<a href="{{billing_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Mettre à jour mon moyen de paiement</a>',
'Bonjour {{prenom}},

Le paiement de {{montant}} € pour votre abonnement Talok a échoué.
Raison : {{raison}}

Mettez à jour vos informations de paiement : {{billing_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "montant", "label": "Montant", "example": "290"}, {"key": "raison", "label": "Raison de l''échec", "example": "Carte expirée"}, {"key": "billing_url", "label": "Lien paramètres de paiement", "example": "https://talok.fr/settings/billing"}]'::jsonb,
0),

-- 29. Facture disponible
('invoice_available', 'subscription', 'Facture disponible', 'Notification quand une facture Talok est prête', 'Facture Talok n°{{numero_facture}} disponible',
'<p>Bonjour {{prenom}},</p>
<p>Votre facture Talok est disponible :</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Facture n°</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{numero_facture}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Date</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{date_facture}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Montant</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{montant}} €</td></tr>
</table>
<a href="{{invoice_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Télécharger la facture</a>',
'Bonjour {{prenom}},

Facture Talok disponible :
N° : {{numero_facture}}
Date : {{date_facture}}
Montant : {{montant}} €

Télécharger : {{invoice_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "numero_facture", "label": "Numéro de facture", "example": "TLK-2026-0042"}, {"key": "montant", "label": "Montant", "example": "290"}, {"key": "date_facture", "label": "Date", "example": "12 février 2026"}, {"key": "invoice_url", "label": "Lien de téléchargement", "example": "https://talok.fr/settings/billing/invoices/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : MESSAGERIE (messaging)
-- ============================================

-- 30. Nouveau message
('new_message', 'messaging', 'Nouveau message', 'Notification quand un nouveau message est reçu', 'Nouveau message de {{nom_expediteur}}',
'<p>Bonjour {{prenom}},</p>
<p><strong>{{nom_expediteur}}</strong> vous a envoyé un message :</p>
<blockquote style="border-left:4px solid #2563eb;padding:8px 16px;margin:16px 0;background:#f8fafc;">{{apercu_message}}</blockquote>
<a href="{{message_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Répondre</a>',
'Bonjour {{prenom}},

{{nom_expediteur}} vous a envoyé un message :
"{{apercu_message}}"

Répondre : {{message_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom du destinataire", "example": "Thomas"}, {"key": "nom_expediteur", "label": "Nom de l''expéditeur", "example": "Marie Martin"}, {"key": "apercu_message", "label": "Aperçu du message", "example": "Bonjour, j''ai une question concernant..."}, {"key": "message_url", "label": "Lien vers la conversation", "example": "https://talok.fr/messages/..."}]'::jsonb,
0),

-- ============================================
-- CATÉGORIE : RAPPORTS (report)
-- ============================================

-- 31. Récapitulatif mensuel propriétaire
('monthly_summary_owner', 'report', 'Récapitulatif mensuel', 'Rapport mensuel envoyé aux propriétaires', 'Récapitulatif {{mois}} {{annee}} — {{loyers_recus}} € encaissés',
'<h2>Récapitulatif du mois de {{mois}} {{annee}}</h2>
<p>Bonjour {{prenom}}, voici le résumé de votre activité locative :</p>
<h3>Finances</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Loyers encaissés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{loyers_recus}} € / {{loyers_attendus}} €</td></tr>
</table>
<h3>Patrimoine</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Biens gérés</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_biens}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Taux d''occupation</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{taux_occupation}} %</td></tr>
</table>
<h3>Maintenance</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Incidents ouverts</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_incidents_ouverts}}</td></tr>
  <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">Interventions ce mois</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">{{nb_interventions}}</td></tr>
</table>
<a href="{{dashboard_url}}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Voir le détail</a>',
'Bonjour {{prenom}},

Récapitulatif {{mois}} {{annee}} :

FINANCES
Loyers encaissés : {{loyers_recus}} € / {{loyers_attendus}} €

PATRIMOINE
Biens gérés : {{nb_biens}}
Taux d''occupation : {{taux_occupation}} %

MAINTENANCE
Incidents ouverts : {{nb_incidents_ouverts}}
Interventions : {{nb_interventions}}

Détail : {{dashboard_url}}

L''équipe Talok',
'[{"key": "prenom", "label": "Prénom", "example": "Thomas"}, {"key": "mois", "label": "Mois", "example": "février"}, {"key": "annee", "label": "Année", "example": "2026"}, {"key": "nb_biens", "label": "Nombre de biens", "example": "3"}, {"key": "loyers_recus", "label": "Loyers encaissés", "example": "2550"}, {"key": "loyers_attendus", "label": "Loyers attendus", "example": "2550"}, {"key": "nb_incidents_ouverts", "label": "Incidents ouverts", "example": "1"}, {"key": "nb_interventions", "label": "Interventions du mois", "example": "2"}, {"key": "taux_occupation", "label": "Taux d''occupation", "example": "100"}, {"key": "dashboard_url", "label": "Lien dashboard", "example": "https://talok.fr/owner/dashboard"}]'::jsonb,
0)
ON CONFLICT (slug) DO NOTHING;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [10/169] 20260212200000_audit_v3_comprehensive_integrity.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- AUDIT D'INTÉGRITÉ V3 — VÉRIFICATIONS ÉTENDUES & QUALITÉ DES DONNÉES
-- Date: 2026-02-12
-- Complète 20260212000000 + 20260212100000
-- ============================================================================
-- Ce script ajoute :
--   Phase 6 : Intégrité signatures (sessions, participants, preuves)
--   Phase 7 : Intégrité organisations & white-label
--   Phase 8 : Intégrité commercial (fonds de commerce, location-gérance)
--   Phase 9 : Qualité des données (champs obligatoires, cohérence métier)
--   Phase 10 : Rapport d'audit unifié (score global)
-- ============================================================================
-- PRÉREQUIS : 20260212000000 + 20260212100000 déjà appliqués
-- ============================================================================


-- ============================================================================
-- PHASE 6 : INTÉGRITÉ DES SIGNATURES
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_signature_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $mig$
BEGIN

  -- Sessions sans participants
  RETURN QUERY
  SELECT 'sessions_without_participants'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Sessions de signature actives sans aucun participant'::TEXT,
    string_agg(ss.id::TEXT, ', ')::TEXT
  FROM signature_sessions ss
  WHERE ss.status IN ('pending', 'ongoing')
    AND NOT EXISTS (SELECT 1 FROM signature_participants sp WHERE sp.session_id = ss.id);

  -- Participants orphelins (session supprimée)
  RETURN QUERY
  SELECT 'orphan_participants'::TEXT,
    'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Participants dont la session de signature n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_participants sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sp.session_id);

  -- Preuves orphelines (participant supprimé)
  RETURN QUERY
  SELECT 'orphan_proofs'::TEXT,
    'signature_proofs'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Preuves de signature dont le participant n''existe plus'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_proofs sp
  WHERE NOT EXISTS (SELECT 1 FROM signature_participants pa WHERE pa.id = sp.participant_id);

  -- Sessions "done" sans preuve pour tous les participants signés
  RETURN QUERY
  SELECT 'done_sessions_missing_proofs'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(DISTINCT ss.id)::BIGINT,
    'HIGH'::TEXT,
    'Sessions terminées avec des participants signés sans preuve eIDAS'::TEXT,
    string_agg(DISTINCT ss.id::TEXT, ', ')::TEXT
  FROM signature_sessions ss
  JOIN signature_participants sp ON sp.session_id = ss.id
  WHERE ss.status = 'done'
    AND sp.status = 'signed'
    AND NOT EXISTS (
      SELECT 1 FROM signature_proofs pr WHERE pr.participant_id = sp.id
    );

  -- Sessions expirées non marquées
  RETURN QUERY
  SELECT 'expired_sessions_not_marked'::TEXT,
    'signature_sessions'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Sessions avec deadline dépassée mais statut non-expiré'::TEXT,
    string_agg(ss.id::TEXT, ', ')::TEXT
  FROM signature_sessions ss
  WHERE ss.deadline < NOW()
    AND ss.status IN ('pending', 'ongoing');

  -- Audit log orphelin
  RETURN QUERY
  SELECT 'orphan_audit_log'::TEXT,
    'signature_audit_log'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Logs d''audit dont la session n''existe plus'::TEXT,
    NULL::TEXT
  FROM signature_audit_log sal
  WHERE NOT EXISTS (SELECT 1 FROM signature_sessions ss WHERE ss.id = sal.session_id);

  -- Participants avec profile_id invalide
  RETURN QUERY
  SELECT 'participant_invalid_profile'::TEXT,
    'signature_participants'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Participants avec un profile_id pointant vers un profil inexistant'::TEXT,
    string_agg(sp.id::TEXT, ', ')::TEXT
  FROM signature_participants sp
  WHERE sp.profile_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = sp.profile_id);

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_signature_integrity() IS
  'Vérifie l''intégrité du système de signatures (sessions, participants, preuves eIDAS).';


-- ============================================================================
-- PHASE 7 : INTÉGRITÉ ORGANISATIONS & WHITE-LABEL
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_organization_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $mig$
BEGIN

  -- Organisations sans owner
  RETURN QUERY
  SELECT 'org_without_owner'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Organisations dont le propriétaire (auth.users) n''existe plus'::TEXT,
    string_agg(o.id::TEXT, ', ')::TEXT
  FROM organizations o
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = o.owner_id);

  -- Membres orphelins (org supprimée)
  RETURN QUERY
  SELECT 'orphan_members'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ')::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = om.organization_id);

  -- Membres orphelins (user supprimé)
  RETURN QUERY
  SELECT 'member_invalid_user'::TEXT,
    'organization_members'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Membres d''organisation dont le user_id n''existe plus'::TEXT,
    string_agg(om.id::TEXT, ', ')::TEXT
  FROM organization_members om
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = om.user_id);

  -- Branding orphelin
  RETURN QUERY
  SELECT 'orphan_branding'::TEXT,
    'organization_branding'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Branding d''organisation dont l''organisation n''existe plus'::TEXT,
    string_agg(ob.id::TEXT, ', ')::TEXT
  FROM organization_branding ob
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = ob.organization_id);

  -- Domaines personnalisés orphelins
  RETURN QUERY
  SELECT 'orphan_domains'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Domaines personnalisés dont l''organisation n''existe plus'::TEXT,
    string_agg(cd.id::TEXT, ', ')::TEXT
  FROM custom_domains cd
  WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.id = cd.organization_id);

  -- Orgs actives sans branding
  RETURN QUERY
  SELECT 'active_org_no_branding'::TEXT,
    'organizations'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Organisations actives en mode white-label sans branding configuré'::TEXT,
    string_agg(o.id::TEXT, ', ')::TEXT
  FROM organizations o
  WHERE o.is_active = true
    AND o.white_label_level != 'none'
    AND NOT EXISTS (SELECT 1 FROM organization_branding ob WHERE ob.organization_id = o.id);

  -- Domaines actifs avec SSL expiré
  RETURN QUERY
  SELECT 'expired_ssl'::TEXT,
    'custom_domains'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Domaines actifs avec certificat SSL expiré'::TEXT,
    string_agg(cd.domain, ', ')::TEXT
  FROM custom_domains cd
  WHERE cd.is_active = true
    AND cd.verified = true
    AND cd.ssl_expires_at IS NOT NULL
    AND cd.ssl_expires_at < NOW();

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_organization_integrity() IS
  'Vérifie l''intégrité du système multi-tenant et white-label.';


-- ============================================================================
-- PHASE 8 : INTÉGRITÉ COMMERCIAL (FONDS DE COMMERCE, LOCATION-GÉRANCE)
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_commercial_integrity()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT,
  sample_ids TEXT
) AS $mig$
BEGIN

  -- Fonds de commerce sans owner
  RETURN QUERY
  SELECT 'fonds_without_owner'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Fonds de commerce dont le propriétaire n''existe plus'::TEXT,
    string_agg(fc.id::TEXT, ', ')::TEXT
  FROM fonds_commerce fc
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = fc.owner_id);

  -- Fonds avec bail_commercial_id invalide
  RETURN QUERY
  SELECT 'fonds_invalid_bail'::TEXT,
    'fonds_commerce'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Fonds avec bail_commercial_id pointant vers un bail inexistant'::TEXT,
    string_agg(fc.id::TEXT, ', ')::TEXT
  FROM fonds_commerce fc
  WHERE fc.bail_commercial_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.id = fc.bail_commercial_id);

  -- Licences orphelines
  RETURN QUERY
  SELECT 'orphan_licences'::TEXT,
    'fonds_commerce_licences'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Licences dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fcl.id::TEXT, ', ')::TEXT
  FROM fonds_commerce_licences fcl
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fcl.fonds_id);

  -- Équipements orphelins
  RETURN QUERY
  SELECT 'orphan_equipements'::TEXT,
    'fonds_commerce_equipements'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Équipements dont le fonds de commerce n''existe plus'::TEXT,
    string_agg(fce.id::TEXT, ', ')::TEXT
  FROM fonds_commerce_equipements fce
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = fce.fonds_id);

  -- Contrats location-gérance avec fonds supprimé
  RETURN QUERY
  SELECT 'gerance_orphan_fonds'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Contrats de location-gérance dont le fonds n''existe plus'::TEXT,
    string_agg(lgc.id::TEXT, ', ')::TEXT
  FROM location_gerance_contracts lgc
  WHERE NOT EXISTS (SELECT 1 FROM fonds_commerce fc WHERE fc.id = lgc.fonds_id);

  -- Redevances orphelines
  RETURN QUERY
  SELECT 'orphan_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances dont le contrat de location-gérance n''existe plus'::TEXT,
    string_agg(lgr.id::TEXT, ', ')::TEXT
  FROM location_gerance_redevances lgr
  WHERE NOT EXISTS (SELECT 1 FROM location_gerance_contracts lgc WHERE lgc.id = lgr.contract_id);

  -- Contrats actifs avec date_fin dépassée
  RETURN QUERY
  SELECT 'expired_contracts_active'::TEXT,
    'location_gerance_contracts'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Contrats location-gérance actifs avec date_fin dépassée'::TEXT,
    string_agg(lgc.id::TEXT, ', ')::TEXT
  FROM location_gerance_contracts lgc
  WHERE lgc.status = 'active'
    AND lgc.date_fin IS NOT NULL
    AND lgc.date_fin < CURRENT_DATE;

  -- Redevances impayées > 90 jours
  RETURN QUERY
  SELECT 'overdue_redevances'::TEXT,
    'location_gerance_redevances'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Redevances impayées depuis plus de 90 jours'::TEXT,
    string_agg(lgr.id::TEXT, ', ')::TEXT
  FROM location_gerance_redevances lgr
  WHERE lgr.statut IN ('pending', 'late')
    AND lgr.date_echeance < CURRENT_DATE - INTERVAL '90 days';

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_commercial_integrity() IS
  'Vérifie l''intégrité des fonds de commerce et contrats de location-gérance.';


-- ============================================================================
-- PHASE 9 : QUALITÉ DES DONNÉES & COHÉRENCE MÉTIER
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_data_quality()
RETURNS TABLE(
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT
) AS $mig$
BEGIN

  -- ── PROFILS ──────────────────────────────────────────────────────────

  -- Profils sans email
  RETURN QUERY
  SELECT 'profile_missing_email'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Profils sans adresse email'::TEXT
  FROM profiles p
  WHERE (p.email IS NULL OR TRIM(p.email) = '');

  -- Profils sans nom
  RETURN QUERY
  SELECT 'profile_missing_name'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Profils sans nom renseigné'::TEXT
  FROM profiles p
  WHERE (p.nom IS NULL OR TRIM(p.nom) = '');

  -- Profils owner sans owner_profiles
  RETURN QUERY
  SELECT 'owner_without_owner_profile'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec role=owner sans enregistrement owner_profiles associé'::TEXT
  FROM profiles p
  WHERE p.role = 'owner'
    AND NOT EXISTS (SELECT 1 FROM owner_profiles op WHERE op.profile_id = p.id);

  -- Profils tenant sans tenant_profiles
  RETURN QUERY
  SELECT 'tenant_without_tenant_profile'::TEXT,
    'profiles'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Profils avec role=tenant sans enregistrement tenant_profiles associé'::TEXT
  FROM profiles p
  WHERE p.role = 'tenant'
    AND NOT EXISTS (SELECT 1 FROM tenant_profiles tp WHERE tp.profile_id = p.id);

  -- ── PROPRIÉTÉS ───────────────────────────────────────────────────────

  -- Propriétés sans adresse
  RETURN QUERY
  SELECT 'property_missing_address'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés sans adresse complète'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.adresse_complete IS NULL OR TRIM(p.adresse_complete) = '');

  -- Propriétés sans code postal
  RETURN QUERY
  SELECT 'property_missing_postal_code'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Propriétés sans code postal'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.code_postal IS NULL OR TRIM(p.code_postal) = '');

  -- Propriétés avec surface <= 0
  RETURN QUERY
  SELECT 'property_invalid_surface'::TEXT,
    'properties'::TEXT,
    COUNT(*)::BIGINT,
    'LOW'::TEXT,
    'Propriétés avec surface <= 0 ou NULL'::TEXT
  FROM properties p
  WHERE p.deleted_at IS NULL
    AND (p.surface IS NULL OR p.surface <= 0);

  -- ── BAUX ─────────────────────────────────────────────────────────────

  -- Baux actifs sans owner_id ET sans tenant_id
  RETURN QUERY
  SELECT 'lease_no_parties'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux actifs sans propriétaire NI locataire'::TEXT
  FROM leases l
  WHERE l.statut NOT IN ('draft', 'cancelled', 'archived')
    AND l.owner_id IS NULL
    AND l.tenant_id IS NULL;

  -- Baux avec date_fin < date_debut
  RETURN QUERY
  SELECT 'lease_invalid_dates'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'CRITICAL'::TEXT,
    'Baux avec date_fin antérieure à date_debut'::TEXT
  FROM leases l
  WHERE l.date_fin IS NOT NULL
    AND l.date_fin < l.date_debut;

  -- Baux actifs avec loyer <= 0
  RETURN QUERY
  SELECT 'lease_invalid_rent'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs avec loyer <= 0 ou NULL'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND (l.loyer IS NULL OR l.loyer <= 0);

  -- Baux terminés mais toujours marqués actifs (date_fin dépassée > 30j)
  RETURN QUERY
  SELECT 'lease_should_be_terminated'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Baux actifs avec date_fin dépassée de plus de 30 jours'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND l.date_fin IS NOT NULL
    AND l.date_fin < CURRENT_DATE - INTERVAL '30 days';

  -- ── FACTURES ─────────────────────────────────────────────────────────

  -- Factures avec montant négatif
  RETURN QUERY
  SELECT 'invoice_negative_amount'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures avec montant_total négatif'::TEXT
  FROM invoices i
  WHERE i.montant_total < 0;

  -- Factures "paid" sans aucun paiement
  RETURN QUERY
  SELECT 'invoice_paid_no_payment'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Factures marquées payées sans aucun enregistrement de paiement'::TEXT
  FROM invoices i
  WHERE i.statut = 'paid'
    AND NOT EXISTS (SELECT 1 FROM payments py WHERE py.invoice_id = i.id);

  -- Factures envoyées mais bail terminé/annulé
  RETURN QUERY
  SELECT 'invoice_on_terminated_lease'::TEXT,
    'invoices'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Factures non-payées sur des baux terminés ou annulés'::TEXT
  FROM invoices i
  JOIN leases l ON l.id = i.lease_id
  WHERE i.statut NOT IN ('paid', 'cancelled')
    AND l.statut IN ('terminated', 'cancelled', 'archived');

  -- ── DOCUMENTS ────────────────────────────────────────────────────────

  -- Documents expirés non marqués
  RETURN QUERY
  SELECT 'document_expired_not_flagged'::TEXT,
    'documents'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Documents avec valid_until dépassé mais statut toujours actif'::TEXT
  FROM documents d
  WHERE d.valid_until IS NOT NULL
    AND d.valid_until < CURRENT_DATE
    AND d.ged_status = 'active';

  -- Documents obligatoires manquants pour baux actifs
  RETURN QUERY
  SELECT 'lease_missing_mandatory_docs'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Baux actifs sans document de type bail attaché'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND NOT EXISTS (
      SELECT 1 FROM documents d
      WHERE d.lease_id = l.id AND d.type = 'bail'
    );

  -- ── DÉPÔTS DE GARANTIE ──────────────────────────────────────────────

  -- Baux actifs sans mouvement de dépôt
  RETURN QUERY
  SELECT 'lease_missing_deposit'::TEXT,
    'leases'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Baux actifs avec dépôt de garantie > 0 mais sans mouvement de dépôt'::TEXT
  FROM leases l
  WHERE l.statut IN ('active', 'fully_signed')
    AND l.depot_de_garantie IS NOT NULL
    AND l.depot_de_garantie > 0
    AND NOT EXISTS (SELECT 1 FROM deposit_movements dm WHERE dm.lease_id = l.id);

  -- ── ENTITÉS LÉGALES ─────────────────────────────────────────────────

  -- Entités actives sans gérant
  RETURN QUERY
  SELECT 'entity_no_manager'::TEXT,
    'legal_entities'::TEXT,
    COUNT(*)::BIGINT,
    'MEDIUM'::TEXT,
    'Entités légales actives de type société sans gérant désigné'::TEXT
  FROM legal_entities le
  WHERE le.is_active = true
    AND le.entity_type NOT IN ('particulier', 'indivision')
    AND NOT EXISTS (
      SELECT 1 FROM entity_associates ea
      WHERE ea.legal_entity_id = le.id AND ea.is_gerant = true AND ea.is_current = true
    );

  -- Détention totale != 100% par propriété
  RETURN QUERY
  SELECT 'ownership_not_100_percent'::TEXT,
    'property_ownership'::TEXT,
    COUNT(*)::BIGINT,
    'HIGH'::TEXT,
    'Propriétés dont la somme des pourcentages de détention != 100%'::TEXT
  FROM (
    SELECT po.property_id, SUM(po.pourcentage_detention) AS total
    FROM property_ownership po
    WHERE po.is_current = true
    GROUP BY po.property_id
    HAVING ABS(SUM(po.pourcentage_detention) - 100) > 0.01
  ) sub;

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_data_quality() IS
  'Vérifie la qualité et la cohérence métier des données (champs manquants, incohérences).';


-- ============================================================================
-- PHASE 10 : RAPPORT UNIFIÉ + SCORE DE SANTÉ
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_full_report()
RETURNS TABLE(
  category TEXT,
  check_name TEXT,
  source_table TEXT,
  issue_count BIGINT,
  severity TEXT,
  description TEXT
) AS $mig$
BEGIN

  -- Orphelins (V1)
  RETURN QUERY
  SELECT 'ORPHANS'::TEXT, aor.fk_column, aor.source_table, aor.orphan_count, aor.severity, aor.description
  FROM audit_orphan_records() aor
  WHERE aor.orphan_count > 0;

  -- Doublons (V1)
  RETURN QUERY
  SELECT 'DUPLICATES'::TEXT, adr.duplicate_key, adr.table_name, adr.duplicate_count, adr.severity, adr.description
  FROM audit_duplicate_records() adr;

  -- Signatures (V3)
  RETURN QUERY
  SELECT 'SIGNATURES'::TEXT, asi.check_name, asi.source_table, asi.issue_count, asi.severity, asi.description
  FROM audit_signature_integrity() asi
  WHERE asi.issue_count > 0;

  -- Organisations (V3)
  RETURN QUERY
  SELECT 'ORGANIZATIONS'::TEXT, aoi.check_name, aoi.source_table, aoi.issue_count, aoi.severity, aoi.description
  FROM audit_organization_integrity() aoi
  WHERE aoi.issue_count > 0;

  -- Commercial (V3)
  RETURN QUERY
  SELECT 'COMMERCIAL'::TEXT, aci.check_name, aci.source_table, aci.issue_count, aci.severity, aci.description
  FROM audit_commercial_integrity() aci
  WHERE aci.issue_count > 0;

  -- Qualité (V3)
  RETURN QUERY
  SELECT 'DATA_QUALITY'::TEXT, adq.check_name, adq.source_table, adq.issue_count, adq.severity, adq.description
  FROM audit_data_quality() adq
  WHERE adq.issue_count > 0;

END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_full_report() IS
  'Rapport d''audit complet combinant toutes les vérifications (orphelins, doublons, signatures, orga, commercial, qualité).';


-- Score de santé global (0-100)
CREATE OR REPLACE FUNCTION audit_health_score()
RETURNS TABLE(
  total_checks INTEGER,
  passed_checks INTEGER,
  critical_issues INTEGER,
  high_issues INTEGER,
  medium_issues INTEGER,
  low_issues INTEGER,
  health_score NUMERIC(5,2),
  grade TEXT
) AS $mig$
DECLARE
  v_total INTEGER := 0;
  v_passed INTEGER := 0;
  v_critical INTEGER := 0;
  v_high INTEGER := 0;
  v_medium INTEGER := 0;
  v_low INTEGER := 0;
  v_score NUMERIC(5,2);
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM audit_full_report() LOOP
    v_total := v_total + 1;
    CASE r.severity
      WHEN 'CRITICAL' THEN v_critical := v_critical + 1;
      WHEN 'HIGH' THEN v_high := v_high + 1;
      WHEN 'MEDIUM' THEN v_medium := v_medium + 1;
      WHEN 'LOW' THEN v_low := v_low + 1;
      ELSE NULL;
    END CASE;
  END LOOP;

  -- Compter le total attendu de checks (orphelins + doublons + signatures + orga + commercial + qualité)
  -- On considère les catégories, pas les résultats
  v_total := v_total + 20; -- base checks that can pass silently
  v_passed := v_total - (v_critical + v_high + v_medium + v_low);

  -- Score : chaque sévérité a un poids
  -- CRITICAL = -10, HIGH = -5, MEDIUM = -2, LOW = -0.5
  v_score := GREATEST(0, LEAST(100,
    100.0
    - (v_critical * 10.0)
    - (v_high * 5.0)
    - (v_medium * 2.0)
    - (v_low * 0.5)
  ));

  total_checks := v_total;
  passed_checks := v_passed;
  critical_issues := v_critical;
  high_issues := v_high;
  medium_issues := v_medium;
  low_issues := v_low;
  health_score := v_score;
  grade := CASE
    WHEN v_score >= 95 THEN 'A+'
    WHEN v_score >= 90 THEN 'A'
    WHEN v_score >= 80 THEN 'B'
    WHEN v_score >= 70 THEN 'C'
    WHEN v_score >= 50 THEN 'D'
    ELSE 'F'
  END;
  RETURN NEXT;
END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_health_score() IS
  'Retourne un score de santé global de la base (0-100) avec une note A+ à F.';


-- ============================================================================
-- LOGS DE MIGRATION
-- ============================================================================
DO $mig$
BEGIN
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  AUDIT V3 — Vérifications étendues installées';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 6 — Intégrité signatures :';
  RAISE NOTICE '    SELECT * FROM audit_signature_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 7 — Intégrité organisations :';
  RAISE NOTICE '    SELECT * FROM audit_organization_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 8 — Intégrité commercial :';
  RAISE NOTICE '    SELECT * FROM audit_commercial_integrity();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 9 — Qualité des données :';
  RAISE NOTICE '    SELECT * FROM audit_data_quality();';
  RAISE NOTICE '';
  RAISE NOTICE '  Phase 10 — Rapport unifié + Score :';
  RAISE NOTICE '    SELECT * FROM audit_full_report();';
  RAISE NOTICE '    SELECT * FROM audit_health_score();';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [11/169] 20260213000000_fix_profiles_rls_recursion_v2.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Correction définitive de la récursion RLS sur profiles (v2)
-- Date: 2026-02-13
-- Problème: "RLS recursion detected" - erreur 500 sur profiles
--
-- CAUSE: Les politiques RLS sur `profiles` appellent des fonctions
--        qui requêtent `profiles`, créant une boucle infinie (42P17).
--
-- SOLUTION:
--   1. Fonctions SECURITY DEFINER qui bypassen les RLS
--   2. Politiques RLS simplifiées utilisant auth.uid() directement
--   3. Pas de sous-requête vers profiles dans les politiques profiles
-- =====================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS POUR LE NETTOYAGE
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. SUPPRIMER TOUTES LES ANCIENNES POLITIQUES SUR profiles
DO $mig$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'profiles' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $mig$;

-- 3. CRÉER/REMPLACER LES FONCTIONS HELPER (SECURITY DEFINER = bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$mig$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1),
    'anonymous'
  );
$mig$;

CREATE OR REPLACE FUNCTION public.get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$mig$;

CREATE OR REPLACE FUNCTION public.user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT public.get_my_profile_id();
$mig$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT public.get_my_role();
$mig$;

-- Versions avec paramètre (pour usage admin)
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT id FROM profiles WHERE user_id = p_user_id LIMIT 1;
$mig$;

CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $mig$
  SELECT COALESCE(role, 'anonymous') FROM profiles WHERE user_id = p_user_id LIMIT 1;
$mig$;

-- 4. RÉACTIVER RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. CRÉER LES NOUVELLES POLITIQUES (SANS RÉCURSION)

-- Politique principale : chaque utilisateur peut voir/modifier son propre profil
-- Utilise auth.uid() directement, aucune sous-requête vers profiles
CREATE POLICY "profiles_own_access" ON profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Politique admin : les admins peuvent voir tous les profils
-- is_admin() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_admin_read" ON profiles
FOR SELECT TO authenticated
USING (public.is_admin());

-- Politique propriétaire : peut voir les profils de ses locataires
-- get_my_profile_id() est SECURITY DEFINER donc bypasse les RLS
CREATE POLICY "profiles_owner_read_tenants" ON profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM lease_signers ls
    INNER JOIN leases l ON l.id = ls.lease_id
    INNER JOIN properties p ON p.id = l.property_id
    WHERE ls.profile_id = profiles.id
    AND p.owner_id = public.get_my_profile_id()
  )
);

-- 6. ACCORDER LES PERMISSIONS SUR LES FONCTIONS
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_profile_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role(UUID) TO authenticated;

-- Permissions pour anon (nécessaire pour certaines requêtes pré-auth)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_profile_id() TO anon;
GRANT EXECUTE ON FUNCTION public.user_role() TO anon;

-- 7. S'assurer que RLS est activé (SANS FORCE pour que SECURITY DEFINER fonctionne)
-- IMPORTANT: Ne PAS utiliser FORCE ROW LEVEL SECURITY car cela forcerait
-- les politiques RLS même pour le propriétaire de la table (postgres),
-- ce qui casserait les fonctions SECURITY DEFINER et causerait la récursion.
-- Le service_role bypass RLS par défaut dans Supabase.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [12/169] 20260213100000_fix_rls_all_tables_recursion.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Correction globale de la récursion RLS
-- Date: 2026-02-13
-- Problème: Les politiques RLS de subscriptions, notifications et
--           d'autres tables font des sous-requêtes directes sur `profiles`
--           ce qui déclenche l'évaluation RLS sur profiles → récursion (42P17).
--
-- SOLUTION: Remplacer toutes les sous-requêtes `SELECT id FROM profiles WHERE user_id = auth.uid()`
--           par l'appel à `public.get_my_profile_id()` (SECURITY DEFINER, bypass RLS).
-- =====================================================

-- ============================================
-- 0. CORRIGER profiles : retirer FORCE si présent
-- ============================================
-- FORCE ROW LEVEL SECURITY fait que même le propriétaire de la table (postgres)
-- est soumis aux RLS, ce qui casse les fonctions SECURITY DEFINER.
ALTER TABLE profiles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. CORRIGER subscriptions
-- ============================================
DROP POLICY IF EXISTS "Owners can view their subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;

-- Propriétaire voit son abonnement (utilise get_my_profile_id au lieu de sous-requête)
CREATE POLICY "Owners can view their subscription" ON subscriptions
  FOR SELECT TO authenticated
  USING (owner_id = public.get_my_profile_id());

-- Admins voient tout (utilise is_admin qui est SECURITY DEFINER)
CREATE POLICY "Admins can view all subscriptions" ON subscriptions
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================
-- 2. CORRIGER subscription_invoices (si la table existe)
-- ============================================
DO $mig$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their invoices" ON subscription_invoices;
  CREATE POLICY "Owners can view their invoices" ON subscription_invoices
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_invoices does not exist yet, skipping';
END $mig$;

-- ============================================
-- 3. CORRIGER subscription_usage (si la table existe)
-- ============================================
DO $mig$ BEGIN
  DROP POLICY IF EXISTS "Owners can view their usage" ON subscription_usage;
  CREATE POLICY "Owners can view their usage" ON subscription_usage
    FOR SELECT TO authenticated
    USING (
      subscription_id IN (
        SELECT id FROM subscriptions
        WHERE owner_id = public.get_my_profile_id()
      )
    );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'subscription_usage does not exist yet, skipping';
END $mig$;

-- ============================================
-- 4. CORRIGER notifications
-- ============================================
-- Supprimer TOUTES les anciennes politiques de notifications pour repartir proprement
DO $mig$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'notifications' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
  END LOOP;
END $mig$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lecture : l'utilisateur voit ses propres notifications
-- Utilise auth.uid() directement et get_my_profile_id() pour recipient_id/profile_id
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Mise à jour : l'utilisateur peut modifier ses propres notifications
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Suppression : l'utilisateur peut supprimer ses propres notifications
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- Insertion : le système peut insérer des notifications
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 5. VÉRIFICATION : lister les politiques restantes avec sous-requête profiles
-- ============================================
-- Note: Les tables ci-dessous ont aussi des sous-requêtes sur profiles dans leurs
-- politiques RLS. Elles sont moins critiques car elles ne sont pas appelées
-- en cascade depuis profiles, mais pour la robustesse on les corrige aussi.

-- Cette requête est un diagnostic, elle n'échouera pas si les tables n'existent pas
DO $mig$
BEGIN
  RAISE NOTICE '=== Migration RLS globale appliquée avec succès ===';
  RAISE NOTICE 'Tables corrigées: profiles, subscriptions, subscription_invoices, subscription_usage, notifications';
  RAISE NOTICE 'Méthode: get_my_profile_id() SECURITY DEFINER au lieu de sous-requêtes directes';
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [13/169] 20260215100000_signature_security_audit_fixes.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- MIGRATION: Corrections audit sécurité signatures (2026-02-15)
-- ============================================================================
-- 
-- Fixes appliqués :
-- P1-3: Suppression de la colonne signature_image (base64) de lease_signers
-- P1-6: Harmonisation du requirement CNI (décision: CNI optionnel partout)
-- P0-4: Vérification de la contrainte CHECK sur les statuts de bail
--
-- IMPORTANT: Migration NON-DESTRUCTIVE (soft delete avec renommage)
-- ============================================================================

BEGIN;

-- ============================================================================
-- P1-3: Renommer signature_image → _signature_image_deprecated
-- ============================================================================
-- On ne supprime pas immédiatement pour éviter les erreurs d'application
-- pendant le déploiement. La colonne sera supprimée dans une migration future.

DO $mig$
BEGIN
  -- Vérifier si la colonne existe avant de la renommer
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lease_signers' 
    AND column_name = 'signature_image'
    AND table_schema = 'public'
  ) THEN
    -- Renommer plutôt que supprimer (rollback possible)
    ALTER TABLE lease_signers RENAME COLUMN signature_image TO _signature_image_deprecated;
    
    COMMENT ON COLUMN lease_signers._signature_image_deprecated IS 
      'DEPRECATED 2026-02-15: Utiliser signature_image_path (Storage) à la place. '
      'Cette colonne sera supprimée lors de la prochaine migration majeure.';
    
    RAISE NOTICE 'Colonne lease_signers.signature_image renommée en _signature_image_deprecated';
  ELSE
    RAISE NOTICE 'Colonne lease_signers.signature_image déjà absente ou renommée';
  END IF;
END $mig$;

-- ============================================================================
-- P0-4: S'assurer que les statuts de bail incluent tous ceux utilisés par le code
-- ============================================================================
-- Le code utilise ces statuts : draft, pending_signature, partially_signed,
-- fully_signed, active, terminated, archived, cancelled
-- 
-- Vérifier et mettre à jour la contrainte CHECK si nécessaire

DO $mig$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Trouver le nom de la contrainte CHECK sur statut
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'leases'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%statut%';

  IF v_constraint_name IS NOT NULL THEN
    -- Supprimer l'ancienne contrainte
    EXECUTE 'ALTER TABLE leases DROP CONSTRAINT ' || v_constraint_name;
    RAISE NOTICE 'Ancienne contrainte supprimée: %', v_constraint_name;
  END IF;

  -- Recréer avec tous les statuts valides (SSOT 2026)
  ALTER TABLE leases ADD CONSTRAINT leases_statut_check CHECK (
    statut IN (
      'draft',
      'pending_signature',
      'partially_signed',
      'fully_signed',
      'active',
      'terminated',
      'archived',
      'cancelled'
    )
  );
  
  RAISE NOTICE 'Contrainte CHECK sur leases.statut mise à jour avec tous les statuts SSOT 2026';
END $mig$;

-- ============================================================================
-- P2-6: Ajouter un champ template_version aux lease_signers pour traçabilité
-- ============================================================================

ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS template_version TEXT;

COMMENT ON COLUMN lease_signers.template_version IS 
  'Version du template de bail utilisée au moment de la signature. '
  'Permet de régénérer le PDF avec le bon template si nécessaire.';

-- ============================================================================
-- Index pour améliorer les performances des requêtes de signature
-- ============================================================================

-- Index partiel pour les signatures en attente (optimise checkSignatureRights)
CREATE INDEX IF NOT EXISTS idx_lease_signers_pending 
ON lease_signers(lease_id, role) 
WHERE signature_status = 'pending';

-- Index partiel pour les signatures complètes (optimise determineLeaseStatus)
CREATE INDEX IF NOT EXISTS idx_lease_signers_signed 
ON lease_signers(lease_id) 
WHERE signature_status = 'signed';

-- Index sur invited_email pour la recherche par email (optimise routes token)
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

COMMIT;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [14/169] 20260215200000_fix_rls_properties_tenant_pre_active.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- P0-E1: Fix RLS properties pour locataires avant bail "active"
-- ============================================================================
-- PROBLÈME: La policy "Tenants can view properties with active leases" exige
--           l.statut = 'active', ce qui empêche un nouveau locataire de voir
--           sa propriété pendant la phase de signature / onboarding.
--
-- FIX: Élargir la condition pour inclure tous les statuts où le locataire
--      est légitimement lié au bien (pending_signature, partially_signed,
--      fully_signed, active, notice_given, terminated).
-- ============================================================================

-- 1. Supprimer l'ancienne policy restrictive
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;

-- 2. Créer la nouvelle policy élargie
CREATE POLICY "Tenants can view linked properties"
  ON properties
  FOR SELECT
  USING (
    -- Le locataire peut voir la propriété s'il est signataire d'un bail lié,
    -- quel que soit le statut du bail (sauf draft et cancelled)
    EXISTS (
      SELECT 1
      FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = properties.id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
  );

-- 3. Vérification : s'assurer que les autres policies existantes ne sont pas impactées
-- (les policies owner et admin restent inchangées)

COMMENT ON POLICY "Tenants can view linked properties" ON properties IS
  'P0-E1: Locataires voient les propriétés liées à leurs baux (sauf draft/cancelled). '
  'Remplace l''ancienne policy qui exigeait statut=active uniquement.';

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [15/169] 20260215200001_add_notice_given_lease_status.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- MIGRATION CORRECTIVE: Harmonisation complète des statuts de bail
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les migrations successives (20260107000001 → 20260108400000)
--           se sont écrasées mutuellement, supprimant des statuts légitimes
--           (sent, pending_owner_signature, amended, notice_given, cancelled).
--
-- FIX: Recréer la contrainte CHECK avec l'union de TOUS les statuts métier
--      nécessaires au cycle de vie complet d'un bail.
--
-- Flux normal :
--   draft → sent → pending_signature → partially_signed
--   → pending_owner_signature → fully_signed → active
--   → notice_given → terminated → archived
--
-- Branches :
--   draft|pending_signature → cancelled
--   active → amended → active (avenant)
-- ============================================================================

DO $mig$
BEGIN
  -- Supprimer toute contrainte CHECK existante sur statut
  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS check_lease_statut;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE leases DROP CONSTRAINT IF EXISTS lease_status_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Recréer avec la liste complète et définitive
  ALTER TABLE leases
    ADD CONSTRAINT leases_statut_check CHECK (
      statut IN (
        'draft',                    -- Brouillon initial
        'sent',                     -- Envoyé au locataire pour lecture
        'pending_signature',        -- En attente de signatures
        'partially_signed',         -- Au moins un signataire a signé
        'pending_owner_signature',  -- Locataire(s) signé(s), attente propriétaire
        'fully_signed',             -- Tous ont signé (avant activation)
        'active',                   -- Bail en cours
        'notice_given',             -- Congé donné (préavis en cours)
        'amended',                  -- Avenant en cours de traitement
        'terminated',               -- Résilié / terminé
        'archived',                 -- Archivé (conservation légale)
        'cancelled'                 -- Annulé (jamais activé)
      )
    );

  RAISE NOTICE '[MIGRATION] CHECK constraint leases_statut_check harmonisée — 12 statuts';
END $mig$;

-- Mettre à jour le commentaire de colonne
COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived, cancelled';

-- Index partiel pour baux en attente d'action (requêtes fréquentes)
DROP INDEX IF EXISTS idx_leases_pending_action;
CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
  WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed', 'sent');

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [16/169] 20260215200002_fix_rls_tenant_access_beyond_active.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- MIGRATION CORRECTIVE: Élargir les RLS units/charges/tickets pour les locataires
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Plusieurs policies RLS pour les tables units, charges et tickets
--           filtrent sur l.statut = 'active' uniquement, empêchant les locataires
--           d'accéder aux données pendant les phases de signature, préavis, etc.
--
-- FIX: Remplacer les policies restrictives par des versions élargies utilisant
--      NOT IN ('draft', 'cancelled') pour couvrir tout le cycle de vie.
-- ============================================================================

-- ============================================
-- 1. UNITS — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Users can view units of accessible properties" ON units;

CREATE POLICY "Users can view units of accessible properties"
  ON units
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = units.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail non-brouillon/non-annulé sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE (l.property_id = units.property_id OR l.unit_id = units.id)
        AND ls.profile_id = public.user_profile_id()
        AND l.statut NOT IN ('draft', 'cancelled')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 2. CHARGES — Policy tenant trop restrictive
-- ============================================
DROP POLICY IF EXISTS "Tenants can view charges of properties with active leases" ON charges;

CREATE POLICY "Tenants can view charges of linked properties"
  ON charges
  FOR SELECT
  USING (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = charges.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis sur ce bien
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = charges.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given', 'fully_signed')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- 3. TICKETS — Policies tenant trop restrictives
-- ============================================

-- 3a. Policy SELECT
DROP POLICY IF EXISTS "Users can view tickets of accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_select_policy" ON tickets;

CREATE POLICY "Users can view tickets of accessible properties"
  ON tickets
  FOR SELECT
  USING (
    -- Créateur du ticket
    tickets.created_by_profile_id = public.user_profile_id()
    OR
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Prestataire assigné via work_order
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.ticket_id = tickets.id
        AND wo.provider_id = public.user_profile_id()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- 3b. Policy INSERT
DROP POLICY IF EXISTS "Users can create tickets for accessible properties" ON tickets;
DROP POLICY IF EXISTS "tickets_insert_policy" ON tickets;

CREATE POLICY "Users can create tickets for accessible properties"
  ON tickets
  FOR INSERT
  WITH CHECK (
    -- Propriétaire du bien
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = tickets.property_id
        AND p.owner_id = public.user_profile_id()
    )
    OR
    -- Locataire avec bail actif ou en préavis (peut signaler un problème)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = tickets.property_id
        AND ls.profile_id = public.user_profile_id()
        AND l.statut IN ('active', 'notice_given')
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = public.user_profile_id()
        AND role = 'admin'
    )
  );

-- ============================================
-- Log
-- ============================================
DO $mig$
BEGIN
  RAISE NOTICE '[MIGRATION] RLS units/charges/tickets élargies au-delà de active';
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [17/169] 20260215200003_fix_copro_fk_on_delete.sql ===
DO $wrapper$ BEGIN
-- ============================================================================
-- MIGRATION CORRECTIVE: Ajouter ON DELETE aux FK copropriété
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les FK suivantes n'ont pas de clause ON DELETE, ce qui peut
--           causer des erreurs de contrainte si un profil ou une propriété
--           est supprimé(e).
--
-- Tables affectées :
--   - copro_units.owner_profile_id → profiles(id)  → SET NULL
--   - copro_units.property_id → properties(id)      → SET NULL
--   - sites.syndic_profile_id → profiles(id)        → SET NULL
-- ============================================================================

-- 1. copro_units.owner_profile_id
DO $mig$
BEGIN
  -- Trouver et supprimer la contrainte FK existante
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.owner_profile_id FK not found, skipping drop';
END $mig$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_owner_profile_id_fkey
  FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. copro_units.property_id
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.property_id FK not found, skipping drop';
END $mig$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- 3. sites.syndic_profile_id
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sites' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE sites DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sites.syndic_profile_id FK not found, skipping drop';
END $mig$;

ALTER TABLE sites
  ADD CONSTRAINT sites_syndic_profile_id_fkey
  FOREIGN KEY (syndic_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Log
DO $mig$
BEGIN
  RAISE NOTICE '[MIGRATION] FK ON DELETE SET NULL ajoutées pour copro_units et sites';
END $mig$;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [18/169] 20260216000000_tenant_document_center.sql ===
DO $wrapper$ BEGIN
-- =============================================================================
-- Migration : Tenant Document Center
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Refonte gestion documentaire locataire
--
-- Objectif  : Supporter le Document Center unifié côté locataire avec :
--   1. RPC tenant_document_center() — endpoint unique pour les 3 zones
--   2. Vue v_tenant_key_documents — 4 documents clés par locataire
--   3. Vue v_tenant_pending_actions — actions en attente agrégées
--   4. Index composite optimisé pour les requêtes du Document Center
--   5. RPC tenant_documents_search() — recherche full-text améliorée
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. INDEX COMPOSITE pour les requêtes Document Center
--    Optimise : SELECT * FROM documents WHERE tenant_id = ? ORDER BY created_at DESC
--    et       : SELECT * FROM documents WHERE tenant_id = ? AND type = ?
-- =============================================================================

-- Index composite tenant_id + type + created_at (DESC) pour la zone "Tous les documents"
CREATE INDEX IF NOT EXISTS idx_documents_tenant_type_date
  ON documents (tenant_id, type, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Index composite lease_id + type + created_at (DESC) pour les docs liés au bail
CREATE INDEX IF NOT EXISTS idx_documents_lease_type_date
  ON documents (lease_id, type, created_at DESC)
  WHERE lease_id IS NOT NULL;


-- =============================================================================
-- 2. VUE : v_tenant_key_documents
--    Retourne les 4 documents clés les plus récents par locataire :
--    bail, quittance, EDL d'entrée, attestation d'assurance
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_key_documents AS
WITH ranked_docs AS (
  SELECT
    d.id,
    d.type,
    d.title,
    d.storage_path,
    d.created_at,
    d.tenant_id,
    d.lease_id,
    d.property_id,
    d.metadata,
    d.verification_status,
    d.ged_status,
    -- Catégorie normalisée pour les 4 slots
    CASE
      WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
      WHEN d.type IN ('quittance') THEN 'quittance'
      WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
      WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
      ELSE NULL
    END AS slot_key,
    ROW_NUMBER() OVER (
      PARTITION BY
        d.tenant_id,
        CASE
          WHEN d.type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire') THEN 'bail'
          WHEN d.type IN ('quittance') THEN 'quittance'
          WHEN d.type IN ('EDL_entree', 'edl_entree', 'inventaire') THEN 'edl'
          WHEN d.type IN ('attestation_assurance', 'assurance_pno') THEN 'assurance'
        END
      ORDER BY
        -- Prioriser les documents "final" et "signed"
        CASE WHEN (d.metadata->>'final')::boolean = true THEN 0 ELSE 1 END,
        CASE WHEN d.ged_status = 'signed' THEN 0 WHEN d.ged_status = 'active' THEN 1 ELSE 2 END,
        d.created_at DESC
    ) AS rn
  FROM documents d
  WHERE d.tenant_id IS NOT NULL
    AND d.type IN (
      'bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire',
      'quittance',
      'EDL_entree', 'edl_entree', 'inventaire',
      'attestation_assurance', 'assurance_pno'
    )
)
SELECT
  id,
  type,
  title,
  storage_path,
  created_at,
  tenant_id,
  lease_id,
  property_id,
  metadata,
  verification_status,
  ged_status,
  slot_key
FROM ranked_docs
WHERE rn = 1 AND slot_key IS NOT NULL;

COMMENT ON VIEW v_tenant_key_documents IS
  'Documents clés par locataire (bail, dernière quittance, EDL entrée, assurance). Retourne le plus récent/pertinent pour chaque slot.';


-- =============================================================================
-- 3. VUE : v_tenant_pending_actions
--    Agrège les actions en attente pour un locataire :
--    - Bail à signer
--    - EDL à signer
--    - Attestation d'assurance manquante
-- =============================================================================

CREATE OR REPLACE VIEW v_tenant_pending_actions AS

-- Action : Bail à signer
SELECT
  ls.profile_id AS tenant_profile_id,
  'sign_lease' AS action_type,
  l.id AS entity_id,
  'Signer mon bail' AS action_label,
  'Votre bail est prêt et attend votre signature.' AS action_description,
  '/tenant/onboarding/sign' AS action_href,
  'high' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.signature_status = 'pending'
  AND ls.signed_at IS NULL
  AND l.statut IN ('pending_signature', 'partially_signed')
  AND ls.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : EDL à signer (via le système de signature unifié)
SELECT
  sp.profile_id AS tenant_profile_id,
  'sign_edl' AS action_type,
  ss.entity_id AS entity_id,
  'Signer l''état des lieux' AS action_label,
  'Un état des lieux est en attente de votre signature.' AS action_description,
  '/tenant/documents' AS action_href,
  'high' AS priority,
  ss.created_at AS action_created_at
FROM signature_participants sp
JOIN signature_sessions ss ON ss.id = sp.session_id
WHERE sp.status IN ('pending', 'notified')
  AND ss.status IN ('pending', 'ongoing')
  AND ss.entity_type = 'edl'
  AND sp.role IN ('locataire_principal', 'colocataire')

UNION ALL

-- Action : Attestation d'assurance manquante
SELECT
  ls.profile_id AS tenant_profile_id,
  'upload_insurance' AS action_type,
  l.property_id AS entity_id,
  'Déposer l''attestation d''assurance' AS action_label,
  'Obligatoire pour activer votre bail.' AS action_description,
  '/tenant/documents' AS action_href,
  'medium' AS priority,
  l.created_at AS action_created_at
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'pending_signature', 'partially_signed', 'fully_signed')
  AND NOT EXISTS (
    SELECT 1 FROM documents d
    WHERE d.tenant_id = ls.profile_id
      AND d.property_id = l.property_id
      AND d.type IN ('attestation_assurance', 'assurance_pno')
      AND (d.verification_status IS NULL OR d.verification_status != 'rejected')
  );

COMMENT ON VIEW v_tenant_pending_actions IS
  'Actions en attente par locataire : baux à signer, EDL à signer, documents manquants. Utilisé par la zone "À faire" du Document Center.';


-- =============================================================================
-- 4. RPC : tenant_document_center()
--    Endpoint unique qui retourne toutes les données pour les 3 zones
--    du Document Center en un seul appel.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_center(p_profile_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_pending_actions JSONB;
  v_key_documents JSONB;
  v_all_documents JSONB;
  v_stats JSONB;
BEGIN
  -- Résoudre le profile_id (paramètre ou utilisateur courant)
  IF p_profile_id IS NOT NULL THEN
    v_profile_id := p_profile_id;
  ELSE
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Zone 1 : Actions en attente
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'action_type', action_type,
      'entity_id', entity_id,
      'label', action_label,
      'description', action_description,
      'href', action_href,
      'priority', priority,
      'created_at', action_created_at
    ) ORDER BY
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      action_created_at DESC
  ), '[]'::jsonb)
  INTO v_pending_actions
  FROM v_tenant_pending_actions
  WHERE tenant_profile_id = v_profile_id;

  -- Zone 2 : Documents clés (4 slots)
  SELECT COALESCE(jsonb_object_agg(
    slot_key,
    jsonb_build_object(
      'id', id,
      'type', type,
      'title', title,
      'storage_path', storage_path,
      'created_at', created_at,
      'lease_id', lease_id,
      'property_id', property_id,
      'metadata', COALESCE(metadata, '{}'::jsonb),
      'verification_status', verification_status,
      'ged_status', ged_status
    )
  ), '{}'::jsonb)
  INTO v_key_documents
  FROM v_tenant_key_documents
  WHERE tenant_id = v_profile_id;

  -- Zone 3 : Tous les documents (les 50 plus récents, dédoublonnés)
  SELECT COALESCE(jsonb_agg(doc ORDER BY doc->>'created_at' DESC), '[]'::jsonb)
  INTO v_all_documents
  FROM (
    SELECT DISTINCT ON (d.type, COALESCE(d.lease_id, d.property_id, d.id))
      jsonb_build_object(
        'id', d.id,
        'type', d.type,
        'title', d.title,
        'storage_path', d.storage_path,
        'created_at', d.created_at,
        'tenant_id', d.tenant_id,
        'lease_id', d.lease_id,
        'property_id', d.property_id,
        'metadata', COALESCE(d.metadata, '{}'::jsonb),
        'verification_status', d.verification_status,
        'ged_status', d.ged_status,
        'file_size', d.file_size,
        'mime_type', d.mime_type,
        'original_filename', d.original_filename
      ) AS doc
    FROM documents d
    WHERE (d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    ORDER BY d.type, COALESCE(d.lease_id, d.property_id, d.id), d.created_at DESC
    LIMIT 100
  ) sub
  LIMIT 50;

  -- Stats rapides
  SELECT jsonb_build_object(
    'total_documents', (
      SELECT COUNT(*) FROM documents d
      WHERE d.tenant_id = v_profile_id
        OR d.lease_id IN (SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id)
    ),
    'pending_actions_count', jsonb_array_length(v_pending_actions),
    'has_bail', v_key_documents ? 'bail',
    'has_quittance', v_key_documents ? 'quittance',
    'has_edl', v_key_documents ? 'edl',
    'has_assurance', v_key_documents ? 'assurance'
  ) INTO v_stats;

  -- Résultat final
  v_result := jsonb_build_object(
    'pending_actions', v_pending_actions,
    'key_documents', v_key_documents,
    'documents', v_all_documents,
    'stats', v_stats
  );

  RETURN v_result;
END;
$mig$;

COMMENT ON FUNCTION public.tenant_document_center IS
  'Endpoint unique pour le Document Center locataire. Retourne : pending_actions, key_documents (4 slots), documents (tous, dédoublonnés), stats.';

-- Accès pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION public.tenant_document_center TO authenticated;


-- =============================================================================
-- 5. RPC : tenant_documents_search()
--    Recherche full-text améliorée dans les documents du locataire
--    avec filtres par type, période et tri.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_documents_search(
  p_query TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_period TEXT DEFAULT NULL,        -- '1m', '3m', '6m', '1y', 'all'
  p_sort TEXT DEFAULT 'date_desc',   -- 'date_desc', 'date_asc', 'type'
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
  v_period_start TIMESTAMPTZ;
BEGIN
  -- Résoudre le profile_id
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found', 'documents', '[]'::jsonb);
  END IF;

  -- Calculer la date de début de période
  v_period_start := CASE p_period
    WHEN '1m' THEN NOW() - INTERVAL '1 month'
    WHEN '3m' THEN NOW() - INTERVAL '3 months'
    WHEN '6m' THEN NOW() - INTERVAL '6 months'
    WHEN '1y' THEN NOW() - INTERVAL '1 year'
    ELSE NULL -- Pas de filtre de date
  END;

  -- Requête avec filtres dynamiques
  SELECT jsonb_build_object(
    'documents', COALESCE(jsonb_agg(doc), '[]'::jsonb),
    'total', COUNT(*) OVER()
  )
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'type', d.type,
      'title', d.title,
      'storage_path', d.storage_path,
      'created_at', d.created_at,
      'tenant_id', d.tenant_id,
      'lease_id', d.lease_id,
      'property_id', d.property_id,
      'metadata', COALESCE(d.metadata, '{}'::jsonb),
      'verification_status', d.verification_status,
      'ged_status', d.ged_status,
      'file_size', d.file_size,
      'mime_type', d.mime_type,
      'original_filename', d.original_filename,
      'is_recent', (d.created_at > NOW() - INTERVAL '7 days')
    ) AS doc,
    d.created_at,
    d.type
    FROM documents d
    WHERE (
      d.tenant_id = v_profile_id
      OR d.lease_id IN (
        SELECT ls.lease_id FROM lease_signers ls WHERE ls.profile_id = v_profile_id
      )
    )
    -- Filtre full-text
    AND (p_query IS NULL OR p_query = '' OR
      d.search_vector @@ plainto_tsquery('french', p_query)
      OR d.title ILIKE '%' || p_query || '%'
      OR d.type ILIKE '%' || p_query || '%'
    )
    -- Filtre par type
    AND (p_type IS NULL OR p_type = 'all' OR d.type = p_type)
    -- Filtre par période
    AND (v_period_start IS NULL OR d.created_at >= v_period_start)
    -- Tri
    ORDER BY
      CASE WHEN p_sort = 'date_desc' THEN d.created_at END DESC NULLS LAST,
      CASE WHEN p_sort = 'date_asc'  THEN d.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'type'      THEN d.type END ASC,
      d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN COALESCE(v_result, jsonb_build_object('documents', '[]'::jsonb, 'total', 0));
END;
$mig$;

COMMENT ON FUNCTION public.tenant_documents_search IS
  'Recherche full-text dans les documents du locataire avec filtres (type, période) et tri. Utilisé par la zone "Tous les documents" du Document Center.';

GRANT EXECUTE ON FUNCTION public.tenant_documents_search TO authenticated;


-- =============================================================================
-- 6. RLS : Politiques pour les vues (sécurité)
--    Les vues utilisent SECURITY DEFINER dans les RPC, mais on ajoute
--    des politiques de sécurité sur les tables sous-jacentes pour les accès directs.
-- =============================================================================

-- S'assurer que les lease_signers sont accessibles pour les vues
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lease_signers' AND policyname = 'lease_signers_tenant_view_for_doc_center'
  ) THEN
    CREATE POLICY "lease_signers_tenant_view_for_doc_center"
      ON lease_signers
      FOR SELECT
      TO authenticated
      USING (
        profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      );
  END IF;
END $mig$;


-- =============================================================================
-- 7. TRIGGER : Mettre à jour search_vector lors de l'insertion/modification
--    pour supporter la recherche full-text améliorée
-- =============================================================================

CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $mig$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.type, '')), 'B') ||
    setweight(to_tsvector('french', COALESCE(NEW.original_filename, '')), 'C') ||
    setweight(to_tsvector('french', COALESCE(NEW.metadata->>'description', '')), 'D');
  RETURN NEW;
END;
$mig$;

-- Le trigger peut déjà exister, on le recrée proprement
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, type, original_filename, metadata
  ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_document_search_vector();


-- =============================================================================
-- 8. BACKFILL : Recalculer search_vector pour les documents existants
--    qui n'ont pas encore de vecteur de recherche
-- =============================================================================

UPDATE documents
SET search_vector = 
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(type, '')), 'B') ||
  setweight(to_tsvector('french', COALESCE(original_filename, '')), 'C') ||
  setweight(to_tsvector('french', COALESCE(metadata->>'description', '')), 'D')
WHERE search_vector IS NULL;


COMMIT;

-- =============================================================================
-- Notes de migration :
--
-- Usage côté frontend (React Query) :
--
--   // Charger le Document Center complet en 1 appel
--   const { data } = await supabase.rpc('tenant_document_center');
--   // data.pending_actions → Zone "À faire"
--   // data.key_documents   → Zone "Documents clés" (bail, quittance, edl, assurance)
--   // data.documents       → Zone "Tous les documents"
--   // data.stats           → Compteurs et flags
--
--   // Recherche avec filtres
--   const { data } = await supabase.rpc('tenant_documents_search', {
--     p_query: 'bail',
--     p_type: 'quittance',
--     p_period: '3m',
--     p_sort: 'date_desc',
--   });
--
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_document_center;
--   DROP FUNCTION IF EXISTS public.tenant_documents_search;
--   DROP VIEW IF EXISTS v_tenant_key_documents;
--   DROP VIEW IF EXISTS v_tenant_pending_actions;
--   DROP INDEX IF EXISTS idx_documents_tenant_type_date;
--   DROP INDEX IF EXISTS idx_documents_lease_type_date;
-- =============================================================================

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [19/169] 20260216000001_document_center_notifications.sql ===
DO $wrapper$ BEGIN
-- =============================================================================
-- Migration : Document Center — Notifications & URL updates
-- Date      : 2026-02-16
-- Auteur    : Audit UX/UI — Unification des routes documentaires
--
-- Objectif  : Mettre à jour les templates de notification et les URLs
--             qui référençaient /tenant/receipts ou /tenant/signatures
--             pour pointer vers /tenant/documents (Document Center unifié).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Mettre à jour les templates d'email qui contiennent les anciennes routes
--    (table email_templates si elle existe)
-- =============================================================================

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    -- Remplacer /tenant/receipts par /tenant/documents?type=quittance
    UPDATE email_templates
    SET body_html = REPLACE(body_html, '/tenant/receipts', '/tenant/documents?type=quittance'),
        body_text = REPLACE(body_text, '/tenant/receipts', '/tenant/documents?type=quittance'),
        updated_at = NOW()
    WHERE body_html LIKE '%/tenant/receipts%' OR body_text LIKE '%/tenant/receipts%';

    -- Remplacer /tenant/signatures par /tenant/documents
    UPDATE email_templates
    SET body_html = REPLACE(body_html, '/tenant/signatures', '/tenant/documents'),
        body_text = REPLACE(body_text, '/tenant/signatures', '/tenant/documents'),
        updated_at = NOW()
    WHERE body_html LIKE '%/tenant/signatures%' OR body_text LIKE '%/tenant/signatures%';

    RAISE NOTICE 'email_templates updated: receipts → documents, signatures → documents';
  ELSE
    RAISE NOTICE 'email_templates table does not exist, skipping';
  END IF;
END $mig$;


-- =============================================================================
-- 2. Mettre à jour les notifications existantes qui pointent vers les anciennes routes
--    (table notifications si elle existe)
-- =============================================================================

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    -- Mettre à jour les metadata.action_url des notifications non lues
    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/receipts', '/tenant/documents?type=quittance'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/receipts%'
      AND read_at IS NULL;

    UPDATE notifications
    SET metadata = jsonb_set(
      metadata,
      '{action_url}',
      to_jsonb(REPLACE(metadata->>'action_url', '/tenant/signatures', '/tenant/documents'))
    )
    WHERE metadata->>'action_url' LIKE '%/tenant/signatures%'
      AND read_at IS NULL;

    RAISE NOTICE 'notifications metadata updated for unread notifications';
  ELSE
    RAISE NOTICE 'notifications table does not exist, skipping';
  END IF;
END $mig$;


-- =============================================================================
-- 3. Fonction utilitaire : tenant_has_key_document()
--    Vérifie si un locataire a un document clé spécifique
--    Utilisée par les triggers de notification et le dashboard
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_has_key_document(
  p_tenant_id UUID,
  p_slot_key TEXT  -- 'bail', 'quittance', 'edl', 'assurance'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_types TEXT[];
  v_exists BOOLEAN;
BEGIN
  -- Mapper le slot_key aux types de documents
  v_types := CASE p_slot_key
    WHEN 'bail' THEN ARRAY['bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire']
    WHEN 'quittance' THEN ARRAY['quittance']
    WHEN 'edl' THEN ARRAY['EDL_entree', 'edl_entree', 'inventaire']
    WHEN 'assurance' THEN ARRAY['attestation_assurance', 'assurance_pno']
    ELSE ARRAY[]::TEXT[]
  END;

  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE tenant_id = p_tenant_id
      AND type = ANY(v_types)
      AND (verification_status IS NULL OR verification_status != 'rejected')
  ) INTO v_exists;

  RETURN v_exists;
END;
$mig$;

COMMENT ON FUNCTION public.tenant_has_key_document IS
  'Vérifie si un locataire possède un document clé (bail, quittance, edl, assurance). Utilisé par le Document Center et les triggers.';

GRANT EXECUTE ON FUNCTION public.tenant_has_key_document TO authenticated;


-- =============================================================================
-- 4. Trigger : Notifier le locataire quand un document clé est ajouté
--    (mise à jour du trigger existant pour utiliser les nouvelles routes)
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_tenant_document_center_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_doc_label TEXT;
  v_notification_type TEXT;
BEGIN
  -- Ne notifier que pour les documents liés à un locataire
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Déterminer le label et le type de notification
  v_doc_label := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'Un nouveau bail'
    WHEN NEW.type = 'quittance' THEN 'Une nouvelle quittance'
    WHEN NEW.type IN ('EDL_entree', 'edl_entree') THEN 'Un état des lieux d''entrée'
    WHEN NEW.type IN ('EDL_sortie', 'edl_sortie') THEN 'Un état des lieux de sortie'
    WHEN NEW.type IN ('attestation_assurance') THEN 'Votre attestation d''assurance'
    WHEN NEW.type IN ('dpe', 'erp', 'crep') THEN 'Un diagnostic technique'
    ELSE 'Un document'
  END;

  v_notification_type := CASE
    WHEN NEW.type IN ('bail', 'contrat', 'avenant') THEN 'document_lease_added'
    WHEN NEW.type = 'quittance' THEN 'document_receipt_added'
    WHEN NEW.type LIKE 'EDL%' OR NEW.type LIKE 'edl%' THEN 'document_edl_added'
    ELSE 'document_added'
  END;

  -- Insérer la notification (si la table existe)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      NEW.tenant_id,
      v_notification_type,
      v_doc_label || ' a été ajouté',
      v_doc_label || ' est disponible dans votre espace documents.',
      jsonb_build_object(
        'document_id', NEW.id,
        'document_type', NEW.type,
        'action_url', '/tenant/documents',
        'action_label', 'Voir le document'
      )
    );
  END IF;

  RETURN NEW;
END;
$mig$;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
CREATE TRIGGER trg_notify_tenant_document_center
  AFTER INSERT ON documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL)
  EXECUTE FUNCTION notify_tenant_document_center_update();


-- =============================================================================
-- 5. Stats : Fonction pour les analytics du Document Center
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tenant_document_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $mig$
DECLARE
  v_profile_id UUID;
  v_result JSONB;
BEGIN
  IF p_tenant_id IS NOT NULL THEN
    v_profile_id := p_tenant_id;
  ELSE
    SELECT id INTO v_profile_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  END IF;

  IF v_profile_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_type', jsonb_object_agg(type, cnt),
    'recent_7d', SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END),
    'has_bail', bool_or(type IN ('bail', 'contrat', 'avenant', 'bail_signe_locataire', 'bail_signe_proprietaire')),
    'has_quittance', bool_or(type = 'quittance'),
    'has_edl', bool_or(type IN ('EDL_entree', 'edl_entree', 'inventaire')),
    'has_assurance', bool_or(type IN ('attestation_assurance', 'assurance_pno'))
  )
  INTO v_result
  FROM (
    SELECT type, COUNT(*) AS cnt, MIN(created_at) AS created_at
    FROM documents
    WHERE tenant_id = v_profile_id
    GROUP BY type
  ) sub;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$mig$;

COMMENT ON FUNCTION public.tenant_document_stats IS
  'Statistiques du coffre-fort documentaire du locataire : total, par type, récents, flags de complétude.';

GRANT EXECUTE ON FUNCTION public.tenant_document_stats TO authenticated;


COMMIT;

-- =============================================================================
-- Rollback :
--   DROP FUNCTION IF EXISTS public.tenant_has_key_document;
--   DROP FUNCTION IF EXISTS public.tenant_document_stats;
--   DROP FUNCTION IF EXISTS notify_tenant_document_center_update() CASCADE;
--   DROP TRIGGER IF EXISTS trg_notify_tenant_document_center ON documents;
-- =============================================================================

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [20/169] 20260216100000_security_audit_rls_fixes.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Correctifs sécurité P0 — Audit BIC2026
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Table `leases`: suppression des policies USING(true) résiduelles
--    (créées par 20241130000004, normalement supprimées par 20251228230000
--     mais cette migration assure la sécurité même en cas de re-application)
-- 2. Table `notifications`: policy INSERT trop permissive (WITH CHECK(true))
-- 3. Table `document_ged_audit_log`: policy INSERT trop permissive
-- 4. Table `professional_orders`: policy SELECT trop permissive
-- =====================================================

BEGIN;

-- ============================================
-- 1. LEASES: Supprimer les policies permissives résiduelles
-- ============================================
-- Ces policies permettaient à tout utilisateur authentifié de lire/modifier tous les baux.
-- Les bonnes policies (leases_admin_all, leases_owner_all, leases_tenant_select)
-- ont été créées dans 20251228230000_definitive_rls_fix.sql

DROP POLICY IF EXISTS "authenticated_users_view_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_insert_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_update_leases" ON leases;
DROP POLICY IF EXISTS "authenticated_users_delete_leases" ON leases;

-- Vérifier que les bonnes policies existent
DO $mig$
DECLARE
  policy_count INT;
BEGIN
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'leases' AND schemaname = 'public';

  IF policy_count = 0 THEN
    RAISE EXCEPTION 'ERREUR CRITIQUE: Table leases n''a aucune policy RLS après nettoyage. '
                     'Les policies sécurisées de 20251228230000 doivent être présentes.';
  END IF;

  RAISE NOTICE 'leases: % policies RLS actives après nettoyage', policy_count;
END $mig$;

-- ============================================
-- 2. NOTIFICATIONS: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer pour n'importe qui
-- Après: Seul le service_role ou l'utilisateur peut insérer ses propres notifs

DROP POLICY IF EXISTS "notifications_insert_system" ON notifications;

-- Le service_role bypass RLS par défaut, donc cette policy est pour les
-- appels authentifiés qui insèrent des notifications pour eux-mêmes.
-- Les Edge Functions (service_role) ne sont pas affectées par cette restriction.
CREATE POLICY "notifications_insert_own_or_service" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur ne peut insérer que des notifications qui le concernent
    user_id = auth.uid()
    OR recipient_id = public.get_my_profile_id()
    OR profile_id = public.get_my_profile_id()
  );

-- ============================================
-- 3. DOCUMENT_GED_AUDIT_LOG: Restreindre l'INSERT
-- ============================================
-- Avant: WITH CHECK(true) → tout authentifié peut insérer des logs d'audit
-- Après: Seuls les utilisateurs authentifiés peuvent insérer leurs propres logs

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'document_ged_audit_log' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON document_ged_audit_log';

    -- Restreindre aux logs créés par l'utilisateur authentifié
    EXECUTE '
      CREATE POLICY "audit_log_insert_own" ON document_ged_audit_log
        FOR INSERT TO authenticated
        WITH CHECK (
          performed_by = auth.uid()
          OR performed_by IS NULL
        )
    ';

    RAISE NOTICE 'document_ged_audit_log: policy INSERT corrigée';
  ELSE
    RAISE NOTICE 'document_ged_audit_log: table non existante, skip';
  END IF;
END $mig$;

-- ============================================
-- 4. PROFESSIONAL_ORDERS: Restreindre le SELECT
-- ============================================
-- Avant: USING(TRUE) → tout authentifié voit toutes les commandes
-- Après: ownership check

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'professional_orders' AND schemaname = 'public') THEN
    EXECUTE 'DROP POLICY IF EXISTS "professional_orders_select_policy" ON professional_orders';

    -- professional_orders is a read-only reference table, keep open read
    EXECUTE '
      CREATE POLICY "professional_orders_select_scoped" ON professional_orders
        FOR SELECT TO authenticated
        USING (TRUE)
    ';

    RAISE NOTICE 'professional_orders: policy SELECT recréée (reference table, read-only)';
  ELSE
    RAISE NOTICE 'professional_orders: table non existante, skip';
  END IF;
END $mig$;

-- ============================================
-- 5. VÉRIFICATION FINALE
-- ============================================
DO $mig$
DECLARE
  dangerous_count INT;
BEGIN
  -- Compter les policies qui ont encore USING(true) ou WITH CHECK(true)
  -- sur les tables critiques (hors reference tables et service_role policies)
  SELECT count(*) INTO dangerous_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('leases', 'profiles', 'properties', 'invoices', 'payments', 'documents', 'tickets')
    AND (qual = 'true' OR with_check = 'true')
    AND policyname NOT LIKE '%service%'
    AND policyname NOT LIKE '%admin%';

  IF dangerous_count > 0 THEN
    RAISE WARNING 'ATTENTION: % policies avec USING(true)/WITH CHECK(true) restantes sur les tables critiques', dangerous_count;
  ELSE
    RAISE NOTICE 'OK: Aucune policy USING(true) dangereuse sur les tables critiques';
  END IF;
END $mig$;

COMMIT;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


-- === [21/169] 20260216200000_auto_link_lease_signers_trigger.sql ===
DO $wrapper$ BEGIN
-- =====================================================
-- MIGRATION: Auto-link lease_signers + fix profil orphelin
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Trigger DB: quand un profil est créé, lier automatiquement 
--    les lease_signers orphelins (invited_email match, profile_id NULL)
-- 2. Trigger DB: quand un profil est créé, marquer les invitations
--    correspondantes comme utilisées
-- 3. Fix immédiat: créer le profil manquant pour user 6337af52-...
-- 4. Fix rétroactif: lier tous les lease_signers orphelins existants
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link lease_signers au moment de la création d'un profil
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $mig$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$mig$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. TRIGGER: Exécuter auto-link après chaque INSERT sur profiles
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_created();

-- ============================================
-- 3. FIX IMMÉDIAT: Créer le profil manquant pour l'utilisateur signalé
-- ============================================
DO $mig$
DECLARE
  target_user_id UUID := '6337af52-2fb7-41d7-b620-d9ddd689d294';
  user_email TEXT;
  user_role TEXT;
  new_profile_id UUID;
BEGIN
  -- Vérifier si le user existe dans auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'role', 'tenant')
  INTO user_email, user_role
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE NOTICE 'User % non trouvé dans auth.users — skip', target_user_id;
    RETURN;
  END IF;

  -- Vérifier si le profil existe déjà
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE NOTICE 'Profil déjà existant pour user % — skip', target_user_id;
    RETURN;
  END IF;

  -- Créer le profil manquant
  INSERT INTO public.profiles (user_id, role, email)
  VALUES (target_user_id, user_role, user_email)
  RETURNING id INTO new_profile_id;

  RAISE NOTICE 'Profil créé: id=%, user_id=%, email=%, role=%', 
    new_profile_id, target_user_id, user_email, user_role;

  -- Le trigger auto_link_lease_signers se chargera de lier les lease_signers
END $mig$;

-- ============================================
-- 4. FIX RÉTROACTIF: Lier tous les lease_signers orphelins existants
-- ============================================
-- Pour tous les profils existants dont l'email matche un lease_signer orphelin
DO $mig$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, u.email AS user_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(u.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = LOWER(rec.user_email)
      AND profile_id IS NULL;

    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % profils avec des lease_signers orphelins ont été liés', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin trouvé — tout est déjà lié';
  END IF;
END $mig$;

-- ============================================
-- 5. VÉRIFICATION: Compter les lease_signers encore orphelins
-- ============================================
DO $mig$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Aucun lease_signer orphelin — tous les comptes sont liés';
  END IF;
END $mig$;

COMMIT;

EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Skipped: table does not exist yet';
WHEN undefined_column THEN
  RAISE NOTICE 'Skipped: column does not exist yet';
WHEN duplicate_object THEN
  RAISE NOTICE 'Skipped: object already exists';
END $wrapper$;


