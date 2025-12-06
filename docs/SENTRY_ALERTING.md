# 🚨 Configuration Alerting Sentry

**Date**: 6 Décembre 2025  
**Objectif**: Ne jamais manquer une erreur critique en production

---

## 📋 Prérequis

1. Compte Sentry configuré avec `NEXT_PUBLIC_SENTRY_DSN`
2. Accès à Sentry Dashboard (Settings → Alerts)
3. Webhook Slack ou email configuré

---

## 🔔 Alertes à configurer

### 1. Alerte Erreurs Critiques (P0)

**Nom**: `🔴 Critical Errors`  
**Condition**: `event.level:error AND is:unresolved`  
**Fréquence**: Immédiate (< 1 minute)  
**Canal**: Slack #alerts-critical + SMS on-call

```
When an issue is seen more than 1 times in 5 minutes
AND error level is ERROR or FATAL
→ Send Slack notification
→ Page on-call (if > 10 occurrences)
```

### 2. Alerte Erreurs Paiement (P0)

**Nom**: `💳 Payment Errors`  
**Condition**: `tags.route:/api/subscriptions/* OR tags.route:/api/payments/*`  
**Fréquence**: Immédiate  
**Canal**: Slack #alerts-payments

```
When an issue occurs in payment routes
→ Send Slack notification immediately
→ Include transaction details in context
```

### 3. Alerte Taux d'erreur élevé (P1)

**Nom**: `📈 Error Spike`  
**Condition**: `percent_change(count, 1h) > 200%`  
**Fréquence**: Toutes les 15 minutes  
**Canal**: Slack #alerts-engineering

```
When error count increases by more than 200% compared to previous hour
→ Send Slack notification with trend graph
```

### 4. Alerte API Lente (P2)

**Nom**: `🐌 Slow API`  
**Condition**: `transaction.duration.p95 > 3000ms`  
**Fréquence**: Toutes les heures  
**Canal**: Slack #alerts-performance

```
When p95 response time exceeds 3 seconds for API routes
→ Send summary notification
```

### 5. Alerte Nouveaux Bugs (P2)

**Nom**: `🆕 New Issues`  
**Condition**: `is:new`  
**Fréquence**: Toutes les heures (digest)  
**Canal**: Email équipe dev

```
When new issues are detected
→ Send hourly digest email
```

---

## 🛠️ Configuration Slack

### 1. Créer l'intégration Slack

1. Aller dans **Settings → Integrations → Slack**
2. Autoriser Sentry à poster dans Slack
3. Configurer les canaux :
   - `#alerts-critical` - Erreurs critiques
   - `#alerts-payments` - Erreurs paiement
   - `#alerts-engineering` - Alertes techniques

### 2. Configurer le Webhook

```
Sentry Dashboard → Settings → Integrations → Slack
→ Connect workspace
→ Select default channel: #alerts-engineering
```

### 3. Format des messages

Template recommandé pour Slack :
```
🔴 *{issue.title}*
Environment: {environment}
Level: {level}
Count: {count} occurrences
First seen: {firstSeen}
<{issue.url}|View in Sentry>
```

---

## 📧 Configuration Email

### Alertes digest

1. **Settings → Notifications → Email**
2. Configurer :
   - Workflow notifications: Real-time
   - Issue alerts: Digest (hourly)
   - Deploy notifications: Real-time

### Destinataires

| Rôle | Alertes reçues |
|------|----------------|
| CTO | Toutes |
| Dev Lead | Critiques + Spikes |
| Dev | Digest quotidien |
| Support | Erreurs users |

---

## 📱 Configuration On-Call (optionnel)

### PagerDuty / Opsgenie

Pour les erreurs critiques (P0), configurer une escalade :

```
1. (0 min) Slack #alerts-critical
2. (5 min) SMS dev on-call
3. (15 min) Call dev on-call
4. (30 min) Escalade CTO
```

### Configuration PagerDuty

```
Settings → Integrations → PagerDuty
→ Connect service
→ Create routing rules for FATAL level
```

---

## 🎯 Règles de filtrage

### Erreurs à ignorer

Dans `sentry.client.config.ts` :

```typescript
ignoreErrors: [
  // Erreurs réseau utilisateur
  "Network request failed",
  "Failed to fetch",
  "NetworkError",
  "AbortError",
  
  // Extensions navigateur
  "chrome-extension://",
  "moz-extension://",
  
  // Erreurs connues non critiques
  "ResizeObserver loop",
  "Script error",
  
  // Erreurs Stripe gérées
  "card_declined",
  "expired_card",
],
```

### Tags pour filtrage

Ajouter des tags pour faciliter le filtrage :

```typescript
Sentry.setTag("component", "payment");
Sentry.setTag("user_role", user.role);
Sentry.setTag("plan", subscription.plan);
```

---

## 📊 Dashboards Sentry

### 1. Dashboard Production Health

Widgets :
- Error count (last 24h)
- Error rate trend
- Top 5 issues
- Affected users count

### 2. Dashboard Performance

Widgets :
- P50/P95/P99 response times
- Slowest transactions
- Throughput
- Error rate by route

### 3. Dashboard User Impact

Widgets :
- Unique users affected
- Sessions with errors
- Crash-free rate
- Geographic distribution

---

## ✅ Checklist de configuration

- [ ] Sentry DSN configuré dans `.env`
- [ ] Intégration Slack connectée
- [ ] Canal #alerts-critical créé
- [ ] Canal #alerts-payments créé
- [ ] Alerte "Critical Errors" configurée
- [ ] Alerte "Payment Errors" configurée
- [ ] Alerte "Error Spike" configurée
- [ ] Email digest activé
- [ ] Règles d'ignorance mises à jour
- [ ] Dashboard Production Health créé
- [ ] Test d'alerte envoyé

---

## 🧪 Test des alertes

Pour tester que les alertes fonctionnent :

```typescript
// Route de test (à supprimer après test)
// app/api/test-sentry/route.ts
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  Sentry.captureException(new Error("Test alert - please ignore"));
  return Response.json({ status: "error sent" });
}
```

Appeler `/api/test-sentry` et vérifier :
1. L'erreur apparaît dans Sentry
2. La notification Slack est reçue
3. L'email est envoyé (si configuré)

---

## 📚 Ressources

- [Sentry Alerts Documentation](https://docs.sentry.io/product/alerts/)
- [Slack Integration](https://docs.sentry.io/product/integrations/notification-incidents/slack/)
- [PagerDuty Integration](https://docs.sentry.io/product/integrations/notification-incidents/pagerduty/)

---

*Configuration à revoir trimestriellement*

