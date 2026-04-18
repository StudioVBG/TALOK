# Sprint B3 — PASS 6 : Smoke tests fonctionnels

## Statut

⏳ **En attente d'exécution utilisateur** — Chrome MCP indisponible dans cette session, tests à dérouler manuellement (browser ou DevTools).

## Pré-requis

- `https://talok.fr` accessible
- Credentials de test :
  - Owner : `volberg.thomas@gmail.com`
  - Tenant : `volberg.thomas@hotmail.fr`
- Devtools ouverts (Network + Console) pour capturer 500 et erreurs RLS

## 6.1 — Flux owner (15 min)

| # | Action | Vérification | Statut |
|---|---|---|---|
| 1 | `https://talok.fr/login` | Page charge, formulaire visible | ☐ |
| 2 | Login owner | Redirection `/owner` (pas `/login` sur boucle) | ☐ |
| 3 | `/owner` (dashboard) | Pas de 500/4xx en Network. Pas d'erreur `42P17` console | ☐ |
| 4 | `/owner/properties` | Liste charge. Filtre `parent_property_id IS NULL` appliqué (pas de doublons) | ☐ |
| 5 | Clic sur 1 property | Page détail charge sans erreur RLS | ☐ |
| 6 | `/owner/leases` | Liste baux charge | ☐ |
| 7 | `/owner/accounting` | Dashboard charge si plan ≥ Confort. Sinon UpgradeGate visible | ☐ |
| 8 | `/owner/subscription` | Plan actuel correct, feature gating OK | ☐ |

**Critères de blocage** :
- 🔴 Erreur `42P17 infinite recursion` n'importe où
- 🔴 500 sur dashboard ou liste properties/leases
- 🔴 Login boucle infinie ou 401 récurrents

## 6.2 — Flux tenant (10 min)

| # | Action | Vérification | Statut |
|---|---|---|---|
| 1 | Logout owner, login tenant | Redirection `/tenant` | ☐ |
| 2 | `/tenant` (dashboard) | Charge sans erreur | ☐ |
| 3 | Clic bail `da2eb9da-1ff1-4020-8682-5f993aa6fde7` | Détail bail charge | ☐ |
| 4 | Section "Documents essentiels" | Toutes les cartes ("Bail signé", "Quittances", "EDL", "Assurance") affichent un statut. **Point fragile** : carte "Signé" ne doit pas montrer "Manquant" si le bail est signé | ☐ |
| 5 | Section quittances | Liste charge. Aucune erreur 403 sur PDF download | ☐ |
| 6 | `/tenant/documents` | Liste charge avec filtres par type | ☐ |

**Critères de blocage** :
- 🔴 Tenant ne peut pas voir SES baux (RLS cassée)
- 🔴 Quittances inaccessibles
- 🔴 Erreur 500 sur Document Center

## 6.3 — Flux SMS / OTP (5 min)

### Option A — Sans vrai numéro (test DB-only)

```sql
-- Vérifier que l'app peut INSERT dans sms_messages (via le code applicatif Twilio Verify)
-- Inspecter les 5 derniers SMS envoyés
SELECT id, to_number, status, twilio_status, territory, verify_sid,
       error_code, error_message, created_at
FROM sms_messages
ORDER BY created_at DESC
LIMIT 10;
```

Critères :
- ✅ Si une ligne récente avec `status = 'queued'` ou `'sent'` ou `'delivered'` → flux SMS opérationnel
- ✅ `territory` non-NULL (Sprint 0 active)
- ⚠️ Si toutes les lignes récentes sont `failed` avec `error_message` parlant → vérifier credentials Twilio
- 🔴 Si table vide depuis > 24h alors qu'attendue active → SMS désactivé silencieusement

### Option B — Avec vrai numéro (test e2e)

1. Owner test → Settings → 2FA SMS activation (ou flow signature de bail)
2. Saisir un numéro réel (le tien)
3. Cliquer "Envoyer code"
4. Vérifier réception SMS dans les 30s
5. Saisir code → vérifier validation OK

## 6.4 — Upload document (5 min)

⚠️ Skip si bucket `documents` pas créé (cf. PASS 3).

| # | Action | Vérification | Statut |
|---|---|---|---|
| 1 | Owner → 1 property → Documents | Liste charge | ☐ |
| 2 | Cliquer "Upload" → choisir un PDF (< 50 MB) | Upload progress visible | ☐ |
| 3 | Apparition dans la liste | Document listé immédiatement | ☐ |
| 4 | Cliquer "Voir" / "Télécharger" | Signed URL fonctionnelle, PDF s'ouvre | ☐ |
| 5 | Vérification SQL | `SELECT * FROM documents ORDER BY created_at DESC LIMIT 3` → row visible avec `storage_path` non-NULL | ☐ |

## 6.5 — Stripe webhook health (2 min)

```sql
-- Vérifier les 10 derniers webhooks Stripe traités
SELECT
  event_type,
  status,
  processed_at,
  retry_count,
  error_message
FROM stripe_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

Critères :
- ✅ `status = 'processed'` pour la majorité
- ⚠️ `retry_count > 3` sur plusieurs lignes → endpoint Stripe down
- 🔴 Toutes en `pending` depuis > 1h → cron `process-webhooks` cassé

Si la table `stripe_webhook_events` n'existe pas (nom différent), adapter :
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%stripe%' OR table_name LIKE '%webhook%';
```

## Output utilisateur attendu

Pour chaque section 6.1 à 6.5 :
- Liste des cases cochées (✅ ou ❌ pour chaque ligne du tableau)
- Screenshots des écrans clés (si possible)
- Coller les résultats SQL des sections 6.3, 6.4, 6.5

## Verdict de cette PASS

- 🟢 **GO** si tout passe ou anomalies mineures uniquement
- 🟡 **GO avec réserves** si :
  - Buckets manquants (skip 6.4 acceptable)
  - 1-2 erreurs 500 isolées sur des features secondaires
- 🔴 **NO-GO** si :
  - Erreur 42P17 (RLS recursion)
  - Login impossible
  - Dashboard owner ou tenant cassé (500)
  - Tenant ne voit pas son bail
