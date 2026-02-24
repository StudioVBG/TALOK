# Checklist déploiement : 2FA, SMS et email

Ce document liste les variables d'environnement et configurations à mettre en place en production pour que la **vérification 2FA identité** (renouvellement CNI, mise à jour pièce d'identité) et l'envoi de **SMS** / **emails** fonctionnent correctement.

## Contexte

- **2FA identité** : le locataire demande un code par SMS et/ou par email (lien + code) sur `POST /api/tenant/identity/request-2fa`. Si ni Twilio ni Resend ne sont configurés, l'API renvoie une erreur 500 avec `channels_failed`.
- **SMS** : Twilio (service utilisé par l'app).
- **Email** : Resend (envoi des codes et liens de vérification, quittances, etc.).

---

## 1. Variables d'environnement (Netlify / Vercel / autre host)

À configurer dans l’interface d’administration de votre plateforme (ex. Netlify : Site settings → Environment variables).

### Twilio (SMS)

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `TWILIO_ACCOUNT_SID` | Oui pour SMS | Identifiant du compte (commence par `AC`). À ne pas confondre avec une clé API `SK...`. |
| `TWILIO_AUTH_TOKEN` | Oui pour SMS | Jeton d’authentification du compte. |
| `TWILIO_PHONE_NUMBER` | Oui pour SMS | Numéro d’envoi au format E.164 (ex. `+33...`, `+596...`). |
| `TWILIO_MESSAGING_SERVICE_SID` | Non | Optionnel, si vous utilisez un Messaging Service (commence par `MG`). |

En production, si ces variables sont absentes, l’envoi SMS échouera et la 2FA ne pourra s’appuyer que sur l’email (si Resend est configuré).

### Resend (email)

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `RESEND_API_KEY` | Oui en prod | Clé API Resend (commence par `re_`). Requise en production par la validation d’env. |
| `RESEND_FROM_EMAIL` | Recommandé | Adresse d’envoi (ex. `Gestion Locative <noreply@votre-domaine.fr>`). |
| `RESEND_REPLY_TO` | Optionnel | Adresse de réponse (ex. `support@votre-domaine.fr`). |

Sans `RESEND_API_KEY` valide, les emails (codes 2FA, quittances, etc.) ne partent pas. En mode test Resend, l’envoi est limité à l’adresse du compte ; pour envoyer à tous les locataires, il faut **vérifier un domaine** et désactiver le mode test.

### Application

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | URL publique de l’app (ex. `https://votre-app.netlify.app`). Utilisée pour les liens de vérification 2FA dans les emails. |

---

## 2. Compte Twilio : Trial vs payant

- **Compte Trial** : Twilio n’envoie des SMS qu’aux **numéros vérifiés** dans la console (Phone Numbers → Manage → Verified Caller IDs). Pour tester la 2FA avec un numéro réel, ajoutez-le en tant que numéro vérifié ou passez en compte payant.
- **Compte payant** : envoi possible vers n’importe quel numéro (sous réserve des coûts et des règles du pays).

---

## 3. Resend : domaine et mode test

- **Domaine** : dans le dashboard Resend, vérifiez un domaine (DNS) pour pouvoir envoyer depuis `@votre-domaine.fr` et éviter les limites du domaine par défaut.
- **Mode test** : en mode test, Resend n’envoie qu’à l’adresse email du compte. Pour que les locataires reçoivent les codes 2FA par email, vérifiez un domaine et utilisez une clé API de production (mode test désactivé).

---

## 4. Vérification rapide après déploiement

1. **2FA identité** : connectez-vous en tant que locataire, allez sur la page de renouvellement CNI (ex. `/tenant/identity/renew`), cliquez sur « Envoyer le code ». Vous devez recevoir un code par SMS et/ou par email selon la configuration.
2. **En cas d’erreur 500** : vérifiez les logs (Netlify Functions, Vercel, etc.) et la présence de `channels_failed` dans la réponse. Cela indique quels canaux (SMS, email) ont échoué ; configurez les variables correspondantes (Twilio et/ou Resend) et, si besoin, domaine et compte payant / numéros vérifiés.

---

## 5. Références dans le code

- Validation des variables d’environnement : `lib/config/env-validation.ts` (RESEND requis en prod, Twilio optionnel).
- Route 2FA : `app/api/tenant/identity/request-2fa/route.ts`.
- Envoi SMS : `lib/services/sms.service.ts`, credentials : `lib/services/credentials-service.ts`.
- Envoi email : `lib/email/send-email.ts`, `lib/services/email-service.ts`.
- Exemple de variables : `.env.example`.
