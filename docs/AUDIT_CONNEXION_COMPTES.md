# AUDIT COMPLET - Connexion entre comptes Propriétaire et Locataire

**Date:** 2026-02-20  
**Propriétaire:** contact.explore.mq@gmail.com  
**Locataire:** volberg.thomas@hotmail.fr

---

## 1. CHAÎNE DE CONNEXION ATTENDUE

Pour qu'un propriétaire et un locataire soient correctement connectés, la chaîne suivante doit être complète:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CHAÎNE DE CONNEXION ATTENDUE                            │
└─────────────────────────────────────────────────────────────────────────────────┘

PROPRIÉTAIRE                                    LOCATAIRE
═══════════                                     ═════════

auth.users                                      auth.users
    │ (user_id)                                     │ (user_id)
    ▼                                               ▼
profiles (role='owner')                         profiles (role='tenant')
    │ (id = owner_id)                               │ (id = profile_id)
    ▼                                               │
properties                                          │
    │ (id = property_id)                            │
    ▼                                               │
leases                                              │
    │                                               │
    └────────────────┬──────────────────────────────┘
                     │
                     ▼
              lease_signers
              ┌────────────────────────────────────┐
              │ role='proprietaire' + profile_id   │◄── Propriétaire
              │ role='locataire_principal'         │◄── Locataire
              │   + profile_id                     │
              │   + invited_email                  │
              └────────────────────────────────────┘
                     │
                     ▼
              invitations (optionnel)
              ┌────────────────────────────────────┐
              │ email = locataire                  │
              │ lease_id                           │
              │ used_by = profile_id locataire     │
              └────────────────────────────────────┘
                     │
                     ▼
              notifications
              ┌────────────────────────────────────┐
              │ Pour propriétaire:                 │
              │   - tenant_account_created         │
              │                                    │
              │ Pour locataire:                    │
              │   - lease_invite                   │
              └────────────────────────────────────┘
```

---

## 2. POINTS DE RUPTURE POSSIBLES

### A. Ruptures côté `auth.users`
| Point | Description | Impact |
|-------|-------------|--------|
| A1 | Utilisateur non confirmé (email_confirmed_at = NULL) | Connexion impossible |
| A2 | Email différent de celui invité (casse différente) | Auto-link échoue |

### B. Ruptures côté `profiles`
| Point | Description | Impact |
|-------|-------------|--------|
| B1 | `user_id` NULL ou incorrect | Profil non lié au compte auth |
| B2 | `role` incorrect (ex: 'owner' au lieu de 'tenant') | Dashboard incorrect affiché |
| B3 | Profil dupliqué pour le même `user_id` | Comportement imprévisible |
| B4 | Colonne `email` non synchronisée avec `auth.users.email` | Recherches par email échouent |

### C. Ruptures côté `lease_signers`
| Point | Description | Impact |
|-------|-------------|--------|
| C1 | `profile_id` NULL alors que le locataire a un profil | **CRITIQUE** - Bail non visible pour le locataire |
| C2 | `invited_email` avec casse différente | Auto-link échoue |
| C3 | Signataire manquant pour le locataire | Bail incomplet |
| C4 | `signature_status` incorrect | Workflow de signature bloqué |

### D. Ruptures côté `invitations`
| Point | Description | Impact |
|-------|-------------|--------|
| D1 | Invitation expirée | Locataire ne peut pas rejoindre |
| D2 | `used_by` NULL même si `used_at` rempli | Liaison non effectuée |
| D3 | Aucune invitation créée | Pas de lien entre bail et locataire |

### E. Ruptures côté `notifications`
| Point | Description | Impact |
|-------|-------------|--------|
| E1 | `user_id` ou `profile_id` NULL/incorrect | Notification non reçue |
| E2 | Notification `tenant_account_created` manquante | Propriétaire non informé |
| E3 | Notification `lease_invite` manquante | Locataire non informé |

### F. Ruptures côté `triggers`
| Point | Description | Impact |
|-------|-------------|--------|
| F1 | Trigger `auto_link_lease_signers_on_profile_created` inactif | Liaison automatique ne fonctionne pas |
| F2 | Trigger `auto_link_signer_on_insert` inactif | Nouveau signataire pas lié automatiquement |

---

## 3. REQUÊTES SQL DE DIAGNOSTIC

Exécutez ces requêtes dans le **SQL Editor de Supabase** pour identifier les ruptures:

### 3.1 Diagnostic du compte Propriétaire

```sql
-- ============================================
-- DIAGNOSTIC PROPRIÉTAIRE
-- ============================================

-- 1. Vérifier auth.users
SELECT 
    id AS user_id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users 
WHERE LOWER(email) = LOWER('contact.explore.mq@gmail.com');

-- 2. Vérifier profiles
SELECT 
    p.id AS profile_id,
    p.user_id,
    p.role,
    p.prenom,
    p.nom,
    p.email AS profile_email,
    u.email AS auth_email,
    p.created_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('contact.explore.mq@gmail.com')
   OR LOWER(p.email) = LOWER('contact.explore.mq@gmail.com');

-- 3. Vérifier les biens du propriétaire
SELECT 
    prop.id,
    prop.adresse_complete,
    prop.unique_code,
    prop.owner_id,
    p.prenom || ' ' || p.nom AS owner_name
FROM properties prop
JOIN profiles p ON p.id = prop.owner_id
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('contact.explore.mq@gmail.com');

-- 4. Vérifier les baux du propriétaire
SELECT 
    l.id AS lease_id,
    l.statut,
    l.type_bail,
    l.loyer,
    l.date_debut,
    prop.adresse_complete
FROM leases l
JOIN properties prop ON prop.id = l.property_id
JOIN profiles p ON p.id = prop.owner_id
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('contact.explore.mq@gmail.com');
```

### 3.2 Diagnostic du compte Locataire

```sql
-- ============================================
-- DIAGNOSTIC LOCATAIRE
-- ============================================

-- 1. Vérifier auth.users
SELECT 
    id AS user_id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users 
WHERE LOWER(email) = LOWER('volberg.thomas@hotmail.fr');

-- 2. Vérifier profiles
SELECT 
    p.id AS profile_id,
    p.user_id,
    p.role,
    p.prenom,
    p.nom,
    p.email AS profile_email,
    u.email AS auth_email,
    p.created_at
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
   OR LOWER(p.email) = LOWER('volberg.thomas@hotmail.fr');

-- 3. Vérifier tenant_profiles
SELECT 
    tp.*,
    p.prenom,
    p.nom
FROM tenant_profiles tp
JOIN profiles p ON p.id = tp.profile_id
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr');
```

### 3.3 Diagnostic des connexions lease_signers

```sql
-- ============================================
-- DIAGNOSTIC LEASE_SIGNERS (CRUCIAL)
-- ============================================

-- 1. Signataires avec invited_email du locataire
SELECT 
    ls.id AS signer_id,
    ls.lease_id,
    ls.profile_id,
    ls.invited_email,
    ls.invited_name,
    ls.role,
    ls.signature_status,
    ls.signed_at,
    l.statut AS lease_status,
    l.type_bail,
    prop.adresse_complete,
    CASE 
        WHEN ls.profile_id IS NULL THEN '❌ RUPTURE: profile_id NULL'
        ELSE '✅ OK'
    END AS diagnostic
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
LEFT JOIN properties prop ON prop.id = l.property_id
WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr');

-- 2. Signataires avec profile_id du locataire (si connu)
SELECT 
    ls.id AS signer_id,
    ls.lease_id,
    ls.profile_id,
    ls.invited_email,
    ls.role,
    ls.signature_status,
    l.statut AS lease_status,
    prop.adresse_complete
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
LEFT JOIN properties prop ON prop.id = l.property_id
WHERE ls.profile_id IN (
    SELECT p.id FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
);

-- 3. ORPHELINS: Signataires avec email mais sans profile_id
SELECT 
    ls.id,
    ls.invited_email,
    ls.profile_id,
    ls.role,
    l.id AS lease_id,
    l.statut
FROM lease_signers ls
JOIN leases l ON l.id = ls.lease_id
WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr')
  AND ls.profile_id IS NULL;
```

### 3.4 Diagnostic des invitations

```sql
-- ============================================
-- DIAGNOSTIC INVITATIONS
-- ============================================

SELECT 
    i.id,
    i.email,
    i.role,
    i.lease_id,
    i.property_id,
    i.created_at,
    i.expires_at,
    i.used_at,
    i.used_by,
    CASE 
        WHEN i.used_at IS NOT NULL THEN '✅ Utilisée'
        WHEN i.expires_at < NOW() THEN '❌ Expirée'
        ELSE '⏳ En attente'
    END AS status,
    creator.prenom || ' ' || creator.nom AS created_by_name,
    l.statut AS lease_status
FROM invitations i
LEFT JOIN profiles creator ON creator.id = i.created_by
LEFT JOIN leases l ON l.id = i.lease_id
WHERE LOWER(i.email) = LOWER('volberg.thomas@hotmail.fr')
ORDER BY i.created_at DESC;
```

### 3.5 Diagnostic des notifications

```sql
-- ============================================
-- DIAGNOSTIC NOTIFICATIONS
-- ============================================

-- 1. Notifications du propriétaire
SELECT 
    n.id,
    n.type,
    n.title,
    n.body,
    n.is_read,
    n.created_at,
    n.metadata
FROM notifications n
JOIN profiles p ON (p.id = n.profile_id OR p.user_id = n.user_id)
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('contact.explore.mq@gmail.com')
ORDER BY n.created_at DESC
LIMIT 20;

-- 2. Notifications du locataire
SELECT 
    n.id,
    n.type,
    n.title,
    n.body,
    n.is_read,
    n.created_at,
    n.metadata
FROM notifications n
JOIN profiles p ON (p.id = n.profile_id OR p.user_id = n.user_id)
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
ORDER BY n.created_at DESC
LIMIT 20;

-- 3. Vérifier notification tenant_account_created pour le propriétaire
SELECT COUNT(*) AS has_tenant_created_notif
FROM notifications n
JOIN profiles p ON p.id = n.profile_id
JOIN auth.users u ON u.id = p.user_id
WHERE LOWER(u.email) = LOWER('contact.explore.mq@gmail.com')
  AND n.type = 'tenant_account_created';
```

---

## 4. SCRIPTS DE CORRECTION

### 4.1 Lier le profil locataire aux lease_signers

```sql
-- ============================================
-- CORRECTION: Lier profile_id aux lease_signers
-- ============================================

-- Étape 1: Identifier le profile_id du locataire
WITH tenant_profile AS (
    SELECT p.id AS profile_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
    LIMIT 1
)
-- Étape 2: Mettre à jour les lease_signers orphelins
UPDATE lease_signers
SET profile_id = (SELECT profile_id FROM tenant_profile)
WHERE LOWER(invited_email) = LOWER('volberg.thomas@hotmail.fr')
  AND profile_id IS NULL
  AND (SELECT profile_id FROM tenant_profile) IS NOT NULL;

-- Vérification après correction
SELECT id, lease_id, profile_id, invited_email, role
FROM lease_signers
WHERE LOWER(invited_email) = LOWER('volberg.thomas@hotmail.fr');
```

### 4.2 Créer la notification manquante pour le propriétaire

```sql
-- ============================================
-- CORRECTION: Créer notification tenant_account_created
-- ============================================

WITH owner_data AS (
    SELECT 
        p.id AS owner_profile_id,
        p.user_id AS owner_user_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER('contact.explore.mq@gmail.com')
    LIMIT 1
),
tenant_data AS (
    SELECT 
        p.id AS tenant_profile_id,
        u.email AS tenant_email
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
    LIMIT 1
),
lease_data AS (
    SELECT 
        l.id AS lease_id,
        prop.adresse_complete
    FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties prop ON prop.id = l.property_id
    WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr')
    LIMIT 1
)
INSERT INTO notifications (
    user_id,
    profile_id,
    type,
    title,
    body,
    is_read,
    read,
    metadata
)
SELECT 
    od.owner_user_id,
    od.owner_profile_id,
    'tenant_account_created',
    'Locataire inscrit',
    format('%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
        td.tenant_email, COALESCE(ld.adresse_complete, 'adresse non renseignée')),
    false,
    false,
    jsonb_build_object(
        'lease_id', ld.lease_id,
        'tenant_email', td.tenant_email,
        'tenant_profile_id', td.tenant_profile_id
    )
FROM owner_data od
CROSS JOIN tenant_data td
CROSS JOIN lease_data ld
WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.profile_id = od.owner_profile_id
      AND n.type = 'tenant_account_created'
      AND n.metadata->>'tenant_email' = td.tenant_email
);
```

### 4.3 Créer la notification manquante pour le locataire

```sql
-- ============================================
-- CORRECTION: Créer notification lease_invite pour le locataire
-- ============================================

WITH tenant_data AS (
    SELECT 
        p.id AS tenant_profile_id,
        p.user_id AS tenant_user_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
    LIMIT 1
),
lease_data AS (
    SELECT 
        l.id AS lease_id,
        l.loyer,
        l.type_bail,
        prop.id AS property_id,
        prop.adresse_complete,
        prop.code_postal,
        prop.ville,
        owner.prenom || ' ' || owner.nom AS owner_name
    FROM lease_signers ls
    JOIN leases l ON l.id = ls.lease_id
    JOIN properties prop ON prop.id = l.property_id
    JOIN profiles owner ON owner.id = prop.owner_id
    WHERE LOWER(ls.invited_email) = LOWER('volberg.thomas@hotmail.fr')
    LIMIT 1
)
INSERT INTO notifications (
    user_id,
    profile_id,
    type,
    title,
    body,
    is_read,
    read,
    metadata
)
SELECT 
    td.tenant_user_id,
    td.tenant_profile_id,
    'lease_invite',
    'Nouveau bail à signer',
    format('%s vous invite à signer un bail pour %s, %s %s.',
        ld.owner_name, ld.adresse_complete, ld.code_postal, ld.ville),
    false,
    false,
    jsonb_build_object(
        'lease_id', ld.lease_id,
        'property_id', ld.property_id,
        'owner_name', ld.owner_name,
        'loyer', ld.loyer,
        'type_bail', ld.type_bail
    )
FROM tenant_data td
CROSS JOIN lease_data ld
WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.profile_id = td.tenant_profile_id
      AND n.type = 'lease_invite'
      AND n.metadata->>'lease_id' = ld.lease_id::text
);
```

### 4.4 Marquer les invitations comme utilisées

```sql
-- ============================================
-- CORRECTION: Marquer invitations comme utilisées
-- ============================================

WITH tenant_profile AS (
    SELECT p.id AS profile_id
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER('volberg.thomas@hotmail.fr')
    LIMIT 1
)
UPDATE invitations
SET 
    used_at = COALESCE(used_at, NOW()),
    used_by = COALESCE(used_by, (SELECT profile_id FROM tenant_profile))
WHERE LOWER(email) = LOWER('volberg.thomas@hotmail.fr')
  AND used_at IS NULL
  AND expires_at > NOW();
```

---

## 5. VÉRIFICATION DES TRIGGERS

```sql
-- ============================================
-- VÉRIFIER QUE LES TRIGGERS SONT ACTIFS
-- ============================================

-- Lister tous les triggers sur lease_signers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'lease_signers';

-- Lister tous les triggers sur profiles
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';

-- Vérifier que les fonctions trigger existent
SELECT 
    proname AS function_name,
    prosrc IS NOT NULL AS has_source
FROM pg_proc
WHERE proname IN (
    'auto_link_lease_signers_on_profile_created',
    'auto_link_signer_on_insert',
    'auto_link_signer_profile'
);
```

---

## 6. SCRIPT COMPLET DE DIAGNOSTIC ET CORRECTION

Exécutez ce script complet pour un diagnostic automatique:

```sql
-- ============================================
-- SCRIPT COMPLET: DIAGNOSTIC ET CORRECTION
-- Email propriétaire: contact.explore.mq@gmail.com
-- Email locataire: volberg.thomas@hotmail.fr
-- ============================================

DO $$
DECLARE
    v_owner_email TEXT := 'contact.explore.mq@gmail.com';
    v_tenant_email TEXT := 'volberg.thomas@hotmail.fr';
    v_owner_user_id UUID;
    v_owner_profile_id UUID;
    v_tenant_user_id UUID;
    v_tenant_profile_id UUID;
    v_orphan_signers INT;
    v_linked_signers INT;
    v_owner_notifs INT;
    v_tenant_notifs INT;
BEGIN
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'DIAGNOSTIC DE CONNEXION ENTRE COMPTES';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    
    -- 1. Vérifier le propriétaire
    RAISE NOTICE '';
    RAISE NOTICE '1. PROPRIÉTAIRE (%)', v_owner_email;
    
    SELECT id INTO v_owner_user_id
    FROM auth.users WHERE LOWER(email) = LOWER(v_owner_email);
    
    IF v_owner_user_id IS NULL THEN
        RAISE NOTICE '   ❌ auth.users: NON TROUVÉ';
    ELSE
        RAISE NOTICE '   ✅ auth.users: %', v_owner_user_id;
        
        SELECT id INTO v_owner_profile_id
        FROM profiles WHERE user_id = v_owner_user_id;
        
        IF v_owner_profile_id IS NULL THEN
            RAISE NOTICE '   ❌ profiles: NON TROUVÉ';
        ELSE
            RAISE NOTICE '   ✅ profiles: %', v_owner_profile_id;
        END IF;
    END IF;
    
    -- 2. Vérifier le locataire
    RAISE NOTICE '';
    RAISE NOTICE '2. LOCATAIRE (%)', v_tenant_email;
    
    SELECT id INTO v_tenant_user_id
    FROM auth.users WHERE LOWER(email) = LOWER(v_tenant_email);
    
    IF v_tenant_user_id IS NULL THEN
        RAISE NOTICE '   ❌ auth.users: NON TROUVÉ';
    ELSE
        RAISE NOTICE '   ✅ auth.users: %', v_tenant_user_id;
        
        SELECT id INTO v_tenant_profile_id
        FROM profiles WHERE user_id = v_tenant_user_id;
        
        IF v_tenant_profile_id IS NULL THEN
            RAISE NOTICE '   ❌ profiles: NON TROUVÉ';
        ELSE
            RAISE NOTICE '   ✅ profiles: %', v_tenant_profile_id;
        END IF;
    END IF;
    
    -- 3. Vérifier lease_signers
    RAISE NOTICE '';
    RAISE NOTICE '3. LEASE_SIGNERS';
    
    SELECT COUNT(*) INTO v_orphan_signers
    FROM lease_signers
    WHERE LOWER(invited_email) = LOWER(v_tenant_email)
      AND profile_id IS NULL;
    
    SELECT COUNT(*) INTO v_linked_signers
    FROM lease_signers
    WHERE LOWER(invited_email) = LOWER(v_tenant_email)
      AND profile_id IS NOT NULL;
    
    RAISE NOTICE '   Signataires liés: %', v_linked_signers;
    RAISE NOTICE '   Signataires orphelins (profile_id NULL): %', v_orphan_signers;
    
    IF v_orphan_signers > 0 THEN
        RAISE NOTICE '   ❌ RUPTURE DÉTECTÉE: % signataire(s) avec email mais sans profile_id', v_orphan_signers;
    END IF;
    
    -- 4. Vérifier notifications
    RAISE NOTICE '';
    RAISE NOTICE '4. NOTIFICATIONS';
    
    IF v_owner_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_owner_notifs
        FROM notifications
        WHERE profile_id = v_owner_profile_id OR user_id = v_owner_user_id;
        RAISE NOTICE '   Propriétaire: % notification(s)', v_owner_notifs;
    END IF;
    
    IF v_tenant_profile_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_tenant_notifs
        FROM notifications
        WHERE profile_id = v_tenant_profile_id OR user_id = v_tenant_user_id;
        RAISE NOTICE '   Locataire: % notification(s)', v_tenant_notifs;
        
        IF v_tenant_notifs = 0 THEN
            RAISE NOTICE '   ❌ RUPTURE: Le locataire n''a aucune notification';
        END IF;
    END IF;
    
    -- 5. CORRECTION AUTOMATIQUE (si profil locataire existe)
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'CORRECTIONS AUTOMATIQUES';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    
    IF v_tenant_profile_id IS NOT NULL AND v_orphan_signers > 0 THEN
        UPDATE lease_signers
        SET profile_id = v_tenant_profile_id
        WHERE LOWER(invited_email) = LOWER(v_tenant_email)
          AND profile_id IS NULL;
        
        GET DIAGNOSTICS v_linked_signers = ROW_COUNT;
        RAISE NOTICE '✅ % signataire(s) lié(s) au profil locataire', v_linked_signers;
    ELSE
        RAISE NOTICE 'Aucune correction nécessaire pour lease_signers';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
    RAISE NOTICE 'FIN DU DIAGNOSTIC';
    RAISE NOTICE '════════════════════════════════════════════════════════════════';
END $$;
```

---

## 7. RÉSUMÉ DES CAUSES POSSIBLES

### Pourquoi les comptes ne sont pas connectés ?

1. **Le trigger `auto_link_lease_signers_on_profile_created` n'a pas fonctionné**
   - Le profil locataire a été créé AVANT l'invitation (l'email n'était pas encore dans `lease_signers`)
   - Ou le trigger a eu une erreur silencieuse

2. **L'invitation a été créée APRÈS la création du compte locataire**
   - Le trigger INSERT sur `lease_signers` doit lier automatiquement, mais peut avoir échoué

3. **Différence de casse dans les emails**
   - Les triggers utilisent `LOWER()` mais une ancienne donnée pourrait avoir été insérée sans normalisation

4. **Les notifications n'ont pas été créées**
   - Le trigger de notification a peut-être échoué
   - Les RLS policies peuvent bloquer l'insertion

---

## 8. ACTIONS RECOMMANDÉES

1. **Exécuter le script de diagnostic complet** (section 6)
2. **Vérifier les résultats** et identifier les ruptures
3. **Exécuter les scripts de correction** selon les ruptures identifiées
4. **Tester la connexion** en se connectant aux deux comptes

---

*Document généré automatiquement par l'audit de connexion*
