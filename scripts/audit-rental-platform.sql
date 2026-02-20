-- ============================================================================
-- AUDIT COMPLET — PLATEFORME LOCATIVE TALOK
-- Date: 2026-02-20
-- Auteur: Consultant technique gestion locative
--
-- OBJECTIF:
--   Requetes SQL de diagnostic couvrant les 3 axes de l'audit:
--     AXE 1 — Etat des comptes existants
--     AXE 2 — Ameliorations appliquees
--     AXE 3 — Verification pre/post creation
--
-- EXECUTION: Supabase Studio > SQL Editor (lecture seule — pas de modification)
-- ============================================================================

-- ============================================================
-- AXE 1 — ETAT DES COMPTES EXISTANTS
-- ============================================================

-- ────────────────────────────────────────────────────
-- Q1. TABLEAU RECAPITULATIF PAR BAIL
-- Colonnes: Bail ID, Adresse, Locataire, tenant_id (profile),
--           lease_signers, invitation, EDL, Statut global
-- ────────────────────────────────────────────────────
SELECT
  l.id AS bail_id,
  LEFT(l.id::TEXT, 8) AS bail_id_court,
  l.type_bail,
  l.statut AS bail_statut,
  l.loyer,
  l.charges_forfaitaires AS charges,
  l.date_debut,
  l.date_fin,
  pr.adresse_complete AS adresse,
  pr.code_postal,
  pr.ville,
  -- Info proprietaire
  own.nom AS owner_nom,
  own.prenom AS owner_prenom,
  own.email AS owner_email,
  -- Info locataire (depuis lease_signers)
  ls.id AS signer_id,
  ls.role AS signer_role,
  ls.invited_email,
  ls.invited_name,
  ls.signature_status AS signer_signature,
  ls.profile_id AS tenant_profile_id,
  ten.nom AS tenant_nom,
  ten.prenom AS tenant_prenom,
  ten.email AS tenant_email_profile,
  ten.user_id AS tenant_user_id,
  -- Invitation associee
  inv.id AS invitation_id,
  inv.used_at AS invitation_used_at,
  inv.expires_at AS invitation_expires_at,
  CASE
    WHEN inv.id IS NULL THEN 'pas_invitation'
    WHEN inv.used_at IS NOT NULL THEN 'acceptee'
    WHEN inv.expires_at < NOW() THEN 'expiree'
    ELSE 'en_attente'
  END AS invitation_statut,
  -- EDL
  edl.id AS edl_id,
  edl.type AS edl_type,
  edl.status AS edl_statut,
  -- Statut global
  CASE
    WHEN ls.id IS NULL THEN 'ROUGE — Aucun signer locataire'
    WHEN ls.profile_id IS NULL AND ls.invited_email IS NOT NULL THEN 'JAUNE — Signer orphelin (pas de compte)'
    WHEN ls.profile_id IS NOT NULL AND ten.user_id IS NULL THEN 'JAUNE — Profil sans compte auth'
    WHEN ls.profile_id IS NOT NULL AND ten.user_id IS NOT NULL AND l.statut = 'active' THEN 'VERT — Chaine complete'
    WHEN ls.profile_id IS NOT NULL AND ten.user_id IS NOT NULL THEN 'VERT — Lie, bail ' || l.statut
    ELSE 'JAUNE — A verifier'
  END AS statut_global
FROM public.leases l
JOIN public.properties pr ON l.property_id = pr.id
JOIN public.profiles own ON pr.owner_id = own.id
LEFT JOIN public.lease_signers ls ON ls.lease_id = l.id
  AND ls.role IN ('locataire_principal', 'colocataire')
LEFT JOIN public.profiles ten ON ls.profile_id = ten.id
LEFT JOIN public.invitations inv ON inv.lease_id = l.id
  AND inv.email = COALESCE(ls.invited_email, ten.email)
LEFT JOIN public.edl ON edl.lease_id = l.id AND edl.type = 'entree'
WHERE l.statut NOT IN ('archived')
  AND (pr.deleted_at IS NULL OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'deleted_at'
  ))
ORDER BY l.created_at DESC;


-- ────────────────────────────────────────────────────
-- Q2. COHERENCE TEXTE vs FK
-- Verifie que les donnees textuelles (invited_email, invited_name)
-- correspondent aux FK (profile_id → profiles → auth.users)
-- ────────────────────────────────────────────────────
SELECT
  ls.id AS signer_id,
  ls.lease_id,
  ls.role,
  -- Donnees textuelles sur lease_signers
  ls.invited_email AS text_email,
  ls.invited_name AS text_name,
  -- Donnees FK: profiles
  ten.email AS fk_profile_email,
  ten.nom AS fk_profile_nom,
  ten.prenom AS fk_profile_prenom,
  -- Donnees FK: auth.users
  au.email AS fk_auth_email,
  -- Coherence
  CASE
    WHEN ls.profile_id IS NULL THEN 'orphelin'
    WHEN LOWER(TRIM(ls.invited_email)) = LOWER(TRIM(au.email)) THEN 'coherent'
    WHEN ls.invited_email IS NULL THEN 'coherent (pas email invite)'
    ELSE 'INCOHERENT — email differe'
  END AS coherence_email,
  CASE
    WHEN ls.profile_id IS NULL THEN 'orphelin'
    WHEN ls.invited_name IS NULL THEN 'coherent (pas de nom invite)'
    WHEN LOWER(TRIM(ls.invited_name)) = LOWER(TRIM(COALESCE(ten.nom, '') || ' ' || COALESCE(ten.prenom, '')))
      OR LOWER(TRIM(ls.invited_name)) = LOWER(TRIM(COALESCE(ten.prenom, '') || ' ' || COALESCE(ten.nom, '')))
      THEN 'coherent'
    ELSE 'DIVERGENT — nom differe (non bloquant)'
  END AS coherence_nom
FROM public.lease_signers ls
LEFT JOIN public.profiles ten ON ls.profile_id = ten.id
LEFT JOIN auth.users au ON ten.user_id = au.id
WHERE ls.role IN ('locataire_principal', 'colocataire', 'garant')
ORDER BY ls.created_at DESC;


-- ────────────────────────────────────────────────────
-- Q3. RUPTURES DE CONNEXION
-- Identifie les cas problematiques:
--   - tenant_id NULL dans lease_signers
--   - Profil sans user_id (pas lie a auth)
--   - Invitation bloquee en "pending" > 7 jours
-- ────────────────────────────────────────────────────

-- 3a. Lease_signers orphelins (profile_id NULL) avec email valide
SELECT
  ls.id AS signer_id,
  ls.lease_id,
  ls.invited_email,
  ls.invited_name,
  ls.role,
  l.statut AS bail_statut,
  pr.adresse_complete,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM auth.users au WHERE LOWER(au.email) = LOWER(ls.invited_email)
    ) THEN 'LINKABLE — compte existe, auto-link defaillant'
    ELSE 'EN ATTENTE — locataire n''a pas cree de compte'
  END AS diagnostic,
  ls.created_at AS signer_cree_le
FROM public.lease_signers ls
JOIN public.leases l ON ls.lease_id = l.id
JOIN public.properties pr ON l.property_id = pr.id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND ls.invited_email != ''
  AND ls.invited_email NOT LIKE '%@a-definir%'
ORDER BY ls.created_at DESC;

-- 3b. Profils sans compte auth (user_id NULL ou invalide)
SELECT
  p.id AS profile_id,
  p.email,
  p.nom,
  p.prenom,
  p.role,
  p.user_id,
  CASE
    WHEN p.user_id IS NULL THEN 'user_id NULL'
    WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p.user_id) THEN 'user_id INVALIDE'
    ELSE 'OK'
  END AS diagnostic,
  p.created_at
FROM public.profiles p
WHERE p.user_id IS NULL
   OR (p.user_id IS NOT NULL AND NOT EXISTS (
     SELECT 1 FROM auth.users WHERE id = p.user_id
   ))
ORDER BY p.created_at DESC;

-- 3c. Invitations bloquees (non utilisees et non expirees)
SELECT
  inv.id AS invitation_id,
  inv.email,
  inv.role,
  inv.lease_id,
  l.statut AS bail_statut,
  pr.adresse_complete,
  inv.expires_at,
  inv.used_at,
  CASE
    WHEN inv.used_at IS NOT NULL THEN 'utilisee'
    WHEN inv.expires_at < NOW() THEN 'EXPIREE'
    WHEN inv.expires_at < NOW() + INTERVAL '3 days' THEN 'EXPIRE BIENTOT'
    ELSE 'en_attente'
  END AS statut,
  NOW() - inv.created_at AS age_invitation
FROM public.invitations inv
LEFT JOIN public.leases l ON inv.lease_id = l.id
LEFT JOIN public.properties pr ON l.property_id = pr.id
WHERE inv.used_at IS NULL
ORDER BY inv.created_at DESC;


-- ────────────────────────────────────────────────────
-- Q4. VERIFICATION EDL / CONTRAT / SIDEBAR
-- Compare les informations entre bail, signataires et EDL
-- ────────────────────────────────────────────────────
SELECT
  l.id AS bail_id,
  l.type_bail,
  l.statut AS bail_statut,
  l.loyer,
  l.date_debut,
  pr.adresse_complete,
  -- Signataires proprietaire
  own_signer.id IS NOT NULL AS owner_est_signer,
  own_signer.signature_status AS owner_signature,
  -- Signataires locataire
  ten_signer.id IS NOT NULL AS tenant_est_signer,
  ten_signer.signature_status AS tenant_signature,
  ten_signer.profile_id AS tenant_signer_profile,
  -- EDL entree
  edl_e.id IS NOT NULL AS edl_entree_existe,
  edl_e.status AS edl_entree_statut,
  -- EDL sortie
  edl_s.id IS NOT NULL AS edl_sortie_existe,
  edl_s.status AS edl_sortie_statut,
  -- PDF
  l.pdf_url IS NOT NULL AS pdf_genere,
  l.pdf_signed_url IS NOT NULL AS pdf_signe,
  -- Diagnostic
  CASE
    WHEN ten_signer.id IS NULL THEN 'ROUGE — Pas de signer locataire'
    WHEN ten_signer.profile_id IS NULL THEN 'JAUNE — Signer sans profil lie'
    WHEN l.statut = 'active' AND edl_e.id IS NULL THEN 'JAUNE — Bail actif sans EDL entree'
    WHEN l.statut = 'active' AND ten_signer.signature_status != 'signed' THEN 'JAUNE — Bail actif, locataire non signe'
    ELSE 'VERT'
  END AS diagnostic
FROM public.leases l
JOIN public.properties pr ON l.property_id = pr.id
LEFT JOIN public.lease_signers own_signer ON own_signer.lease_id = l.id AND own_signer.role = 'proprietaire'
LEFT JOIN public.lease_signers ten_signer ON ten_signer.lease_id = l.id AND ten_signer.role IN ('locataire_principal', 'colocataire')
LEFT JOIN public.edl edl_e ON edl_e.lease_id = l.id AND edl_e.type = 'entree'
LEFT JOIN public.edl edl_s ON edl_s.lease_id = l.id AND edl_s.type = 'sortie'
WHERE l.statut NOT IN ('archived')
ORDER BY l.created_at DESC;


-- ────────────────────────────────────────────────────
-- Q5. DOUBLONS POTENTIELS
-- Detecte les baux en double, les signataires en double, etc.
-- ────────────────────────────────────────────────────

-- 5a. Baux en double (meme property + meme date_debut + meme type)
SELECT
  l.property_id,
  pr.adresse_complete,
  l.type_bail,
  l.date_debut,
  COUNT(*) AS nb_baux,
  ARRAY_AGG(l.id ORDER BY l.created_at) AS bail_ids,
  ARRAY_AGG(l.statut ORDER BY l.created_at) AS statuts
FROM public.leases l
JOIN public.properties pr ON l.property_id = pr.id
GROUP BY l.property_id, pr.adresse_complete, l.type_bail, l.date_debut
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 5b. Signataires en double (meme lease + meme email)
SELECT
  ls.lease_id,
  COALESCE(ls.invited_email, p.email) AS email,
  COUNT(*) AS nb_signataires,
  ARRAY_AGG(ls.id ORDER BY ls.created_at) AS signer_ids,
  ARRAY_AGG(ls.profile_id ORDER BY ls.created_at) AS profile_ids
FROM public.lease_signers ls
LEFT JOIN public.profiles p ON ls.profile_id = p.id
GROUP BY ls.lease_id, COALESCE(ls.invited_email, p.email)
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 5c. Profils en double (meme email)
SELECT
  LOWER(COALESCE(p.email, au.email)) AS email,
  COUNT(*) AS nb_profils,
  ARRAY_AGG(p.id ORDER BY p.created_at) AS profile_ids,
  ARRAY_AGG(p.role ORDER BY p.created_at) AS roles,
  ARRAY_AGG(p.user_id ORDER BY p.created_at) AS user_ids
FROM public.profiles p
LEFT JOIN auth.users au ON p.user_id = au.id
WHERE COALESCE(p.email, au.email) IS NOT NULL
GROUP BY LOWER(COALESCE(p.email, au.email))
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;


-- ────────────────────────────────────────────────────
-- Q6. DATES INCOHERENTES
-- ────────────────────────────────────────────────────
SELECT
  l.id AS bail_id,
  l.type_bail,
  l.statut,
  l.date_debut,
  l.date_fin,
  pr.adresse_complete,
  CASE
    WHEN l.date_fin IS NOT NULL AND l.date_fin < l.date_debut
      THEN 'ERREUR — date_fin < date_debut'
    WHEN l.date_debut > CURRENT_DATE + INTERVAL '5 years'
      THEN 'SUSPECT — date_debut > 5 ans dans le futur'
    WHEN l.date_debut < '2000-01-01'
      THEN 'SUSPECT — date_debut < 2000'
    WHEN l.statut = 'active' AND l.date_fin IS NOT NULL AND l.date_fin < CURRENT_DATE
      THEN 'ATTENTION — bail actif avec date_fin passee'
    WHEN l.statut = 'terminated' AND (l.date_fin IS NULL OR l.date_fin > CURRENT_DATE)
      THEN 'ATTENTION — bail termine sans date_fin ou date_fin future'
    ELSE 'OK'
  END AS diagnostic_dates
FROM public.leases l
JOIN public.properties pr ON l.property_id = pr.id
WHERE l.statut NOT IN ('archived')
  AND (
    (l.date_fin IS NOT NULL AND l.date_fin < l.date_debut)
    OR (l.date_debut > CURRENT_DATE + INTERVAL '5 years')
    OR (l.date_debut < '2000-01-01')
    OR (l.statut = 'active' AND l.date_fin IS NOT NULL AND l.date_fin < CURRENT_DATE)
    OR (l.statut = 'terminated' AND (l.date_fin IS NULL OR l.date_fin > CURRENT_DATE))
  )
ORDER BY l.created_at DESC;


-- ============================================================
-- AXE 2 — AMELIORATIONS APPLIQUEES (depuis dernier audit)
-- ============================================================

-- ────────────────────────────────────────────────────
-- Q7. JOURNAL DES REPARATIONS (_repair_log)
-- ────────────────────────────────────────────────────
SELECT
  id,
  repair_date,
  table_name,
  record_id,
  action,
  details,
  reversed
FROM public._repair_log
ORDER BY repair_date DESC
LIMIT 100;

-- ────────────────────────────────────────────────────
-- Q8. TRIGGERS ACTIFS (verification post-correction)
-- Verifie que les triggers corriges sont bien en place
-- ────────────────────────────────────────────────────
SELECT
  t.tgname AS trigger_name,
  n.nspname AS schema_name,
  c.relname AS table_name,
  CASE t.tgtype & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END AS timing,
  CASE t.tgtype & 28
    WHEN 4 THEN 'INSERT'
    WHEN 8 THEN 'DELETE'
    WHEN 16 THEN 'UPDATE'
    WHEN 20 THEN 'INSERT OR UPDATE'
    WHEN 12 THEN 'INSERT OR DELETE'
    WHEN 24 THEN 'UPDATE OR DELETE'
    WHEN 28 THEN 'INSERT OR UPDATE OR DELETE'
  END AS event,
  t.tgenabled AS enabled,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname IN ('public', 'auth')
  AND t.tgname IN (
    'on_auth_user_created',
    'trigger_auto_link_lease_signers',
    'on_profile_created_auto_link',
    'trigger_auto_link_on_profile_update',
    'trigger_link_profile_auth',
    'trigger_auto_link_signer_on_insert',
    'trg_create_owner_subscription',
    'auto_activate_lease_on_edl',
    'validate_lease_before_insert'
  )
ORDER BY n.nspname, c.relname, t.tgname;


-- ────────────────────────────────────────────────────
-- Q9. VERIFICATION: Trigger obsolete supprime
-- Le trigger on_profile_created_auto_link devrait etre absent
-- ────────────────────────────────────────────────────
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = 'on_profile_created_auto_link'
        AND n.nspname = 'public' AND c.relname = 'profiles'
    ) THEN 'ROUGE — Trigger obsolete ENCORE ACTIF — appliquer DROP'
    ELSE 'VERT — Trigger obsolete correctement supprime'
  END AS diagnostic_trigger_obsolete;

-- Requete corrective (a executer si ROUGE):
-- DROP TRIGGER IF EXISTS on_profile_created_auto_link ON public.profiles;
-- DROP FUNCTION IF EXISTS public.auto_link_signer_profile();


-- ────────────────────────────────────────────────────
-- Q10. CHECK INTEGRITE GLOBAL (appel fonction)
-- ────────────────────────────────────────────────────
-- SELECT * FROM check_data_integrity();


-- ============================================================
-- AXE 3 — REQUETES DE VERIFICATION POST-CREATION
-- ============================================================

-- ────────────────────────────────────────────────────
-- Q11. PRE-CREATION: Verifier si un compte auth existe deja
-- Remplacer 'email@example.com' par l'email du futur locataire
-- ────────────────────────────────────────────────────
-- SELECT id, email, created_at, last_sign_in_at
-- FROM auth.users
-- WHERE LOWER(email) = LOWER('email@example.com');

-- ────────────────────────────────────────────────────
-- Q12. PRE-CREATION: Verifier si un profil existe deja
-- ────────────────────────────────────────────────────
-- SELECT p.id, p.user_id, p.email, p.nom, p.prenom, p.role, p.created_at
-- FROM profiles p
-- LEFT JOIN auth.users au ON p.user_id = au.id
-- WHERE LOWER(COALESCE(p.email, au.email)) = LOWER('email@example.com');

-- ────────────────────────────────────────────────────
-- Q13. POST-CREATION: Verifier qu'un bail est complet
-- Remplacer 'LEASE_UUID' par l'ID du bail cree
-- ────────────────────────────────────────────────────
-- SELECT
--   l.id AS bail_id,
--   l.statut,
--   l.type_bail,
--   l.loyer,
--   pr.adresse_complete,
--   -- Proprietaire (signer)
--   own_s.id IS NOT NULL AS owner_signer_ok,
--   own_s.signature_status AS owner_sig_status,
--   -- Locataire (signer)
--   ten_s.id IS NOT NULL AS tenant_signer_ok,
--   ten_s.profile_id IS NOT NULL AS tenant_profile_linked,
--   ten_s.invited_email,
--   ten_s.signature_status AS tenant_sig_status,
--   -- Invitation
--   inv.id IS NOT NULL AS invitation_exists,
--   inv.used_at IS NOT NULL AS invitation_accepted,
--   -- EDL
--   edl.id IS NOT NULL AS edl_entree_exists,
--   -- Resume
--   CASE
--     WHEN own_s.id IS NULL THEN 'Manque signer proprietaire'
--     WHEN ten_s.id IS NULL THEN 'Manque signer locataire'
--     WHEN ten_s.profile_id IS NULL THEN 'Locataire non lie (compte non cree)'
--     WHEN own_s.signature_status != 'signed' THEN 'Proprietaire n''a pas signe'
--     WHEN ten_s.signature_status != 'signed' THEN 'Locataire n''a pas signe'
--     WHEN l.statut != 'active' AND own_s.signature_status = 'signed' AND ten_s.signature_status = 'signed' THEN 'Signatures OK, bail non active'
--     ELSE 'Complet'
--   END AS diagnostic
-- FROM public.leases l
-- JOIN public.properties pr ON l.property_id = pr.id
-- LEFT JOIN public.lease_signers own_s ON own_s.lease_id = l.id AND own_s.role = 'proprietaire'
-- LEFT JOIN public.lease_signers ten_s ON ten_s.lease_id = l.id AND ten_s.role IN ('locataire_principal', 'colocataire')
-- LEFT JOIN public.invitations inv ON inv.lease_id = l.id
-- LEFT JOIN public.edl ON edl.lease_id = l.id AND edl.type = 'entree'
-- WHERE l.id = 'LEASE_UUID';

-- ────────────────────────────────────────────────────
-- Q14. POST-CREATION: Verifier la chaine complete pour un locataire
-- Remplacer 'email@example.com' par l'email du locataire
-- ────────────────────────────────────────────────────
-- SELECT
--   au.id AS auth_user_id,
--   au.email AS auth_email,
--   au.last_sign_in_at,
--   p.id AS profile_id,
--   p.user_id,
--   p.role,
--   p.nom,
--   p.prenom,
--   ls.id AS signer_id,
--   ls.lease_id,
--   ls.role AS signer_role,
--   ls.signature_status,
--   ls.invited_email,
--   l.statut AS bail_statut,
--   l.loyer,
--   pr.adresse_complete,
--   CASE
--     WHEN p.id IS NULL THEN 'ROUGE — Pas de profil'
--     WHEN ls.id IS NULL THEN 'ROUGE — Pas de signer'
--     WHEN ls.profile_id IS NULL THEN 'JAUNE — Signer orphelin'
--     WHEN ls.profile_id != p.id THEN 'ROUGE — Signer lie a un autre profil'
--     ELSE 'VERT — Chaine complete'
--   END AS diagnostic
-- FROM auth.users au
-- LEFT JOIN public.profiles p ON p.user_id = au.id
-- LEFT JOIN public.lease_signers ls ON ls.profile_id = p.id
--   AND ls.role IN ('locataire_principal', 'colocataire')
-- LEFT JOIN public.leases l ON ls.lease_id = l.id
-- LEFT JOIN public.properties pr ON l.property_id = pr.id
-- WHERE LOWER(au.email) = LOWER('email@example.com');


-- ============================================================
-- FIN DU SCRIPT D'AUDIT
-- ============================================================
