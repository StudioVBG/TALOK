-- ====================================================================
-- Sprint B2 — Phase 2 MODERE — Batch 14/15
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260412110000_documents_copro_fk.sql
-- Risk: MODERE
-- Why: +4 policies, -4 policies, UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412110000_documents_copro_fk.sql'; END $pre$;

-- =====================================================
-- Migration: Documents copropriété — FK copro_site_id + RLS
-- Date: 2026-04-12
-- Sprint: S2-3 — claude/talok-account-audit-78zaW
--
-- Contexte :
--   La table `documents` sert de GED unifiée (contrats, diagnostics,
--   quittances…) mais n'a aucun lien direct vers un site de copropriété.
--   Pour permettre la GED copro (PV d'AG, convocations, états datés,
--   appels de fonds, contrats syndic…) sans mélanger avec les documents
--   par lease/property/entity, on ajoute une FK nullable `copro_site_id`.
--
--   Nullable = backward compat : les documents existants (contrats de
--   bail, CNI, quittances…) ne sont pas impactés.
--
-- Scope :
--   - NE PAS migrer les documents AG existants qui vivent dans
--     copro_assemblies.document_url et le bucket assembly-documents.
--     C'est un travail de convergence Phase 3, hors scope ici.
--   - Cette migration prépare l'infrastructure uniquement.
-- =====================================================

BEGIN;

-- ============================================
-- 1. Ajouter la colonne copro_site_id (nullable + FK)
-- ============================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS copro_site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documents.copro_site_id IS
  'Site de copropriété rattaché à ce document (PV d''AG, convocation, état daté, etc.).
   NULL pour les documents non-copro (contrats, CNI, quittances, etc.).';

-- ============================================
-- 2. Index partiel — pour les requêtes GED copro
-- ============================================
-- L'index partiel garde la taille minimale en excluant tous les documents
-- non-copro (la majorité du volume).
CREATE INDEX IF NOT EXISTS idx_documents_copro_site_id
  ON public.documents(copro_site_id)
  WHERE copro_site_id IS NOT NULL;

-- ============================================
-- 3. RLS — syndic peut voir les documents de ses sites
-- ============================================
-- La chaîne d'autorisation :
--   user → profiles → syndic_profiles → sites.syndic_profile_id → documents
DROP POLICY IF EXISTS "documents_syndic_copro_select" ON public.documents;
CREATE POLICY "documents_syndic_copro_select"
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT s.id
      FROM public.sites s
      WHERE s.syndic_profile_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT : un syndic peut déposer un document pour un site qu'il gère
DROP POLICY IF EXISTS "documents_syndic_copro_insert" ON public.documents;
CREATE POLICY "documents_syndic_copro_insert"
  ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    copro_site_id IS NULL -- laisse passer les non-copro inserts (autres policies gèrent)
    OR copro_site_id IN (
      SELECT s.id
      FROM public.sites s
      WHERE s.syndic_profile_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE : syndic peut mettre à jour les documents de ses sites
DROP POLICY IF EXISTS "documents_syndic_copro_update" ON public.documents;
CREATE POLICY "documents_syndic_copro_update"
  ON public.documents
  FOR UPDATE TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT s.id
      FROM public.sites s
      WHERE s.syndic_profile_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 4. RLS — copropriétaire peut voir les documents de son site
-- ============================================
-- La chaîne d'autorisation :
--   user → user_site_roles (role_code='coproprietaire') → sites → documents
DROP POLICY IF EXISTS "documents_coproprietaire_select" ON public.documents;
CREATE POLICY "documents_coproprietaire_select"
  ON public.documents
  FOR SELECT TO authenticated
  USING (
    copro_site_id IS NOT NULL
    AND copro_site_id IN (
      SELECT usr.site_id
      FROM public.user_site_roles usr
      WHERE usr.user_id = auth.uid()
        AND usr.role_code IN (
          'coproprietaire',
          'coproprietaire_bailleur',
          'conseil_syndical'
        )
    )
  );

-- ============================================
-- 5. Schema cache reload
-- ============================================
NOTIFY pgrst, 'reload schema';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412110000', 'documents_copro_fk')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412110000_documents_copro_fk.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260412150000_create_cron_logs.sql
-- Risk: MODERE
-- Why: +2 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260412150000_create_cron_logs.sql'; END $pre$;

-- =====================================================
-- Migration: Create cron_logs table for admin monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS cron_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cron_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'running')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_name ON cron_logs(cron_name);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started ON cron_logs(started_at DESC);

-- RLS
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read cron_logs" ON cron_logs;
CREATE POLICY "Admins can read cron_logs"
  ON cron_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "Service role can insert cron_logs" ON cron_logs;
CREATE POLICY "Service role can insert cron_logs"
  ON cron_logs FOR INSERT
  WITH CHECK (true);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260412150000', 'create_cron_logs')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260412150000_create_cron_logs.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415121706_harden_sign_cash_receipt_as_tenant.sql
-- Risk: MODERE
-- Why: UPDATE
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415121706_harden_sign_cash_receipt_as_tenant.sql'; END $pre$;

-- =====================================================
-- Migration: Hardening SOTA de sign_cash_receipt_as_tenant
-- Date: 2026-04-15
-- Branche: claude/fix-cash-receipt-notification-fsMqC
--
-- Contexte:
--   La migration 20260410220000_cash_receipt_two_step_signature.sql a créé
--   la fonction sign_cash_receipt_as_tenant mais sans :
--     - SET search_path = public, pg_temp (risque d'injection via search_path)
--     - GRANT EXECUTE TO authenticated / service_role
--     - Vérification défensive de l'identité du locataire appelant
--     - NOTIFY pgrst pour recharger le cache
--
--   En production, le flow actuel passe par la route API qui utilise le
--   service role (bypass RLS), donc techniquement fonctionnel. Mais :
--     1. Sans GRANT explicite, tout appel direct depuis un client avec JWT
--        authenticated échoue ou dépend de l'exécution par défaut.
--     2. Sans search_path verrouillé, la fonction SECURITY DEFINER est
--        vulnérable aux attaques de search_path si `pg_temp` est prioritaire.
--     3. Sans tenant-check interne, un appel authenticated direct pourrait
--        signer le reçu d'un autre utilisateur si la RPC est exposée.
--
--   Cette migration :
--     1. Drop toutes les variantes connues de la fonction.
--     2. Recrée la fonction avec SECURITY DEFINER + search_path verrouillé.
--     3. Ajoute une vérification d'identité : si auth.uid() IS NOT NULL,
--        le caller doit correspondre au tenant du reçu (service_role bypass).
--     4. GRANT EXECUTE sur authenticated + service_role.
--     5. NOTIFY pgrst pour recharger le schema cache.
--
-- Conformité:
--   - Art. 21 loi n°89-462 du 6 juillet 1989
--   - Décret n°2015-587 du 6 mai 2015
-- =====================================================

BEGIN;

-- ============================================
-- 1. Drop de toutes les versions existantes
-- ============================================

-- Signature 6 args (migration 20260410220000)
DROP FUNCTION IF EXISTS public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
);

-- Filet de sécurité : drop toute autre surcharge existante
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'sign_cash_receipt_as_tenant'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.signature || ' CASCADE';
  END LOOP;
END $$;

-- ============================================
-- 2. Recréation SOTA avec hardening complet
-- ============================================

CREATE OR REPLACE FUNCTION public.sign_cash_receipt_as_tenant(
  p_receipt_id UUID,
  p_tenant_signature TEXT,
  p_tenant_signed_at TIMESTAMPTZ DEFAULT NOW(),
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_device_info JSONB DEFAULT '{}'::jsonb
) RETURNS public.cash_receipts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receipt       public.cash_receipts;
  v_payment       public.payments;
  v_caller_profile UUID;
  v_hash          TEXT;
  v_document_data TEXT;
BEGIN
  -- (a) Récupérer le reçu
  SELECT * INTO v_receipt FROM public.cash_receipts WHERE id = p_receipt_id;
  IF v_receipt.id IS NULL THEN
    RAISE EXCEPTION 'Reçu non trouvé'
      USING ERRCODE = 'P0002';
  END IF;

  -- (b) Idempotence / état
  IF v_receipt.status NOT IN ('pending_tenant', 'draft') THEN
    RAISE EXCEPTION 'Ce reçu a déjà été signé'
      USING ERRCODE = '23505';
  END IF;

  -- (c) Vérification d'identité défensive.
  --     - Si la fonction est appelée via une JWT authenticated (auth.uid()
  --       renvoie un user_id), on exige que le profile du caller == tenant_id.
  --     - Si auth.uid() est NULL (appel service_role via l'API route), on
  --       fait confiance au caller côté serveur, qui a déjà vérifié l'identité.
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_caller_profile
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_caller_profile IS NULL OR v_caller_profile <> v_receipt.tenant_id THEN
      -- Admin bypass : un admin authentifié peut régulariser
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Ce reçu n''est pas adressé à votre compte'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- (d) Créer le paiement associé
  INSERT INTO public.payments (invoice_id, montant, moyen, date_paiement, statut)
  VALUES (v_receipt.invoice_id, v_receipt.amount, 'especes', CURRENT_DATE, 'succeeded')
  RETURNING * INTO v_payment;

  -- (e) Hash d'intégrité (deux signatures + contextes)
  v_document_data := v_receipt.invoice_id::TEXT
                  || '|' || v_receipt.amount::TEXT
                  || '|' || COALESCE(v_receipt.owner_signed_at::TEXT, '')
                  || '|' || p_tenant_signed_at::TEXT
                  || '|' || COALESCE(v_receipt.latitude::TEXT, '')
                  || '|' || COALESCE(v_receipt.longitude::TEXT, '')
                  || '|' || COALESCE(p_latitude::TEXT, '')
                  || '|' || COALESCE(p_longitude::TEXT, '');
  v_hash := encode(sha256(v_document_data::bytea), 'hex');

  -- (f) Finaliser le reçu
  UPDATE public.cash_receipts
  SET tenant_signature = p_tenant_signature,
      tenant_signed_at = p_tenant_signed_at,
      tenant_signature_latitude = p_latitude,
      tenant_signature_longitude = p_longitude,
      tenant_device_info = COALESCE(p_device_info, '{}'::jsonb),
      payment_id = v_payment.id,
      document_hash = v_hash,
      status = 'signed',
      updated_at = NOW()
  WHERE id = p_receipt_id
  RETURNING * INTO v_receipt;

  -- (g) Marquer la facture payée
  UPDATE public.invoices
  SET statut = 'paid'
  WHERE id = v_receipt.invoice_id;

  RETURN v_receipt;
END;
$$;

COMMENT ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) IS
  'SOTA 2026 — Contresignature locataire d''un reçu espèces.
   Finalise la signature, crée le paiement et marque la facture comme payée.
   Vérification d''identité défensive (auth.uid() doit matcher tenant_id si
   présent). Conformité art. 21 loi 6 juillet 1989.';

-- ============================================
-- 3. Permissions explicites
-- ============================================

REVOKE ALL ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sign_cash_receipt_as_tenant(
  UUID, TEXT, TIMESTAMPTZ, NUMERIC, NUMERIC, JSONB
) TO authenticated, service_role;

-- ============================================
-- 4. Forcer le rechargement du schema cache PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415121706', 'harden_sign_cash_receipt_as_tenant')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415121706_harden_sign_cash_receipt_as_tenant.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415124844_add_cheque_photo_to_payments.sql
-- Risk: MODERE
-- Why: -2 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415124844_add_cheque_photo_to_payments.sql'; END $pre$;

-- =====================================================
-- Migration: Cheque photo upload for manual payments
-- Date: 2026-04-15
--
-- CONTEXT:
-- The manual payment modal (`ManualPaymentDialog.tsx`) lets owners log a
-- cheque payment. We now allow them to attach an optional photo of the
-- physical cheque (e.g. taken from the mobile camera via
-- `<input capture="environment">`). The photo is stored privately and
-- accessed through signed URLs generated by an API route that validates
-- ownership.
--
-- CHANGES:
-- 1. Add `payments.cheque_photo_path TEXT NULL` to store the storage path
--    of the uploaded cheque image (e.g. `cheques/<invoice_id>/<ts>.jpg`).
-- 2. Create a private `payment-proofs` storage bucket with a 5 MB file
--    size limit and a restricted list of image MIME types.
-- 3. Lock RLS on `storage.objects` for this bucket: neither anonymous
--    nor authenticated users can INSERT/SELECT directly. All access is
--    mediated by API routes using the service role key, which both
--    bypasses RLS and performs application-level ownership checks
--    (pattern used throughout the app — see `api/inspections/[iid]/photos`).
--
-- NOTE:
-- The photo is OPTIONAL. An upload failure must never block the payment
-- from being recorded (the JS layer catches upload errors and logs them).
-- =====================================================

BEGIN;

-- ============================================
-- 1. payments.cheque_photo_path column
-- ============================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cheque_photo_path TEXT NULL;

COMMENT ON COLUMN public.payments.cheque_photo_path IS
  'Chemin de stockage (bucket payment-proofs) de la photo du chèque physique. NULL si aucune photo attachée.';

-- ============================================
-- 2. Private storage bucket for payment proofs
-- ============================================
--
-- `public = false` → tout accès passe par des URLs signées générées côté
-- serveur après vérification d'autorisation. 5 MB limit aligné avec le
-- front (voir `ManualPaymentDialog.tsx`).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 3. RLS — no direct client access to this bucket
-- ============================================
--
-- Volontairement pas de policy permissive : tous les accès (upload,
-- download, delete) transitent par les routes API qui utilisent le
-- service_role client. Cela évite de devoir encoder l'owner dans le
-- path et centralise la vérification d'autorisation (lien facture → bail
-- → owner_id → profile).

DROP POLICY IF EXISTS "payment_proofs_block_anon" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_block_auth" ON storage.objects;

-- ============================================
-- 4. Reload PostgREST schema cache
-- ============================================

NOTIFY pgrst, 'reload schema';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415124844', 'add_cheque_photo_to_payments')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415124844_add_cheque_photo_to_payments.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql
-- Note: file on disk is 20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql but will be renamed to 20260415140001_fix_tenant_payment_signing_and_leases_recursion.sql
-- Risk: MODERE
-- Why: +1 policies, -2 policies
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql'; END $pre$;

-- =====================================================
-- Migration: Fix SOTA — tenant cash-receipt signature 500 + leases RLS recursion
-- Date: 2026-04-15
-- Branche: claude/fix-tenant-payment-signing-UuhJr
--
-- CONTEXTE — Deux bugs critiques côté tenant dashboard :
--
--   Bug #1 — POST /api/payments/cash-receipt/[id]/tenant-sign → 500
--     new row for relation "payments" violates check constraint
--     "payments_moyen_check"
--
--     ROOT CAUSE:
--       La RPC public.sign_cash_receipt_as_tenant (créée par
--       20260410220000, durcie par 20260415121706) insère dans public.payments
--       avec moyen = 'especes'. La migration 20241129000002_cash_payments.sql
--       était censée étendre le CHECK à ('cb', 'virement', 'prelevement',
--       'especes', 'cheque', 'autre') mais son bloc ALTER est wrappé dans
--       un `EXCEPTION WHEN others THEN NULL` → sur un environnement où le
--       ALTER a silencieusement échoué, le CHECK d'origine
--       ('cb', 'virement', 'prelevement') est resté en place. La migration
--       20260411120000_harden_payments_check_constraints.sql adresse le
--       problème mais ne garantit pas le reload du cache PostgREST sur tous
--       les runners PostgreSQL si elle a déjà été considérée appliquée.
--
--     FIX: Re-asserter le CHECK sans EXCEPTION catch-all, log explicite,
--     NOTIFY pgrst pour recharger le cache. Idempotent.
--
--   Bug #2 — useTenantRealtime → "infinite recursion detected in policy
--            for relation \"leases\"" (42P17)
--
--     ROOT CAUSE — Chaîne de récursion complète:
--       (1) Le tenant fait SELECT sur `leases` (hook useTenantRealtime,
--           lib/hooks/use-realtime-tenant.ts:215)
--       (2) Postgres évalue les policies sur leases. Parmi elles,
--           "Owners can view leases of own properties" (recréée par
--           20260410212232_fix_entity_members_policy_recursion.sql) fait:
--               EXISTS (SELECT 1 FROM properties p WHERE p.id =
--                 leases.property_id AND p.owner_id = user_profile_id())
--       (3) Le SELECT sur `properties` déclenche les policies de properties.
--           Parmi elles, "tenant_select_properties" (créée par
--           202502180002_fix_rls_conflicts_final.sql:53, JAMAIS DROPPÉE)
--           fait:
--               EXISTS (SELECT 1 FROM leases l
--                       JOIN lease_signers ls ON ls.lease_id = l.id
--                       WHERE l.property_id = properties.id
--                         AND ls.profile_id = user_profile_id()
--                         AND l.statut = 'active')
--       (4) Le SELECT sur `leases` de la sous-requête réexécute les policies
--           de leases → CYCLE → 42P17
--
--     NOTE:
--       La migration 20260410213940 a créé une policy équivalente
--       "Tenants can view linked properties" qui utilise
--       tenant_accessible_property_ids() en SECURITY DEFINER (donc pas de
--       récursion), MAIS n'a pas droppé "tenant_select_properties". Les
--       deux coexistent, et c'est la version non-SECURITY-DEFINER qui
--       casse le plan RLS.
--
--     Chaînes secondaires identiques via :
--       - tickets  → EXISTS(leases JOIN lease_signers) → leases → properties
--                    → tenant_select_properties → leases → BOUCLE
--       - charges  → idem
--       - units    → idem
--
--     FIX:
--       1. DROP "tenant_select_properties" (la SECURITY DEFINER cousine
--          "Tenants can view linked properties" couvre le même use case).
--       2. S'assurer que "Tenants can view linked properties" existe avec
--          le helper SECURITY DEFINER (idempotent — la migration 20260410213940
--          est supposée l'avoir créée, mais on garantit ici en defense-in-depth).
--       3. NOTIFY pgrst reload schema.
--
-- Conformité / sécurité:
--   - La policy SECURITY DEFINER est plus stricte : elle exige
--     l.statut NOT IN ('draft', 'cancelled') alors que tenant_select_properties
--     exigeait l.statut = 'active'. On élargit légèrement la visibilité
--     (pending_signature, fully_signed, notice_given, terminated) — conforme
--     à la décision produit de 20260215200000_fix_rls_properties_tenant_pre_active.sql.
-- =====================================================

BEGIN;

-- ============================================================
-- 1. Bug #1 — payments_moyen_check (defense-in-depth, pas d'EXCEPTION)
-- ============================================================
--
-- Whitelist canonique :
--   cb           Stripe carte bancaire (flow tenant)
--   virement     Virement manuel / Stripe SEPA
--   prelevement  SEPA Direct Debit
--   especes      Reçu espèces (signature en deux étapes)
--   cheque       Chèque papier (owner mark-paid)
--   autre        Fallback
--

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_moyen_check;

DO $$ BEGIN

  ALTER TABLE public.payments
  ADD CONSTRAINT payments_moyen_check
  CHECK (moyen IN ('cb', 'virement', 'prelevement', 'especes', 'cheque', 'autre'));

EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;

END $$;

-- On re-asserte aussi payments_statut_check dans la même passe : la
-- même migration 20260411120000 l'étend à 'cancelled'. Si elle n'est
-- pas appliquée, syncInvoiceStatusFromPayments échoue silencieusement
-- à chaque paiement manuel qui évince un PaymentIntent Stripe.
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_statut_check;

DO $$ BEGIN

  ALTER TABLE public.payments
  ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled'));

EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;

END $$;

-- ============================================================
-- 2. Bug #2 — Récursion RLS infinie sur leases
-- ============================================================

-- 2a. S'assurer que le helper SECURITY DEFINER est en place (idempotent)
--     Même définition que 20260415130000 — fait office de safety net si la
--     migration précédente n'a pas été déployée.
CREATE OR REPLACE FUNCTION public.tenant_accessible_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT l.property_id
  FROM public.leases l
  JOIN public.lease_signers ls ON ls.lease_id = l.id
  WHERE ls.profile_id = public.user_profile_id()
    AND l.statut NOT IN ('draft', 'cancelled');
$$;

REVOKE ALL ON FUNCTION public.tenant_accessible_property_ids() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tenant_accessible_property_ids()
  TO authenticated, service_role;

-- 2b. DROP la policy récursive redondante.
--     tenant_select_properties contient un EXISTS(SELECT FROM leases) inline
--     qui crée la boucle avec "Owners can view leases of own properties"
--     (qui fait EXISTS(SELECT FROM properties)).
DROP POLICY IF EXISTS "tenant_select_properties" ON public.properties;

-- 2c. Garantir l'existence de la policy SECURITY DEFINER équivalente.
--     Si la migration 20260410213940 a été appliquée, la policy existe déjà
--     avec cette signature → DROP+CREATE la recrée à l'identique.
DROP POLICY IF EXISTS "Tenants can view linked properties" ON public.properties;

CREATE POLICY "Tenants can view linked properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.tenant_accessible_property_ids()));

COMMENT ON POLICY "Tenants can view linked properties" ON public.properties IS
  'SOTA 2026 — Locataires peuvent voir les biens liés à leurs baux (hors '
  'draft/cancelled). Utilise tenant_accessible_property_ids() SECURITY '
  'DEFINER pour bypasser les RLS de leases/lease_signers et éviter la '
  'récursion infinie (42P17) via la chaîne leases→properties→leases.';

-- ============================================================
-- 3. Sanity check : aucune policy récursive résiduelle sur properties
-- ============================================================
DO $$
DECLARE
  v_remaining INT;
BEGIN
  -- Détecter toute policy sur properties dont le USING lit `leases` inline
  -- (signe d'une récursion latente qui réapparaîtrait au prochain query plan).
  SELECT count(*) INTO v_remaining
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'properties'
    AND (qual ILIKE '%FROM leases%' OR qual ILIKE '%JOIN leases%')
    -- Exclure les policies qui passent par le helper (pas de récursion)
    AND qual NOT ILIKE '%tenant_accessible_property_ids%';

  IF v_remaining > 0 THEN
    RAISE WARNING
      'ATTENTION: % policies RLS sur properties lisent encore `leases` inline — risque de récursion',
      v_remaining;
  ELSE
    RAISE NOTICE 'OK: aucune policy RLS sur properties ne lit `leases` inline';
  END IF;
END $$;

-- ============================================================
-- 4. Recharger le schema cache PostgREST
-- ============================================================
-- Nécessaire pour que les workers PostgREST existants re-lisent les
-- contraintes et policies sans redémarrage.

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

COMMIT;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260415140001', 'fix_tenant_payment_signing_and_leases_recursion')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260415140000_fix_tenant_payment_signing_and_leases_recursion.sql'; END $post$;

COMMIT;

-- END OF BATCH 14/15 (Phase 2 MODERE)
