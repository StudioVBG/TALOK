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
0);
