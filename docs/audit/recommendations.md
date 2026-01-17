# Recommandations - Audit Email Resend

**Date:** 2026-01-17
**Priorité:** Critique > Haute > Moyenne > Basse

---

## 1. Problèmes Critiques

### 1.1 Route /api/emails/send Non Protégée

**Fichier:** `app/api/emails/send/route.ts`

**Problème:** La route accepte n'importe quelle requête POST sans authentification. Un attaquant pourrait l'utiliser pour envoyer du spam via votre compte Resend.

**Impact:**
- Épuisement quota Resend
- Blacklistage du domaine
- Coûts imprévus
- Réputation email compromise

**Solution recommandée:**

```typescript
// app/api/emails/send/route.ts - AVANT
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // ... envoi direct
  }
}

// app/api/emails/send/route.ts - APRÈS
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Option 1: Authentification utilisateur
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Option 2: Vérifier le rôle (admin only)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // ... suite du code
  }
}
```

**Alternative (API key interne):**

```typescript
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");

  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ... suite
}
```

---

### 1.2 Pas de Retry Logic

**Fichiers affectés:** Tous les services email

**Problème:** Si l'API Resend échoue (timeout, erreur réseau), l'email est perdu définitivement.

**Impact:**
- Emails importants non envoyés (invitations bail, confirmations paiement)
- Mauvaise UX
- Données incohérentes

**Solution recommandée:**

```typescript
// lib/emails/utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`[Email] Tentative ${attempt}/${maxRetries} échouée:`, error.message);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  throw lastError;
}

// Utilisation dans resend.service.ts
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  try {
    const result = await withRetry(async () => {
      const resend = getResendClient();
      const { data, error } = await resend.emails.send({
        // ...
      });

      if (error) throw new Error(error.message);
      return data;
    });

    return { success: true, id: result?.id };
  } catch (error: any) {
    console.error('[Email] Échec définitif après 3 tentatives:', error);
    return { success: false, error: error.message };
  }
}
```

---

### 1.3 Pas de Queue Email

**Problème:** Les emails sont envoyés de manière synchrone, ce qui:
- Ralentit les réponses API
- Crée des timeouts potentiels
- Ne permet pas de gérer les pics de charge

**Solution recommandée (avec outbox pattern):**

```sql
-- Migration: create email_outbox table
CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_addresses TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  template_id TEXT,
  template_data JSONB,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_email_outbox_status ON email_outbox(status);
```

```typescript
// lib/emails/queue.ts
export async function queueEmail(options: SendEmailOptions): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("email_outbox")
    .insert({
      to_addresses: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      status: "pending"
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

// Cron job pour traiter la queue
// /api/cron/process-email-queue
export async function GET(request: Request) {
  const supabase = getServiceClient();

  // Récupérer les emails en attente
  const { data: emails } = await supabase
    .from("email_outbox")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .limit(50);

  for (const email of emails || []) {
    try {
      await sendEmail({
        to: email.to_addresses,
        subject: email.subject,
        html: email.html
      });

      await supabase
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", email.id);
    } catch (error) {
      await supabase
        .from("email_outbox")
        .update({
          status: email.attempts >= 2 ? "failed" : "pending",
          attempts: email.attempts + 1,
          last_attempt_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq("id", email.id);
    }
  }
}
```

---

## 2. Problèmes Importants

### 2.1 Duplication de Code

**Fichiers concernés:**
- `lib/emails/resend.service.ts`
- `lib/services/email-service.ts`

**Problème:** Deux services font la même chose avec des implémentations différentes.

**Recommandation:** Consolider en un seul service.

```
STRUCTURE PROPOSÉE:

lib/emails/
├── index.ts              # Barrel export
├── client.ts             # Client Resend singleton
├── service.ts            # Service principal unifié
├── templates/
│   ├── index.ts
│   ├── payment.ts
│   ├── lease.ts
│   ├── visit.ts
│   ├── onboarding.ts
│   └── account.ts
└── utils/
    ├── retry.ts
    ├── validation.ts
    └── queue.ts
```

### 2.2 Validation Email Manquante

**Fichier:** `lib/emails/resend.service.ts`

**Problème:** Pas de validation du format email avant envoi.

**Solution:**

```typescript
// lib/emails/utils/validation.ts
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function validateRecipients(to: string | string[]): string[] {
  const emails = Array.isArray(to) ? to : [to];
  const valid = emails.filter(isValidEmail);

  if (valid.length === 0) {
    throw new Error("Aucune adresse email valide");
  }

  if (valid.length !== emails.length) {
    console.warn("[Email] Certaines adresses invalides ignorées:",
      emails.filter(e => !isValidEmail(e)));
  }

  return valid;
}

// Utilisation
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  try {
    const validRecipients = validateRecipients(options.to);
    // ... suite
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 2.3 Rate Limiting

**Problème:** Aucune protection contre l'envoi massif.

**Solution:**

```typescript
// lib/emails/utils/rate-limit.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Utilisation dans le service
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // Limite par destinataire
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  for (const recipient of recipients) {
    if (!checkRateLimit(`email:${recipient}`, 5, 60000)) {
      console.warn(`[Email] Rate limit atteint pour ${recipient}`);
      return {
        success: false,
        error: `Trop d'emails envoyés à ${recipient}. Réessayez dans 1 minute.`
      };
    }
  }

  // ... suite
}
```

---

## 3. Améliorations Moyennes

### 3.1 Logging Structuré

**Problème:** Les logs sont des strings non structurés, difficiles à analyser.

**Solution:**

```typescript
// lib/emails/utils/logger.ts
interface EmailLogEntry {
  event: 'send_attempt' | 'send_success' | 'send_failure' | 'template_rendered';
  timestamp: string;
  emailId?: string;
  to: string[];
  subject: string;
  template?: string;
  duration?: number;
  error?: string;
}

export function logEmail(entry: EmailLogEntry) {
  const logLine = JSON.stringify({
    ...entry,
    service: 'email',
    timestamp: entry.timestamp || new Date().toISOString()
  });

  if (entry.event === 'send_failure') {
    console.error(logLine);
  } else {
    console.log(logLine);
  }
}

// Utilisation
const startTime = Date.now();
const result = await resend.emails.send({ ... });

logEmail({
  event: result.error ? 'send_failure' : 'send_success',
  emailId: result.data?.id,
  to: recipients,
  subject: options.subject,
  template: options.template,
  duration: Date.now() - startTime,
  error: result.error?.message
});
```

### 3.2 Métriques d'Envoi

**Problème:** Pas de visibilité sur les performances email.

**Solution:**

```typescript
// lib/emails/metrics.ts
interface EmailMetrics {
  totalSent: number;
  totalFailed: number;
  avgDeliveryTime: number;
  byTemplate: Record<string, { sent: number; failed: number }>;
}

// Table pour stocker les métriques
/*
CREATE TABLE email_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT,
  template TEXT,
  to_address TEXT,
  status TEXT, -- sent, failed, bounced
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

export async function recordEmailMetric(data: {
  emailId?: string;
  template?: string;
  to: string;
  status: 'sent' | 'failed';
  durationMs: number;
  error?: string;
}) {
  const supabase = getServiceClient();

  await supabase.from("email_metrics").insert({
    email_id: data.emailId,
    template: data.template,
    to_address: data.to,
    status: data.status,
    duration_ms: data.durationMs,
    error_message: data.error
  });
}
```

### 3.3 Preview/Test Mode

**Problème:** Difficile de tester les templates en dev.

**Solution:**

```typescript
// /api/admin/emails/preview/route.ts
export async function POST(request: Request) {
  const { templateId, data } = await request.json();

  // Générer le HTML sans envoyer
  const template = emailTemplates[templateId];
  if (!template) {
    return NextResponse.json({ error: "Template inconnu" }, { status: 404 });
  }

  const rendered = template(data);

  return NextResponse.json({
    subject: rendered.subject,
    html: rendered.html,
    previewUrl: `data:text/html;base64,${Buffer.from(rendered.html).toString('base64')}`
  });
}
```

---

## 4. Améliorations Basses

### 4.1 Templates Responsives

**Problème:** Certains templates peuvent mal s'afficher sur mobile.

**Recommandation:** Utiliser des tables pour la mise en page email (meilleure compatibilité) et tester sur litmus.com ou email-on-acid.com.

### 4.2 Unsubscribe Links

**Problème:** Pas de lien de désinscription sur les emails marketing.

**Recommandation:** Ajouter un footer avec lien de gestion des préférences.

```html
<div class="footer">
  <a href="{{unsubscribe_url}}">Gérer mes préférences email</a>
</div>
```

### 4.3 Tracking Ouvertures/Clics

**Note:** Resend offre le tracking natif. Vérifier qu'il est activé dans le dashboard.

---

## 5. Flux Manquants Identifiés

### 5.1 Emails à Ajouter

| Flux | Trigger | Destinataire | Priorité |
|------|---------|--------------|----------|
| Bienvenue après inscription | Création compte (Supabase Auth) | Nouvel utilisateur | Haute |
| Fin de bail approche | 2 mois avant fin | Propriétaire + Locataire | Haute |
| Révision loyer annuelle | Date anniversaire bail | Propriétaire | Moyenne |
| Récapitulatif mensuel | 1er du mois | Propriétaire | Moyenne |
| Nouveau document uploadé | Upload document | Destinataire du document | Basse |
| Compte inactif | 30 jours sans connexion | Utilisateur | Basse |

### 5.2 Emails de Vérification Supabase

**Problème:** Supabase Auth envoie ses propres emails (confirmation, reset) qui ne sont pas customisés.

**Recommandation:**
1. Désactiver les emails Supabase natifs
2. Intercepter les events via webhooks
3. Envoyer via Resend avec vos templates

```sql
-- Dans Supabase Dashboard > Auth > Email Templates
-- Désactiver "Enable email confirmations"

-- Puis créer un webhook pour auth.users.created
-- qui appelle votre API pour envoyer l'email de bienvenue
```

---

## 6. Plan d'Action Recommandé

### Phase 1 (Immédiat - 1-2 jours)

1. **[CRITIQUE]** Protéger `/api/emails/send` avec authentification
2. **[CRITIQUE]** Ajouter retry logic basique (3 tentatives)

### Phase 2 (Court terme - 1 semaine)

3. Consolider les services email en un seul
4. Ajouter validation email format
5. Implémenter rate limiting

### Phase 3 (Moyen terme - 2-3 semaines)

6. Implémenter la queue email avec outbox pattern
7. Ajouter métriques et monitoring
8. Créer les tests automatisés

### Phase 4 (Long terme - 1 mois+)

9. Ajouter les flux manquants
10. Customiser les emails Supabase Auth
11. Améliorer les templates (responsive, A/B testing)

---

## 7. Ressources

### Documentation
- [Resend Docs](https://resend.com/docs)
- [React Email](https://react.email) (pour des templates plus maintenables)
- [Email Best Practices](https://www.mailgun.com/blog/email/email-best-practices/)

### Outils de Test
- [Litmus](https://www.litmus.com/) - Test rendu email
- [Mail Tester](https://www.mail-tester.com/) - Score délivrabilité
- [Mailtrap](https://mailtrap.io/) - Sandbox email pour tests

### Monitoring
- Dashboard Resend natif
- Intégration possible avec Sentry pour les erreurs
- Datadog/New Relic pour métriques avancées
