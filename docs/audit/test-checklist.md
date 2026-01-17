# Checklist de Tests Email - Talok

**Date:** 2026-01-17

---

## 1. Tests de Configuration

### 1.1 Vérification API Resend

```bash
# Test basique - Vérifier que l'API répond
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Talok <onboarding@resend.dev>",
    "to": "votre-email@example.com",
    "subject": "Test Configuration Resend",
    "html": "<p>Ce test confirme que Resend est correctement configuré.</p>"
  }'
```

**Résultat attendu:** `{"id": "xxx-xxx-xxx"}`

### 1.2 Test via Script Local

```bash
# Exécuter le script de test
npx ts-node scripts/test-email.ts
```

**Vérifications:**
- [ ] Le script s'exécute sans erreur
- [ ] L'email est reçu dans la boîte de destination
- [ ] Le contenu HTML est correctement rendu
- [ ] L'adresse d'expédition est correcte

### 1.3 Test Route API

```bash
# Test de la route /api/emails/send
curl -X POST http://localhost:3000/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test API Email",
    "html": "<h1>Test</h1><p>Email de test via API</p>"
  }'
```

**Vérifications:**
- [ ] Réponse 200 avec `success: true`
- [ ] Email reçu dans les 30 secondes
- [ ] Logs visibles dans la console

---

## 2. Tests par Flux

### 2.1 Onboarding

#### Bienvenue Owner
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Créer un compte propriétaire | Page /signup |
| 2 | Vérifier l'email | Boîte de réception |
| 3 | Vérifier le contenu | Template welcomeOnboarding avec étapes owner |
| 4 | Cliquer sur CTA | Redirige vers /owner/onboarding |

#### Rappels Onboarding
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Créer un compte, ne pas terminer l'onboarding | - |
| 2 | Appeler GET /api/cron/onboarding-reminders | Header: Authorization: Bearer $CRON_SECRET |
| 3 | Vérifier réponse | `{ results: { sent: X } }` |
| 4 | Vérifier l'email | Template 24h/72h/7d selon timing |

```bash
# Test manuel du cron
curl http://localhost:3000/api/cron/onboarding-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 2.2 Bail

#### Invitation Bail
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Se connecter en tant que propriétaire | - |
| 2 | Aller sur /owner/properties/{id} | - |
| 3 | Cliquer "Créer un bail" | - |
| 4 | Remplir le formulaire avec email locataire | - |
| 5 | Soumettre | - |
| 6 | Vérifier la réponse API | `emails_sent_count > 0` |
| 7 | Vérifier boîte email locataire | Template lease_invite |
| 8 | Cliquer sur le lien | Redirige vers /signature/{token} |

#### Relance Signature
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Aller sur /owner/leases/{id} | - |
| 2 | Trouver un signataire non signé | - |
| 3 | Cliquer "Relancer" | - |
| 4 | Vérifier l'email reçu | Template lease_invite avec isReminder=true |

#### Notification Bail Signé
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Utiliser le lien d'invitation reçu | - |
| 2 | Compléter le processus de signature | - |
| 3 | Vérifier email propriétaire | Template leaseSignedNotification |
| 4 | Si tous signés | Badge "BAIL ACTIF" |

### 2.3 Paiements

#### Confirmation Paiement
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Se connecter en tant que locataire | - |
| 2 | Aller sur /tenant/payments | - |
| 3 | Payer une facture | - |
| 4 | Vérifier email | Template paymentConfirmation |
| 5 | Vérifier le lien quittance | PDF accessible |

#### Test Webhook Stripe (dev)
```bash
# Utiliser Stripe CLI pour simuler un webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

| Vérification |
|--------------|
| [ ] Log "[Receipt] Generated and saved" visible |
| [ ] Email quittance envoyé au locataire |
| [ ] Email notification envoyé au propriétaire |

#### Rappel de Paiement
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Se connecter en tant que propriétaire | - |
| 2 | Aller sur /owner/money | - |
| 3 | Trouver une facture impayée | - |
| 4 | Cliquer "Envoyer un rappel" | - |
| 5 | Vérifier email locataire | Template paymentReminder |

### 2.4 Maintenance

#### Nouveau Ticket
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Se connecter en tant que locataire | - |
| 2 | Créer un ticket de maintenance | - |
| 3 | Vérifier email propriétaire | Template newTicket |
| 4 | Vérifier la priorité affichée | Badge correct (basse/normale/haute) |

#### Mise à Jour Ticket
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Se connecter en tant que propriétaire/prestataire | - |
| 2 | Accepter/Rejeter/Compléter un ticket | - |
| 3 | Vérifier email locataire | Template ticketUpdated |
| 4 | Vérifier le nouveau statut affiché | - |

### 2.5 Visites

#### Demande de Visite
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Aller sur une annonce publique | - |
| 2 | Réserver un créneau de visite | - |
| 3 | Vérifier email propriétaire | Template visitBookingRequest |
| 4 | Badge "DEMANDE DE VISITE" visible | - |

#### Confirmation Visite
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Se connecter en tant que propriétaire | - |
| 2 | Confirmer une demande de visite | - |
| 3 | Vérifier email visiteur | Template visitBookingConfirmed |
| 4 | Badge "VISITE CONFIRMÉE" visible | - |

#### Rappels de Visite
```bash
# Test cron rappels
curl http://localhost:3000/api/cron/visit-reminders \
  -H "Authorization: Bearer $CRON_SECRET"
```

| Vérification |
|--------------|
| [ ] Réponse avec `reminders_24h_sent` et `reminders_1h_sent` |
| [ ] Emails reçus par propriétaire ET visiteur |
| [ ] Flags mis à jour en DB |

### 2.6 Authentification

#### Reset Password
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Aller sur /auth/forgot-password | - |
| 2 | Entrer email | - |
| 3 | Vérifier email reçu | Template passwordReset |
| 4 | Lien expire en 1h | Mentionné dans l'email |
| 5 | Cliquer et changer le mot de passe | - |

#### OTP Signature
| Étape | Action | Vérification |
|-------|--------|--------------|
| 1 | Arriver à l'étape OTP du processus signature | - |
| 2 | Cliquer "Envoyer le code" | - |
| 3 | Vérifier email | Code 6 chiffres reçu |
| 4 | Entrer le code | Signature validée |

---

## 3. Tests de Charge et Edge Cases

### 3.1 Rate Limiting

| Test | Action | Résultat attendu |
|------|--------|------------------|
| Envoi rapide 10 emails | Boucle d'appels API | Aucun email bloqué (Resend a ses propres limites) |
| Envoi rapide 100 emails | Boucle d'appels API | Certains peuvent échouer (rate limit Resend) |

### 3.2 Données Invalides

| Test | Action | Résultat attendu |
|------|--------|------------------|
| Email invalide | `to: "not-an-email"` | Erreur 400 ou erreur Resend |
| Email vide | `to: ""` | Erreur "Destinataire requis" |
| Subject vide | `subject: ""` | Erreur "Sujet requis" |
| HTML vide | `html: ""` | Erreur "Contenu requis" |
| To très long | 1000 destinataires | Vérifier comportement Resend |

### 3.3 Cas Limites

| Test | Action | Résultat attendu |
|------|--------|------------------|
| RESEND_API_KEY absente | Supprimer la variable | Mode simulation activé |
| RESEND_API_KEY invalide | Mettre une fausse clé | Erreur 401 Resend |
| Domaine non vérifié | Utiliser un @gmail.com en from | Fallback sur onboarding@resend.dev |
| Destinataire bounce | Envoyer à une adresse invalide | Log erreur, pas de crash |

---

## 4. Tests d'Intégration

### 4.1 Flux Complet Bail

```
1. Owner crée un compte → Email bienvenue ✓
2. Owner ajoute un bien → Pas d'email
3. Owner crée un bail → Email invitation ✓
4. Tenant clique sur le lien → Page signature
5. Tenant demande OTP → Email OTP ✓
6. Tenant signe → Email notification owner ✓
7. Si colocation: répéter 4-6 pour chaque colocataire
8. Tous signés → Email "Bail actif" owner ✓
```

### 4.2 Flux Complet Paiement

```
1. Owner génère facture → Email nouvelle facture ✓
2. Tenant ne paie pas → Cron rappel → Email rappel ✓
3. Tenant paie → Email confirmation tenant ✓
4. Webhook Stripe → Quittance générée → Email quittance ✓
5. Webhook Stripe → Email notification owner ✓
```

### 4.3 Flux Complet Visite

```
1. Visiteur réserve → Email demande owner ✓
2. Owner confirme → Email confirmation visiteur ✓
3. 24h avant → Cron → Email rappel aux deux ✓
4. 1h avant → Cron → Email rappel aux deux ✓
5. Après visite → Email feedback visiteur ✓
```

---

## 5. Vérifications Dashboard Resend

### 5.1 Métriques à Vérifier

| Métrique | Où trouver | Seuil acceptable |
|----------|------------|------------------|
| Delivery rate | Dashboard Resend | > 95% |
| Bounce rate | Dashboard Resend | < 2% |
| Spam complaints | Dashboard Resend | < 0.1% |
| Average delivery time | Dashboard Resend | < 10s |

### 5.2 Logs à Vérifier

| Log | Signification |
|-----|---------------|
| `[Email] ✅ Email envoyé avec succès` | Envoi réussi |
| `[Email] ❌ Erreur Resend:` | Erreur API |
| `[Email] 📧 Envoi simulé (mode dev)` | Mode dev actif |
| `[Email] Credentials DB: trouvés` | Credentials depuis DB |

---

## 6. Tests Automatisés (À Implémenter)

### 6.1 Tests Unitaires Suggérés

```typescript
// __tests__/emails/resend-service.test.ts

describe('ResendService', () => {
  it('should send email successfully', async () => {
    // Mock Resend
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>'
    });
    expect(result.success).toBe(true);
  });

  it('should return error for missing recipient', async () => {
    const result = await sendEmail({
      to: '',
      subject: 'Test',
      html: '<p>Test</p>'
    });
    expect(result.success).toBe(false);
  });

  it('should use correct template for invoice', async () => {
    const result = await sendInvoiceNotification({
      tenantEmail: 'test@example.com',
      // ... other data
    });
    // Verify template was used
  });
});
```

### 6.2 Tests E2E Suggérés

```typescript
// e2e/email-flows.spec.ts

test('lease invitation flow', async ({ page }) => {
  // Login as owner
  // Create lease with tenant email
  // Check API response has emails_sent_count > 0
  // Check email service mock was called with correct template
});
```

---

## 7. Checklist Récapitulative

### Configuration
- [ ] RESEND_API_KEY définie
- [ ] RESEND_FROM_EMAIL avec domaine vérifié
- [ ] CRON_SECRET défini pour les crons
- [ ] Mode dev: EMAIL_FORCE_SEND=true si besoin d'envoyer

### Fonctionnel
- [ ] Email bienvenue envoyé à l'inscription
- [ ] Rappels onboarding fonctionnent
- [ ] Invitations bail envoyées
- [ ] Relances bail envoyées
- [ ] Notifications signature fonctionnent
- [ ] Confirmations paiement envoyées
- [ ] Quittances envoyées après paiement
- [ ] Rappels loyer fonctionnent
- [ ] Notifications tickets fonctionnent
- [ ] Flux visite complet fonctionne
- [ ] Reset password fonctionne
- [ ] OTP signature fonctionne

### Monitoring
- [ ] Logs lisibles et utiles
- [ ] Dashboard Resend accessible
- [ ] Alertes sur erreurs critiques configurées

### Sécurité
- [ ] Route /api/emails/send protégée (⚠️ À FAIRE)
- [ ] Crons protégés par CRON_SECRET
- [ ] Credentials chiffrées en DB
