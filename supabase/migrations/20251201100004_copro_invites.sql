-- =====================================================
-- MIGRATION: Invitations COPRO
-- Description: Système d'invitation des copropriétaires
-- =====================================================

-- =====================================================
-- TABLE: copro_invites
-- =====================================================
CREATE TABLE IF NOT EXISTS copro_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Token d'invitation
  token TEXT NOT NULL UNIQUE,
  
  -- Informations invité
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  
  -- Contexte
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES copro_units(id) ON DELETE SET NULL,
  
  -- Rôle cible
  target_role TEXT NOT NULL DEFAULT 'coproprietaire_occupant'
    CHECK (target_role IN (
      'syndic', 'conseil_syndical', 'president_cs',
      'coproprietaire_occupant', 'coproprietaire_bailleur',
      'coproprietaire_nu', 'usufruitier',
      'locataire', 'gardien', 'prestataire'
    )),
  
  -- Détails de propriété (si copropriétaire)
  ownership_type TEXT CHECK (ownership_type IN (
    'pleine_propriete', 'nue_propriete', 'usufruit', 'indivision', 'sci'
  )),
  ownership_share NUMERIC(5,4) DEFAULT 1.0,
  
  -- Personnalisation
  personal_message TEXT,
  
  -- Invitant
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- État
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'cancelled')),
  
  -- Dates
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  
  -- Relances
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_copro_invites_token ON copro_invites(token);
CREATE INDEX IF NOT EXISTS idx_copro_invites_email ON copro_invites(email);
CREATE INDEX IF NOT EXISTS idx_copro_invites_site ON copro_invites(site_id);
CREATE INDEX IF NOT EXISTS idx_copro_invites_status ON copro_invites(status);
CREATE INDEX IF NOT EXISTS idx_copro_invites_expires ON copro_invites(expires_at);

-- =====================================================
-- FUNCTION: Générer un token d'invitation
-- =====================================================
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TEXT AS $$
DECLARE
  new_token TEXT;
  exists_count INTEGER;
BEGIN
  LOOP
    -- Token lisible: 3 groupes de 4 caractères
    new_token := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 5 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 9 FOR 4)
    );
    SELECT COUNT(*) INTO exists_count FROM copro_invites WHERE token = new_token;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-générer le token
CREATE OR REPLACE FUNCTION trigger_generate_invite_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL THEN
    NEW.token := generate_invite_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_invite_token ON copro_invites;
CREATE TRIGGER trg_generate_invite_token
  BEFORE INSERT ON copro_invites
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_invite_token();

-- Trigger: Mettre à jour updated_at
DROP TRIGGER IF EXISTS trg_copro_invites_updated_at ON copro_invites;
CREATE TRIGGER trg_copro_invites_updated_at
  BEFORE UPDATE ON copro_invites
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =====================================================
-- FUNCTION: Valider une invitation
-- =====================================================
CREATE OR REPLACE FUNCTION validate_copro_invite(p_token TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  invite_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  site_id UUID,
  site_name TEXT,
  unit_id UUID,
  lot_number TEXT,
  target_role TEXT,
  ownership_type TEXT,
  ownership_share NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT ci.*, s.name as site_name, cu.lot_number
  INTO v_invite
  FROM copro_invites ci
  JOIN sites s ON s.id = ci.site_id
  LEFT JOIN copro_units cu ON cu.id = ci.unit_id
  WHERE ci.token = p_token;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
      NULL::UUID, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::TEXT, NULL::NUMERIC, 'Invitation introuvable'::TEXT;
    RETURN;
  END IF;
  
  IF v_invite.status = 'accepted' THEN
    RETURN QUERY SELECT 
      false, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
      v_invite.site_id, v_invite.site_name, v_invite.unit_id, v_invite.lot_number,
      v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
      'Invitation déjà utilisée'::TEXT;
    RETURN;
  END IF;
  
  IF v_invite.status = 'cancelled' THEN
    RETURN QUERY SELECT 
      false, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
      v_invite.site_id, v_invite.site_name, v_invite.unit_id, v_invite.lot_number,
      v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
      'Invitation annulée'::TEXT;
    RETURN;
  END IF;
  
  IF v_invite.expires_at < NOW() THEN
    -- Mettre à jour le statut
    UPDATE copro_invites SET status = 'expired', updated_at = NOW()
    WHERE id = v_invite.id;
    
    RETURN QUERY SELECT 
      false, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
      v_invite.site_id, v_invite.site_name, v_invite.unit_id, v_invite.lot_number,
      v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
      'Invitation expirée'::TEXT;
    RETURN;
  END IF;
  
  -- Invitation valide
  RETURN QUERY SELECT 
    true, v_invite.id, v_invite.email, v_invite.first_name, v_invite.last_name,
    v_invite.site_id, v_invite.site_name, v_invite.unit_id, v_invite.lot_number,
    v_invite.target_role, v_invite.ownership_type, v_invite.ownership_share,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Accepter une invitation
-- =====================================================
CREATE OR REPLACE FUNCTION accept_copro_invite(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  invite_id UUID,
  role_assigned TEXT,
  ownership_created BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_invite RECORD;
  v_profile_id UUID;
  v_role_id UUID;
  v_ownership_id UUID;
BEGIN
  -- Valider l'invitation
  SELECT * INTO v_invite
  FROM copro_invites
  WHERE token = p_token
    AND status IN ('pending', 'sent')
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, 'Invitation invalide ou expirée'::TEXT;
    RETURN;
  END IF;
  
  -- Récupérer le profile_id
  SELECT id INTO v_profile_id FROM profiles WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, v_invite.id, NULL::TEXT, false, 'Profil utilisateur non trouvé'::TEXT;
    RETURN;
  END IF;
  
  -- Attribuer le rôle
  INSERT INTO user_roles (user_id, role_code, site_id, unit_id, granted_by)
  VALUES (p_user_id, v_invite.target_role, v_invite.site_id, v_invite.unit_id, v_invite.invited_by)
  ON CONFLICT (user_id, role_code, site_id, unit_id) DO UPDATE
  SET is_active = true, revoked_at = NULL, updated_at = NOW()
  RETURNING id INTO v_role_id;
  
  -- Créer l'ownership si c'est un copropriétaire avec un lot
  IF v_invite.unit_id IS NOT NULL AND v_invite.target_role IN (
    'coproprietaire_occupant', 'coproprietaire_bailleur', 
    'coproprietaire_nu', 'usufruitier'
  ) THEN
    INSERT INTO ownerships (
      unit_id, profile_id, 
      ownership_type, ownership_share,
      is_current
    )
    VALUES (
      v_invite.unit_id, v_profile_id,
      COALESCE(v_invite.ownership_type, 'pleine_propriete'),
      COALESCE(v_invite.ownership_share, 1.0),
      true
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_ownership_id;
    
    -- Mettre à jour le mode d'occupation du lot
    IF v_invite.target_role = 'coproprietaire_occupant' THEN
      UPDATE copro_units SET occupation_mode = 'owner_occupied', updated_at = NOW()
      WHERE id = v_invite.unit_id;
    ELSIF v_invite.target_role = 'coproprietaire_bailleur' THEN
      UPDATE copro_units SET occupation_mode = 'rented', updated_at = NOW()
      WHERE id = v_invite.unit_id;
    END IF;
  END IF;
  
  -- Marquer l'invitation comme acceptée
  UPDATE copro_invites
  SET 
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = p_user_id,
    updated_at = NOW()
  WHERE id = v_invite.id;
  
  RETURN QUERY SELECT 
    true, 
    v_invite.id, 
    v_invite.target_role, 
    (v_ownership_id IS NOT NULL),
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RLS: copro_invites
-- =====================================================
ALTER TABLE copro_invites ENABLE ROW LEVEL SECURITY;

-- Lecture: syndic du site, invitant, ou invité
CREATE POLICY "copro_invites_select_policy" ON copro_invites
  FOR SELECT USING (
    is_syndic_of(site_id)
    OR invited_by = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR has_role('platform_admin')
  );

-- Insertion: syndic du site ou admin
CREATE POLICY "copro_invites_insert_policy" ON copro_invites
  FOR INSERT WITH CHECK (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- Modification: syndic du site ou admin
CREATE POLICY "copro_invites_update_policy" ON copro_invites
  FOR UPDATE USING (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- Suppression: syndic du site ou admin
CREATE POLICY "copro_invites_delete_policy" ON copro_invites
  FOR DELETE USING (
    is_syndic_of(site_id)
    OR has_role('platform_admin')
  );

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON copro_invites TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invite_token TO authenticated;
GRANT EXECUTE ON FUNCTION validate_copro_invite TO anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_copro_invite TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE copro_invites IS 'Invitations pour rejoindre une copropriété';
COMMENT ON COLUMN copro_invites.token IS 'Token unique d''invitation (ex: ABCD-EFGH-IJKL)';
COMMENT ON COLUMN copro_invites.target_role IS 'Rôle RBAC qui sera attribué à l''acceptation';

