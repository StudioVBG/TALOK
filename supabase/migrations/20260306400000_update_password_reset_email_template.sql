-- ============================================================
-- Migration: Mise à jour du template email de réinitialisation de mot de passe
-- Le flux utilise désormais l'API /api/auth/forgot-password qui :
--   1. Génère le lien via supabase.auth.admin.generateLink()
--   2. Envoie l'email via Resend avec emailTemplates.passwordReset()
-- Cette migration synchronise le template en base pour l'admin viewer.
-- ============================================================

-- Mettre à jour le template auth_reset_password pour refléter le nouveau design
UPDATE email_templates
SET
  subject = 'Réinitialisation de votre mot de passe Talok',
  body_html = '<div style="text-align: center; margin-bottom: 24px;">
  <div style="display: inline-block; width: 64px; height: 64px; background: #f9fafb; border-radius: 50%; line-height: 64px; font-size: 32px;">🔐</div>
</div>

<h2 style="text-align: center;">Réinitialisation de mot de passe</h2>
<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé à réinitialiser votre mot de passe sur <strong>Talok</strong>. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>

<div style="text-align: center; margin: 32px 0;">
  <a href="{{reset_url}}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff !important;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Réinitialiser mon mot de passe</a>
</div>

<div style="background-color:#f9fafb;border-left:4px solid #2563eb;padding:20px 24px;margin:24px 0;border-radius:0 8px 8px 0;">
  <p style="margin:0;font-size:14px;color:#6b7280;">⏱ Ce lien expire dans <strong>{{expiration}}</strong>. Passé ce délai, vous devrez effectuer une nouvelle demande.</p>
</div>

<hr style="border:none;height:1px;background:#e5e7eb;margin:24px 0;">

<p style="font-size:13px;color:#6b7280;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur&nbsp;:<br>
<a href="{{reset_url}}" style="color:#2563eb;word-break:break-all;font-size:12px;">{{reset_url}}</a></p>

<p style="font-size:13px;color:#6b7280;">Si vous n''êtes pas à l''origine de cette demande, ignorez simplement cet email. Votre mot de passe ne sera pas modifié.</p>',

  body_text = 'Bonjour {{prenom}},

Vous avez demandé à réinitialiser votre mot de passe sur Talok.
Cliquez sur le lien suivant pour en choisir un nouveau :

{{reset_url}}

Ce lien expire dans {{expiration}}.
Passé ce délai, vous devrez effectuer une nouvelle demande.

Si vous n''êtes pas à l''origine de cette demande, ignorez simplement cet email.
Votre mot de passe ne sera pas modifié.

L''équipe Talok',

  available_variables = '[
    {"key": "prenom", "label": "Prénom de l''utilisateur", "example": "Thomas"},
    {"key": "reset_url", "label": "Lien de réinitialisation", "example": "https://talok.fr/auth/callback?next=/auth/reset-password&code=abc123"},
    {"key": "expiration", "label": "Durée de validité du lien", "example": "1 heure"}
  ]'::jsonb,

  updated_at = now()

WHERE slug = 'auth_reset_password';

-- Si le template n'existait pas (cas de migration partielle), l'insérer
INSERT INTO email_templates (slug, category, name, description, subject, body_html, body_text, available_variables, send_delay_minutes)
SELECT
  'auth_reset_password',
  'auth',
  'Réinitialisation de mot de passe',
  'Email envoyé lors d''une demande de réinitialisation de mot de passe. Envoyé via Resend par l''API /api/auth/forgot-password.',
  'Réinitialisation de votre mot de passe Talok',
  '<div style="text-align: center; margin-bottom: 24px;">
  <div style="display: inline-block; width: 64px; height: 64px; background: #f9fafb; border-radius: 50%; line-height: 64px; font-size: 32px;">🔐</div>
</div>
<h2 style="text-align: center;">Réinitialisation de mot de passe</h2>
<p>Bonjour {{prenom}},</p>
<p>Vous avez demandé à réinitialiser votre mot de passe sur <strong>Talok</strong>. Cliquez sur le bouton ci-dessous pour en choisir un nouveau :</p>
<div style="text-align: center; margin: 32px 0;">
  <a href="{{reset_url}}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff !important;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;">Réinitialiser mon mot de passe</a>
</div>
<div style="background-color:#f9fafb;border-left:4px solid #2563eb;padding:20px 24px;margin:24px 0;border-radius:0 8px 8px 0;">
  <p style="margin:0;font-size:14px;color:#6b7280;">⏱ Ce lien expire dans <strong>{{expiration}}</strong>. Passé ce délai, vous devrez effectuer une nouvelle demande.</p>
</div>
<p style="font-size:13px;color:#6b7280;">Si vous n''êtes pas à l''origine de cette demande, ignorez simplement cet email. Votre mot de passe ne sera pas modifié.</p>',
  'Bonjour {{prenom}},

Vous avez demandé à réinitialiser votre mot de passe sur Talok.
Cliquez sur le lien suivant pour en choisir un nouveau :
{{reset_url}}

Ce lien expire dans {{expiration}}.
Si vous n''êtes pas à l''origine de cette demande, ignorez cet email.

L''équipe Talok',
  '[{"key": "prenom", "label": "Prénom de l''utilisateur", "example": "Thomas"}, {"key": "reset_url", "label": "Lien de réinitialisation", "example": "https://talok.fr/auth/callback?next=/auth/reset-password&code=abc123"}, {"key": "expiration", "label": "Durée de validité du lien", "example": "1 heure"}]'::jsonb,
  0
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE slug = 'auth_reset_password');
