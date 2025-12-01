# Guide d'implémentation - Fonctionnalités avancées

Ce document décrit comment finaliser l'implémentation des fonctionnalités avancées qui nécessitent une configuration supplémentaire.

## 1. Intégration Stripe (Paiements en ligne)

### Installation
```bash
npm install stripe @stripe/stripe-js
```

### Configuration
1. Créer un compte Stripe et récupérer les clés API
2. Ajouter dans `.env.local` :
```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

3. Mettre à jour `/app/api/payments/create-intent/route.ts` :
```typescript
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

4. Créer un composant de paiement avec Stripe Elements

### Documentation
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe React Elements](https://stripe.com/docs/stripe-js/react)

## 2. Notifications par Email

### Option 1 : Resend (Recommandé)
```bash
npm install resend
```

Configuration dans `.env.local` :
```
RESEND_API_KEY=re_...
```

Mettre à jour `/app/api/emails/send/route.ts` :
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
```

### Option 2 : SendGrid
```bash
npm install @sendgrid/mail
```

### Option 3 : Supabase Edge Functions
Utiliser les Edge Functions de Supabase pour envoyer des emails.

## 3. Génération de PDF

Pour les quittances et factures en PDF :

```bash
npm install jspdf html2canvas
```

Ou utiliser une solution serveur comme Puppeteer.

## 4. Tests

### Tests unitaires
Les tests sont configurés avec Vitest. Exemple :
```typescript
// tests/unit/services/invoices.test.ts
import { describe, it, expect } from 'vitest';
import { invoicesService } from '@/features/billing/services/invoices.service';

describe('InvoicesService', () => {
  it('should calculate total correctly', () => {
    // Tests...
  });
});
```

### Tests E2E
Les tests Playwright sont configurés. Exemple :
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can sign in', async ({ page }) => {
  // Tests...
});
```

## 5. Déploiement

### Vercel (Recommandé)
1. Connecter le repository GitHub
2. Configurer les variables d'environnement
3. Déployer automatiquement

### Supabase
1. Créer un projet Supabase
2. Appliquer les migrations : `supabase db push`
3. Configurer le Storage bucket "documents"
4. Configurer les politiques RLS

### Variables d'environnement à configurer
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` (optionnel)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (optionnel)
- `RESEND_API_KEY` (optionnel)

## 6. Améliorations futures

### Performance
- Mise en cache avec React Query ou SWR
- Pagination pour les listes longues
- Images optimisées avec next/image

### Fonctionnalités
- Signature électronique (Yousign, DocuSign)
- Calendrier de paiements récurrents
- Notifications push
- Application mobile (React Native)
- API publique pour intégrations tierces

### Analytics
- Intégration Google Analytics ou Plausible
- Tracking des événements utilisateur
- Tableaux de bord analytics avancés

