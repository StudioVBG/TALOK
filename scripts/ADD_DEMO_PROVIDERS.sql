-- =====================================================
-- Script : Ajout de prestataires de démonstration
-- À exécuter dans la console SQL de Supabase
-- =====================================================

-- 1. Créer les comptes utilisateurs pour les prestataires
-- Note: Les mots de passe seront "Provider123!"

DO $$
DECLARE
  v_user_id_1 UUID;
  v_user_id_2 UUID;
  v_user_id_3 UUID;
  v_user_id_4 UUID;
  v_user_id_5 UUID;
  v_profile_id_1 UUID;
  v_profile_id_2 UUID;
  v_profile_id_3 UUID;
  v_profile_id_4 UUID;
  v_profile_id_5 UUID;
BEGIN
  -- Prestataire 1 : Plombier
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'demo.plombier@example.com',
    crypt('Provider123!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"prenom": "Jean", "nom": "Dupont"}',
    NOW(), NOW()
  ) RETURNING id INTO v_user_id_1;

  INSERT INTO profiles (id, user_id, role, prenom, nom, email, telephone)
  VALUES (gen_random_uuid(), v_user_id_1, 'provider', 'Jean', 'Dupont', 'demo.plombier@example.com', '0601020304')
  RETURNING id INTO v_profile_id_1;

  INSERT INTO provider_profiles (profile_id, type_services, status, kyc_status, disponibilite_urgence, tarif_min, tarif_max, zones_intervention)
  VALUES (v_profile_id_1, ARRAY['plomberie', 'chauffage'], 'approved', 'verified', true, 45, 85, 'Île-de-France');

  -- Prestataire 2 : Électricien
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'demo.electricien@example.com',
    crypt('Provider123!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"prenom": "Marie", "nom": "Martin"}',
    NOW(), NOW()
  ) RETURNING id INTO v_user_id_2;

  INSERT INTO profiles (id, user_id, role, prenom, nom, email, telephone)
  VALUES (gen_random_uuid(), v_user_id_2, 'provider', 'Marie', 'Martin', 'demo.electricien@example.com', '0611223344')
  RETURNING id INTO v_profile_id_2;

  INSERT INTO provider_profiles (profile_id, type_services, status, kyc_status, disponibilite_urgence, tarif_min, tarif_max, zones_intervention)
  VALUES (v_profile_id_2, ARRAY['electricite'], 'approved', 'verified', true, 50, 90, 'Paris et petite couronne');

  -- Prestataire 3 : Multi-services
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'demo.multiservices@example.com',
    crypt('Provider123!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"prenom": "Pierre", "nom": "Bernard"}',
    NOW(), NOW()
  ) RETURNING id INTO v_user_id_3;

  INSERT INTO profiles (id, user_id, role, prenom, nom, email, telephone)
  VALUES (gen_random_uuid(), v_user_id_3, 'provider', 'Pierre', 'Bernard', 'demo.multiservices@example.com', '0622334455')
  RETURNING id INTO v_profile_id_3;

  INSERT INTO provider_profiles (profile_id, type_services, status, kyc_status, disponibilite_urgence, tarif_min, tarif_max, zones_intervention)
  VALUES (v_profile_id_3, ARRAY['plomberie', 'electricite', 'serrurerie', 'autre'], 'approved', 'verified', false, 40, 70, 'France entière');

  -- Prestataire 4 : Serrurier
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'demo.serrurier@example.com',
    crypt('Provider123!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"prenom": "Lucas", "nom": "Petit"}',
    NOW(), NOW()
  ) RETURNING id INTO v_user_id_4;

  INSERT INTO profiles (id, user_id, role, prenom, nom, email, telephone)
  VALUES (gen_random_uuid(), v_user_id_4, 'provider', 'Lucas', 'Petit', 'demo.serrurier@example.com', '0633445566')
  RETURNING id INTO v_profile_id_4;

  INSERT INTO provider_profiles (profile_id, type_services, status, kyc_status, disponibilite_urgence, tarif_min, tarif_max, zones_intervention)
  VALUES (v_profile_id_4, ARRAY['serrurerie'], 'approved', 'pending', true, 60, 120, 'Paris');

  -- Prestataire 5 : Chauffagiste
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    'demo.chauffagiste@example.com',
    crypt('Provider123!', gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"prenom": "Sophie", "nom": "Leroy"}',
    NOW(), NOW()
  ) RETURNING id INTO v_user_id_5;

  INSERT INTO profiles (id, user_id, role, prenom, nom, email, telephone)
  VALUES (gen_random_uuid(), v_user_id_5, 'provider', 'Sophie', 'Leroy', 'demo.chauffagiste@example.com', '0644556677')
  RETURNING id INTO v_profile_id_5;

  INSERT INTO provider_profiles (profile_id, type_services, status, kyc_status, disponibilite_urgence, tarif_min, tarif_max, zones_intervention)
  VALUES (v_profile_id_5, ARRAY['chauffage'], 'approved', 'verified', false, 55, 95, 'Île-de-France');

  RAISE NOTICE '✅ 5 prestataires de démonstration créés avec succès !';
  RAISE NOTICE 'Emails: demo.plombier@example.com, demo.electricien@example.com, demo.multiservices@example.com, demo.serrurier@example.com, demo.chauffagiste@example.com';
  RAISE NOTICE 'Mot de passe: Provider123!';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erreur: %. Utilisation de la méthode alternative...', SQLERRM;
END $$;

-- =====================================================
-- MÉTHODE ALTERNATIVE (si le bloc ci-dessus échoue)
-- Créer les prestataires directement dans les tables
-- =====================================================

-- Si auth.users n'est pas accessible, créer uniquement les profils
-- Les prestataires pourront s'inscrire eux-mêmes ensuite

-- Vérifier si provider_profiles existe
DO $$
BEGIN
  -- Créer des profils provider sans user_id (ils devront être liés plus tard)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'demo.plombier@example.com') THEN
    
    -- Insérer directement dans profiles avec role = provider
    INSERT INTO profiles (id, role, prenom, nom, email, telephone)
    VALUES 
      (gen_random_uuid(), 'provider', 'Jean', 'Dupont', 'demo.plombier@example.com', '0601020304'),
      (gen_random_uuid(), 'provider', 'Marie', 'Martin', 'demo.electricien@example.com', '0611223344'),
      (gen_random_uuid(), 'provider', 'Pierre', 'Bernard', 'demo.multiservices@example.com', '0622334455'),
      (gen_random_uuid(), 'provider', 'Lucas', 'Petit', 'demo.serrurier@example.com', '0633445566'),
      (gen_random_uuid(), 'provider', 'Sophie', 'Leroy', 'demo.chauffagiste@example.com', '0644556677')
    ON CONFLICT (email) DO NOTHING;
    
    -- Créer les provider_profiles correspondants
    INSERT INTO provider_profiles (profile_id, type_services, status, kyc_status, disponibilite_urgence, tarif_min, tarif_max, zones_intervention)
    SELECT 
      p.id,
      CASE 
        WHEN p.email = 'demo.plombier@example.com' THEN ARRAY['plomberie', 'chauffage']
        WHEN p.email = 'demo.electricien@example.com' THEN ARRAY['electricite']
        WHEN p.email = 'demo.multiservices@example.com' THEN ARRAY['plomberie', 'electricite', 'serrurerie', 'autre']
        WHEN p.email = 'demo.serrurier@example.com' THEN ARRAY['serrurerie']
        WHEN p.email = 'demo.chauffagiste@example.com' THEN ARRAY['chauffage']
      END,
      'approved',
      'verified',
      CASE WHEN p.email IN ('demo.plombier@example.com', 'demo.electricien@example.com', 'demo.serrurier@example.com') THEN true ELSE false END,
      CASE 
        WHEN p.email = 'demo.plombier@example.com' THEN 45
        WHEN p.email = 'demo.electricien@example.com' THEN 50
        WHEN p.email = 'demo.multiservices@example.com' THEN 40
        WHEN p.email = 'demo.serrurier@example.com' THEN 60
        WHEN p.email = 'demo.chauffagiste@example.com' THEN 55
      END,
      CASE 
        WHEN p.email = 'demo.plombier@example.com' THEN 85
        WHEN p.email = 'demo.electricien@example.com' THEN 90
        WHEN p.email = 'demo.multiservices@example.com' THEN 70
        WHEN p.email = 'demo.serrurier@example.com' THEN 120
        WHEN p.email = 'demo.chauffagiste@example.com' THEN 95
      END,
      'France'
    FROM profiles p
    WHERE p.email LIKE 'demo.%@example.com'
    AND NOT EXISTS (SELECT 1 FROM provider_profiles pp WHERE pp.profile_id = p.id);
    
    RAISE NOTICE '✅ Profils prestataires créés via méthode alternative';
  ELSE
    RAISE NOTICE 'Les prestataires de démo existent déjà';
  END IF;
END $$;

-- =====================================================
-- Mettre à jour le ticket existant avec une catégorie
-- =====================================================

UPDATE tickets 
SET categorie = 'autre'
WHERE categorie IS NULL OR categorie = '';

-- Vérification
SELECT 
  'Prestataires approuvés' as type,
  COUNT(*) as count 
FROM provider_profiles 
WHERE status = 'approved';

