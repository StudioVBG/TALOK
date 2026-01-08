# 📧 Configuration des Emails

## Vue d'ensemble

L'application utilise un service d'email centralisé qui supporte **Resend** (recommandé) et **SendGrid**.

## Configuration rapide avec Resend

### 1. Créer un compte Resend

1. Allez sur [resend.com](https://resend.com)
2. Créez un compte gratuit (3 000 emails/mois)
3. Récupérez votre **API Key** dans Dashboard > API Keys

### 2. Ajouter les variables d'environnement

Ajoutez ces lignes à votre fichier `.env.local` :

```env
# Provider d'email
EMAIL_PROVIDER=resend

# Clé API Resend
RESEND_API_KEY=your_resend_api_key_here

# Adresse d'expédition
# Pour les tests, utilisez l'adresse Resend par défaut :
EMAIL_FROM=Talok <onboarding@resend.dev>

# Pour la production, utilisez votre domaine vérifié :
# EMAIL_FROM=Talok <noreply@votre-domaine.com>

# Forcer l'envoi même en développement (optionnel)
EMAIL_FORCE_SEND=true
```

### 3. Vérifier votre domaine (production)

Pour utiliser votre propre domaine en production :

1. Dans Resend, allez dans **Domains**
2. Ajoutez votre domaine
3. Configurez les enregistrements DNS (SPF, DKIM, DMARC)
4. Attendez la vérification (quelques minutes)

## Emails disponibles

### Templates prêts à l'emploi

| Template | Description | Déclenché par |
|----------|-------------|---------------|
| `welcome` | Bienvenue nouveau compte | Inscription |
| `lease_invite` | Invitation à signer un bail | Création de bail |
| `lease_signature` | Demande de signature | Envoi signature |
| `rent_receipt` | Quittance de loyer | Paiement reçu |
| `rent_reminder` | Rappel de loyer | Cron automatique |
| `payment_received` | Confirmation paiement | Paiement validé |
| `ticket_created` | Nouveau ticket | Création ticket |

### Aperçu de l'email d'invitation de bail

```
┌──────────────────────────────────────────────┐
│        📄 Nouveau bail à signer              │
├──────────────────────────────────────────────┤
│  Bonjour [Nom],                              │
│                                              │
│  [Propriétaire] vous invite à signer...      │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ 📍 15 rue Schoelcher, 97200 FDF      │    │
│  │ 💰 1 200 €/mois (1 000 € + 200 €)    │    │
│  │ 📋 Location meublée                  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  1️⃣ Vérifier votre identité                  │
│  2️⃣ Relire le bail                           │
│  3️⃣ Signer électroniquement                  │
│                                              │
│      [✍️ Compléter et signer mon bail]       │
│                                              │
│  Ce lien expire dans 7 jours.                │
├──────────────────────────────────────────────┤
│  🔒 Signature électronique sécurisée         │
│  © 2025 Talok                     │
└──────────────────────────────────────────────┘
```

## Utilisation dans le code

### Envoyer un email simple

```typescript
import { sendEmail } from "@/lib/services/email-service";

await sendEmail({
  to: "destinataire@email.com",
  subject: "Sujet de l'email",
  html: "<h1>Contenu HTML</h1>",
});
```

### Utiliser un template

```typescript
import { sendTemplateEmail } from "@/lib/services/email-service";

await sendTemplateEmail("welcome", "destinataire@email.com", {
  name: "Jean Dupont",
  dashboard_url: "https://app.gestion-locative.com/dashboard",
  year: "2025",
});
```

### Envoyer une invitation de bail

```typescript
import { sendLeaseInviteEmail } from "@/lib/services/email-service";

await sendLeaseInviteEmail({
  to: "locataire@email.com",
  tenantName: "Marie Martin",
  ownerName: "Jean Dupont",
  propertyAddress: "15 rue Schoelcher, 97200 Fort-de-France",
  rent: 1000,
  charges: 200,
  leaseType: "meuble",
  inviteUrl: "https://app.gestion-locative.com/signature/xxxxx",
});
```

## Mode développement

Par défaut, en mode développement (`NODE_ENV=development`), les emails sont **simulés** et affichés dans la console :

```
[Email] 📧 Envoi simulé (mode dev): { to: 'test@email.com', subject: '...' }
[Email] 💡 Pour envoyer réellement, ajoutez EMAIL_FORCE_SEND=true dans .env.local
```

Pour tester l'envoi réel en développement :

```env
EMAIL_FORCE_SEND=true
```

## Dépannage

### L'email n'est pas envoyé

1. Vérifiez que `RESEND_API_KEY` est défini
2. Vérifiez que `EMAIL_FORCE_SEND=true` si vous êtes en dev
3. Consultez les logs de la console

### Erreur "Clé API email non configurée"

Ajoutez votre clé API dans `.env.local` :
```env
RESEND_API_KEY=your_resend_api_key_here
```

### L'email arrive dans les spams

1. Vérifiez votre domaine sur Resend
2. Configurez correctement SPF, DKIM et DMARC
3. Utilisez une adresse from avec votre domaine vérifié

## Alternative : SendGrid

Si vous préférez SendGrid :

```env
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=Talok <noreply@votre-domaine.com>
```

## Ressources

- [Documentation Resend](https://resend.com/docs)
- [Documentation SendGrid](https://docs.sendgrid.com)
- [Vérification de domaine DNS](https://resend.com/docs/dashboard/domains/introduction)

