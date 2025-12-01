# ✅ Checklist de Déploiement

## 📋 Pré-requis

### 1. Migrations SQL à Appliquer

```bash
# Appliquer toutes les migrations dans l'ordre
supabase migration up
```

**Migrations critiques :**
- ✅ `20240101000022_add_lease_states.sql` - États baux
- ✅ `20240101000023_idempotency_and_2fa.sql` - Idempotency & 2FA
- ✅ `20240101000024_document_links_table.sql` - Liens de partage

### 2. Variables d'Environnement

Ajouter dans `.env.local` :

```env
# Webhooks
STRIPE_WEBHOOK_SECRET=whsec_...
WEBHOOK_SECRET=your_webhook_secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 2FA (optionnel - pour chiffrement du secret)
TWO_FACTOR_ENCRYPTION_KEY=your_32_char_key
```

### 3. Dépendances

```bash
npm install
# otplib devrait être installé
```

---

## 🔧 Configuration Supabase

### Tables à Vérifier

1. **idempotency_keys** - Doit exister
2. **document_links** - Doit exister
3. **profiles** - Colonnes `two_factor_secret`, `two_factor_enabled`, `suspended`, etc.

### RLS Policies

Vérifier que toutes les nouvelles tables ont des politiques RLS :
- ✅ `idempotency_keys` (peut être sans RLS si service role uniquement)
- ✅ `document_links` (RLS configuré)

---

## 🧪 Tests à Effectuer

### Routes API Critiques

1. **Approbation Devis**
   ```bash
   POST /api/tickets/[tid]/quotes/[qid]/approve
   ```

2. **Relance Paiement**
   ```bash
   POST /api/invoices/[iid]/remind
   ```

3. **Suspension Compte**
   ```bash
   PATCH /api/admin/users/[id]
   Body: { "suspended": true, "reason": "Test" }
   ```

4. **2FA**
   ```bash
   POST /api/auth/2fa/enable
   POST /api/auth/2fa/verify
   Body: { "token": "123456" }
   ```

5. **Broadcast**
   ```bash
   POST /api/admin/broadcast
   Body: { "title": "Test", "message": "Message", "audience": "all" }
   ```

6. **Recherche**
   ```bash
   GET /api/search?q=test&type=all
   ```

7. **Copier Lien**
   ```bash
   GET /api/documents/[id]/copy-link
   ```

### Pages Frontend

1. `/admin/integrations` - Doit charger
2. `/admin/moderation` - Doit charger
3. `/admin/accounting` - Doit charger
4. `/admin/privacy` - Doit charger
5. `/vendor/dashboard` - Doit charger
6. `/vendor/jobs` - Doit charger
7. `/vendor/invoices` - Doit charger

---

## 🚀 Déploiement

### 1. Build

```bash
npm run build
```

### 2. Vérifier les Erreurs

```bash
npm run type-check
npm run lint
```

### 3. Tests (si disponibles)

```bash
npm run test
npm run test:e2e
```

### 4. Déployer

```bash
# Vercel
vercel deploy

# Ou autre plateforme
```

---

## 📝 Notes Post-Déploiement

1. **Cron Jobs** : Configurer un cron pour nettoyer `idempotency_keys` (toutes les 24h)
2. **Monitoring** : Surveiller les erreurs dans les logs
3. **Webhooks** : Configurer les URLs de webhook dans Stripe/GoCardless
4. **2FA** : Tester le flux complet d'activation

---

## ⚠️ Points d'Attention

1. **Idempotency** : Le middleware n'est pas encore intégré dans toutes les routes critiques. À ajouter progressivement.
2. **Webhooks** : La vérification HMAC nécessite le secret. Vérifier que les webhooks fonctionnent.
3. **2FA** : Le secret TOTP est stocké en clair. En production, chiffrer avec `TWO_FACTOR_ENCRYPTION_KEY`.
4. **Document Links** : Vérifier que la table `document_links` existe avant d'utiliser `/api/documents/[id]/copy-link`.

---

## ✅ Validation Finale

- [ ] Toutes les migrations appliquées
- [ ] Variables d'environnement configurées
- [ ] Build réussi sans erreurs
- [ ] Routes API testées
- [ ] Pages frontend accessibles
- [ ] RLS policies vérifiées
- [ ] Webhooks configurés
- [ ] Monitoring en place





