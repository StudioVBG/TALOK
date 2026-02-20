# Audit — Connexion des comptes Propriétaire / Locataire

Ce document décrit la chaîne de connexion attendue entre les comptes propriétaire et locataire, les points de rupture possibles, les requêtes de diagnostic et de correction, ainsi qu’une checklist de vérification.

## 1. Chaîne de connexion attendue

```
PROPRIÉTAIRE                                    LOCATAIRE
auth.users → profiles → properties → leases ←→ lease_signers ←→ profiles ← auth.users
```

En détail :

- **Propriétaire** : `auth.users` (email) → `profiles` (owner) → `properties` → `leases`.
- **Bail** : `leases` est lié à des `lease_signers` (un par signataire).
- **Locataire** : chaque `lease_signer` doit être relié à un `profile_id` (et éventuellement `invited_email` si pas encore de compte). Le `profile` du locataire est lié à `auth.users`.

Tant que `lease_signers.profile_id` est NULL pour un locataire invité par email, le locataire n’apparaît pas correctement côté propriétaire et peut ne pas voir son bail côté locataire.

## 2. Points de rupture identifiés

| Criticité   | Emplacement                 | Problème probable |
|------------|-----------------------------|--------------------|
| CRITIQUE   | `lease_signers.profile_id`  | `profile_id` NULL alors que le locataire a un compte (email correspondant). |
| IMPORTANT  | `notifications`             | Notifications « Locataire inscrit » non créées pour le propriétaire. |
| IMPORTANT  | `invitations.used_by`      | Invitation non marquée comme utilisée (`used_at` / `used_by` vides). |
| MINEUR     | `profiles.email`            | Colonne email non synchronisée avec `auth.users` (si elle existe). |

## 3. Diagnostic rapide (Supabase SQL Editor)

### 3.1 Signataires orphelins pour un email donné

Remplacez `'volberg.thomas@hotmail.fr'` par l’email du locataire à vérifier.

```sql
-- Signataires orphelins (cause la plus probable de rupture)
SELECT
  ls.id,
  ls.invited_email,
  ls.profile_id,
  ls.role,
  l.statut,
  CASE WHEN ls.profile_id IS NULL THEN '❌ RUPTURE' ELSE '✅ OK' END AS status
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr');
```

### 3.2 Tous les signataires orphelins avec email valide

```sql
SELECT
  ls.id,
  ls.lease_id,
  ls.invited_email,
  ls.role,
  l.statut
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND ls.invited_email NOT LIKE '%@a-definir%';
```

### 3.3 Vérifier si un profil existe pour cet email

```sql
SELECT p.id AS profile_id, p.role, u.email
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr');
```

### 3.4 Invitations non marquées utilisées

```sql
SELECT id, email, lease_id, used_at, used_by, expires_at
FROM invitations
WHERE LOWER(email) = LOWER('volberg.thomas@hotmail.fr')
  AND used_at IS NULL;
```

## 4. Corrections SQL (Supabase SQL Editor)

À exécuter après avoir confirmé le diagnostic (email et contexte corrects).

### 4.1 Lier le profil locataire aux lease_signers orphelins

Remplacez l’email par celui du locataire concerné.

```sql
-- Lier le profil locataire aux lease_signers
WITH tenant_profile AS (
  SELECT p.id AS profile_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
)
UPDATE lease_signers
SET profile_id = (SELECT profile_id FROM tenant_profile)
WHERE LOWER(invited_email) = LOWER('volberg.thomas@hotmail.fr')
  AND profile_id IS NULL;
```

### 4.2 Marquer les invitations comme utilisées

```sql
WITH tenant_profile AS (
  SELECT p.id AS profile_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
)
UPDATE invitations
SET used_by = (SELECT profile_id FROM tenant_profile),
    used_at = NOW()
WHERE LOWER(email) = LOWER('volberg.thomas@hotmail.fr')
  AND used_at IS NULL;
```

### 4.3 Créer les notifications manquantes pour le propriétaire

À exécuter après avoir lié les `lease_signers` (section 4.1). Crée une notification « Locataire inscrit » par bail concerné pour le propriétaire.

```sql
-- Créer les notifications "Locataire inscrit" pour les propriétaires
INSERT INTO notifications (user_id, profile_id, type, title, body, is_read, read, metadata)
SELECT DISTINCT
  p_owner.user_id,
  p_owner.id AS profile_id,
  'tenant_account_created',
  'Locataire inscrit',
  format(
    '%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
    u_tenant.email,
    COALESCE(prop.adresse_complete, 'adresse non renseignée')
  ),
  false,
  false,
  jsonb_build_object(
    'lease_id', l.id,
    'tenant_email', u_tenant.email,
    'tenant_profile_id', p_tenant.id,
    'action_url', format('/owner/leases/%s', l.id)
  )
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
JOIN properties prop ON prop.id = l.property_id
JOIN profiles p_owner ON p_owner.id = prop.owner_id
JOIN profiles p_tenant ON p_tenant.id = ls.profile_id
JOIN auth.users u_tenant ON u_tenant.id = p_tenant.user_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.profile_id = p_owner.id
      AND n.type = 'tenant_account_created'
      AND (n.metadata->>'lease_id')::text = l.id::text
  );
```

## 5. Script d’audit TypeScript

Un script permet d’automatiser le diagnostic et de proposer les corrections SQL :

```bash
npx tsx scripts/audit-account-connections.ts
```

Filtrer par email :

```bash
npx tsx scripts/audit-account-connections.ts --email=volberg.thomas@hotmail.fr
```

Le script :

- Liste les `lease_signers` orphelins (profile_id NULL, invited_email renseigné).
- Croise avec `auth.users` et `profiles` pour repérer les correspondances (email → profil).
- Vérifie les invitations non marquées utilisées.
- Vérifie les notifications « Locataire inscrit » pour les baux concernés.
- Affiche des scripts SQL correctifs à copier dans le SQL Editor.

Variables d’environnement requises (ex. `.env.local`) : `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 6. Scénarios de reproduction et prévention

### 6.1 Causes probables des ruptures

1. **Profil locataire créé avant l’envoi de l’invitation**  
   Le trigger `auto_link_lease_signers_on_profile_created` ne s’exécute qu’à la création du profil ; il ne rattrape pas un `lease_signer` créé après. Le trigger `auto_link_signer_on_insert` (BEFORE INSERT sur `lease_signers`) est censé lier si l’email correspond ; en cas d’échec (ex. différence de casse ou d’espaces), le signer reste orphelin.

2. **Invitation créée avec `profile_id` NULL**  
   Si le trigger `auto_link_signer_on_insert` ne trouve pas le profil (email différent, timing), le signer est inséré avec `profile_id` NULL.

3. **Notifications**  
   Les notifications « Locataire inscrit » sont créées par le trigger `auto_link_lease_signers_on_profile_created`. Si la liaison a été faite manuellement ou par un correctif SQL, ces notifications n’ont pas été créées.

4. **Invitation non marquée utilisée**  
   Si le locataire n’a jamais passé par `/api/invitations/accept` ou par le flux d’onboarding qui met à jour `invitations`, `used_at` / `used_by` restent vides.

### 6.2 Prévention

- S’assurer que les triggers `auto_link_signer_on_insert` et `auto_link_lease_signers_on_profile_created` sont actifs et sans erreur (vérifier les logs Supabase).
- Utiliser systématiquement une comparaison d’email en `LOWER(TRIM(...))` côté API et dans les triggers.
- Après toute correction manuelle des `lease_signers`, exécuter si besoin le script de création de notifications (section 4.3) pour les baux concernés.

## 7. Checklist de vérification post-correction

- [ ] Pour l’email du locataire : plus aucun `lease_signer` avec cet `invited_email` et `profile_id` NULL (requête 3.1).
- [ ] Pour cet email : un seul `profiles` lié à `auth.users` avec le même email (requête 3.3).
- [ ] Les lignes `invitations` pour cet email sont marquées `used_at` et `used_by` (requête 3.4 ou après 4.2).
- [ ] Pour chaque bail concerné, au moins une notification `tenant_account_created` pour le propriétaire (section 4.3 si besoin).
- [ ] Côté app : le propriétaire voit le locataire sur le bail ; le locataire voit le bail dans son espace.
- [ ] Relancer `npx tsx scripts/audit-account-connections.ts --email=...` : plus d’orphelins ni d’invitations non utilisées pour cet email.

## 8. RPC d’audit (optionnel)

Si la migration `20260220100000_fix_orphan_signers_audit.sql` a été appliquée, une RPC `audit_account_connections()` est disponible. Elle retourne des comptages (orphelins, correspondances, invitations non marquées, notifications manquantes) pour un audit global depuis le SQL Editor ou l’API.
